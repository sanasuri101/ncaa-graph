/**
 * api/analyze.js — Agentic multi-agent matchup analysis using LangGraph.js
 *
 * Architecture:
 *   START
 *     └─► router — validates teams, initialises state (no data pre-loading)
 *           ├─► efficiency_agent  — calls tools to get what IT decides it needs
 *           ├─► form_agent        — calls tools to get what IT decides it needs
 *           ├─► matchup_agent     — calls tools to get what IT decides it needs
 *           └─► odds_agent        — calls tools to get what IT decides it needs
 *     └─► synthesis — calls tools to verify, dig deeper, then writes sections
 *   END
 *
 * Each agent uses Vercel AI SDK generateText() with tools + maxSteps:3.
 * Agents decide what data they need and fetch it via tool calls.
 * This is genuinely agentic — specialisation comes from the agent's goal,
 * not from what data was pre-injected.
 *
 * Request:  POST { team_a: string, team_b: string }
 * Response: { agents: AgentResult[], confidence: ConfidenceResult }
 */

import { readFileSync, statSync }                    from 'fs';
import { join }                                      from 'path';
import { Annotation, StateGraph, END, START, Send } from '@langchain/langgraph';
import { generateText, tool }                        from 'ai';
import { createGroq }                                from '@ai-sdk/groq';
import { z }                                         from 'zod';

// ── Sanitizer ─────────────────────────────────────────────────────────────────
function sanitizeLLMOutput(text) {
  if (!text) return '';
  let s = String(text).slice(0, 2000);
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, '');
  s = s.replace(/^(Note|Disclaimer|Reminder|Instructions?|System|Ignore previous|Return only|You must|Your (task|job|role)|RULES?|IMPORTANT)[:\s][^\n]*/gim, '');
  if (/^\s*\{[\s\n]*"/.test(s)) return '';
  s = s.replace(/```[\w]*\n?|```/g, '');
  s = s.replace(/\n{3,}/g, '\n\n').trim();
  return s || '';
}

function sanitizeTeamName(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .slice(0, 60)
    .replace(/[\n\r\t]/g, ' ')
    .replace(/[`"\\]/g, '')
    .replace(/\b(ignore|system|return|instructions?|json|you must|your (role|task))[\s\S]*/gi, '')
    .trim();
}

// ── Constants ─────────────────────────────────────────────────────────────────
const MODEL         = 'llama-3.3-70b-versatile';
const MAX_TOKENS    = 1024;
const MAX_TOKENS_SY = 2048;
const MAX_STEPS     = 4;   // max tool call rounds per agent
const FETCH_TIMEOUT = 25000;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ── Data loading ──────────────────────────────────────────────────────────────
let _cache      = null;
let _cacheMtime = 0;

function getAnalyzeCacheMtime() {
  const files = [
    'public/data/torvik_stats.json', 'public/data/recent_form.json',
    'public/data/espn_odds.json',    'data/injury_overrides.json',
    'data/roster_stats.json',        'data/injury_news.json',
  ];
  let latest = 0;
  for (const f of files) {
    try { const { mtimeMs } = statSync(join(process.cwd(), f)); if (mtimeMs > latest) latest = mtimeMs; } catch {}
  }
  return latest;
}

function getData() {
  const mtime = getAnalyzeCacheMtime();
  if (_cache && mtime === _cacheMtime) return _cache;

  const graph  = JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'graph_data.json'),  'utf8'));
  const torvik = JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'torvik_stats.json'), 'utf8'));
  const form   = JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'recent_form.json'),  'utf8'));

  let injuryMap = {};
  try {
    const raw = JSON.parse(readFileSync(join(process.cwd(), 'data', 'injury_overrides.json'), 'utf8'));
    for (const [id, ov] of Object.entries(raw.overrides ?? {})) {
      if ((ov.adj_em_penalty ?? 0) > 0)
        injuryMap[id] = { penalty: ov.adj_em_penalty, players: ov.players ?? [], notes: ov.notes ?? '' };
    }
  } catch {}

  const nodeByName = {};
  graph.nodes.forEach(n => {
    nodeByName[n.label.toLowerCase()]     = n;
    nodeByName[n.full_name.toLowerCase()] = n;
  });

  const edgesByNode = {};
  graph.edges.forEach(e => {
    (edgesByNode[e.from] = edgesByNode[e.from] || []).push(e);
    (edgesByNode[e.to]   = edgesByNode[e.to]   || []).push(e);
  });

  let transPairs = {};
  try { transPairs = JSON.parse(readFileSync(join(process.cwd(), 'data', 'transitive_analysis.json'), 'utf8')).pairs ?? {}; } catch {}

  let oddsData = { games: {}, futures: {} };
  try { oddsData = JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'espn_odds.json'), 'utf8')); } catch {}

  let injuryNews = {};
  try { injuryNews = JSON.parse(readFileSync(join(process.cwd(), 'data', 'injury_news.json'), 'utf8'))?.teams ?? {}; } catch {}

  let rosterStats = {};
  try { rosterStats = JSON.parse(readFileSync(join(process.cwd(), 'data', 'roster_stats.json'), 'utf8')).teams ?? {}; } catch {}

  _cache = { graph, torvik, form, injuryMap, transPairs, nodeByName, edgesByNode, oddsData, injuryNews, rosterStats };
  _cacheMtime = mtime;
  return _cache;
}

// ── Team resolution ───────────────────────────────────────────────────────────
function normalizeTeamName(s) {
  return s.toLowerCase().trim()
    .replace(/\bst\.\s*/g, 'saint ').replace(/\bst\s+/g, 'saint ')
    .replace(/\bft\.?\s+/g, 'fort ').replace(/[.'`]/g, '').replace(/\s+/g, ' ').trim();
}

const TEAM_ALIASES = {
  'unc': 'north carolina', 'uconn': 'uconn huskies', 'ucf': 'ucf knights',
  'ucla': 'ucla bruins',   'umbc': 'umbc retrievers', 'vcu': 'vcu rams',
  'tcu': 'tcu horned frogs', 'smu': 'smu mustangs',  'byu': 'byu cougars',
  'lsu': 'lsu tigers',     'liu': 'long island university', 'sam houston': 'sam houston bearkats',
  'isu': 'iowa state cyclones',     'iowa st': 'iowa state cyclones',
  'msu': 'michigan state spartans', 'mich st': 'michigan state spartans',
  'ku': 'kansas jayhawks',          'osu': 'ohio state buckeyes',
  'a&m': 'texas a&m aggies',        'tamu': 'texas a&m aggies',
  "st john's": 'saint johns red storm', 'sjr': 'saint johns red storm',
  'st johns': 'saint johns red storm',
};

function resolveTeam(name, nodeByName) {
  const raw      = name.toLowerCase().trim();
  const aliasKey = Object.keys(TEAM_ALIASES).find(k => raw === k || raw.startsWith(k + ' '));
  const queryStr = aliasKey ? TEAM_ALIASES[aliasKey] : normalizeTeamName(name);
  const normMap  = {};
  Object.keys(nodeByName).forEach(k => { normMap[normalizeTeamName(k)] = nodeByName[k]; });
  if (normMap[queryStr]) return normMap[queryStr];
  const candidates = Object.keys(normMap)
    .filter(k => k.includes(queryStr) || queryStr.includes(k))
    .sort((a, b) => (b.startsWith(queryStr) ? 1 : 0) - (a.startsWith(queryStr) ? 1 : 0) || b.length - a.length);
  return candidates.length ? normMap[candidates[0]] : null;
}

// ── Tool implementations (pure functions over cached data) ────────────────────

function implEfficiencyStats(teamName) {
  const { torvik, injuryMap, nodeByName } = getData();
  const node = resolveTeam(teamName, nodeByName);
  if (!node) return `Team not found: "${teamName}"`;
  const tv = torvik?.teams?.[node.id]?.torvik;
  if (!tv) return `No Torvik data for ${node.full_name}`;
  const inj = injuryMap?.[node.id];
  const injStr = inj
    ? `\n⚠ INJURY (AdjEM penalty -${inj.penalty}): ${inj.players.map(p => `${p.name} — ${p.status}`).join('; ')}${inj.notes ? ' | ' + inj.notes : ''}`
    : '';
  return [
    `${node.full_name} (${node.region} #${node.seed}, ${tv.conf})`,
    `T-Rank #${tv.rank} | AdjEM: ${tv.adj_em > 0 ? '+' : ''}${tv.adj_em} | AdjOE: ${tv.adj_oe} | AdjDE: ${tv.adj_de}`,
    `Barthag: ${(tv.barthag * 100).toFixed(1)}% (neutral court win prob) | WAB: ${parseFloat(tv.wab).toFixed(1)}`,
    `Shooting: eFG% ${tv.efg} | 2P% ${tv.two_p} | 3P% ${tv.three_p} | FT% ${tv.ft_pct}`,
    `Four Factors: TOV% ${tv.tov_rate} | ORB% ${tv.orb_rate} | FTR ${tv.ftr}`,
    `Opp: eFG% ${tv.opp_efg} | TOV% ${tv.opp_tov}`,
    `Pace: adj_tempo ${tv.adj_tempo?.toFixed(2)} | Luck: ${parseFloat(tv.luck ?? 0).toFixed(3)}`,
    `Record: ${tv.record} | SOS rank: ${tv.sos_rank?.toFixed(2) ?? '?'}`,
    injStr,
  ].filter(Boolean).join('\n');
}

function implRecentForm(teamName) {
  const { form, nodeByName } = getData();
  const node = resolveTeam(teamName, nodeByName);
  if (!node) return `Team not found: "${teamName}"`;
  const tf = form?.teams?.[node.id];
  if (!tf) return `No form data for ${node.full_name}`;
  const games = tf.games?.slice(-10) ?? [];
  const margins = games.map(g => {
    const [a, b] = (g.score ?? '0-0').split('-').map(Number);
    return g.won ? (a - b) : (b - a);
  });
  const avgMargin = margins.length ? (margins.reduce((s, m) => s + m, 0) / margins.length).toFixed(1) : '?';
  const last5     = games.slice(-5).map(g => `${g.won ? 'W' : 'L'} ${g.score} vs ${g.opp} (${g.date.slice(5)})`).join(' | ');
  return [
    `${node.full_name} recent form:`,
    `Last 10: ${tf.last10} | Streak: ${tf.streak}`,
    `Avg margin last 10: ${avgMargin > 0 ? '+' : ''}${avgMargin} pts`,
    `Last 5: ${last5}`,
  ].join('\n');
}

function implRoster(teamName) {
  const { rosterStats, nodeByName } = getData();
  const node = resolveTeam(teamName, nodeByName);
  if (!node) return `Team not found: "${teamName}"`;
  const players = rosterStats?.[String(node.id)]?.players ?? [];
  if (!players.length) return `No roster data for ${node.full_name}`;
  return `${node.full_name} roster (top by minutes):\n` + players.slice(0, 8).map((p, i) => {
    const inj = p.injured ? ` ⚠ ${p.injured}` : '';
    return `  ${i+1}. ${p.name} (${p.exp}, ${p.pos}, ${p.height})${inj}\n` +
           `     ${p.mpg} MPG | ${p.ppg}/${p.rpg}/${p.apg} pts/reb/ast | FG ${p.fg}% | 3P ${p.three_pct}% | PER ${p.per}`;
  }).join('\n');
}

function implInjuryNews(teamName) {
  const { injuryNews, injuryMap, nodeByName } = getData();
  const node = resolveTeam(teamName, nodeByName);
  if (!node) return `Team not found: "${teamName}"`;
  const news    = injuryNews?.[node.id]?.articles ?? [];
  const penalty = injuryMap?.[node.id];
  const lines   = [];
  if (penalty) lines.push(`Model injury penalty: AdjEM -${penalty.penalty} | Players: ${penalty.players.map(p => `${p.name} (${p.status})`).join(', ')}`);
  if (news.length) lines.push('Recent headlines:', ...news.slice(0, 4).map(n => `  • ${n.headline}`));
  return lines.length ? lines.join('\n') : `No injury data for ${node.full_name}`;
}

function implH2H(teamA, teamB) {
  const { graph, nodeByName, edgesByNode } = getData();
  const nodeA = resolveTeam(teamA, nodeByName);
  const nodeB = resolveTeam(teamB, nodeByName);
  if (!nodeA) return `Team not found: "${teamA}"`;
  if (!nodeB) return `Team not found: "${teamB}"`;
  const edges = edgesByNode[nodeA.id] ?? [];
  const h2h   = edges.filter(e =>
    (e.from === nodeA.id && e.to === nodeB.id) ||
    (e.from === nodeB.id && e.to === nodeA.id)
  );
  if (!h2h.length) return `No H2H games between ${nodeA.label} and ${nodeB.label} this season.`;
  return `H2H: ${nodeA.label} vs ${nodeB.label}:\n` + h2h.map(e => {
    const winner = e.from === nodeA.id ? nodeA.label : nodeB.label;
    return `  ${e.date}: ${winner} won ${e.label} by ${e.margin}`;
  }).join('\n');
}

function implCommonOpponents(teamA, teamB) {
  const { graph, nodeByName, edgesByNode } = getData();
  const nodeA = resolveTeam(teamA, nodeByName);
  const nodeB = resolveTeam(teamB, nodeByName);
  if (!nodeA) return `Team not found: "${teamA}"`;
  if (!nodeB) return `Team not found: "${teamB}"`;
  const aEdges = edgesByNode[nodeA.id] ?? [];
  const bEdges = edgesByNode[nodeB.id] ?? [];
  const aOpps  = new Set(aEdges.map(e => e.from === nodeA.id ? e.to : e.from));
  const bOpps  = new Set(bEdges.map(e => e.from === nodeB.id ? e.to : e.from));
  const common = [...aOpps].filter(id => bOpps.has(id)).slice(0, 8);
  if (!common.length) return 'No common opponents found.';
  return `Common opponents (${common.length}):\n` + common.map(cid => {
    const cNode = graph.nodes.find(n => n.id === cid);
    const aGame = aEdges.find(e => (e.from === nodeA.id && e.to === cid) || (e.to === nodeA.id && e.from === cid));
    const bGame = bEdges.find(e => (e.from === nodeB.id && e.to === cid) || (e.to === nodeB.id && e.from === cid));
    const aRes  = aGame ? (aGame.from === nodeA.id ? `W ${aGame.label}` : `L ${aGame.label}`) : '?';
    const bRes  = bGame ? (bGame.from === nodeB.id ? `W ${bGame.label}` : `L ${bGame.label}`) : '?';
    return `  vs ${cNode?.label ?? cid}: ${nodeA.label} ${aRes} | ${nodeB.label} ${bRes}`;
  }).join('\n');
}

function implTransitive(teamA, teamB) {
  const { transPairs, nodeByName } = getData();
  const nodeA = resolveTeam(teamA, nodeByName);
  const nodeB = resolveTeam(teamB, nodeByName);
  if (!nodeA) return `Team not found: "${teamA}"`;
  if (!nodeB) return `Team not found: "${teamB}"`;
  const key  = `${nodeA.id}_${nodeB.id}`;
  const keyR = `${nodeB.id}_${nodeA.id}`;
  const tp   = transPairs[key] || transPairs[keyR];
  if (!tp?.n) return 'No transitive evidence found.';
  const flipped = !!transPairs[keyR] && !transPairs[key];
  const favors  = tp.verdict === 'a' ? (flipped ? nodeB.label : nodeA.label)
                : tp.verdict === 'b' ? (flipped ? nodeA.label : nodeB.label) : 'neither';
  const chains  = [
    ...(tp.a || []).slice(0, 3).map(s => `  ${nodeA.label} beat ${s.common_name} (${s.a_score}), who beat ${nodeB.label} (${s.b_score})`),
    ...(tp.b || []).slice(0, 3).map(s => `  ${nodeB.label} beat ${s.common_name} (${s.b_score}), who beat ${nodeA.label} (${s.a_score})`),
  ];
  return `Transitive evidence (${tp.n} signals, conf ${tp.conf?.toFixed(0) ?? '?'}/100): favors ${favors}\n${chains.join('\n')}`;
}

function implOdds(teamA, teamB) {
  const { oddsData, nodeByName } = getData();
  const nodeA = resolveTeam(teamA, nodeByName);
  const nodeB = resolveTeam(teamB, nodeByName);
  if (!nodeA) return `Team not found: "${teamA}"`;
  if (!nodeB) return `Team not found: "${teamB}"`;
  const games = Object.values(oddsData?.games ?? {});
  const game  = games.find(g =>
    (g.home_id === nodeA.id && g.away_id === nodeB.id) ||
    (g.home_id === nodeB.id && g.away_id === nodeA.id)
  );
  if (!game) return 'No tournament game odds found for this matchup yet.';
  const isAHome = game.home_id === nodeA.id;
  const odds = game.odds, bpi = game.bpi;
  const lines = [];
  if (odds) {
    const aML  = isAHome ? odds.home_moneyline   : odds.away_moneyline;
    const bML  = isAHome ? odds.away_moneyline   : odds.home_moneyline;
    const aImp = isAHome ? odds.home_implied_pct : odds.away_implied_pct;
    const bImp = isAHome ? odds.away_implied_pct : odds.home_implied_pct;
    const openA = isAHome ? odds.open_home_ml : odds.open_away_ml;
    const mvmt  = odds.line_movement != null ? (isAHome ? odds.line_movement : -odds.line_movement) : null;
    lines.push(`DraftKings: Spread ${odds.spread >= 0 ? '+' : ''}${odds.spread} | O/U ${odds.over_under}`);
    lines.push(`${teamA} ML: ${aML} (${aImp}% implied) | ${teamB} ML: ${bML} (${bImp}% implied)`);
    if (openA != null) lines.push(`Opening ML ${teamA}: ${openA}${mvmt != null ? ` → ${mvmt > 0 ? '+' : ''}${mvmt.toFixed(1)}% shift (${mvmt > 2 ? 'sharp money on ' + teamA : mvmt < -2 ? 'sharp money on ' + teamB : 'no significant movement'})` : ''}`);
  }
  if (bpi) {
    const aBpi = isAHome ? bpi.home_bpi_win_pct : bpi.away_bpi_win_pct;
    const bBpi = isAHome ? bpi.away_bpi_win_pct : bpi.home_bpi_win_pct;
    lines.push(`ESPN BPI: ${teamA} ${aBpi}% | ${teamB} ${bBpi}% | margin ${bpi.bpi_pred_margin > 0 ? '+' : ''}${bpi.bpi_pred_margin} | quality ${bpi.matchup_quality}/100`);
  }
  const futA = oddsData?.futures?.[teamA.toLowerCase()];
  const futB = oddsData?.futures?.[teamB.toLowerCase()];
  if (futA?.markets || futB?.markets) {
    const fmtFut = (fut, name) => !fut?.markets ? '' :
      `${name}: ` + Object.entries(fut.markets).map(([k, v]) => `${k.replace(/_/g,' ')}: ${v.moneyline} (${v.implied_pct}%)`).join(' | ');
    if (futA) lines.push('Futures — ' + fmtFut(futA, teamA));
    if (futB) lines.push('Futures — ' + fmtFut(futB, teamB));
  }
  return lines.join('\n');
}

// ── Shared tool definitions (Zod schemas, used by all agents) ─────────────────
function buildAgentTools(teamA, teamB) {
  return {
    get_efficiency_stats: tool({
      description: 'Get Torvik efficiency metrics for a team: AdjEM, AdjOE, AdjDE, Barthag, eFG%, Four Factors, pace, injury penalties.',
      parameters: z.object({ team: z.string().describe(`Team name. Use "${teamA}" or "${teamB}"`) }),
      execute: async ({ team }) => implEfficiencyStats(team),
    }),
    get_recent_form: tool({
      description: 'Get last-10 record, current streak, and last 5 game results with scores and opponents.',
      parameters: z.object({ team: z.string().describe(`Team name. Use "${teamA}" or "${teamB}"`) }),
      execute: async ({ team }) => implRecentForm(team),
    }),
    get_roster: tool({
      description: 'Get top-8 players by minutes with full stat lines (PPG/RPG/APG/FG%/PER) and injury flags.',
      parameters: z.object({ team: z.string().describe(`Team name. Use "${teamA}" or "${teamB}"`) }),
      execute: async ({ team }) => implRoster(team),
    }),
    get_injury_news: tool({
      description: 'Get injury model penalties and recent injury headlines for a team.',
      parameters: z.object({ team: z.string().describe(`Team name. Use "${teamA}" or "${teamB}"`) }),
      execute: async ({ team }) => implInjuryNews(team),
    }),
    get_h2h: tool({
      description: 'Get head-to-head game results between the two teams this season.',
      parameters: z.object({
        team_a: z.string().describe(`First team. Use "${teamA}"`),
        team_b: z.string().describe(`Second team. Use "${teamB}"`),
      }),
      execute: async ({ team_a, team_b }) => implH2H(team_a, team_b),
    }),
    get_common_opponents: tool({
      description: 'Get common opponents both teams have faced this season with results for each.',
      parameters: z.object({
        team_a: z.string().describe(`First team. Use "${teamA}"`),
        team_b: z.string().describe(`Second team. Use "${teamB}"`),
      }),
      execute: async ({ team_a, team_b }) => implCommonOpponents(team_a, team_b),
    }),
    get_transitive: tool({
      description: 'Get precomputed transitive win chains (A beat X who beat B) showing indirect evidence.',
      parameters: z.object({
        team_a: z.string().describe(`First team. Use "${teamA}"`),
        team_b: z.string().describe(`Second team. Use "${teamB}"`),
      }),
      execute: async ({ team_a, team_b }) => implTransitive(team_a, team_b),
    }),
    get_odds: tool({
      description: 'Get DraftKings moneyline, spread, O/U, implied probabilities, line movement, ESPN BPI, and futures.',
      parameters: z.object({
        team_a: z.string().describe(`First team. Use "${teamA}"`),
        team_b: z.string().describe(`Second team. Use "${teamB}"`),
      }),
      execute: async ({ team_a, team_b }) => implOdds(team_a, team_b),
    }),
  };
}

// ── LangGraph State ───────────────────────────────────────────────────────────
const GraphState = Annotation.Root({
  team_a:        Annotation({ reducer: (_, b) => b }),
  team_b:        Annotation({ reducer: (_, b) => b }),
  agent_results: Annotation({ reducer: (a, b) => [...(a ?? []), ...(Array.isArray(b) ? b : [b])] }),
  confidence:    Annotation({ reducer: (_, b) => b }),
  error:         Annotation({ reducer: (_, b) => b }),
});

// ── Router — validates teams only, no data pre-loading ────────────────────────
function routerNode(state) {
  const { nodeByName } = getData();
  const nodeA = resolveTeam(state.team_a, nodeByName);
  const nodeB = resolveTeam(state.team_b, nodeByName);
  if (!nodeA || !nodeB)
    return { error: `Team not found: ${!nodeA ? state.team_a : state.team_b}` };
  return {};
}

function routerEdge(state) {
  if (state.error) return [END];
  return [
    new Send('efficiency_agent', state),
    new Send('form_agent',       state),
    new Send('matchup_agent',    state),
    new Send('odds_agent',       state),
  ];
}

// ── Agent factory — builds an agentic node with tool access ──────────────────
function makeAgent({ agentName, systemPrompt, maxTokens = MAX_TOKENS }) {
  return async function agentNode(state, config) {
    const groqKey = config.configurable?.groqKey;
    const groq    = createGroq({ apiKey: groqKey });
    const tools   = buildAgentTools(state.team_a, state.team_b);

    try {
      // Phase 1: tool-calling — agent fetches the data it decides it needs
      const toolResult = await generateText({
        model:     groq(MODEL),
        maxTokens,
        maxSteps:  MAX_STEPS,
        tools,
        toolChoice: 'auto',
        system:    systemPrompt,
        prompt:    `Fetch all data you need to assess this matchup: ${state.team_a} vs ${state.team_b}.\nCall the tools that are relevant to your role. You MUST call at least one tool.`,
      });

      // Collect all tool results across all steps
      const allSteps = await toolResult.steps;
      const toolData = allSteps
        .flatMap(step => step.toolResults ?? [])
        .map(tr => {
          // SDK wraps string output as {type:"text",value:"..."} or {type:"json",value:{...}}
          const raw = tr.output ?? tr.result ?? "";
          let txt = "";
          if (typeof raw === "string")             txt = raw;
          else if (raw?.type === "text")           txt = raw.value ?? "";
          else if (raw?.type === "json")           txt = JSON.stringify(raw.value ?? {});
          else if (raw?.value != null)             txt = String(raw.value);
          else                                      txt = JSON.stringify(raw);
          return `[${tr.toolName}]\n${txt}`;
        })
        .join('\n\n');

      if (!toolData) throw new Error('No tool data retrieved');

      // Phase 2: JSON generation — separate call with no tools, just the retrieved data
      const jsonResult = await generateText({
        model:     groq(MODEL),
        maxTokens: 512,
        system:    `You are a ${agentName} analyst. Return ONLY valid JSON. No markdown, no explanation, no text outside the JSON object.`,
        prompt:    `Based on this data:\n\n${toolData}\n\nReturn your assessment as JSON:\n{\n  "agent": "${agentName}",\n  "win_pct": <number 0-100 for ${state.team_a}>,\n  "confidence": "low|medium|high",\n  "key_edge": "<one specific stat advantage from the data>",\n  "reasoning": "<2-3 sentences citing exact numbers from the data above>"\n}`,
      });

      let result;
      try {
        const clean = jsonResult.text.replace(/```json|```/g, '').trim();
        const s = clean.indexOf('{'), e = clean.lastIndexOf('}');
        result = JSON.parse(s >= 0 && e > s ? clean.slice(s, e+1) : clean);
      } catch {
        result = {
          agent:      agentName,
          win_pct:    50,
          confidence: 'low',
          key_edge:   'parse error',
          reasoning:  sanitizeLLMOutput(toolData).slice(0, 300) || `${agentName} analysis incomplete`,
        };
      }

      if (result.reasoning) result.reasoning = sanitizeLLMOutput(result.reasoning);
      result.agent = agentName;
      return { agent_results: [result] };

    } catch (err) {
      console.error(`[${agentName}] error:`, err?.message ?? err);
      return { agent_results: [{ agent: agentName, win_pct: 50, confidence: 'low', key_edge: 'error', reasoning: err?.message ?? 'unknown error' }] };
    }
  };
}

// ── Four specialist agents ────────────────────────────────────────────────────

const efficiencyAgent = makeAgent({
  agentName:    'efficiency',
  systemPrompt: `You are an NCAA basketball efficiency analyst. Your job: assess matchup win probability using efficiency metrics.

WHAT TO DO:
1. Call get_efficiency_stats for BOTH teams — compare AdjEM, AdjOE, AdjDE, Barthag
2. Call get_roster for BOTH teams — look for injury flags (⚠) that affect efficiency
3. If you find injuries, call get_injury_news to quantify the impact
4. Compute the AdjEM gap. >10 pts = decisive, 5-10 = meaningful, <5 = toss-up
5. Barthag IS the neutral-court win probability — use it directly
6. Return your JSON assessment

Focus: efficiency numbers, four factors, injury-adjusted AdjEM. Ignore form and market.`,
});

const formAgent = makeAgent({
  agentName:    'form',
  systemPrompt: `You are an NCAA basketball momentum analyst. Your job: assess matchup win probability using recent form.

WHAT TO DO:
1. Call get_recent_form for BOTH teams — get last-10 record and streak
2. Call get_roster for BOTH teams — check for injured key players who affect recent results
3. Look for: teams on winning streaks, scoring margin trends, performance in last 5 games
4. A team that's 8-2 in last 10 and winning by 12+ is peaking. A 5-5 team with losses to ranked opponents is different from 5-5 against weak competition
5. Return your JSON assessment

Focus: momentum, recent scoring margins, streak quality. Ignore season-long efficiency.`,
});

const matchupAgent = makeAgent({
  agentName:    'matchup',
  systemPrompt: `You are an NCAA basketball matchup specialist. Your job: assess win probability using head-to-head history, common opponents, and stylistic matchup.

WHAT TO DO:
1. Call get_h2h — check for direct results between these teams
2. Call get_common_opponents — find teams both have played and compare results
3. Call get_transitive — get indirect evidence chains
4. Call get_efficiency_stats for BOTH teams — compare pace (adj_tempo). Pace mismatch matters: a fast team vs a slow team usually sees the faster team win the tempo battle
5. Return your JSON assessment

Focus: direct evidence, common opponents, transitive chains, pace mismatch. Weight H2H > common opponents > transitive.`,
});

const oddsAgent = makeAgent({
  agentName:    'odds',
  systemPrompt: `You are a sports betting market analyst. Your job: assess win probability using market data and ESPN BPI.

WHAT TO DO:
1. Call get_odds — get DraftKings ML, spread, implied probabilities, line movement, BPI
2. Call get_injury_news for BOTH teams — market may not have priced in recent injuries
3. If no odds data: return 50% confidence low
4. Market-implied probability aggregates all public information. BPI is an independent model
5. Line movement >3% = sharp money. Ignore movement <2%
6. If market and BPI agree within 5pp: high confidence. If they diverge >10pp: note the conflict
7. Return your JSON assessment

Focus: market signals, BPI, line movement, injury news not yet priced in. Do not use efficiency stats.`,
});

// ── Synthesis node ────────────────────────────────────────────────────────────
async function synthesisNode(state, config) {
  const groqKey = config.configurable?.groqKey;
  const results = state.agent_results ?? [];
  await new Promise(r => setTimeout(r, 500));

  const groq  = createGroq({ apiKey: groqKey });
  const tools = buildAgentTools(state.team_a, state.team_b);

  const get = (name) => results.find(r => r.agent === name) ?? { win_pct: 50, confidence: 'low', reasoning: '' };
  const eff = get('efficiency'), frm = get('form'), mtch = get('matchup'), odds = get('odds');

  const safePct = r => { const n = Number(r.win_pct); return isNaN(n) ? 50 : Math.max(1, Math.min(99, n)); };
  const oddsAvailable = !(odds.confidence === 'low' && (odds.key_edge === 'error' || odds.key_edge === 'no market data'));

  let weights = oddsAvailable
    ? { efficiency: 0.40, odds: 0.20, form: 0.20, matchup: 0.20 }
    : { efficiency: 0.50, odds: 0.00, form: 0.25, matchup: 0.25 };

  if (oddsAvailable) {
    const gap = Math.abs(safePct(eff) - safePct(odds));
    if (odds.confidence === 'high' && gap > 10)
      weights = { efficiency: 0.30, odds: 0.35, form: 0.20, matchup: 0.15 };
    else if (gap < 5)
      weights = { efficiency: 0.45, odds: 0.20, form: 0.20, matchup: 0.15 };
  }

  const weightedPct = Math.round(
    safePct(eff)  * weights.efficiency +
    safePct(odds) * weights.odds       +
    safePct(frm)  * weights.form       +
    safePct(mtch) * weights.matchup
  );

  const pcts    = oddsAvailable ? [safePct(eff), safePct(frm), safePct(mtch), safePct(odds)] : [safePct(eff), safePct(frm), safePct(mtch)];
  const spread  = Math.max(...pcts) - Math.min(...pcts);
  const half    = Math.round(spread / 2 + 3);
  const rangeLow  = Math.max(1,  weightedPct - half);
  const rangeHigh = Math.min(99, weightedPct + half);

  const agentSummary = results.map(r =>
    `${r.agent.toUpperCase()}: ${r.win_pct}% for ${state.team_a} (${r.confidence})\nEdge: ${r.key_edge}\n${r.reasoning}`
  ).join('\n\n');

  const weightDesc = oddsAvailable
    ? `Efficiency ${Math.round(weights.efficiency*100)}%, Market/BPI ${Math.round(weights.odds*100)}%, Form ${Math.round(weights.form*100)}%, Matchup ${Math.round(weights.matchup*100)}%`
    : 'Efficiency 50%, Form 25%, Matchup 25% (no market data)';

  const synthSystem = `You are a senior NCAA tournament analyst. Write like The Athletic: deep, specific, opinionated.
You have access to tools. Use them to verify specific claims from the agent reports or dig deeper on anything that needs more detail.
You MUST respond with valid JSON only. No markdown fences, no text outside the JSON.
Schema:
{
  "injury_note": "<If ANY player has ⚠ in data: 2-3 sentences on injury, player stats, direct matchup impact. Empty string if none.>",
  "decisive_factor": "<4-6 sentences. The single biggest structural reason one team wins. Cite exact numbers, explain the causal chain, connect to how the game is played.>",
  "key_matchup": "<4-5 sentences. Player vs player battle that decides it. Name both with full stat lines — PPG/RPG/APG/FG%/height/weight. Explain the physical and stylistic mismatch.>",
  "x_factors": "<3-4 sentences. Two or three specific underweighted factors. Cite numbers: TOV%, pace mismatch, rebounding margin, bench depth, Four Factors edges.>",
  "risk": "<3-4 sentences. Specific scenario where the favorite loses. Name players, game situation, exact vulnerability. Make it concrete.>",
  "market_vs_model": "<2-3 sentences. Compare weighted model vs DraftKings implied vs BPI. If diverge >6pp explain the gap. If aligned note the consensus.>",
  "bottom_line": "<2-3 sentences. Who wins, why, final score. Name the player who seals it.>"
}`;

  const synthPrompt = `Synthesize a deep expert matchup analysis for ${state.team_a} vs ${state.team_b}.

AGENT REPORTS:
${agentSummary}

WEIGHTED WIN PROBABILITY for ${state.team_a}: ${weightedPct}% (range: ${rangeLow}-${rangeHigh}%)
Weights: ${weightDesc}
Agent spread: ${spread.toFixed(0)} pts (${spread < 10 ? 'strong consensus' : spread < 20 ? 'moderate agreement' : 'significant disagreement'})

Use your tools to verify specific claims or fetch any detail you need for depth. Then return the JSON analysis.
Rules:
- Cite specific player names and stats in every section
- Cite at least one efficiency number (AdjEM, AdjOE, AdjDE, eFG%, Barthag) per section
- injury_note: if any agent mentioned ⚠ or injury, verify with get_injury_news and be specific
- bottom_line: must include a specific score like "Michigan wins 82-71" and name who seals it
- Write like you are being paid to be right
Return ONLY the JSON object. No backticks. No preamble.`;

  try {
    // Phase 1: synthesis agent fetches any additional data it needs
    const synthToolResult = await generateText({
      model:      groq(MODEL),
      maxTokens:  1024,
      maxSteps:   MAX_STEPS,
      tools,
      toolChoice: 'auto',
      system:     synthSystem,
      prompt:     `Review the agent reports and fetch any additional data you need to write a deep analysis of ${state.team_a} vs ${state.team_b}. Focus on verifying key claims and getting roster/injury details.\n\n${synthPrompt}`,
    });

    const synthSteps = await synthToolResult.steps;
    const synthToolData = synthSteps
      .flatMap(step => step.toolResults ?? [])
      .map(tr => {
          // SDK wraps string output as {type:"text",value:"..."} or {type:"json",value:{...}}
          const raw = tr.output ?? tr.result ?? "";
          let txt = "";
          if (typeof raw === "string")             txt = raw;
          else if (raw?.type === "text")           txt = raw.value ?? "";
          else if (raw?.type === "json")           txt = JSON.stringify(raw.value ?? {});
          else if (raw?.value != null)             txt = String(raw.value);
          else                                      txt = JSON.stringify(raw);
          return `[${tr.toolName}]\n${txt}`;
        })
      .join('\n\n');

    // Phase 2: write the full JSON analysis with all data in context
    const { text } = await generateText({
      model:     groq(MODEL),
      maxTokens: MAX_TOKENS_SY,
      system:    synthSystem,
      prompt:    `${synthPrompt}\n\nADDITIONAL DATA YOU FETCHED:\n${synthToolData || 'None'}`,
    });

    let clean = text.replace(/```json|```/g, '').trim();
    const s = clean.indexOf('{'), e = clean.lastIndexOf('}');
    if (s > 0 && e > s) clean = clean.slice(s, e + 1);

    const KEYS = ['injury_note','decisive_factor','key_matchup','x_factors','risk','market_vs_model','bottom_line'];
    let sections = {};

    try {
      const parsed = JSON.parse(clean);
      const df = parsed.decisive_factor;
      if (df && typeof df === 'object') sections = df.decisive_factor ? df : parsed;
      else if (typeof df === 'string' && df.trim().startsWith('{')) {
        try { const inner = JSON.parse(df); sections = inner.decisive_factor ? inner : parsed; } catch { sections = parsed; }
      } else sections = parsed;
      const filled = KEYS.filter(k => typeof sections[k] === 'string' && sections[k].length > 10);
      if (filled.length < 3) throw new Error('insufficient content');
    } catch {
      const fb = sanitizeLLMOutput(clean) || results.map(r => r.reasoning).filter(Boolean).join(' ');
      const paras = fb.split('\n\n').filter(Boolean);
      sections = { decisive_factor: paras[0] ?? fb, key_matchup: paras[1] ?? '', x_factors: paras[2] ?? '', risk: paras[3] ?? '', market_vs_model: paras[4] ?? '', bottom_line: paras[paras.length-1] ?? '', injury_note: '' };
    }

    const san = s => s ? sanitizeLLMOutput(String(s)) : '';

    const reasoningParts = ['decisive_factor','key_matchup','risk','market_vs_model','bottom_line']
      .map(k => san(sections[k])).filter(s => s.length > 10);
    const reasoning = reasoningParts.join('\n\n') ||
      `${state.team_a} vs ${state.team_b}: model weighted probability ${weightedPct}% for ${state.team_a}.`;

    return {
      confidence: {
        team_a: state.team_a, team_b: state.team_b,
        win_pct: weightedPct, range_low: rangeLow, range_high: rangeHigh,
        agent_spread: Math.round(spread),
        consensus: spread < 10 ? 'strong' : spread < 20 ? 'moderate' : 'split',
        weights, reasoning,
        sections: {
          injury_note:     san(sections.injury_note     ?? ''),
          decisive_factor: san(sections.decisive_factor ?? ''),
          key_matchup:     san(sections.key_matchup     ?? ''),
          x_factors:       san(sections.x_factors       ?? ''),
          risk:            san(sections.risk             ?? ''),
          market_vs_model: san(sections.market_vs_model ?? ''),
          bottom_line:     san(sections.bottom_line      ?? ''),
        },
        agent_breakdown: results.map(r => ({ agent: r.agent, win_pct: r.win_pct, confidence: r.confidence, key_edge: r.key_edge })),
      },
    };
  } catch (err) {
    return { confidence: { error: err.message } };
  }
}

// ── Build graph ───────────────────────────────────────────────────────────────
function buildGraph() {
  const workflow = new StateGraph(GraphState)
    .addNode('router',           routerNode)
    .addNode('efficiency_agent', efficiencyAgent)
    .addNode('form_agent',       formAgent)
    .addNode('matchup_agent',    matchupAgent)
    .addNode('odds_agent',       oddsAgent)
    .addNode('synthesis',        synthesisNode);

  workflow.addConditionalEdges('router', routerEdge);
  workflow.addEdge('efficiency_agent', 'synthesis');
  workflow.addEdge('form_agent',       'synthesis');
  workflow.addEdge('matchup_agent',    'synthesis');
  workflow.addEdge('odds_agent',       'synthesis');
  workflow.addEdge('synthesis',        END);
  workflow.addEdge(START, 'router');

  return workflow.compile();
}

const graph = buildGraph();

// ── Vercel handler ────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return; }
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json', ...CORS });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  let body;
  try {
    const raw = await new Promise((resolve, reject) => {
      let d = ''; req.on('data', c => { d += c; }); req.on('end', () => resolve(d)); req.on('error', reject);
    });
    body = JSON.parse(raw);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json', ...CORS });
    res.end(JSON.stringify({ error: 'Invalid JSON' }));
    return;
  }

  const rawA = body.team_a, rawB = body.team_b;
  if (!rawA || !rawB) {
    res.writeHead(400, { 'Content-Type': 'application/json', ...CORS });
    res.end(JSON.stringify({ error: 'team_a and team_b required' }));
    return;
  }
  if (typeof rawA !== 'string' || typeof rawB !== 'string' || rawA.length > 200 || rawB.length > 200) {
    res.writeHead(400, { 'Content-Type': 'application/json', ...CORS });
    res.end(JSON.stringify({ error: 'Invalid team names' }));
    return;
  }

  const team_a = sanitizeTeamName(rawA);
  const team_b = sanitizeTeamName(rawB);
  if (!team_a || !team_b) {
    res.writeHead(400, { 'Content-Type': 'application/json', ...CORS });
    res.end(JSON.stringify({ error: 'Invalid team names after sanitization' }));
    return;
  }

  const groqKey = process.env.GROQ_KEY;
  if (!groqKey) {
    res.writeHead(500, { 'Content-Type': 'application/json', ...CORS });
    res.end(JSON.stringify({ error: 'Server configuration error' }));
    return;
  }

  try {
    const result = await graph.invoke(
      { team_a, team_b, agent_results: [] },
      { configurable: { groqKey } }
    );

    if (result.error) {
      res.writeHead(400, { 'Content-Type': 'application/json', ...CORS });
      res.end(JSON.stringify({ error: result.error }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json', ...CORS });
    res.end(JSON.stringify({
      agents:     result.agent_results ?? [],
      confidence: result.confidence ?? {},
      odds_data:  null,
    }));
  } catch (err) {
    console.error('[analyze] handler error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json', ...CORS });
    res.end(JSON.stringify({ error: err.message ?? 'Internal server error' }));
  }
}
