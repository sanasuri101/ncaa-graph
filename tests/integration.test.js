/**
 * integration.test.js — NCAA Graph integration + hallucination-prevention tests
 *
 * Every path where the LLM scout can fabricate data is covered:
 *   1.  Data files load
 *   2.  Graph structure
 *   3.  Torvik stats completeness
 *   4.  Transitive analysis
 *   5.  Not-played pair resolution
 *   6.  Bracket teams / ESPN IDs
 *   7.  Recent form
 *   8.  Injury data sources (overrides + news + roster)
 *   9.  Name normalization
 *   10. Team resolution — aliases, possessives, nicknames, dedup
 *   11. Intent routing — all intents + absence/sidelined phrasing
 *   12. Tool output grounding — every key stat sourced from files
 *   13. Injury context pipeline — alive filter, cache immutability
 *   14. Eliminated team guard — blocked from stats + standings
 *   15. Context field coverage — preFetch produces usable context per intent
 *   16. Data source saturation — all files reachable via tool paths
 *
 * Run: node tests/integration.test.js   (from project root)
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ── Test harness ───────────────────────────────────────────────────────────────
let passed = 0,
  failed = 0;
const failures = [];

function assert(condition, label, detail = "") {
  if (condition) {
    process.stdout.write(`  ✓ ${label}\n`);
    passed++;
  } else {
    process.stderr.write(`  ✗ ${label}${detail ? " — " + detail : ""}\n`);
    failed++;
    failures.push(label + (detail ? " — " + detail : ""));
  }
}

function section(n, title) {
  process.stdout.write(`\n${n}. ${title}\n`);
}

function load(relPath) {
  return JSON.parse(readFileSync(join(ROOT, relPath), "utf8"));
}

// ── Load data files ────────────────────────────────────────────────────────────
let graph, torvik, trans, form, bracket;
let injOverrides, injNews, rosterStats, odds, allGames;

section(1, "Data files load");
const FILES = [
  ["graph_data.json", "public/data/graph_data.json"],
  ["torvik_stats.json", "public/data/torvik_stats.json"],
  ["transitive_analysis.json", "public/data/transitive_analysis.json"],
  ["recent_form.json", "public/data/recent_form.json"],
  ["bracket_teams.json", "data/bracket_teams.json"],
  ["injury_overrides.json", "data/injury_overrides.json"],
  ["injury_news.json", "data/injury_news.json"],
  ["roster_stats.json", "data/roster_stats.json"],
  ["espn_odds.json", "data/espn_odds.json"],
  ["all_games.json", "data/all_games.json"],
];
for (const [name, rel] of FILES) {
  try {
    const d = load(rel);
    switch (name) {
      case "graph_data.json":
        graph = d;
        break;
      case "torvik_stats.json":
        torvik = d;
        break;
      case "transitive_analysis.json":
        trans = d;
        break;
      case "recent_form.json":
        form = d;
        break;
      case "bracket_teams.json":
        bracket = d;
        break;
      case "injury_overrides.json":
        injOverrides = d;
        break;
      case "injury_news.json":
        injNews = d;
        break;
      case "roster_stats.json":
        rosterStats = d;
        break;
      case "espn_odds.json":
        odds = d;
        break;
      case "all_games.json":
        allGames = d;
        break;
    }
    assert(true, name);
  } catch (e) {
    assert(false, name, e.message);
  }
}

// ── 2. Graph structure ────────────────────────────────────────────────────────
section(2, "Graph structure");
assert(
  (graph?.nodes?.length ?? 0) >= 64,
  `>=64 nodes (got ${graph?.nodes?.length})`,
);
assert(
  (graph?.edges?.length ?? 0) > 200,
  `>200 edges (got ${graph?.edges?.length})`,
);
const n0 = graph?.nodes?.[0];
for (const f of [
  "id",
  "full_name",
  "seed",
  "region",
  "wins_vs_field",
  "losses_vs_field",
])
  assert(n0?.[f] != null, `node has ${f}`);
const e0 = graph?.edges?.[0];
for (const f of ["from", "to", "label", "margin", "date"])
  assert(e0?.[f] != null, `edge has ${f}`);
assert(
  (graph?.edges ?? []).filter((e) => e.from === e.to).length === 0,
  "no self-loop edges",
);
// Triple edges are valid: conf home + conf away + conf tournament = 3 games.
// Flag only 4+ as a data error.
const edgeCounts = {};
(graph?.edges ?? []).forEach((e) => {
  const k = [e.from, e.to].sort().join("_");
  edgeCounts[k] = (edgeCounts[k] || 0) + 1;
});
const quadrupleEdges = Object.entries(edgeCounts).filter(([, v]) => v > 3);
assert(
  quadrupleEdges.length === 0,
  `no quadruple+ duplicate edges (${quadrupleEdges.length} found)`,
);

// ── 3. Torvik stats ───────────────────────────────────────────────────────────
section(3, "Torvik stats completeness");
assert(torvik?.teams != null, "torvik.teams exists");
const bracketIds = new Set((graph?.nodes ?? []).map((n) => n.id));
const missingTorvik = [...bracketIds].filter((id) => !torvik?.teams?.[id]);
assert(
  missingTorvik.length === 0,
  `all 64 bracket teams have torvik entry (missing: ${missingTorvik.join(", ") || "none"})`,
);
const tv0 = Object.values(torvik?.teams ?? {})[0]?.torvik;
for (const f of ["adj_oe", "adj_de", "adj_em", "rank", "barthag"])
  assert(tv0?.[f] != null, `torvik entry has ${f}`);

// ── 4. Transitive analysis ───────────────────────────────────────────────────
section(4, "Transitive analysis");
const pairCount = Object.keys(trans?.pairs ?? {}).length;
assert(pairCount > 1000, `>1000 transitive pairs (got ${pairCount})`);
const badKeys = Object.keys(trans?.pairs ?? {}).filter(
  (k) => !/^\d+_\d+$/.test(k),
);
assert(badKeys.length === 0, "all pair keys are id_id format");
const p0 = Object.values(trans?.pairs ?? {})[1];
for (const f of ["a", "b", "both_beat", "both_lost"])
  assert(Array.isArray(p0?.[f]), `pair has ${f} array`);
assert(p0?.verdict != null, "pair has verdict");

// ── 5. Not-played pairs resolvable ───────────────────────────────────────────
section(5, "Not-played pair resolution");
const ids = (graph?.nodes ?? []).map((n) => n.id);
let lookupFails = 0,
  lookupChecked = 0;
outer: for (let i = 0; i < ids.length; i++) {
  for (let j = i + 1; j < ids.length; j++) {
    const played = (graph?.edges ?? []).some(
      (e) =>
        (e.from === ids[i] && e.to === ids[j]) ||
        (e.from === ids[j] && e.to === ids[i]),
    );
    if (!played) {
      const found =
        trans?.pairs?.[`${ids[i]}_${ids[j]}`] ||
        trans?.pairs?.[`${ids[j]}_${ids[i]}`];
      if (!found) lookupFails++;
    }
    if (++lookupChecked >= 300) break outer;
  }
}
assert(
  lookupFails === 0,
  `no missing transitive entries for 300 sampled not-played pairs (${lookupFails} misses)`,
);

// ── 6. Bracket teams / ESPN IDs ──────────────────────────────────────────────
section(6, "Bracket teams");
assert(
  (bracket?.length ?? 0) >= 64,
  `>=64 bracket entries (got ${bracket?.length})`,
);
const espnIds = (bracket ?? []).map((t) => t.espn_id);
assert(new Set(espnIds).size === espnIds.length, "no duplicate ESPN IDs");
assert(
  (bracket ?? []).every(
    (t) => t.espn_id && t.bracket_name && t.seed && t.region,
  ),
  "all entries have espn_id, bracket_name, seed, region",
);
const spotCheck = {
  Duke: "150",
  Michigan: "130",
  Houston: "248",
  Arizona: "12",
};
for (const [name, id] of Object.entries(spotCheck)) {
  const t = (bracket ?? []).find((t) => t.bracket_name === name);
  assert(t?.espn_id === id, `${name} espn_id=${id} (got ${t?.espn_id})`);
}

// ── 7. Recent form ───────────────────────────────────────────────────────────
section(7, "Recent form");
assert(typeof form === "object" && form !== null, "recent_form is object");
// Support either flat {id: {...}} or nested {teams: {id: {...}}}
const formTeams = form?.teams ?? form;
assert(
  Object.keys(formTeams).length > 0,
  `form has entries (${Object.keys(formTeams).length})`,
);
const f0 = Object.values(formTeams)[0];
assert(Array.isArray(f0?.games), "form entry has games array");
assert(typeof f0?.last10 === "string", "form entry has last10 string");
assert(f0?.streak != null, "form entry has streak");

// ── 8. Injury data sources ───────────────────────────────────────────────────
section(8, "Injury data sources");

// 8a. injury_overrides.json structure
const overrides = injOverrides?.overrides ?? {};
assert(
  Object.keys(overrides).length >= 9,
  `>=9 injury overrides (got ${Object.keys(overrides).length})`,
);
for (const [id, ov] of Object.entries(overrides)) {
  assert(
    (ov.adj_em_penalty ?? 0) > 0,
    `override ${id} (${ov.bracket_name}) has positive adj_em_penalty`,
  );
  assert(
    Array.isArray(ov.players) && ov.players.length > 0,
    `override ${id} has players array`,
  );
  assert(
    ov.players.every((p) => p.name && p.status),
    `override ${id} players have name+status`,
  );
}

// 8b. Jefferson entry (newly added)
const jeffersonEntry = overrides["66"];
assert(jeffersonEntry != null, "Iowa State (66) has injury override");
assert(
  jeffersonEntry?.bracket_name === "Iowa State",
  "Iowa State override name correct",
);
const jefferson = jeffersonEntry?.players?.find(
  (p) => p.name === "Joshua Jefferson",
);
assert(
  jefferson != null,
  "Joshua Jefferson entry found in Iowa State override",
);
assert(
  jefferson?.status?.toLowerCase().includes("ankle"),
  "Jefferson status mentions ankle",
);
assert(
  (jeffersonEntry?.adj_em_penalty ?? 0) > 0,
  `Jefferson adj_em_penalty > 0 (got ${jeffersonEntry?.adj_em_penalty})`,
);

// 8c. injury_news.json structure
const newsTeams = injNews?.teams ?? {};
assert(
  Object.keys(newsTeams).length > 0,
  `injury_news has team entries (${Object.keys(newsTeams).length})`,
);
for (const [id, team] of Object.entries(newsTeams)) {
  assert(
    Array.isArray(team.articles),
    `injury_news team ${id} has articles array`,
  );
  if (team.articles.length > 0) {
    assert(
      team.articles[0].headline != null,
      `injury_news team ${id} article has headline`,
    );
  }
}

// 8d. roster_stats.json — player stats for grounding injury impact
const rosterTeams = rosterStats?.teams ?? {};
assert(
  Object.keys(rosterTeams).length > 0,
  `roster_stats has teams (${Object.keys(rosterTeams).length})`,
);
for (const [id, team] of Object.entries(rosterTeams)) {
  assert(
    Array.isArray(team.players) && team.players.length > 0,
    `roster team ${id} has players`,
  );
  const p = team.players[0];
  for (const f of ["name", "ppg", "rpg", "apg", "mpg", "fg"])
    assert(p?.[f] != null, `roster player has ${f} (team ${id})`);
  break; // spot-check first team only
}

// 8e. Injury override teams have matching roster entries (for stat injection)
for (const id of Object.keys(overrides)) {
  if (!rosterTeams[id]) continue; // not all teams have roster stats — that's OK
  const players = rosterTeams[id]?.players ?? [];
  assert(players.length > 0, `roster has players for injured team ${id}`);
}

// ── 9. Name normalization ─────────────────────────────────────────────────────
// Import and test normName
section(9, "Name normalization");
const { normName } = await import(join(ROOT, "api/data.js"));
const normCases = [
  ["Duke's basketball", "duke basketball"], // possessive 's stripped entirely
  ["St. John's", "saint john"], // st. → saint, possessive 's stripped
  ["St Johns", "saint johns"],
  ["Ft. Wayne", "fort wayne"],
  ["UConn  Huskies", "uconn huskies"], // extra spaces collapsed
];
for (const [input, expected] of normCases)
  assert(
    normName(input) === expected,
    `normName("${input}") = "${expected}" (got "${normName(input)}")`,
  );

// ── 10. Team resolution ───────────────────────────────────────────────────────
section(10, "Team resolution — aliases, possessives, nicknames");
const { resolveTeam, getData } = await import(join(ROOT, "api/data.js"));
const { nodeByName } = getData();

const aliasCases = [
  // [query, expected full_name substring]
  ["ISU", "Iowa State"],
  ["iowa st", "Iowa State"],
  ["MSU", "Michigan"], // MSU → Michigan St (label contains "Michigan")
  ["UConn", "UConn"],
  ["UCLA", "UCLA"],
  ["BYU", "BYU"],
  // LSU not in 2025-26 tournament — omitted
  ["Duke", "Duke"],
  ["Michigan", "Michigan"],
  ["Wolverines", "Michigan"], // ALIAS → nickname resolution
  ["Cyclones", "Iowa State"], // ALIAS → nickname resolution
  ["Blue Devils", "Duke"], // ALIAS → nickname resolution
];
for (const [query, nameHint] of aliasCases) {
  const node = resolveTeam(query, nodeByName);
  assert(
    node != null &&
      node.full_name.toLowerCase().includes(nameHint.toLowerCase()),
    `resolveTeam("${query}") → ${nameHint} (got ${node?.full_name ?? "null"})`,
  );
}

// Iowa ≠ Iowa State — should resolve to Iowa (Hawkeyes), not Iowa State
const iowaNode = resolveTeam("Iowa", nodeByName);
const isNode = resolveTeam("Iowa State", nodeByName);
assert(
  iowaNode?.id !== isNode?.id,
  "Iowa resolves differently from Iowa State",
);

// Michigan ≠ Michigan State
const michNode = resolveTeam("Michigan", nodeByName);
const msuNode = resolveTeam("Michigan State", nodeByName);
assert(
  michNode?.id !== msuNode?.id,
  "Michigan resolves differently from Michigan State",
);

// Not a tournament team → null (Fordham is never in March Madness)
const notFound = resolveTeam("Fordham Rams", nodeByName);
assert(notFound === null, "non-bracket team resolves to null");

// ── 11. Intent routing ────────────────────────────────────────────────────────
section(11, "Intent routing — correct data path for each query type");
const { classifyIntent } = await import(join(ROOT, "api/data.js"));
const { graph: g } = getData();

const intentCases = [
  // [query, expected type, optional region/team]
  ["Duke vs Michigan", "matchup"],
  ["How does Duke match up against Michigan?", "matchup"],
  ["Tell me about Duke", "team_lookup"],
  ["How is Iowa State looking?", "team_lookup"],
  ["Who should win it all?", "top_teams_all"],
  ["Who wins the championship?", "top_teams_all"],
  ["Who are the Final Four favorites?", "top_teams_all"],
  ["Who are the sleepers?", "sleeper_all_regions"],
  ["Give me your upset picks", "sleeper_all_regions"],
  ["Best teams in the East", "region_standings"],
  ["Midwest region breakdown", "region_standings"],
  ["Is the market right on Iowa State?", "market_analysis"],
  ["What's the moneyline on Duke?", "market_analysis"],
  ["Could Duke face Michigan in the Final Four?", "unplayed_matchups"],
  ["What if they haven't played yet?", "unplayed_matchups"],
  // Injury player name (no team) → injury_query (non-tool path, data already in prompt)
  ["Is Joshua Jefferson playing?", "injury_query"],
  ["Is Caleb Foster out?", "injury_query"],
  ["Is Jefferson absent?", "injury_query"],
  ["Is Tyler Bilodeau sidelined?", "injury_query"],
  ["Is Caleb Foster sidelined for the tournament?", "injury_query"],
  ["Is Silas Demary Jr. still injured?", "injury_query"],
  // Injury + team name → dynamic (follow-up pattern matches first)
  ["How does Jefferson's absence affect Iowa State?", "dynamic"],
  ["Any injury news for Duke?", "dynamic"],
  ["Who steps up for Duke without Foster?", "dynamic"],
  // Vague but on-topic → dynamic (NOT general — LLM should always respond)
  ["Who you got?", "dynamic"],
  ["Give me your picks", "dynamic"],
  ["What do you think?", "dynamic"],
  ["Help me fill my bracket", "dynamic"],
  // Off-topic: explicit other sports → general
  ["Who won the NBA Finals?", "general"],
  ["Super Bowl predictions", "general"],
  ["Who will win the Premier League?", "general"],
  // Off-topic: non-sports → general
  ["What's the weather today?", "general"],
  ["Help me write a Python script", "general"],
];

for (const [query, expectedType] of intentCases) {
  const intent = classifyIntent(query, g);
  assert(
    intent.type === expectedType,
    `intent("${query}") = ${expectedType} (got ${intent.type})`,
  );
}

// Region-specific routing checks
const eastIntent = classifyIntent("Best teams in the East region", g);
assert(
  eastIntent.region === "East",
  `East region intent has region=East (got ${eastIntent.region})`,
);
const midwestIntent = classifyIntent("Midwest region breakdown", g);
assert(
  midwestIntent.region === "Midwest",
  `Midwest intent has region=Midwest (got ${midwestIntent.region})`,
);

// Matchup intent extracts team labels
const dukeVsMich = classifyIntent("Duke vs Michigan", g);
assert(
  dukeVsMich.team_a != null && dukeVsMich.team_b != null,
  `matchup intent has team_a and team_b (${dukeVsMich.team_a} / ${dukeVsMich.team_b})`,
);

// ── 12. Tool output grounding — stats must come from files ───────────────────
section(12, "Tool output grounding — key stats sourced from data files");
const { implGetTeamStats, implGetMatchup, implGetStandings } = await import(
  join(ROOT, "api/data.js")
);

// 12a. Duke stats match torvik_stats.json
const dukeTorvik = torvik?.teams?.["150"]?.torvik;
const dukeOutput = implGetTeamStats(["Duke"]);
assert(
  dukeOutput.includes(String(dukeTorvik?.adj_em)),
  `Duke AdjEM ${dukeTorvik?.adj_em} appears in tool output`,
  dukeOutput.slice(0, 200),
);
assert(
  dukeOutput.includes(String(dukeTorvik?.adj_oe)),
  `Duke AdjOE ${dukeTorvik?.adj_oe} appears in tool output`,
);
assert(
  dukeOutput.includes(String(dukeTorvik?.adj_de)),
  `Duke AdjDE ${dukeTorvik?.adj_de} appears in tool output`,
);
// Barthag shown as percentage
const dukeBarthagPct = (dukeTorvik?.barthag * 100).toFixed(1);
assert(
  dukeOutput.includes(dukeBarthagPct),
  `Duke Barthag ${dukeBarthagPct}% appears in tool output`,
);

// 12b. Duke injury warning from injury_overrides.json
assert(
  dukeOutput.includes("Caleb Foster"),
  "Duke output includes injured player Caleb Foster",
);
assert(
  dukeOutput.toLowerCase().includes("injur"),
  "Duke output includes injury indicator",
);

// 12c. Iowa State (Jefferson injury) appears in stats
// Iowa State is alive — should show full stats + injury
const isOutput = implGetTeamStats(["Iowa State"]);
assert(
  !isOutput.toUpperCase().includes("ELIMINATED"),
  "Iowa State not marked eliminated",
);
assert(
  isOutput.includes("Joshua Jefferson"),
  "Iowa State output includes Jefferson injury",
  isOutput.slice(0, 200),
);

// 12d. Alias resolution: ISU should resolve to Iowa State
const isuOutput = implGetTeamStats(["ISU"]);
assert(
  !isuOutput.includes('"ISU": not found'),
  'ISU alias resolves (not "not found")',
);

// 12e. Matchup output contains both teams' real AdjEM values
const michTorvik = torvik?.teams?.["130"]?.torvik;
const matchupOutput = implGetMatchup("Duke", "Michigan");
assert(
  matchupOutput.includes(String(dukeTorvik?.adj_em)),
  `matchup contains Duke AdjEM ${dukeTorvik?.adj_em}`,
);
assert(
  matchupOutput.includes(String(michTorvik?.adj_em)),
  `matchup contains Michigan AdjEM ${michTorvik?.adj_em}`,
);

// 12f. Standings top team matches highest AdjEM in torvik
const standingsOutput = implGetStandings("adj_em", null, 5);
const standingsLines = standingsOutput.split("\n");
assert(
  standingsLines.length >= 5,
  `standings returns 5 rows (got ${standingsLines.length})`,
);
// Verify standings are sorted: find max adj_em among alive teams
const { aliveTeamIds } = getData();
const aliveIds = [...(aliveTeamIds.size ? aliveTeamIds : bracketIds)];
const sortedByAdjEM = aliveIds
  .map((id) => torvik?.teams?.[id]?.torvik?.adj_em)
  .filter((v) => v != null)
  .sort((a, b) => b - a);
const topAdjEM = sortedByAdjEM[0];
assert(
  standingsOutput.includes(String(topAdjEM)),
  `standings top team has AdjEM ${topAdjEM} (from torvik)`,
  standingsOutput.split("\n")[0],
);

// 12g. Standings returns only alive teams (no eliminated)
const eliminatedSample = [...bracketIds].find(
  (id) => aliveTeamIds.size > 0 && !aliveTeamIds.has(String(id)),
);
if (eliminatedSample) {
  const elimNode = g.nodes.find((n) => n.id === eliminatedSample);
  assert(
    !standingsOutput.includes(elimNode?.full_name ?? ""),
    `eliminated team "${elimNode?.full_name}" absent from standings`,
  );
}

// 12h. Market odds appear in team output when available
const oddsGames = Object.values(odds?.games ?? {}).filter(
  (gg) => !gg.completed,
);
if (oddsGames.length > 0) {
  const oddsTeamId = oddsGames[0]?.home_id ?? oddsGames[0]?.away_id;
  if (oddsTeamId) {
    const oddsTeamNode = g.nodes.find((n) => n.id === oddsTeamId);
    if (oddsTeamNode) {
      const oddsOutput = implGetTeamStats([oddsTeamNode.label]);
      assert(
        oddsOutput.toLowerCase().includes("ml") ||
          oddsOutput.toLowerCase().includes("market"),
        `team with odds shows market/ML line (team: ${oddsTeamNode.full_name})`,
      );
    }
  }
}

// ── 13. Injury context pipeline ──────────────────────────────────────────────
section(13, "Injury context pipeline — correctness and cache immutability");
const { buildInjuryContext } = await import(join(ROOT, "api/data.js"));

const injCtx = buildInjuryContext();

// 13a. Every alive team with a penalty appears in injury context
const aliveOverrideIds = Object.keys(overrides).filter(
  (id) => !aliveTeamIds.size || aliveTeamIds.has(id),
);
for (const id of aliveOverrideIds) {
  const ov = overrides[id];
  assert(
    injCtx.includes(ov.bracket_name),
    `injury context includes alive injured team: ${ov.bracket_name}`,
  );
}

// 13b. Eliminated teams NOT in injury context (if aliveTeamIds is populated)
if (aliveTeamIds.size > 0) {
  const elimOverrideIds = Object.keys(overrides).filter(
    (id) => !aliveTeamIds.has(id),
  );
  for (const id of elimOverrideIds) {
    const ov = overrides[id];
    assert(
      !injCtx.includes(ov.bracket_name) || injCtx.includes("ELIMINATED"),
      `eliminated injured team "${ov.bracket_name}" not in active injury context`,
    );
  }
}

// 13c. injury_news headlines appear in context
let newsFound = false;
for (const [id, team] of Object.entries(newsTeams)) {
  if (aliveTeamIds.size && !aliveTeamIds.has(id)) continue;
  if (team.articles?.length > 0) {
    // Headline should appear in context
    const headline = team.articles[0].headline;
    if (injCtx.includes(headline.slice(0, 30))) {
      newsFound = true;
      break;
    }
  }
}
assert(newsFound, "injury_news headlines appear in buildInjuryContext output");

// 13d. Roster stats enrichment — player PPG appears in injury context
let rosterEnriched = false;
for (const id of Object.keys(overrides)) {
  if (aliveTeamIds.size && !aliveTeamIds.has(id)) continue;
  const roster = rosterStats?.teams?.[id]?.players ?? [];
  const ovPlayers = overrides[id].players ?? [];
  for (const op of ovPlayers) {
    const rp = roster.find((r) => r.name === op.name);
    if (rp && injCtx.includes(String(rp.ppg))) {
      rosterEnriched = true;
      break;
    }
  }
  if (rosterEnriched) break;
}
assert(rosterEnriched, "roster PPG stats enrich injury context output");

// 13e. Cache immutability: injuryMap must not be mutated after buildInjuryContext calls
const beforeKeys = Object.keys(getData().injuryMap);
buildInjuryContext(); // second call
buildInjuryContext(); // third call
const afterKeys = Object.keys(getData().injuryMap);
assert(
  beforeKeys.length === afterKeys.length &&
    beforeKeys.every((k) => afterKeys.includes(k)),
  `injuryMap cache not mutated (before ${beforeKeys.length}, after ${afterKeys.length} entries)`,
);

// 13f. isInjuryQuery appends, never replaces — check both contexts are in final prompt
const { buildSystemPrompt: _bsp } = await import(
  join(ROOT, "api/data.js")
).catch(() => ({ buildSystemPrompt: null }));
// buildSystemPrompt is not exported — test via preFetch context logic instead

// ── 14. Eliminated team guard ────────────────────────────────────────────────
section(14, "Eliminated team guard");
// Find an eliminated team
const eliminatedId = [...bracketIds].find(
  (id) => aliveTeamIds.size > 0 && !aliveTeamIds.has(String(id)),
);
const elimNode = eliminatedId
  ? g.nodes.find((n) => n.id === eliminatedId)
  : null;

if (elimNode) {
  // implGetTeamStats returns ELIMINATED message
  const elimOutput = implGetTeamStats([elimNode.label]);
  assert(
    elimOutput.toUpperCase().includes("ELIMINATED"),
    `implGetTeamStats for eliminated "${elimNode.full_name}" returns ELIMINATED message`,
  );

  // Standings exclude the eliminated team
  const standingsFull = implGetStandings("adj_em", null, 25);
  assert(
    !standingsFull.includes(elimNode.full_name),
    `eliminated team "${elimNode.full_name}" excluded from standings`,
  );

  // Eliminated team: matchup with alive team returns ELIMINATED in one block
  const aliveId = [...aliveTeamIds][0];
  const aliveNode = g.nodes.find((n) => n.id === String(aliveId));
  if (aliveNode) {
    const elimMatchup = implGetMatchup(elimNode.label, aliveNode.label);
    assert(
      elimMatchup.toUpperCase().includes("ELIMINATED"),
      `matchup involving eliminated team "${elimNode.full_name}" flags ELIMINATED`,
    );
  }
} else {
  assert(
    true,
    "no alive teams computed — eliminated guard tests skipped (pre-tournament)",
  );
}

// ── 15. Context field coverage per intent ────────────────────────────────────
section(
  15,
  "preFetch context coverage — each intent type produces usable data",
);
const { preFetch } = await import(join(ROOT, "api/data.js"));

// matchup: context must contain AdjEM for both teams
{
  const intent = { type: "matchup", team_a: "Duke", team_b: "Michigan" };
  const { context } = preFetch(intent, g, torvik);
  assert(
    context.includes(String(dukeTorvik?.adj_em)),
    "matchup context: Duke AdjEM present",
  );
  assert(
    context.includes(String(michTorvik?.adj_em)),
    "matchup context: Michigan AdjEM present",
  );
}

// team_lookup: context contains team-specific stats
{
  const intent = { type: "team_lookup", team: "Duke" };
  const { context } = preFetch(intent, g, torvik);
  assert(
    context.includes(String(dukeTorvik?.adj_em)),
    "team_lookup context: AdjEM present",
  );
  assert(
    context.includes("Caleb Foster"),
    "team_lookup context: injury player present",
  );
}

// top_teams_all: context contains multiple teams + efficiency header
{
  const intent = { type: "top_teams_all" };
  const { context } = preFetch(intent, g, torvik);
  assert(
    context.includes("TOP TEAMS"),
    "top_teams_all context: header present",
  );
  assert(
    context.split("AdjEM").length > 4,
    "top_teams_all context: multiple AdjEM references",
  );
}

// region_standings: context contains region teams
{
  const intent = { type: "region_standings", region: "East" };
  const { context } = preFetch(intent, g, torvik);
  assert(context.length > 100, "region_standings context: non-empty");
  assert(
    context.includes("AdjEM"),
    "region_standings context: efficiency stats present",
  );
}

// sleeper_all_regions: context covers all 4 regions
{
  const intent = { type: "sleeper_all_regions" };
  const { context } = preFetch(intent, g, torvik);
  for (const r of ["MIDWEST", "EAST", "WEST", "SOUTH"])
    assert(context.toUpperCase().includes(r), `sleeper context includes ${r}`);
}

// market_analysis: context contains market data + efficiency
{
  const intent = { type: "market_analysis" };
  const { context } = preFetch(intent, g, torvik);
  assert(
    context.includes("ALIVE TEAMS BY EFFICIENCY") || context.includes("AdjEM"),
    "market_analysis context: efficiency data present",
  );
}

// dynamic: baseline context is efficiency standings (not empty)
{
  const intent = { type: "dynamic" };
  const { context } = preFetch(intent, g, torvik);
  assert(
    context.includes("ALIVE TEAMS BY EFFICIENCY"),
    "dynamic context: efficiency baseline present",
  );
  assert(context.includes("AdjEM"), "dynamic context: AdjEM in baseline");
}

// unplayed_matchups: context includes potential matchups
{
  const intent = { type: "unplayed_matchups" };
  const { context } = preFetch(intent, g, torvik);
  assert(
    context.includes("TOP TEAMS") || context.includes("AdjEM"),
    "unplayed_matchups context: team data present",
  );
}

// ── 16. Data source saturation ───────────────────────────────────────────────
section(16, "Data source saturation — all files reachable via tool paths");

// graph_data.json → used in matchup (edges, nodes)
const matchupHasH2H = implGetMatchup("Duke", "Michigan");
assert(
  matchupHasH2H.includes("H2H") || matchupHasH2H.includes("No H2H"),
  "graph_data.json edges used in matchup (H2H check)",
);

// transitive_analysis.json → used in matchup when no direct H2H exists
// Duke vs Ohio State: typically no direct H2H game, so transitive analysis is used
const matchupNoH2H = implGetMatchup("Duke", "Ohio State");
assert(
  matchupNoH2H.includes("Transitive") ||
    matchupNoH2H.includes("No transitive") ||
    matchupNoH2H.includes("transitive"),
  "transitive_analysis.json used in matchup output",
);

// torvik_stats.json → used in all tool outputs
assert(
  dukeOutput.includes("AdjEM"),
  "torvik_stats.json feeds implGetTeamStats AdjEM",
);

// recent_form.json → used in team stats
assert(
  dukeOutput.includes("L10") ||
    dukeOutput.includes("Streak") ||
    dukeOutput.includes("Last 3"),
  "recent_form.json feeds implGetTeamStats form section",
);

// injury_overrides.json → appears in team stats
assert(
  dukeOutput.includes("INJURY") || dukeOutput.toLowerCase().includes("injur"),
  "injury_overrides.json feeds implGetTeamStats injury block",
);

// espn_odds.json → odds for teams with upcoming games reach tool output
const oddsGameCount = Object.values(odds?.games ?? {}).filter(
  (gg) => !gg.completed,
).length;
assert(oddsGameCount > 0, `espn_odds.json has ${oddsGameCount} upcoming games`);

// all_games.json → tournament start detection + alive set
assert(
  aliveTeamIds.size > 0,
  `all_games.json used to compute ${aliveTeamIds.size} alive teams`,
);

// injury_news.json → reachable in buildInjuryContext
assert(
  injCtx.includes("RECENT INJURY NEWS") || injCtx.includes("INJURY REPORT"),
  "injury_news.json reachable via buildInjuryContext",
);

// roster_stats.json → player stats injected into injury context
assert(
  rosterEnriched,
  "roster_stats.json player stats reachable via buildInjuryContext",
);

// not_played.json (spot-check it exists and has pairs)
let notPlayed;
try {
  notPlayed = load("data/not_played.json");
  assert(
    Array.isArray(notPlayed) || typeof notPlayed === "object",
    "not_played.json loads",
  );
} catch {
  assert(true, "not_played.json optional — not present"); // not required
}

// ── Summary ──────────────────────────────────────────────────────────────────
process.stdout.write(`\n${"─".repeat(50)}\n`);
process.stdout.write(`${passed} passed  ${failed} failed\n`);
if (failures.length) {
  process.stderr.write("\nFailed:\n");
  failures.forEach((f) => process.stderr.write(`  ✗ ${f}\n`));
  process.exit(1);
} else {
  process.stdout.write("All tests passed ✓\n\n");
}
