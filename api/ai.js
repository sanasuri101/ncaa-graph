/**
 * api/ai.js — NCAA bracket AI chat using Vercel AI SDK + Groq
 *
 * Architecture:
 *   1. classifyIntent() — deterministic pattern match, no LLM
 *   2. preFetch()       — load relevant data, no LLM
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

import { readFileSync, statSync } from 'fs';
import { join }                   from 'path';
import { createGroq }             from '@ai-sdk/groq';
import { streamText, generateText, tool } from 'ai';
import { z }                      from 'zod';

// ── Sanitizer ─────────────────────────────────────────────────────────────────
function sanitize(text) {
  if (!text) return '';
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^(Note|Explanation|Reasoning|Disclaimer|Commentary|Reminder)[:\s].*/gim, '')
    .replace(/^(I (have|will|am|did)|The response|As instructed|Following the|Per the|Based on the instructions?)[^\n]*/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ── Constants ─────────────────────────────────────────────────────────────────
const MODEL         = 'llama-3.3-70b-versatile';
const MAX_TOKENS    = 2048;
const MAX_STEPS     = 3;   // max tool call rounds before forced answer

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ── Cache ─────────────────────────────────────────────────────────────────────
let _cache      = null;
let _cacheMtime = 0;

function getCacheMtime() {
  const files = [
    'public/data/graph_data.json',
    'public/data/torvik_stats.json',
    'public/data/recent_form.json',
    'public/data/espn_odds.json',
    'data/all_games.json',
    'data/injury_overrides.json',
  ];
  let latest = 0;
  for (const f of files) {
    try { const { mtimeMs } = statSync(join(process.cwd(), f)); if (mtimeMs > latest) latest = mtimeMs; } catch {}
  }
  return latest;
}

function readJSON(name)     { return JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', name), 'utf8')); }
function readDataJSON(name) { return JSON.parse(readFileSync(join(process.cwd(), 'data', name), 'utf8')); }

function getData() {
  const mtime = getCacheMtime();
  if (_cache && mtime === _cacheMtime) return _cache;

  const graph  = readJSON('graph_data.json');
  const torvik = readJSON('torvik_stats.json');
  const form   = readJSON('recent_form.json');

  let oddsData = { games: {}, futures: {} };
  try { oddsData = readJSON('espn_odds.json'); } catch {}

  let transPairs = {};
  try { transPairs = readJSON('transitive_analysis.json')?.pairs ?? {}; } catch {}

  let injuryMap = {};
  try {
    const raw = readDataJSON('injury_overrides.json');
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

  // Alive teams from tournament results
  const aliveTeamIds = new Set();
  try {
    const bracketIds = new Set(graph.nodes.map(n => String(n.id)));
    const winners = new Set(), losers = new Set();
    JSON.parse(readFileSync(join(process.cwd(), 'data', 'all_games.json'), 'utf8'))
      .filter(g => g.date >= '2026-03-17')
      .forEach(g => {
        const t1 = String(g.team1_id), t2 = String(g.team2_id);
        if (!bracketIds.has(t1) && !bracketIds.has(t2)) return;
        (g.team1_winner ? winners : losers).add(t1);
        (g.team1_winner ? losers  : winners).add(t2);
      });
    for (const id of winners) if (!losers.has(id)) aliveTeamIds.add(id);
  } catch {}

  // Market odds per team
  const teamOdds = {};
  for (const g of Object.values(oddsData.games ?? {})) {
    if (!g.completed) {
      if (g.home_id) teamOdds[g.home_id] = { game: g.name, ml: g.odds?.home_moneyline, implied: g.odds?.home_implied_pct, bpi: g.bpi?.home_bpi_win_pct };
      if (g.away_id) teamOdds[g.away_id] = { game: g.name, ml: g.odds?.away_moneyline, implied: g.odds?.away_implied_pct, bpi: g.bpi?.away_bpi_win_pct };
    }
  }

  _cache = { graph, torvik, form, transPairs, injuryMap, nodeByName, edgesByNode, aliveTeamIds, oddsData, teamOdds };
  _cacheMtime = mtime;
  return _cache;
}

// ── Name normalization ────────────────────────────────────────────────────────
const ALIASES = {
  'unc':       'north carolina',          'uconn':    'uconn huskies',
  'ucf':       'ucf knights',             'ucla':     'ucla bruins',
  'umbc':      'umbc retrievers',         'vcu':      'vcu rams',
  'tcu':       'tcu horned frogs',        'smu':      'smu mustangs',
  'byu':       'byu cougars',             'lsu':      'lsu tigers',
  'liu':       'long island university',
  'isu':       'iowa state cyclones',     'iowa st':  'iowa state cyclones',
  'msu':       'michigan state spartans', 'mich st':  'michigan state spartans',
  'ku':        'kansas jayhawks',         'osu':      'ohio state buckeyes',
  'fsu':       'florida state seminoles', 'wvu':      'west virginia mountaineers',
  'a&m':       'texas a&m aggies',        'tamu':     'texas a&m aggies',
  'pitt':      'pittsburgh panthers',
  "st john's": 'saint johns red storm',   'sjr':      'saint johns red storm',
  'st johns':  'saint johns red storm',   'saint johns': 'saint johns red storm',
};

function normName(s) {
  return s.toLowerCase().trim()
    .replace(/'s\b/g, '')         // strip possessives: "Duke's" -> "Duke"
    .replace(/\bst\.\s*/g, 'saint ').replace(/\bst\s+/g, 'saint ')
    .replace(/\bft\.?\s+/g, 'fort ').replace(/[.'`]/g, '').replace(/\s+/g, ' ').trim();
}

function resolveTeam(name, nodeByName) {
  const raw   = name.toLowerCase().trim();
  const query = normName(ALIASES[raw] ?? name);
  const norm  = {};
  Object.keys(nodeByName).forEach(k => { norm[normName(k)] = nodeByName[k]; });
  if (norm[query]) return norm[query];
  // Word-boundary containment — prevents "michigan" matching "michigan state"
  const hits = Object.keys(norm)
    .filter(k => {
      if (k === query) return true;
      if (k.startsWith(query + ' ') || k.startsWith(query + '-')) return true;
      if (query.startsWith(k + ' ') || query.startsWith(k + '-')) return true;
      // Nickname: "wolverines" matches "michigan wolverines" (last word)
      const words = k.split(' ');
      if (words.length > 1 && words[words.length - 1] === query) return true;
      return false;
    })
    .sort((a, b) => {
      const ae = a === query ? 2 : a.startsWith(query) ? 1 : 0;
      const be = b === query ? 2 : b.startsWith(query) ? 1 : 0;
      return (be - ae) || (b.length - a.length);
    });
  return hits.length ? norm[hits[0]] : null;
}

// ── Format team block ─────────────────────────────────────────────────────────
function fmtTeam(node, torvik, form, injuryMap, teamOdds) {
  const tv   = torvik?.teams?.[node.id]?.torvik;
  const seed = node.seed != null ? `#${node.seed}` : '?';
  if (!tv) return `${node.full_name} (${node.region} ${seed}) | no Torvik data`;

  const pace   = tv.adj_tempo != null ? (tv.adj_tempo >= 0.7 ? 'Fast' : tv.adj_tempo >= 0.4 ? 'Moderate' : 'Slow') + ` (${tv.adj_tempo.toFixed(2)})` : '?';
  const tf     = form?.teams?.[node.id];
  const recent = tf?.games?.slice(-3).map(g => `${g.date.slice(5)}: ${g.won ? 'W' : 'L'} ${g.score} vs ${g.opp}`).join(' | ') ?? '';
  const inj    = injuryMap?.[node.id];
  const injStr = inj ? `⚠ INJURY (AdjEM -${inj.penalty}): ${inj.players.map(p => `${p.name} — ${p.status}`).join('; ')}${inj.notes ? ' | ' + inj.notes : ''}` : '';
  const odds   = teamOdds?.[node.id];
  const oddsStr= odds ? `Market: ML ${odds.ml ?? '?'} (${odds.implied ?? '?'}% implied) | BPI: ${odds.bpi ?? '?'}% | ${odds.game}` : '';

  return [
    `${node.full_name} (${node.region} ${seed}, ${tv.conf ?? '?'})`,
    `Record: ${tv.record} | Bracket: ${node.wins_vs_field}W-${node.losses_vs_field}L`,
    `T-Rank #${tv.rank} | AdjEM: ${tv.adj_em > 0 ? '+' : ''}${tv.adj_em} | AdjOE: ${tv.adj_oe} | AdjDE: ${tv.adj_de}`,
    `Barthag: ${(tv.barthag * 100).toFixed(1)}% | WAB: ${parseFloat(tv.wab).toFixed(1)} | Pace: ${pace}`,
    `Shooting: 2P% ${tv.two_p ?? '?'} | 3P% ${tv.three_p ?? '?'} | FT% ${tv.ft_pct ?? '?'} | eFG% ${tv.efg ?? '?'}`,
    tf ? `Form: ${tf.last10} L10 | Streak: ${tf.streak}` : '',
    recent ? `Last 3: ${recent}` : '',
    oddsStr,
    injStr,
  ].filter(Boolean).join('\n  ');
}

// ── Tool implementations ──────────────────────────────────────────────────────
function implGetTeamStats(teamNames) {
  const { torvik, form, injuryMap, nodeByName, teamOdds } = getData();
  if (!teamNames?.length) return 'No team names provided.';
  return teamNames.map(name => {
    const node = resolveTeam(name, nodeByName);
    return node ? fmtTeam(node, torvik, form, injuryMap, teamOdds) : `"${name}": not found — check spelling`;
  }).join('\n\n---\n\n');
}

function implGetMatchup(teamA, teamB) {
  const { graph, torvik, form, transPairs, injuryMap, nodeByName, edgesByNode, teamOdds } = getData();
  const nodeA = resolveTeam(teamA, nodeByName);
  const nodeB = resolveTeam(teamB, nodeByName);
  if (!nodeA) return `Team not found: "${teamA}"`;
  if (!nodeB) return `Team not found: "${teamB}"`;

  const lines = [
    `=== ${nodeA.full_name} vs ${nodeB.full_name} ===`,
    fmtTeam(nodeA, torvik, form, injuryMap, teamOdds), '',
    fmtTeam(nodeB, torvik, form, injuryMap, teamOdds),
  ];

  const aEdges = edgesByNode[nodeA.id] || [];
  const bEdges = edgesByNode[nodeB.id] || [];
  const h2h    = aEdges.filter(e => (e.from === nodeA.id && e.to === nodeB.id) || (e.from === nodeB.id && e.to === nodeA.id));

  if (h2h.length) {
    lines.push(`\nH2H (${h2h.length} game${h2h.length > 1 ? 's' : ''}):`);
    h2h.forEach(e => lines.push(`  ${e.date}: ${e.from === nodeA.id ? nodeA.label : nodeB.label} won ${e.label} (+${e.margin})`));
  } else {
    lines.push('\nNo H2H this season.');
    const aOpps = new Set(aEdges.map(e => e.from === nodeA.id ? e.to : e.from));
    const bOpps = new Set(bEdges.map(e => e.from === nodeB.id ? e.to : e.from));
    const common = [...aOpps].filter(id => bOpps.has(id)).slice(0, 5);
    if (common.length) {
      lines.push(`\nCommon opponents (${common.length}):`);
      common.forEach(cid => {
        const cNode = graph.nodes.find(n => n.id === cid);
        const aGame = aEdges.find(e => (e.from === nodeA.id && e.to === cid) || (e.to === nodeA.id && e.from === cid));
        const bGame = bEdges.find(e => (e.from === nodeB.id && e.to === cid) || (e.to === nodeB.id && e.from === cid));
        const aR = aGame ? (aGame.from === nodeA.id ? `W ${aGame.label}` : `L ${aGame.label}`) : '?';
        const bR = bGame ? (bGame.from === nodeB.id ? `W ${bGame.label}` : `L ${bGame.label}`) : '?';
        lines.push(`  vs ${cNode?.label ?? cid}: ${nodeA.label} ${aR} | ${nodeB.label} ${bR}`);
      });
    }
    const tp = transPairs[`${nodeA.id}_${nodeB.id}`] || transPairs[`${nodeB.id}_${nodeA.id}`];
    if (tp?.n > 0) {
      const flipped = !!transPairs[`${nodeB.id}_${nodeA.id}`] && !transPairs[`${nodeA.id}_${nodeB.id}`];
      const favors  = tp.verdict === 'a' ? (flipped ? nodeB.label : nodeA.label)
                    : tp.verdict === 'b' ? (flipped ? nodeA.label : nodeB.label) : 'neither';
      lines.push(`\nTransitive (${tp.n} signals, conf ${tp.conf?.toFixed(0) ?? '?'}/100): favors ${favors}`);
      (tp.a || []).slice(0, 2).forEach(s => lines.push(`  + ${nodeA.label} beat ${s.common_name} (${s.a_score}), who beat ${nodeB.label} (${s.b_score})`));
      (tp.b || []).slice(0, 2).forEach(s => lines.push(`  + ${nodeB.label} beat ${s.common_name} (${s.b_score}), who beat ${nodeA.label} (${s.a_score})`));
    } else {
      lines.push('\nNo transitive evidence found.');
    }
  }
  return lines.join('\n');
}

function implGetStandings(sortBy, region, limit) {
  const VALID_SORT    = ['adj_em', 'barthag', 'rank', 'wins_vs_field', 'seed'];
  const VALID_REGIONS = ['East', 'West', 'South', 'Midwest'];
  sortBy = VALID_SORT.includes(sortBy) ? sortBy : 'adj_em';
  region = VALID_REGIONS.includes(region) ? region : null;
  const parsed = parseInt(limit, 10);
  limit = Math.min(isNaN(parsed) ? 16 : parsed, 25);

  const { graph, torvik, form, aliveTeamIds, teamOdds } = getData();
  let teams = graph.nodes
    .map(n => ({ node: n, tv: torvik?.teams?.[n.id]?.torvik }))
    .filter(t => !aliveTeamIds.size || aliveTeamIds.has(String(t.node.id)));

  if (region) teams = teams.filter(t => t.node.region === region);

  const val = t => {
    if (sortBy === 'adj_em')        return t.tv?.adj_em ?? -999;
    if (sortBy === 'barthag')       return t.tv?.barthag ?? 0;
    if (sortBy === 'rank')          return -(t.tv?.rank ?? 9999);
    if (sortBy === 'wins_vs_field') return t.node.wins_vs_field;
    if (sortBy === 'seed')          return -(t.node.seed ?? 99);
    return 0;
  };

  teams.sort((a, b) => val(b) - val(a));

  return teams.slice(0, limit).map((t, i) => {
    const seed    = t.node.seed != null ? `#${t.node.seed}` : '?';
    const tf      = form?.teams?.[t.node.id];
    const formStr = tf ? ` | ${tf.last10} L10 ${tf.streak}` : '';
    const tvStr   = t.tv ? `AdjEM ${t.tv.adj_em > 0 ? '+' : ''}${t.tv.adj_em} | AdjOE ${t.tv.adj_oe} | AdjDE ${t.tv.adj_de} | Barthag ${(t.tv.barthag * 100).toFixed(1)}%` : 'no Torvik';
    const odds    = teamOdds?.[t.node.id];
    const oddsStr = odds ? ` | ML ${odds.ml ?? '?'} (${odds.implied ?? '?'}% implied)` : '';
    return `${i + 1}. ${t.node.full_name} (${t.node.region} ${seed})${formStr} | ${tvStr}${oddsStr}`;
  }).join('\n');
}

// ── SDK Tool definitions — Zod schemas, no manual coercion needed ─────────────
function buildTools() {
  return {
    get_team_stats: tool({
      description: 'Get efficiency stats, form, roster and injury info for one or more teams.',
      parameters: z.object({
        team_names: z.array(z.string()).describe('Team names e.g. ["Duke", "Michigan"]'),
      }),
      execute: async ({ team_names }) => implGetTeamStats(team_names),
    }),
    get_matchup: tool({
      description: 'Get head-to-head history, common opponents and transitive evidence between two teams.',
      parameters: z.object({
        team_a: z.string().describe('First team name'),
        team_b: z.string().describe('Second team name'),
      }),
      execute: async ({ team_a, team_b }) => implGetMatchup(team_a, team_b),
    }),
    get_standings: tool({
      description: 'Get ranked list of alive teams. Use for "Final Four favorites", "best teams", "top efficiency" questions.',
      parameters: z.object({
        sort_by: z.enum(['adj_em', 'barthag', 'rank', 'wins_vs_field', 'seed'])
          .describe('adj_em=efficiency (use for favorites), barthag=win prob, rank=T-rank, seed=seeding'),
        region: z.enum(['East', 'West', 'South', 'Midwest', 'all']).optional()
          .describe('Filter to a region or all for full field'),
        limit: z.number().int().min(1).max(25).optional()
          .describe('Number of teams to return, default 16'),
      }),
      execute: async ({ sort_by, region, limit }) => implGetStandings(sort_by, region, limit),
    }),
  };
}

// ── Intent classification ─────────────────────────────────────────────────────
const REGIONS_ORDERED = ['Midwest', 'East', 'West', 'South'];

function classifyIntent(msg, graph) {
  const m = msg.toLowerCase();
  // Require NCAA/tournament-specific signal — generic sports words alone don't qualify
  // This prevents "NBA tonight", "play basketball", "Super Bowl" from hitting dynamic
  const hasNcaaSignal = /ncaa|march madness|\bsweet 16\b|\bsweet sixteen\b|\belite 8\b|\belite eight\b|\bfinal four\b|\bright four\b|round of 64|round of 32|first round|second round|torvik|barthag|adj.?em|adj.?oe|adj.?de|t-rank|basketball efficiency|team efficiency|\bbasketball\b|college basketball|ncaa bracket|tournament bracket|tournament pick|region picks?|midwest region|east region|west region|south region|\bseed\b.*\bbasketball\b|\bbasketball\b.*\bseed\b|overall seed|number.*seed|\bseeds?\b.*\badvance\b|\badvance\b.*\bseeds?\b|\b[0-9]+ seed|upset pick|chalk pick|bracket advice|bracket strategy|safe pick|value pick|picks this year|\b5-12\b|\b12-5\b|\b[0-9]+-[0-9]+ matchup\b|seed upset|win probability|wins it all|win it all|cut down the nets|national champion|injured|injury|\bout\b|out for|limited minutes|ppg|rpg|apg|per|three.?point pct|tempo mismatch|pace mismatch|cover the spread|beat the spread|against the spread|over.under|moneyline|the line|step up|change anything|affect the|still win|who wins|the key|does that|does this|who else|who steps|chances now|is.*playing\b|will.*play|any injuries|injury update|injury news|\bhurt\b|questionable|game.?time decision/i.test(m);
  const hasTeamSignal = graph?.nodes?.some(n => {
    const lbl = normName(n.label);
    const re  = new RegExp('\\b' + lbl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
    return re.test(normName(msg));
  }) ?? false;
  const hasOtherSport = /\bnba\b|\bnfl\b|\bnhl\b|\bmlb\b|\bwnba\b|\bsoccer\b|\bfootball\b|\bsuper bowl\b|\bworld series\b|\bstanley cup\b/i.test(m);
  const hasBball = (hasNcaaSignal || hasTeamSignal) && !hasOtherSport;

  if (/haven.?t played|not played|could face|potential matchup/i.test(m))
    return { type: 'unplayed_matchups' };

  if (/final four|champion|title contend|win it all|wins it all|win the tournament|wins the tournament|national title|who.*win.*whole|who.*favori|pick.*win|pick.*champion|who.*(should|would|will).*win/i.test(m))
    return { type: 'top_teams_all' };

  if (/undervalued|underrated|overvalued|market.*value|value.*market|mispriced|odds.*wrong|line.*off|market.*vs|model.*vs.*market|sharp money|betting value|are the odds|\bodds\b.*\?|what.*odds|value bet|value.*betting|\bml\b|moneyline|money line|plus.*minus|\bats\b|against the spread|cover the spread|covers? the spread|\bwho covers\b|beat the spread|does.*cover|spread.*right|favored correctly|the line|over.under|affect.*spread|affect.*line|affect.*odds|injury.*spread|injury.*line|injury.*odds|new line|line move|odds change|line change|prop bet|futures.*odds|implied prob|who covers|betting market|\b[+-][0-9]{3,4}\b|has it right|line.*right|market.*right|priced.*right/i.test(m))
    return { type: 'market_analysis' };

  if (/sleeper|dark.horse|cinderella|upset.pick|surprise pick|overachiev|best upset|who.*should.*pick|bracket.*pick/i.test(m)) {
    // If a specific tournament team is named, fall through to team_lookup
    const mNormSleeper = normName(msg);
    const namedTeam = graph?.nodes?.some(n => {
      const lbl  = normName(n.label);
      const full = normName(n.full_name);
      const rLbl  = new RegExp('\\b' + lbl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
      const rFull = new RegExp('\\b' + full.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
      return rLbl.test(mNormSleeper) || rFull.test(mNormSleeper);
    }) ?? false;
    if (!namedTeam) return { type: 'sleeper_all_regions' };
    // else fall through to team matching below
  }

  for (const r of REGIONS_ORDERED) {
    if (m.includes(r.toLowerCase()) && /best|top|strong|effici|rank|adj.?em|barthag|who|favor|win|pick|bracket|like|predict|advance/i.test(m))
      return { type: 'region_standings', region: r };
  }

  if (/best teams|top teams|strongest|who.?s best|who are the best|top.*remaining|best.*efficiency|most efficient|best.*adj.?em|efficiency.*margin/i.test(m))
    return { type: 'top_teams_all' };

  if (graph) {
    // Expand aliases in message: "isu" → "iowa state cyclones" before node matching
    let mNorm = normName(msg);
    for (const [alias, expansion] of Object.entries(ALIASES)) {
      const aliasNorm = normName(alias);
      const re = new RegExp('\\b' + aliasNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g');
      mNorm = mNorm.replace(re, normName(expansion));
    }
    // Normalize state abbreviations: "michigan state" → "michigan st" for label matching
    const mAbbrev = mNorm
      .replace(/\bmichigan state\b/g, 'michigan st')
      .replace(/\b(\w+) state\b/g, '$1 st');

    const found = graph.nodes.filter(n => {
      const lbl  = normName(n.label);
      const full = normName(n.full_name);
      const rLbl  = new RegExp('\\b' + lbl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
      const rFull = new RegExp('\\b' + full.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
      return rLbl.test(mNorm) || rFull.test(mNorm) || rLbl.test(mAbbrev) || rFull.test(mAbbrev);
    });

    // 2+ found: return as matchup — UNLESS injury/follow-up signal present
    // e.g. "are there injuries for duke and arizona?" should be dynamic not matchup
    if (found.length >= 2) {
      const hasInjurySignal = /injur\w*|\bhurt\b|is.*playing\b|any injury|out for|limited minutes|questionable|who steps up|who else/i.test(m);
      if (hasInjurySignal) return { type: 'dynamic' };
      let teams = found;
      if (found.length > 2) {
        teams = found.filter((n, i) => {
          const nl = normName(n.label);
          return !found.some((o, j) => j !== i && normName(o.label).startsWith(nl + ' '));
        }).slice(0, 2);
        if (teams.length < 2) teams = found.slice(0, 2);
      }
      return { type: 'matchup', team_a: teams[0].label, team_b: teams[1].label };
    }
    if (found.length === 1) {
      const hasNonBball = /university|college admission|job|career|hire|school|professor|campus|degree|graduate|apply|application/i.test(m);
      if (hasNonBball) return { type: 'general' };
      // Follow-up questions like "how does that affect iowa state?" should go dynamic
      // so the model can use chat history, not trigger a fresh team profile lookup
      const isFollowUp = /injur\w*|injury news|is.*playing\b|any injury|hurt\b|questionable|\baffect\b|\bimpact\b|\bchange\b|does that|who else|step up|what about|the news|is out|out for|will he|will she|is he\b|is she\b|when is he|when does|limited minutes|\brepeat\b|same (question|analysis|thing)|analysis for|do the same|redo|reconsider|not gonna|wont win|can.?t win|gonna lose|too weak|no chance|broke his|broke her|broke their|fractured|sprained|tweaked|hobbling|limping|missed.*game|miss.*game/i.test(m);
      if (isFollowUp) return { type: 'dynamic' };
      const hasAnalysis = /tell me|how is|stats|analysis|record|rank|efficiency|looking|how.*doing|how.*playing|how.*perform|season|chance|beat|win|lose|matchup|tournament|bracket|predict|advance|start\w*|lineup|rotation|depth chart|bench|roster|who plays|who starts|is.*sleeper|is.*upset|upset pick|sleeper pick|dark horse|cinderella|got this|got a chance|got what|can they|will they|should I pick|path to|road to|chances of/i.test(m);
      if (hasNcaaSignal || hasAnalysis) return { type: 'team_lookup', team: found[0].label };
    }
  }

  if (!hasBball) return { type: 'general' };
  return { type: 'dynamic' };
}

// ── Pre-fetch ─────────────────────────────────────────────────────────────────
function preFetch(intent, graph, torvik) {
  const thinking = [];
  const blocks   = [];

  switch (intent.type) {
    case 'sleeper_all_regions':
      for (const r of REGIONS_ORDERED) {
        thinking.push(`Checking standings — ${r}`);
        blocks.push(`=== ${r.toUpperCase()} ===\n` + implGetStandings('adj_em', r, 8));
      }
      break;

    case 'top_teams_all': {
      thinking.push('Checking top teams by efficiency + market');
      blocks.push('TOP TEAMS (alive, by efficiency):\n' + implGetStandings('adj_em', null, 16));
      const { oddsData } = getData();
      const upcoming = Object.values(oddsData?.games ?? {}).filter(g => !g.completed);
      if (upcoming.length) {
        blocks.push('UPCOMING GAMES + MARKET LINES:\n' + upcoming.map(g => {
          const o = g.odds, b = g.bpi;
          return [g.name, `Spread: ${o?.spread ?? '?'}`,
            `${g.away} ML ${o?.away_moneyline ?? '?'} (${o?.away_implied_pct ?? '?'}%) BPI ${b?.away_bpi_win_pct ?? '?'}%`,
            `${g.home} ML ${o?.home_moneyline ?? '?'} (${o?.home_implied_pct ?? '?'}%) BPI ${b?.home_bpi_win_pct ?? '?'}%`,
          ].join(' | ');
        }).join('\n'));
      }
      break;
    }

    case 'market_analysis': {
      thinking.push('Checking market vs model divergence');
      blocks.push('ALIVE TEAMS BY EFFICIENCY:\n' + implGetStandings('adj_em', null, 16));
      const { oddsData } = getData();
      const upcoming = Object.values(oddsData?.games ?? {}).filter(g => !g.completed);
      if (upcoming.length) {
        blocks.push('MARKET LINES:\n' + upcoming.map(g => {
          const o = g.odds, b = g.bpi;
          return [g.name, `Spread: ${o?.spread ?? '?'}`,
            `${g.away} ML ${o?.away_moneyline ?? '?'} (${o?.away_implied_pct ?? '?'}%) BPI ${b?.away_bpi_win_pct ?? '?'}%`,
            `${g.home} ML ${o?.home_moneyline ?? '?'} (${o?.home_implied_pct ?? '?'}%) BPI ${b?.home_bpi_win_pct ?? '?'}%`,
          ].join(' | ');
        }).join('\n'));
      }
      if (intent.team) {
        thinking.push('Loading ' + intent.team + ' stats');
        blocks.push(implGetTeamStats([intent.team]));
      }
      break;
    }

    case 'region_standings':
      thinking.push(`Checking standings — ${intent.region}`);
      blocks.push(implGetStandings('adj_em', intent.region, 16));
      break;

    case 'matchup':
      thinking.push(`Analysing ${intent.team_a} vs ${intent.team_b}`);
      blocks.push(implGetMatchup(intent.team_a, intent.team_b));
      break;

    case 'team_lookup':
      thinking.push(`Looking up ${intent.team} stats`);
      blocks.push(implGetTeamStats([intent.team]));
      break;

    case 'unplayed_matchups': {
      thinking.push('Checking potential future matchups');
      blocks.push('TOP TEAMS:\n' + implGetStandings('adj_em', null, 8));
      const { aliveTeamIds } = getData();
      const ranked = graph.nodes
        .filter(n => !aliveTeamIds.size || aliveTeamIds.has(String(n.id)))
        .map(n => ({ n, tv: torvik?.teams?.[n.id]?.torvik }))
        .filter(x => x.tv).sort((a, b) => (b.tv.adj_em ?? -999) - (a.tv.adj_em ?? -999))
        .slice(0, 6);
      const edgeSet = new Set(graph.edges.map(e => `${e.from}-${e.to}`));
      const unplayed = [];
      for (let i = 0; i < ranked.length; i++)
        for (let j = i + 1; j < ranked.length; j++) {
          const a = ranked[i].n, b = ranked[j].n;
          if (!edgeSet.has(`${a.id}-${b.id}`) && !edgeSet.has(`${b.id}-${a.id}`))
            unplayed.push(`${a.full_name} (${a.region} #${a.seed}) vs ${b.full_name} (${b.region} #${b.seed})`);
        }
      if (unplayed.length) blocks.push('POTENTIAL MATCHUPS:\n' + unplayed.join('\n'));
      break;
    }

    default:
      // dynamic — inject baseline so model has real data
      if (intent.type === 'dynamic')
        blocks.push('ALIVE TEAMS BY EFFICIENCY:\n' + implGetStandings('adj_em', null, 16));
      break;
  }

  return { context: blocks.join('\n\n'), thinking };
}

// ── System prompt ─────────────────────────────────────────────────────────────
function buildSystemPrompt(userMsg, graph, torvik, form, injuryMap, prefetchedContext, intent) {
  const { aliveTeamIds, teamOdds } = getData();
  const aliveCount = aliveTeamIds?.size || 16;
  const round  = aliveCount >= 16 ? 'Sweet 16' : aliveCount >= 8 ? 'Elite Eight' : aliveCount >= 4 ? 'Final Four' : 'Championship';
  const season = graph?.meta?.season?.split('-')[1] ?? String(new Date().getFullYear());

  let scopeContext = '';
  if (!prefetchedContext) {
    const mNorm = normName(userMsg);
    const mentioned = graph.nodes.filter(n => {
      const lbl = normName(n.label);
      const re  = new RegExp('\\b' + lbl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
      return re.test(mNorm);
    }).slice(0, 6);

    if (mentioned.length) {
      scopeContext = mentioned.map(n => fmtTeam(n, torvik, form, injuryMap, teamOdds)).join('\n\n');
      const scopeIds = new Set(mentioned.map(n => n.id));
      const gameLines = graph.edges.filter(e => scopeIds.has(e.from) || scopeIds.has(e.to)).slice(0, 15)
        .map(e => `${graph.nodes.find(n => n.id === e.from)?.label ?? e.from} beat ${graph.nodes.find(n => n.id === e.to)?.label ?? e.to} ${e.label} on ${(e.date ?? '').slice(5, 10)}`);
      if (gameLines.length) scopeContext += '\n\nRECENT RESULTS:\n' + gameLines.join('\n');
    } else {
      scopeContext = 'ALIVE TEAMS BY EFFICIENCY:\n' + implGetStandings('adj_em', null, 16);
    }
  }

  const context = prefetchedContext || scopeContext;
  const intentType = intent?.type ?? 'dynamic';

  let p = `You are AI Scout, an expert NCAA basketball analyst. ${season} March Madness ${round}. ${aliveCount} teams remain. Today is March 24, 2026.\n`;
  p += `Only reference teams still alive. No eliminated teams.\n\n`;

  if (intentType === 'matchup' || intentType === 'team_lookup' || intentType === 'multi_team') {
    p += `TASK: Deep matchup or team analysis.\n`;
    p += `- Lead with the AdjEM gap (1pt = 1pt per 100 possessions). State whether it is decisive (>10), meaningful (5-10), or a toss-up (<5).\n`;
    p += `- Barthag = neutral court win probability — state it explicitly.\n`;
    p += `- Compare AdjOE vs opponent AdjDE for offensive edge; AdjDE vs opponent AdjOE for defensive edge.\n`;
    p += `- Cite recent form, streaks, any injuries with their exact AdjEM penalty applied.\n`;
    p += `- If market odds diverge from Barthag by more than 8 points, explain the gap.\n`;
    p += `- Close with: who wins, exact win probability, and the single stat that decides it.\n`;

  } else if (intentType === 'top_teams_all') {
    p += `TASK: Identify the Final Four and championship favorites. Write this as analytical prose, not a numbered stat list.\n`;
    p += `- For the top 4 contenders: state their path through the bracket, their dominant strength, and their one beatable weakness.\n`;
    p += `- Compare efficiency (AdjEM) vs market implied probability for each — call out any significant divergence.\n`;
    p += `- Name a dark horse or two that the bracket field is underestimating.\n`;
    p += `- Be direct: pick your Final Four and state your championship pick with a specific reason.\n`;

  } else if (intentType === 'sleeper_all_regions') {
    p += `TASK: Find the best upset picks in the remaining bracket. Do not apply the same efficiency template to each game — tell the story of how each upset happens.\n`;
    p += `- For each upset pick: name the specific matchup, then explain the mechanism — what does the underdog do well that the favorite is vulnerable to?\n`;
    p += `- Look for: pace mismatches, defensive strengths vs offensive styles, injuries to the favorite, recent momentum shifts, market lines that overvalue seeds.\n`;
    p += `- Rank from most to least likely. Give each pick a realistic probability range.\n`;
    p += `- Do not just list AdjEM gaps — connect the numbers to how the game will actually be played.\n`;

  } else if (intentType === 'market_analysis') {
    p += `TASK: Find teams the market is mispricing. Lead with the biggest discrepancies.\n`;
    p += `- Compare BPI win probability vs DraftKings implied probability (from moneyline) for each upcoming game.\n`;
    p += `- Undervalued = BPI substantially higher than market implied. Overvalued = market implied substantially higher than BPI.\n`;
    p += `- For each mispriced team: exact gap in percentage points, and what the market is missing (injury not priced in, recency bias, AdjDE advantage, pace mismatch).\n`;
    p += `- Give a direct betting recommendation: value bet, fade, or no edge.\n`;

  } else if (intentType === 'region_standings') {
    p += `TASK: Break down the ${intent?.region ?? 'tournament'} region. Who advances and why?\n`;
    p += `- Rank the remaining teams by realistic championship probability, not just seed.\n`;
    p += `- For each: their most likely path, who they need to beat, and their biggest vulnerability.\n`;
    p += `- Call out any upset you see coming and why the higher seed is beatable.\n`;

  } else if (intentType === 'unplayed_matchups') {
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

// ── Streaming response writer ─────────────────────────────────────────────────
// Writes newline-delimited JSON to the response stream.
// Each line is: data: {"type":"...","text":"..."}\n\n
function makeWriter(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    ...CORS,
  });
  return {
    thinking: (text) => res.write(`data: ${JSON.stringify({ type: 'thinking', text })}\n\n`),
    tool:     (text) => res.write(`data: ${JSON.stringify({ type: 'tool',     text })}\n\n`),
    text:     (text) => res.write(`data: ${JSON.stringify({ type: 'text',     text })}\n\n`),
    done:     ()     => { res.write('data: {"type":"done"}\n\n'); res.end(); },
    error:    (msg)  => { res.write(`data: ${JSON.stringify({ type: 'error', text: msg })}\n\n`); res.end(); },
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return; }
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'Method not allowed' } }));
    return;
  }

  let body;
  try {
    const raw = await new Promise((resolve, reject) => {
      let d = ''; req.on('data', c => { d += c; }); req.on('end', () => resolve(d)); req.on('error', reject);
    });
    body = JSON.parse(raw);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'Invalid JSON' } }));
    return;
  }

  if (!Array.isArray(body?.messages)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'Missing messages array' } }));
    return;
  }

  const groqKey = process.env.GROQ_KEY;
  if (!groqKey) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'Server configuration error' } }));
    return;
  }

  const writer = makeWriter(res);

  try {
    const userMsg = body.userMsg || '';
    const { graph, torvik, form, injuryMap } = getData();

    // Step 1: classify + pre-fetch
    const intent   = classifyIntent(userMsg, graph);
    const prefetch = preFetch(intent, graph, torvik);

    // Step 2: emit thinking labels to client immediately
    for (const t of prefetch.thinking) writer.thinking(t);

    // Step 3: build system prompt
    const system = buildSystemPrompt(userMsg, graph, torvik, form, injuryMap, prefetch.context, intent);

    // Trim history to fit token budget (rough estimate — SDK tracks exact usage)
    const BUDGET = 3000; // chars for history
    const history = [];
    let used = 0;
    for (let i = body.messages.length - 1; i >= 0; i--) {
      const len = (body.messages[i].content ?? '').length;
      if (used + len > BUDGET) break;
      history.unshift(body.messages[i]);
      used += len;
    }

    const messages = [{ role: 'system', content: system }, ...history];

    // Step 4a: off-topic — immediate polite redirect, no Groq call needed
    if (intent.type === 'general') {
      // If there's prior conversation context, user is likely asking a follow-up
      // e.g. "is jefferson injured?" after an Iowa State analysis — route to dynamic
      const hasHistory = history.some(m => m.role === 'assistant' && m.content?.length > 20);
      if (hasHistory) {
        // Fall through to dynamic — model uses chat history for context
        intent.type = 'dynamic';
      } else {
        writer.text("I'm focused on the 2026 NCAA Tournament. Ask me about matchups, upset picks, team efficiency, Final Four predictions, or bracket strategy.");
        writer.done();
        return;
      }
    }

    // Step 4b: known intents — no tools, stream directly
    if (intent.type !== 'dynamic') {
      const groq   = createGroq({ apiKey: groqKey });
      const result = streamText({
        model:      groq(MODEL),
        messages,
        maxTokens:  MAX_TOKENS,
      });

      for await (const chunk of result.textStream) {
        writer.text(chunk); // raw — browser sanitizes full text on done
      }
      writer.done();
      return;
    }

    // Step 5: dynamic — stream with tools + maxSteps
    const groq  = createGroq({ apiKey: groqKey });
    const tools = buildTools();

    const result = streamText({
      model:     groq(MODEL),
      messages,
      maxTokens: MAX_TOKENS,
      tools,
      maxSteps:  MAX_STEPS,
      onStepFinish: ({ toolCalls }) => {
        // Emit tool labels as they fire so client shows thinking steps in real time
        if (toolCalls) {
          for (const tc of toolCalls) {
            const label = tc.toolName === 'get_team_stats' ? `Looking up ${(tc.args?.team_names ?? []).join(', ')}`
                        : tc.toolName === 'get_matchup'    ? `Analysing ${tc.args?.team_a} vs ${tc.args?.team_b}`
                        : `Checking standings${tc.args?.region && tc.args.region !== 'all' ? ' — ' + tc.args.region : ''}`;
            writer.tool(label);
          }
        }
      },
    });

    for await (const chunk of result.textStream) {
      writer.text(chunk); // raw — browser sanitizes full text on done
    }
    writer.done();

  } catch (err) {
    writer.error(err.message ?? 'Internal server error');
  }
}
