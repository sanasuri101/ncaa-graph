/**
 * api/ai.js — NCAA bracket AI chat using Vercel AI SDK + Groq
 *
 * Architecture:
 *   1. classifyIntent() — deterministic pattern match, no LLM  (api/data.js)
 *   2. preFetch()       — load relevant data, no LLM           (api/data.js)
 *   3. Known intents    — data in prompt, streamText() no tools, streams to client
 *   4. Dynamic          — streamText() with tools{} + maxSteps, streams to client
 *
 * Streaming protocol (SSE-like, custom):
 *   data: {"type":"thinking","text":"..."}   — thinking step label
 *   data: {"type":"text","text":"..."}        — text chunk
 *   data: {"type":"tool","text":"..."}        — tool call label
 *   data: {"type":"done"}                     — stream complete
 *   data: {"type":"error","text":"..."}       — error
 */

import { createGroq } from "@ai-sdk/groq";
import { streamText, tool } from "ai";
import { z } from "zod";

import {
  getData,
  normName,
  resolveTeam,
  classifyIntent,
  implGetTeamStats,
  implGetMatchup,
  implGetStandings,
  buildInjuryContext,
  preFetch,
  fmtTeam,
  ALIASES,
  REGIONS_ORDERED,
} from "./data.js";

// ── Sanitizer ──────────────────────────────────────────────────────────────────
function sanitize(text) {
  if (!text) return "";
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(
      /^(Note|Explanation|Reasoning|Disclaimer|Commentary|Reminder)[:\s].*/gim,
      "",
    )
    .replace(
      /^(I (have|will|am|did)|The response|As instructed|Following the|Per the|Based on the instructions?)[^\n]*/gim,
      "",
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Constants ──────────────────────────────────────────────────────────────────
const MODEL = "llama-3.3-70b-versatile";
const MAX_TOKENS = 4096;
const MAX_STEPS = 3;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ── SDK Tool definitions ───────────────────────────────────────────────────────
function buildTools() {
  return {
    get_team_stats: tool({
      description:
        "Get efficiency stats, form, roster and injury info for one or more teams.",
      parameters: z.object({
        team_names: z
          .array(z.string())
          .describe('Team names e.g. ["Duke", "Michigan"]'),
      }),
      execute: async ({ team_names }) => implGetTeamStats(team_names),
    }),
    get_matchup: tool({
      description:
        "Get head-to-head history, common opponents and transitive evidence between two teams.",
      parameters: z.object({
        team_a: z.string().describe("First team name"),
        team_b: z.string().describe("Second team name"),
      }),
      execute: async ({ team_a, team_b }) => implGetMatchup(team_a, team_b),
    }),
    get_standings: tool({
      description:
        'Get ranked list of alive teams. Use for "Final Four favorites", "best teams", "top efficiency" questions.',
      parameters: z.object({
        sort_by: z
          .enum(["adj_em", "barthag", "rank", "wins_vs_field", "seed"])
          .describe(
            "adj_em=efficiency (use for favorites), barthag=win prob, rank=T-rank, seed=seeding",
          ),
        region: z
          .enum(["East", "West", "South", "Midwest", "all"])
          .optional()
          .describe("Filter to a region or all for full field"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(25)
          .optional()
          .describe("Number of teams to return, default 16"),
      }),
      execute: async ({ sort_by, region, limit }) =>
        implGetStandings(sort_by, region, limit),
    }),
  };
}

// ── System prompt ──────────────────────────────────────────────────────────────
function buildSystemPrompt(userMsg, graph, torvik, form, injuryMap, prefetchedContext, intent) {
  const { aliveTeamIds, teamOdds } = getData();
  const aliveCount = aliveTeamIds?.size || 16;
  const round =
    aliveCount >= 16
      ? "Sweet 16"
      : aliveCount >= 8
        ? "Elite Eight"
        : aliveCount >= 4
          ? "Final Four"
          : "Championship";
  const season =
    graph?.meta?.season?.split("-")[1] ?? String(new Date().getFullYear());

  let scopeContext = "";
  if (!prefetchedContext) {
    const mNorm = normName(userMsg);
    const mentioned = graph.nodes
      .filter((n) => {
        const lbl = normName(n.label);
        const re = new RegExp(
          "\\b" + lbl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b",
        );
        return re.test(mNorm);
      })
      .slice(0, 6);

    if (mentioned.length) {
      scopeContext = mentioned
        .map((n) => fmtTeam(n, torvik, form, injuryMap, teamOdds))
        .join("\n\n");
      const scopeIds = new Set(mentioned.map((n) => n.id));
      const gameLines = graph.edges
        .filter((e) => {
          if (!scopeIds.has(e.from) && !scopeIds.has(e.to)) return false;
          const otherId = scopeIds.has(e.from) ? e.to : e.from;
          return (
            !aliveTeamIds?.size ||
            aliveTeamIds.has(String(otherId)) ||
            scopeIds.has(otherId)
          );
        })
        .slice(0, 15)
        .map(
          (e) =>
            `${graph.nodes.find((n) => n.id === e.from)?.label ?? e.from} beat ${graph.nodes.find((n) => n.id === e.to)?.label ?? e.to} ${e.label} on ${(e.date ?? "").slice(5, 10)}`,
        );
      if (gameLines.length)
        scopeContext += "\n\nRECENT RESULTS:\n" + gameLines.join("\n");
    } else {
      scopeContext =
        "ALIVE TEAMS BY EFFICIENCY:\n" + implGetStandings("adj_em", null, 16);
    }
  }

  let context = prefetchedContext || scopeContext;

  // Injury injection: always appended — never replaces efficiency context
  const isInjuryQuery =
    /injur\w*|\bhurt\b|out for|is.*playing\b|will.*play|questionable|brok\w*|break\w*|fractur\w*|sprain\w*|tweak\w*|hobbl\w*|limp\w*|missed.*game|miss.*game|game.?time|any injuries|injury news|injury update|\babsent\b|\babsence\b|\bsidelined?\b/i.test(
      userMsg,
    );
  if (isInjuryQuery) {
    const injCtx = buildInjuryContext();
    context += (context ? "\n\n" : "") + injCtx;
  }

  const intentType = intent?.type ?? "dynamic";
  const todayStr = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  });

  let p = `You are AI Scout, an expert NCAA basketball analyst. ${season} March Madness ${round}. ${aliveCount} teams remain. Today is ${todayStr}.\n`;
  p += `Only reference teams still alive. No eliminated teams.\n\n`;

  if (
    intentType === "matchup" ||
    intentType === "team_lookup" ||
    intentType === "multi_team"
  ) {
    p += `TASK: Deep matchup or team analysis.\n`;
    p += `- Lead with the AdjEM gap (1pt = 1pt per 100 possessions). State whether it is decisive (>10), meaningful (5-10), or a toss-up (<5).\n`;
    p += `- Barthag = neutral court win probability — state it explicitly.\n`;
    p += `- Compare AdjOE vs opponent AdjDE for offensive edge; AdjDE vs opponent AdjOE for defensive edge.\n`;
    p += `- Cite recent form, streaks, any injuries with their exact AdjEM penalty applied.\n`;
    p += `- If market odds diverge from Barthag by more than 8 points, explain the gap.\n`;
    p += `- Close with: who wins, exact win probability, and the single stat that decides it.\n`;
  } else if (intentType === "top_teams_all") {
    p += `TASK: Identify the Final Four and championship favorites. Write this as analytical prose, not a numbered stat list.\n`;
    p += `- For the top 4 contenders: state their path through the bracket, their dominant strength, and their one beatable weakness.\n`;
    p += `- Compare efficiency (AdjEM) vs market implied probability for each — call out any significant divergence.\n`;
    p += `- Name a dark horse or two that the bracket field is underestimating.\n`;
    p += `- Be direct: pick your Final Four and state your championship pick with a specific reason.\n`;
  } else if (intentType === "sleeper_all_regions") {
    p += `TASK: Find the best upset picks in the remaining bracket. Do not apply the same efficiency template to each game — tell the story of how each upset happens.\n`;
    p += `- For each upset pick: name the specific matchup, then explain the mechanism — what does the underdog do well that the favorite is vulnerable to?\n`;
    p += `- Look for: pace mismatches, defensive strengths vs offensive styles, injuries to the favorite, recent momentum shifts, market lines that overvalue seeds.\n`;
    p += `- Rank from most to least likely. Give each pick a realistic probability range.\n`;
    p += `- Do not just list AdjEM gaps — connect the numbers to how the game will actually be played.\n`;
  } else if (intentType === "market_analysis") {
    p += `TASK: Identify market mispricing among remaining bracket games.\n`;
    p += `- Only reference teams listed in the DATA section. Do not invent or reference eliminated teams.\n`;
    p += `- Find the top 2-3 biggest discrepancies between BPI win probability and DraftKings implied probability.\n`;
    p += `- For each: state exact gap in pp, explain what market is missing, give recommendation (value bet / fade / no edge).\n`;
    p += `- Keep each entry to 2-3 sentences. Stop after 3 picks. Do not trail off mid-sentence.\n`;
  } else if (intentType === "region_standings") {
    p += `TASK: Break down the ${intent?.region ?? "tournament"} region. Who advances and why?\n`;
    p += `- Rank the remaining teams by realistic championship probability, not just seed.\n`;
    p += `- For each: their most likely path, who they need to beat, and their biggest vulnerability.\n`;
    p += `- Call out any upset you see coming and why the higher seed is beatable.\n`;
  } else if (intentType === "unplayed_matchups") {
    p += `TASK: Analyze potential future matchups among the top remaining teams.\n`;
    p += `- Look at efficiency matchups, pace mismatches, and how styles clash.\n`;
    p += `- Project who advances from each region and what the Final Four looks like.\n`;
  } else {
    p += `Answer directly and specifically. Match the format to the question — if it's a comparison, compare; if it's a prediction, predict; if it's a list, list. No generic templates.\n`;
  }

  p += `\nCite exact numbers throughout. No hedging, no filler phrases, no "it's worth noting". Direct statements only.\n`;
  if (context) p += `\n\nDATA:\n${context}`;
  return p;
}

// ── Streaming response writer ──────────────────────────────────────────────────
function makeWriter(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    ...CORS,
  });
  return {
    thinking: (text) =>
      res.write(`data: ${JSON.stringify({ type: "thinking", text })}\n\n`),
    tool: (text) =>
      res.write(`data: ${JSON.stringify({ type: "tool", text })}\n\n`),
    text: (text) =>
      res.write(`data: ${JSON.stringify({ type: "text", text })}\n\n`),
    done: () => {
      res.write('data: {"type":"done"}\n\n');
      res.end();
    },
    error: (msg) => {
      res.write(`data: ${JSON.stringify({ type: "error", text: msg })}\n\n`);
      res.end();
    },
  };
}

// ── Handler ────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    res.end();
    return;
  }
  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { message: "Method not allowed" } }));
    return;
  }

  let body;
  try {
    const raw = await new Promise((resolve, reject) => {
      let d = "";
      req.on("data", (c) => {
        d += c;
      });
      req.on("end", () => resolve(d));
      req.on("error", reject);
    });
    body = JSON.parse(raw);
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { message: "Invalid JSON" } }));
    return;
  }

  if (!Array.isArray(body?.messages)) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { message: "Missing messages array" } }));
    return;
  }

  const groqKey = process.env.GROQ_KEY;
  if (!groqKey) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ error: { message: "Server configuration error" } }),
    );
    return;
  }

  const writer = makeWriter(res);

  try {
    const userMsg = body.userMsg || "";
    const { graph, torvik, form, injuryMap } = getData();

    const intent = classifyIntent(userMsg, graph);
    const prefetch = preFetch(intent, graph, torvik);

    for (const t of prefetch.thinking) writer.thinking(t);

    const system = buildSystemPrompt(
      userMsg,
      graph,
      torvik,
      form,
      injuryMap,
      prefetch.context,
      intent,
    );

    const BUDGET = 3000;
    const history = [];
    let used = 0;
    for (let i = body.messages.length - 1; i >= 0; i--) {
      const len = (body.messages[i].content ?? "").length;
      if (used + len > BUDGET) break;
      history.unshift(body.messages[i]);
      used += len;
    }

    const messages = [{ role: "system", content: system }, ...history];

    if (intent.type === "general") {
      const hasHistory = history.some(
        (m) => m.role === "assistant" && m.content?.length > 20,
      );
      if (hasHistory) {
        intent.type = "dynamic";
      } else {
        writer.text(
          `I'm focused on the ${new Date().getFullYear()} NCAA Tournament. Ask me about matchups, upset picks, team efficiency, Final Four predictions, or bracket strategy.`,
        );
        writer.done();
        return;
      }
    }

    if (intent.type !== "dynamic") {
      const groq = createGroq({ apiKey: groqKey });
      const result = streamText({
        model: groq(MODEL),
        messages,
        maxTokens: MAX_TOKENS,
      });
      for await (const chunk of result.textStream) {
        writer.text(chunk);
      }
      writer.done();
      return;
    }

    const groq = createGroq({ apiKey: groqKey });
    const tools = buildTools();

    const result = streamText({
      model: groq(MODEL),
      messages,
      maxTokens: MAX_TOKENS,
      tools,
      maxSteps: MAX_STEPS,
      onStepFinish: ({ toolCalls }) => {
        if (toolCalls) {
          for (const tc of toolCalls) {
            const label =
              tc.toolName === "get_team_stats"
                ? `Looking up ${(tc.args?.team_names ?? []).join(", ")}`
                : tc.toolName === "get_matchup"
                  ? `Analysing ${tc.args?.team_a} vs ${tc.args?.team_b}`
                  : `Checking standings${tc.args?.region && tc.args.region !== "all" ? " — " + tc.args.region : ""}`;
            writer.tool(label);
          }
        }
      },
    });

    for await (const chunk of result.textStream) {
      writer.text(chunk);
    }
    writer.done();
  } catch (err) {
    writer.error(err.message ?? "Internal server error");
  }
}
