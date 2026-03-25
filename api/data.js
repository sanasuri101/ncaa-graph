/**
 * api/data.js — Pure data logic: file loading, team resolution, tool implementations.
 * No external AI/LLM dependencies — safe to import in tests.
 * api/ai.js imports everything from here; only the handler/streaming lives there.
 */

import { readFileSync, statSync } from "fs";
import { join } from "path";

// ── File helpers ───────────────────────────────────────────────────────────────
export function readJSON(name) {
  return JSON.parse(
    readFileSync(join(process.cwd(), "public", "data", name), "utf8"),
  );
}

export function readDataJSON(name) {
  return JSON.parse(readFileSync(join(process.cwd(), "data", name), "utf8"));
}

// ── Cache ──────────────────────────────────────────────────────────────────────
let _cache = null;
let _cacheMtime = 0;

function getCacheMtime() {
  const files = [
    "public/data/graph_data.json",
    "public/data/torvik_stats.json",
    "public/data/recent_form.json",
    "public/data/espn_odds.json",
    "data/all_games.json",
    "data/injury_overrides.json",
  ];
  let latest = 0;
  for (const f of files) {
    try {
      const { mtimeMs } = statSync(join(process.cwd(), f));
      if (mtimeMs > latest) latest = mtimeMs;
    } catch {}
  }
  return latest;
}

export function getData() {
  const mtime = getCacheMtime();
  if (_cache && mtime === _cacheMtime) return _cache;

  const graph = readJSON("graph_data.json");
  const torvik = readJSON("torvik_stats.json");
  const form = readJSON("recent_form.json");

  let oddsData = { games: {}, futures: {} };
  try {
    oddsData = readJSON("espn_odds.json");
  } catch {}

  let transPairs = {};
  try {
    transPairs = readJSON("transitive_analysis.json")?.pairs ?? {};
  } catch {}

  let injuryMap = {};
  try {
    const raw = readDataJSON("injury_overrides.json");
    for (const [id, ov] of Object.entries(raw.overrides ?? {})) {
      if ((ov.adj_em_penalty ?? 0) > 0)
        injuryMap[id] = {
          penalty: ov.adj_em_penalty,
          players: ov.players ?? [],
          notes: ov.notes ?? "",
        };
    }
  } catch {}

  const nodeByName = {};
  graph.nodes.forEach((n) => {
    nodeByName[n.label.toLowerCase()] = n;
    nodeByName[n.full_name.toLowerCase()] = n;
  });

  const edgesByNode = {};
  graph.edges.forEach((e) => {
    (edgesByNode[e.from] = edgesByNode[e.from] || []).push(e);
    (edgesByNode[e.to] = edgesByNode[e.to] || []).push(e);
  });

  // Alive teams from tournament results
  const aliveTeamIds = new Set();
  try {
    const bracketIds = new Set(graph.nodes.map((n) => String(n.id)));
    const winners = new Set(),
      losers = new Set();
    JSON.parse(
      readFileSync(join(process.cwd(), "data", "all_games.json"), "utf8"),
    )
      .filter((g) => {
        const meta = graph?.meta;
        const startDate =
          meta?.tourney_start ??
          (() => {
            const yr = new Date().getFullYear();
            const d = new Date(yr, 2, 1);
            let thursdays = 0;
            while (d.getMonth() === 2) {
              if (d.getDay() === 4) thursdays++;
              if (thursdays === 3) break;
              d.setDate(d.getDate() + 1);
            }
            return d.toISOString().slice(0, 10);
          })();
        return g.date >= startDate;
      })
      .forEach((g) => {
        const t1 = String(g.team1_id),
          t2 = String(g.team2_id);
        if (!bracketIds.has(t1) && !bracketIds.has(t2)) return;
        (g.team1_winner ? winners : losers).add(t1);
        (g.team1_winner ? losers : winners).add(t2);
      });
    for (const id of winners) if (!losers.has(id)) aliveTeamIds.add(id);
  } catch {}

  // Market odds per team
  const teamOdds = {};
  for (const g of Object.values(oddsData.games ?? {})) {
    if (!g.completed) {
      if (g.home_id)
        teamOdds[g.home_id] = {
          game: g.name,
          ml: g.odds?.home_moneyline,
          implied: g.odds?.home_implied_pct,
          bpi: g.bpi?.home_bpi_win_pct,
        };
      if (g.away_id)
        teamOdds[g.away_id] = {
          game: g.name,
          ml: g.odds?.away_moneyline,
          implied: g.odds?.away_implied_pct,
          bpi: g.bpi?.away_bpi_win_pct,
        };
    }
  }

  _cache = {
    graph,
    torvik,
    form,
    transPairs,
    injuryMap,
    nodeByName,
    edgesByNode,
    aliveTeamIds,
    oddsData,
    teamOdds,
  };
  _cacheMtime = mtime;
  return _cache;
}

// ── Name normalization ─────────────────────────────────────────────────────────
export const ALIASES = {
  unc: "north carolina",
  uconn: "uconn huskies",
  ucf: "ucf knights",
  ucla: "ucla bruins",
  umbc: "umbc retrievers",
  vcu: "vcu rams",
  tcu: "tcu horned frogs",
  smu: "smu mustangs",
  byu: "byu cougars",
  lsu: "lsu tigers",
  liu: "long island university",
  isu: "iowa state cyclones",
  "iowa st": "iowa state cyclones",
  msu: "michigan st",
  "mich st": "michigan st",
  "michigan state": "michigan st",
  ku: "kansas jayhawks",
  osu: "ohio state buckeyes",
  fsu: "florida state seminoles",
  wvu: "west virginia mountaineers",
  "a&m": "texas a&m aggies",
  tamu: "texas a&m aggies",
  pitt: "pittsburgh panthers",
  "st john's": "saint johns red storm",
  sjr: "saint johns red storm",
  "st johns": "saint johns red storm",
  "saint johns": "saint johns red storm",
  // Mascot/nickname aliases (only for unambiguous nicknames)
  wolverines: "michigan",
  cyclones: "iowa state cyclones",
  "blue devils": "duke",
  "tar heels": "north carolina",
  jayhawks: "kansas jayhawks",
  longhorns: "texas longhorns",
  razorbacks: "arkansas razorbacks",
  volunteers: "tennessee volunteers",
  hoosiers: "indiana hoosiers",
};

export function normName(s) {
  return s
    .toLowerCase()
    .trim()
    .replace(/'s\b/g, "")
    .replace(/\bst\.\s*/g, "saint ")
    .replace(/\bst\s+/g, "saint ")
    .replace(/\bft\.?\s+/g, "fort ")
    .replace(/[.'`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveTeam(name, nodeByName) {
  const raw = name.toLowerCase().trim();
  const query = normName(ALIASES[raw] ?? name);
  const norm = {};
  Object.keys(nodeByName).forEach((k) => {
    norm[normName(k)] = nodeByName[k];
  });
  if (norm[query]) return norm[query];
  // Suffixes that indicate a distinct team name, not just a modifier
  const STATE_DISAMBIGUATORS =
    /^(state|tech|a&m|university|college|christian|pacific|western|eastern|northern|southern|central|international|national|polytechnic)\b/;

  const hits = Object.keys(norm)
    .filter((k) => {
      if (k === query) return true;
      if (k.startsWith(query + " ") || k.startsWith(query + "-")) return true;
      if (query.startsWith(k + " ") || query.startsWith(k + "-")) {
        // Reject "michigan state" → "michigan" false positive:
        // if the suffix after k is a standalone state/school disambiguator, it's a different team.
        const suffix = query.slice(k.length + 1);
        if (STATE_DISAMBIGUATORS.test(suffix)) return false;
        return true;
      }
      const words = k.split(" ");
      if (words.length > 1 && words[words.length - 1] === query) return true;
      return false;
    })
    .sort((a, b) => {
      const ae = a === query ? 2 : a.startsWith(query) ? 1 : 0;
      const be = b === query ? 2 : b.startsWith(query) ? 1 : 0;
      return be - ae || b.length - a.length;
    });
  return hits.length ? norm[hits[0]] : null;
}

// ── Format team block ──────────────────────────────────────────────────────────
export function fmtTeam(node, torvik, form, injuryMap, teamOdds) {
  const { aliveTeamIds } = getData();
  if (aliveTeamIds?.size && !aliveTeamIds.has(String(node.id)))
    return `${node.full_name} — ELIMINATED (no longer in ${new Date().getFullYear()} NCAA Tournament)`;

  const tv = torvik?.teams?.[node.id]?.torvik;
  const seed = node.seed != null ? `#${node.seed}` : "?";
  if (!tv) return `${node.full_name} (${node.region} ${seed}) | no Torvik data`;

  const pace =
    tv.adj_tempo != null
      ? (tv.adj_tempo >= 0.7
          ? "Fast"
          : tv.adj_tempo >= 0.4
            ? "Moderate"
            : "Slow") + ` (${tv.adj_tempo.toFixed(2)})`
      : "?";
  const tf = form?.teams?.[node.id];
  const recent =
    tf?.games
      ?.slice(-3)
      .map(
        (g) =>
          `${g.date.slice(5)}: ${g.won ? "W" : "L"} ${g.score} vs ${g.opp}`,
      )
      .join(" | ") ?? "";
  const inj = injuryMap?.[node.id];
  const injStr = inj
    ? `⚠ INJURY (AdjEM -${inj.penalty}): ${inj.players.map((p) => `${p.name} — ${p.status}`).join("; ")}${inj.notes ? " | " + inj.notes : ""}`
    : "";
  const odds = teamOdds?.[node.id];
  const oddsStr = odds
    ? `Market: ML ${odds.ml ?? "?"} (${odds.implied ?? "?"}% implied) | BPI: ${odds.bpi ?? "?"}% | ${odds.game}`
    : "";

  const ff4off = `eFG%: ${tv.efg ?? "?"} | TOV%: ${tv.tov_rate ?? "?"} | ORB%: ${tv.orb_rate ?? "?"} | FTR: ${tv.ftr ?? "?"}`;
  const ff4def =
    tv.efg_d != null ? `Opp eFG%: ${(tv.efg_d * 100).toFixed(1)}` : "";

  const resume = [
    tv.quad1_record ? `Quad1: ${tv.quad1_record}` : "",
    tv.net_rank ? `NET: #${tv.net_rank}` : "",
    tv.sos_rank ? `SOS: ${tv.sos_rank.toFixed(2)}` : "",
    tv.luck != null
      ? `Luck: ${tv.luck > 0 ? "+" : ""}${parseFloat(tv.luck).toFixed(3)}`
      : "",
  ]
    .filter(Boolean)
    .join(" | ");

  const advanced = [
    tv.proj_barthag
      ? `Proj Barthag: ${(tv.proj_barthag * 100).toFixed(1)}%`
      : "",
    tv.three_pa_rate ? `3PA rate: ${tv.three_pa_rate}%` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  return [
    `${node.full_name} (${node.region} ${seed}, ${tv.conf ?? "?"})`,
    `Record: ${tv.record} | Bracket: ${node.wins_vs_field}W-${node.losses_vs_field}L`,
    `T-Rank #${tv.rank} | AdjEM: ${tv.adj_em > 0 ? "+" : ""}${tv.adj_em} | AdjOE: ${tv.adj_oe} | AdjDE: ${tv.adj_de}`,
    `Barthag: ${(tv.barthag * 100).toFixed(1)}% | Proj Barthag: ${tv.proj_barthag ? (tv.proj_barthag * 100).toFixed(1) + "%" : "?"} | WAB: ${parseFloat(tv.wab).toFixed(1)} | Pace: ${pace}`,
    `Four Factors (off): ${ff4off}`,
    ff4def ? `Four Factors (def): ${ff4def}` : "",
    `Shooting: 2P% ${tv.two_p ?? "?"} | 3P% ${tv.three_p ?? "?"} | FT% ${tv.ft_pct ?? "?"} | 3PA rate: ${tv.three_pa_rate ?? "?"}%`,
    resume ? `Resume: ${resume}` : "",
    advanced ? `Advanced: ${advanced}` : "",
    tf ? `Form: ${tf.last10} L10 | Streak: ${tf.streak}` : "",
    recent ? `Last 3: ${recent}` : "",
    oddsStr,
    injStr,
  ]
    .filter(Boolean)
    .join("\n  ");
}

// ── Tool implementations ───────────────────────────────────────────────────────
export function implGetTeamStats(teamNames) {
  const { torvik, form, injuryMap, nodeByName, teamOdds, aliveTeamIds } =
    getData();
  if (!teamNames?.length) return "No team names provided.";
  return teamNames
    .map((name) => {
      const node = resolveTeam(name, nodeByName);
      if (!node) return `"${name}": not found — check spelling`;
      if (aliveTeamIds?.size && !aliveTeamIds.has(String(node.id)))
        return `${node.full_name}: ELIMINATED — no longer in the ${new Date().getFullYear()} NCAA Tournament`;
      return fmtTeam(node, torvik, form, injuryMap, teamOdds);
    })
    .join("\n\n---\n\n");
}

export function implGetMatchup(teamA, teamB) {
  const {
    graph,
    torvik,
    form,
    transPairs,
    injuryMap,
    nodeByName,
    edgesByNode,
    teamOdds,
    aliveTeamIds,
  } = getData();
  const nodeA = resolveTeam(teamA, nodeByName);
  const nodeB = resolveTeam(teamB, nodeByName);
  if (!nodeA) return `Team not found: "${teamA}"`;
  if (!nodeB) return `Team not found: "${teamB}"`;

  const lines = [
    `=== ${nodeA.full_name} vs ${nodeB.full_name} ===`,
    fmtTeam(nodeA, torvik, form, injuryMap, teamOdds),
    "",
    fmtTeam(nodeB, torvik, form, injuryMap, teamOdds),
  ];

  const aEdges = edgesByNode[nodeA.id] || [];
  const bEdges = edgesByNode[nodeB.id] || [];
  const h2h = aEdges.filter(
    (e) =>
      (e.from === nodeA.id && e.to === nodeB.id) ||
      (e.from === nodeB.id && e.to === nodeA.id),
  );

  if (h2h.length) {
    lines.push(`\nH2H (${h2h.length} game${h2h.length > 1 ? "s" : ""}):`);
    h2h.forEach((e) =>
      lines.push(
        `  ${e.date}: ${e.from === nodeA.id ? nodeA.label : nodeB.label} won ${e.label} (+${e.margin})`,
      ),
    );
  } else {
    lines.push("\nNo H2H this season.");
    const aOpps = new Set(
      aEdges.map((e) => (e.from === nodeA.id ? e.to : e.from)),
    );
    const bOpps = new Set(
      bEdges.map((e) => (e.from === nodeB.id ? e.to : e.from)),
    );
    const common = [...aOpps].filter((id) => bOpps.has(id)).slice(0, 5);
    const aliveCommon = common.filter(
      (cid) => !aliveTeamIds?.size || aliveTeamIds.has(String(cid)),
    );
    if (aliveCommon.length) {
      lines.push(
        `\nCommon opponents still in tournament (${aliveCommon.length}):`,
      );
      aliveCommon.forEach((cid) => {
        const cNode = graph.nodes.find((n) => n.id === cid);
        const aGame = aEdges.find(
          (e) =>
            (e.from === nodeA.id && e.to === cid) ||
            (e.to === nodeA.id && e.from === cid),
        );
        const bGame = bEdges.find(
          (e) =>
            (e.from === nodeB.id && e.to === cid) ||
            (e.to === nodeB.id && e.from === cid),
        );
        const aR = aGame
          ? aGame.from === nodeA.id
            ? `W ${aGame.label}`
            : `L ${aGame.label}`
          : "?";
        const bR = bGame
          ? bGame.from === nodeB.id
            ? `W ${bGame.label}`
            : `L ${bGame.label}`
          : "?";
        lines.push(
          `  vs ${cNode?.label ?? cid}: ${nodeA.label} ${aR} | ${nodeB.label} ${bR}`,
        );
      });
    }
    const tp =
      transPairs[`${nodeA.id}_${nodeB.id}`] ||
      transPairs[`${nodeB.id}_${nodeA.id}`];
    if (tp?.n > 0) {
      const flipped =
        !!transPairs[`${nodeB.id}_${nodeA.id}`] &&
        !transPairs[`${nodeA.id}_${nodeB.id}`];
      const favors =
        tp.verdict === "a"
          ? flipped
            ? nodeB.label
            : nodeA.label
          : tp.verdict === "b"
            ? flipped
              ? nodeA.label
              : nodeB.label
            : "neither";
      lines.push(
        `\nTransitive (${tp.n} signals, conf ${tp.conf?.toFixed(0) ?? "?"}/100): favors ${favors}`,
      );
      const filterChain = (chains) =>
        chains.filter((s) => {
          const cn = graph.nodes.find(
            (n) => n.full_name === s.common_name || n.label === s.common_name,
          );
          return !cn || !aliveTeamIds?.size || aliveTeamIds.has(String(cn.id));
        });
      filterChain(tp.a || [])
        .slice(0, 2)
        .forEach((s) =>
          lines.push(
            `  + ${nodeA.label} beat ${s.common_name} (${s.a_score}), who beat ${nodeB.label} (${s.b_score})`,
          ),
        );
      filterChain(tp.b || [])
        .slice(0, 2)
        .forEach((s) =>
          lines.push(
            `  + ${nodeB.label} beat ${s.common_name} (${s.b_score}), who beat ${nodeA.label} (${s.a_score})`,
          ),
        );
    } else {
      lines.push("\nNo transitive evidence found.");
    }
  }
  return lines.join("\n");
}

export function implGetStandings(sortBy, region, limit) {
  const VALID_SORT = ["adj_em", "barthag", "rank", "wins_vs_field", "seed"];
  const VALID_REGIONS = ["East", "West", "South", "Midwest"];
  sortBy = VALID_SORT.includes(sortBy) ? sortBy : "adj_em";
  region = VALID_REGIONS.includes(region) ? region : null;
  const parsed = parseInt(limit, 10);
  limit = Math.min(isNaN(parsed) ? 16 : parsed, 25);

  const { graph, torvik, form, aliveTeamIds, teamOdds } = getData();
  let teams = graph.nodes
    .map((n) => ({ node: n, tv: torvik?.teams?.[n.id]?.torvik }))
    .filter((t) => !aliveTeamIds.size || aliveTeamIds.has(String(t.node.id)));

  if (region) teams = teams.filter((t) => t.node.region === region);

  const val = (t) => {
    if (sortBy === "adj_em") return t.tv?.adj_em ?? -999;
    if (sortBy === "barthag") return t.tv?.barthag ?? 0;
    if (sortBy === "rank") return -(t.tv?.rank ?? 9999);
    if (sortBy === "wins_vs_field") return t.node.wins_vs_field;
    if (sortBy === "seed") return -(t.node.seed ?? 99);
    return 0;
  };

  teams.sort((a, b) => val(b) - val(a));

  return teams
    .slice(0, limit)
    .map((t, i) => {
      const seed = t.node.seed != null ? `#${t.node.seed}` : "?";
      const tf = form?.teams?.[t.node.id];
      const formStr = tf ? ` | ${tf.last10} L10 ${tf.streak}` : "";
      const tvStr = t.tv
        ? `AdjEM ${t.tv.adj_em > 0 ? "+" : ""}${t.tv.adj_em} | AdjOE ${t.tv.adj_oe} | AdjDE ${t.tv.adj_de} | Barthag ${(t.tv.barthag * 100).toFixed(1)}%`
        : "no Torvik";
      const odds = teamOdds?.[t.node.id];
      const oddsStr = odds
        ? ` | ML ${odds.ml ?? "?"} (${odds.implied ?? "?"}% implied)`
        : "";
      return `${i + 1}. ${t.node.full_name} (${t.node.region} ${seed})${formStr} | ${tvStr}${oddsStr}`;
    })
    .join("\n");
}

// ── Intent classification ──────────────────────────────────────────────────────
export const REGIONS_ORDERED = ["Midwest", "East", "West", "South"];

export function classifyIntent(msg, graph) {
  const m = msg.toLowerCase();
  const hasNcaaSignal =
    /ncaa|march madness|\bsweet 16\b|\bsweet sixteen\b|\belite 8\b|\belite eight\b|\bfinal four\b|\bright four\b|round of 64|round of 32|first round|second round|torvik|barthag|adj.?em|adj.?oe|adj.?de|t-rank|basketball efficiency|team efficiency|\bbasketball\b|college basketball|ncaa bracket|tournament bracket|tournament pick|region picks?|midwest region|east region|west region|south region|\bseed\b.*\bbasketball\b|\bbasketball\b.*\bseed\b|overall seed|number.*seed|\bseeds?\b.*\badvance\b|\badvance\b.*\bseeds?\b|\b[0-9]+ seed|upset pick|upset risk|upset watch|chalk pick|bracket advice|best shot|best chance|bracket strategy|fill.*bracket|my bracket|safe pick|value pick|picks this year|\b5-12\b|\b12-5\b|\b[0-9]+-[0-9]+ matchup\b|seed upset|win probability|wins it all|win it all|cut down the nets|national champion|injured|injury|\bout\b|out for|limited minutes|ppg|rpg|apg|per|three.?point pct|tempo mismatch|pace mismatch|cover the spread|beat the spread|against the spread|over.under|moneyline|the line|step up|change anything|affect the|still win|who wins|the key|does that|does this|who else|who steps|chances now|is.*playing\b|will.*play|any injuries|injury update|injury news|\bhurt\b|questionable|game.?time decision|brok\w*|break\w*|fractur\w*|sprain\w*|tweaked|hobbling|limping|\babsent\b|\babsence\b|\bsidelined?\b|\btournament\b|\bbig dance\b|\bstatus\b|\bsuspended\b|\barrested\b|knee update|foot update|ankle update/i.test(
      m,
    );
  const hasTeamSignal =
    graph?.nodes?.some((n) => {
      const lbl = normName(n.label);
      const re = new RegExp(
        "\\b" + lbl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b",
      );
      return re.test(normName(msg));
    }) ?? false;
  const hasOtherSport =
    /\bnba\b|\bnfl\b|\bnhl\b|\bmlb\b|\bwnba\b|\bsoccer\b|\bfootball\b|\bsuper bowl\b|\bworld series\b|\bstanley cup\b/i.test(
      m,
    );
  const hasBball = (hasNcaaSignal || hasTeamSignal) && !hasOtherSport;

  if (
    /haven.?t played|not played|could.*face|can.*face|potential matchup|if they meet|if they face|possible matchup/i.test(
      m,
    )
  )
    return { type: "unplayed_matchups" };

  if (
    hasBball &&
    /final four|champion|title contend|win it all|wins it all|win the tournament|wins the tournament|national title|who.*win.*whole|who.*favori|pick.*win|pick.*champion|who.*(should|would|will).*win/i.test(
      m,
    )
  )
    return { type: "top_teams_all" };

  const isRhetoricalFollowUp =
    /^(are you sure|are you certain|really\?|seriously\?|you sure|u sure|wait really|is that right|that seems|that can'?t be|i thought|but i thought|doesn'?t that|does(n'?t)? that)/i.test(
      m.trim(),
    );
  if (isRhetoricalFollowUp) return { type: "dynamic" };

  if (
    /undervalued|underrated|overvalued|market.*value|value.*market|mispriced|odds.*wrong|line.*off|market.*vs|model.*vs.*market|sharp money|betting value|are the odds|\bodds\b.*\?|what.*odds|value bet|value.*betting|\bml\b|moneyline|money line|plus.*minus|\bats\b|against the spread|cover the spread|covers? the spread|\bwho covers\b|beat the spread|does.*cover|spread.*right|favored correctly|the line|over.under|affect.*spread|affect.*line|affect.*odds|injury.*spread|injury.*line|injury.*odds|new line|line move|odds change|line change|prop bet|futures.*odds|implied prob|who covers|betting market|\b[+-][0-9]{3,4}\b|has it right|line.*right|market.*right|priced.*right/i.test(
      m,
    )
  )
    return { type: "market_analysis" };

  if (
    /sleeper|dark.horse|cinderella|upset.pick|surprise pick|overachiev|best upset|who.*should.*pick|bracket.*pick/i.test(
      m,
    )
  ) {
    const mNormSleeper = normName(msg);
    const namedTeam =
      graph?.nodes?.some((n) => {
        const lbl = normName(n.label);
        const full = normName(n.full_name);
        const rLbl = new RegExp(
          "\\b" + lbl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b",
        );
        const rFull = new RegExp(
          "\\b" + full.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b",
        );
        return rLbl.test(mNormSleeper) || rFull.test(mNormSleeper);
      }) ?? false;
    if (!namedTeam) return { type: "sleeper_all_regions" };
  }

  for (const r of REGIONS_ORDERED) {
    if (
      m.includes(r.toLowerCase()) &&
      /best|top|strong|effici|rank|adj.?em|barthag|who|favor|win|pick|bracket|like|predict|advance|breakdown|rundown|overview|status|look|shape/i.test(
        m,
      )
    )
      return { type: "region_standings", region: r };
  }

  if (
    /best teams|top teams|strongest|who.?s best|who are the best|top.*remaining|best.*efficiency|most efficient|best.*adj.?em|efficiency.*margin/i.test(
      m,
    )
  )
    return { type: "top_teams_all" };

  if (graph) {
    let mNorm = normName(msg);
    for (const [alias, expansion] of Object.entries(ALIASES)) {
      const aliasNorm = normName(alias);
      const re = new RegExp(
        "\\b" + aliasNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b",
        "g",
      );
      mNorm = mNorm.replace(re, normName(expansion));
    }
    const mAbbrev = mNorm
      .replace(/\bmichigan state\b/g, "michigan st")
      .replace(/\b(\w+) state\b/g, "$1 st");

    const found = graph.nodes.filter((n) => {
      const lbl = normName(n.label);
      const full = normName(n.full_name);
      const rLbl = new RegExp(
        "\\b" + lbl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b",
      );
      const rFull = new RegExp(
        "\\b" + full.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b",
      );
      return (
        rLbl.test(mNorm) ||
        rFull.test(mNorm) ||
        rLbl.test(mAbbrev) ||
        rFull.test(mAbbrev)
      );
    });

    if (found.length >= 2) {
      const hasInjurySignal =
        /injur\w*|\bhurt\b|is.*playing\b|any injury|out for|limited minutes|questionable|who steps up|who else|\babsent\b|\babsence\b|\bsidelined?\b/i.test(
          m,
        );
      if (hasInjurySignal) return { type: "dynamic" };

      let teams = found.filter((a, i) => {
        const aLbl = normName(a.label);
        return !found.some((b, j) => {
          if (i === j) return false;
          const bLbl = normName(b.label);
          return bLbl.includes(aLbl) && bLbl.length > aLbl.length;
        });
      });

      if (teams.length < 2) {
        if (teams.length === 1) {
          const hasNonBball =
            /university|college admission|job|career|hire|school|professor/i.test(
              m,
            );
          if (hasNonBball) return { type: "general" };
          const isFollowUp =
            /injur\w*|injury news|is.*playing\b|any injury|hurt\b|questionable|\baffect\b|\bimpact\b|\bchange\b|does that|who else|step up|what about|the news|is out|out for|will he|will she|is he\b|is she\b|when is he|when does|limited minutes|\brepeat\b|same (question|analysis|thing)|analysis for|do the same|redo|reconsider|not gonna|wont win|can.?t win|gonna lose|too weak|no chance|broke his|broke her|broke their|fractured|sprained|tweaked|hobbling|limping|missed.*game|miss.*game|\babsent\b|\babsence\b|\bsidelined?\b/i.test(
              m,
            );
          if (isFollowUp) return { type: "dynamic" };
          const hasAnalysis =
            /tell me|how is|stats|analysis|record|rank|efficiency|looking|how.*doing|how.*playing|how.*perform|season|chance|beat|win|lose|matchup|tournament|bracket|predict|advance|start\w*|lineup|rotation|depth chart|bench|roster|who plays|who starts|is.*sleeper|is.*upset|upset pick|sleeper pick|dark horse|cinderella|got this|got a chance|got what|can they|will they|should I pick|path to|road to|chances of|four factors|\btov\b|turnover rate|\borb\b|offensive rebound|\bftr\b|free throw rate|opponent efg|opp efg|\bsos\b|strength of schedule|luck rating|proj.*barthag|projected.*barthag|3pa rate|three.?point attempt|net ranking|quad [0-9]|quad[0-9]|\bwab\b|wins above bubble|\bpace\b|\btempo\b|adjoe|adjde|adjem|\bbarthag\b|\btorvik\b|t-rank|efficien\w*/i.test(
              m,
            );
          const hasNcaaSig = hasNcaaSignal;
          if (hasNcaaSig || hasAnalysis)
            return { type: "team_lookup", team: teams[0].label };
        }
        teams = found.slice(0, 2);
      }

      if (found.length > 2) {
        const deduped = teams
          .filter((n, i) => {
            const nl = normName(n.label);
            return !teams.some(
              (o, j) => j !== i && normName(o.label).startsWith(nl + " "),
            );
          })
          .slice(0, 2);
        if (deduped.length >= 2) teams = deduped;
        else teams = teams.slice(0, 2);
      } else {
        teams = teams.slice(0, 2);
      }

      if (teams.length < 2) return { type: "dynamic" };
      return {
        type: "matchup",
        team_a: teams[0].label,
        team_b: teams[1].label,
      };
    }

    if (found.length === 1) {
      const hasNonBball =
        /university|college admission|job|career|hire|school|professor|campus|degree|graduate|apply|application/i.test(
          m,
        );
      if (hasNonBball) return { type: "general" };
      const isFollowUp =
        /injur\w*|injury news|is.*playing\b|any injury|hurt\b|questionable|\baffect\b|\bimpact\b|\bchange\b|does that|who else|step up|what about|the news|is out|out for|will he|will she|is he\b|is she\b|when is he|when does|limited minutes|\brepeat\b|same (question|analysis|thing)|analysis for|do the same|redo|reconsider|not gonna|wont win|can.?t win|gonna lose|too weak|no chance|broke his|broke her|broke their|fractured|sprained|tweaked|hobbling|limping|missed.*game|miss.*game|\babsent\b|\babsence\b|\bsidelined?\b|\bwithout\b/i.test(
          m,
        );
      if (isFollowUp) return { type: "dynamic" };
      const hasAnalysis =
        /tell me|how is|stats|analysis|record|rank|efficiency|looking|how.*doing|how.*playing|how.*perform|season|chance|beat|win|lose|matchup|tournament|bracket|predict|advance|start\w*|lineup|rotation|depth chart|bench|roster|who plays|who starts|is.*sleeper|is.*upset|upset pick|sleeper pick|dark horse|cinderella|got this|got a chance|got what|can they|will they|should I pick|path to|road to|chances of|four factors|\btov\b|turnover rate|\borb\b|offensive rebound|\bftr\b|free throw rate|opponent efg|opp efg|\bsos\b|strength of schedule|luck rating|proj.*barthag|projected.*barthag|3pa rate|three.?point attempt|net ranking|quad [0-9]|quad[0-9]|\bwab\b|wins above bubble|\bpace\b|\btempo\b|adjoe|adjde|adjem|\bbarthag\b|\btorvik\b|t-rank|efficien\w*/i.test(
          m,
        );
      if (hasNcaaSignal || hasAnalysis)
        return { type: "team_lookup", team: found[0].label };
    }
  }

  // If query contains a known injured player's last name → dynamic + inject injury context
  try {
    const { injuryMap: iMap } = getData();
    const injuredLastNames = Object.values(iMap)
      .flatMap(inj => inj.players.map(p => p.name.split(' ').pop().toLowerCase()));
    if (injuredLastNames.some(ln => ln.length > 2 && m.includes(ln))) {
      return { type: 'dynamic' };
    }
  } catch {}

  if (!hasBball) return { type: "general" };
  return { type: "dynamic" };
}

// ── Injury context builder ─────────────────────────────────────────────────────
export function buildInjuryContext() {
  const { injuryMap, nodeByName, aliveTeamIds } = getData();
  let injuryNews = {};
  try {
    const raw = JSON.parse(
      readFileSync(join(process.cwd(), "data", "injury_news.json"), "utf8"),
    );
    injuryNews = raw?.teams ?? {};
  } catch {}

  let rosterStats = {};
  try {
    rosterStats =
      JSON.parse(
        readFileSync(join(process.cwd(), "data", "roster_stats.json"), "utf8"),
      ).teams ?? {};
  } catch {}

  const lines = ["INJURY REPORT — ALL TEAMS:"];

  for (const [id, inj] of Object.entries(injuryMap)) {
    if (aliveTeamIds?.size && !aliveTeamIds.has(String(id))) continue;
    const node = Object.values(nodeByName).find((n) => n.id === id);
    const name = node?.full_name ?? `Team ${id}`;
    lines.push(`\n${name} (AdjEM penalty -${inj.penalty}):`);
    for (const p of inj.players) {
      const rp = rosterStats[id]?.players?.find((r) => r.name === p.name);
      const stats = rp
        ? ` | ${rp.ppg} PPG / ${rp.rpg} RPG / ${rp.apg} APG | ${rp.mpg} MPG | FG ${rp.fg}%`
        : "";
      lines.push(
        `  ${p.name} — ${p.status}${stats}${p.impact ? " | " + p.impact : ""}`,
      );
    }
    if (inj.notes) lines.push(`  Note: ${inj.notes}`);
  }

  const newsLines = [];
  for (const [id, team] of Object.entries(injuryNews)) {
    if (aliveTeamIds?.size && !aliveTeamIds.has(String(id))) continue;
    const articles = team.articles?.slice(0, 2) ?? [];
    if (!articles.length) continue;
    const node = Object.values(nodeByName).find((n) => n.id === id);
    const name = node?.full_name ?? team.bracket_name ?? `Team ${id}`;
    const players = rosterStats[id]?.players ?? [];
    for (const a of articles) {
      const mentionedPlayer = players.find((p) =>
        a.headline
          .toLowerCase()
          .includes(p.name.toLowerCase().split(" ").pop()),
      );
      const playerStats = mentionedPlayer
        ? ` (${mentionedPlayer.ppg} PPG / ${mentionedPlayer.rpg} RPG / ${mentionedPlayer.mpg} MPG)`
        : "";
      newsLines.push(`${name}${playerStats}: ${a.headline}`);
    }
  }
  if (newsLines.length) {
    lines.push("\nRECENT INJURY NEWS:");
    lines.push(...newsLines);
  }

  return lines.join("\n");
}

// ── Pre-fetch ──────────────────────────────────────────────────────────────────
export function preFetch(intent, graph, torvik) {
  const thinking = [];
  const blocks = [];

  switch (intent.type) {
    case "sleeper_all_regions":
      for (const r of REGIONS_ORDERED) {
        thinking.push(`Checking standings — ${r}`);
        blocks.push(
          `=== ${r.toUpperCase()} ===\n` + implGetStandings("adj_em", r, 8),
        );
      }
      break;

    case "top_teams_all": {
      thinking.push("Checking top teams by efficiency + market");
      blocks.push(
        "TOP TEAMS (alive, by efficiency):\n" +
          implGetStandings("adj_em", null, 16),
      );
      const { oddsData } = getData();
      const upcoming = Object.values(oddsData?.games ?? {}).filter(
        (g) => !g.completed,
      );
      if (upcoming.length) {
        blocks.push(
          "UPCOMING GAMES + MARKET LINES:\n" +
            upcoming
              .map((g) => {
                const o = g.odds,
                  b = g.bpi;
                return [
                  g.name,
                  `Spread: ${o?.spread ?? "?"}`,
                  `${g.away} ML ${o?.away_moneyline ?? "?"} (${o?.away_implied_pct ?? "?"}%) BPI ${b?.away_bpi_win_pct ?? "?"}%`,
                  `${g.home} ML ${o?.home_moneyline ?? "?"} (${o?.home_implied_pct ?? "?"}%) BPI ${b?.home_bpi_win_pct ?? "?"}%`,
                ].join(" | ");
              })
              .join("\n"),
        );
      }
      break;
    }

    case "market_analysis": {
      thinking.push("Checking market vs model divergence");
      blocks.push(
        "ALIVE TEAMS BY EFFICIENCY:\n" + implGetStandings("adj_em", null, 16),
      );
      const { oddsData } = getData();
      const upcoming = Object.values(oddsData?.games ?? {}).filter(
        (g) => !g.completed,
      );
      if (upcoming.length) {
        blocks.push(
          "MARKET LINES:\n" +
            upcoming
              .map((g) => {
                const o = g.odds,
                  b = g.bpi;
                return [
                  g.name,
                  `Spread: ${o?.spread ?? "?"}`,
                  `${g.away} ML ${o?.away_moneyline ?? "?"} (${o?.away_implied_pct ?? "?"}%) BPI ${b?.away_bpi_win_pct ?? "?"}%`,
                  `${g.home} ML ${o?.home_moneyline ?? "?"} (${o?.home_implied_pct ?? "?"}%) BPI ${b?.home_bpi_win_pct ?? "?"}%`,
                ].join(" | ");
              })
              .join("\n"),
        );
      }
      if (intent.team) {
        thinking.push("Loading " + intent.team + " stats");
        blocks.push(implGetTeamStats([intent.team]));
      }
      break;
    }

    case "region_standings":
      thinking.push(`Checking standings — ${intent.region}`);
      blocks.push(implGetStandings("adj_em", intent.region, 16));
      break;

    case "matchup":
      thinking.push(`Analysing ${intent.team_a} vs ${intent.team_b}`);
      blocks.push(implGetMatchup(intent.team_a, intent.team_b));
      break;

    case "team_lookup":
      thinking.push(`Looking up ${intent.team} stats`);
      blocks.push(implGetTeamStats([intent.team]));
      break;

    case "unplayed_matchups": {
      thinking.push("Checking potential future matchups");
      blocks.push("TOP TEAMS:\n" + implGetStandings("adj_em", null, 8));
      const { aliveTeamIds } = getData();
      const ranked = graph.nodes
        .filter((n) => !aliveTeamIds.size || aliveTeamIds.has(String(n.id)))
        .map((n) => ({ n, tv: torvik?.teams?.[n.id]?.torvik }))
        .filter((x) => x.tv)
        .sort((a, b) => (b.tv.adj_em ?? -999) - (a.tv.adj_em ?? -999))
        .slice(0, 6);
      const edgeSet = new Set(graph.edges.map((e) => `${e.from}-${e.to}`));
      const unplayed = [];
      for (let i = 0; i < ranked.length; i++)
        for (let j = i + 1; j < ranked.length; j++) {
          const a = ranked[i].n,
            b = ranked[j].n;
          if (
            !edgeSet.has(`${a.id}-${b.id}`) &&
            !edgeSet.has(`${b.id}-${a.id}`)
          )
            unplayed.push(
              `${a.full_name} (${a.region} #${a.seed}) vs ${b.full_name} (${b.region} #${b.seed})`,
            );
        }
      if (unplayed.length)
        blocks.push("POTENTIAL MATCHUPS:\n" + unplayed.join("\n"));
      break;
    }

    default:
      if (intent.type === "dynamic")
        blocks.push(
          "ALIVE TEAMS BY EFFICIENCY:\n" + implGetStandings("adj_em", null, 16),
        );
      break;
  }

  return { context: blocks.join("\n\n"), thinking };
}
