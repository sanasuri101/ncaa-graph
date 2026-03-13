/**
 * api/ai.js — Vercel serverless function (Node.js), AI proxy with tool calling
 *
 * Request body:  { messages: Message[], userMsg: string }
 * Response body: Groq API shape { choices: [{ message: { content: string } }] }
 *
 * Environment variables required:
 *   GROQ_KEY — Groq API key
 */

import { readFileSync } from 'fs';
import { join }         from 'path';

const GROQ_URL      = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL         = 'llama-3.3-70b-versatile';
const MAX_TOKENS    = 2048;
const GROQ_TPM_CAP  = 14000;
const CHARS_PER_TOK = 4;
const TOOL_MAX_ITER = 6;
const FETCH_TIMEOUT = 15000;

// ── CORS headers ──────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ── Tool definitions ──────────────────────────────────────────────────────────
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_team_stats',
      description: 'Get full stats for one or more teams. Use when asked about specific teams.',
      parameters: {
        type: 'object',
        properties: {
          team_names: {
            type: 'array',
            items: { type: 'string' },
            description: 'Team names as they appear in the bracket (e.g. ["Duke", "Michigan"])',
          },
        },
        required: ['team_names'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_matchup',
      description: 'Get head-to-head history and common opponents between two teams. Use when comparing or predicting a matchup.',
      parameters: {
        type: 'object',
        properties: {
          team_a: { type: 'string' },
          team_b: { type: 'string' },
        },
        required: ['team_a', 'team_b'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_standings',
      description: 'Get ranked list of teams by a metric. Use for "best teams", "strongest region", "top seeds" questions.',
      parameters: {
        type: 'object',
        properties: {
          sort_by: {
            type: 'string',
            enum: ['adj_em', 'barthag', 'rank', 'wins_vs_field', 'seed'],
          },
          region: {
            type: 'string',
            enum: ['East', 'West', 'South', 'Midwest', 'bubble', 'all'],
          },
          limit: { anyOf: [{ type: 'number' }, { type: 'string' }], description: 'How many results (e.g. 10)' },
        },
        required: ['sort_by'],
      },
    },
  },
];

// ── Data cache — populated once at cold start ─────────────────────────────────
let _cache = null;

function readJSON(name) {
  // public/ is outputDirectory — Vercel copies it to cwd at deploy time
  const p = join(process.cwd(), 'public', 'data', name);
  return JSON.parse(readFileSync(p, 'utf8'));
}

function getData() {
  if (_cache) return _cache;
  const graph  = readJSON('graph_data.json');
  const torvik = readJSON('torvik_stats.json');
  const form   = readJSON('recent_form.json');

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

  _cache = { graph, torvik, form, nodeByName, edgesByNode };
  return _cache;
}

// ── Team lookup — tolerant of partial names ───────────────────────────────────
function resolveTeam(name, nodeByName) {
  const q = name.toLowerCase().trim();
  if (nodeByName[q]) return nodeByName[q];
  const key = Object.keys(nodeByName).find(k => k.includes(q) || q.includes(k));
  return key ? nodeByName[key] : null;
}

function fmtTeam(node, torvik, form) {
  const tv   = torvik?.teams?.[node.id]?.torvik;
  const seed = node.seed != null ? `#${node.seed}` : 'bubble';
  const base = `${node.full_name} (${node.region} ${seed}, ${tv?.conf ?? '?'}) Season: ${tv?.record ?? node.wins_vs_field + '-' + node.losses_vs_field} | vs bracket field: ${node.wins_vs_field}W-${node.losses_vs_field}L`;
  if (!tv) return base + ' | no Torvik data';

  const pace = tv.adj_tempo != null
    ? (tv.adj_tempo >= 0.7 ? 'fast' : tv.adj_tempo >= 0.4 ? 'moderate' : 'slow') + ` (${tv.adj_tempo.toFixed(2)})`
    : '?';

  const shooting = [
    tv.two_p  != null ? `2P%: ${tv.two_p}` : null,
    tv.three_p != null ? `3P%: ${tv.three_p}` : null,
    tv.ft_pct != null ? `FT%: ${tv.ft_pct}` : null,
    tv.efg    != null ? `eFG%: ${tv.efg}`   : null,
  ].filter(Boolean).join(' | ');

  // Recent form from form file
  const teamForm = form?.teams?.[node.id];
  const formStr = teamForm
    ? `Last10: ${teamForm.last10} | Streak: ${teamForm.streak}`
    : '';

  // Last 3 games
  const recentGames = teamForm?.games?.slice(-3).map(g =>
    `${g.date.slice(5)}: ${g.won ? 'W' : 'L'} ${g.score} vs ${g.opp.replace(/ (Blue Devils|Wildcats|Tar Heels|Bulldogs|Tigers|Volunteers|Gators|Trojans|Hurricanes|Ducks|Aztecs|Cowboys|Razorbacks|Sooners|Cornhuskers|Aggies|Longhorns|Jayhawks|Bruins|Bears|Beavers|Cougars|Gamecocks|Hoyas|Huskies|Crimson Tide|Commodores|Cardinal|Boilermakers|Scarlet Knights|Wolverines|Buckeyes|Badgers|Spartans|Hawkeyes|Illini|Gophers|Nittany Lions|Terrapins|Yellow Jackets|Blue Hens|Panthers|Mountaineers|Musketeers|Flyers|Rams|Owls|Eagles|Falcons|Blue Raiders|Miners|Pirates|Bearcats|Red Raiders|Lobos|Rebels|Wolf Pack|Shockers|Racers|Bison|Vikings|Pride|Penguins|Golden Eagles|Mean Green|Monarchs|Phoenix|Antelopes|Jackrabbits|Lumberjacks|Highlanders|Roadrunners|Flames|Chanticleers|Golden Flashes|Tigers|Lions|Saints|Seahawks|Nighthawks|Patriots|Colonials|Catamounts|Bulldogs|Penguins|Terriers|Ravens|Hornets|Aztecs|Aggies)$/, '').trim()}`
  ).join('; ') ?? '';

  return [
    base,
    `T-Rank #${tv.rank} | AdjEM: ${tv.adj_em > 0 ? '+' : ''}${tv.adj_em} | AdjOE: ${tv.adj_oe} | AdjDE: ${tv.adj_de}`,
    `Barthag: ${(tv.barthag * 100).toFixed(1)}% | WAB: ${parseFloat(tv.wab).toFixed(1)} | SOS Rank: ${tv.sos_rank?.toFixed(2) ?? '?'} | Pace: ${pace}`,
    shooting ? `Shooting — ${shooting}` : '',
    formStr,
    recentGames ? `Recent: ${recentGames}` : '',
  ].filter(Boolean).join('\n  ');
}

// ── Tool implementations ──────────────────────────────────────────────────────
function toolGetTeamStats({ team_names }) {
  const { torvik, form, nodeByName } = getData();
  return team_names.map(name => {
    const node = resolveTeam(name, nodeByName);
    return node ? fmtTeam(node, torvik, form) : `${name}: not found`;
  }).join('\n\n');
}

function toolGetMatchup({ team_a, team_b }) {
  const { graph, torvik, form, nodeByName, edgesByNode } = getData();
  const nodeA = resolveTeam(team_a, nodeByName);
  const nodeB = resolveTeam(team_b, nodeByName);
  if (!nodeA) return `Team not found: ${team_a}`;
  if (!nodeB) return `Team not found: ${team_b}`;

  const lines = [
    `=== ${nodeA.full_name} vs ${nodeB.full_name} ===`,
    fmtTeam(nodeA, torvik, form),
    '',
    fmtTeam(nodeB, torvik, form),
  ];

  const aEdges = edgesByNode[nodeA.id] || [];
  const bEdges = edgesByNode[nodeB.id] || [];

  const h2h = aEdges.filter(e =>
    (e.from === nodeA.id && e.to === nodeB.id) ||
    (e.from === nodeB.id && e.to === nodeA.id)
  );

  if (h2h.length > 0) {
    lines.push(`\nHead-to-head (${h2h.length} game${h2h.length > 1 ? 's' : ''}):`);
    h2h.forEach(e => {
      const winner = e.from === nodeA.id ? nodeA.label : nodeB.label;
      lines.push(`  ${e.date}: ${winner} won ${e.label} (+${e.margin} pts)`);
    });
  } else {
    lines.push('\nHave NOT played each other this season.');
    const aOpps  = new Set(aEdges.map(e => e.from === nodeA.id ? e.to : e.from));
    const bOpps  = new Set(bEdges.map(e => e.from === nodeB.id ? e.to : e.from));
    const common = [...aOpps].filter(id => bOpps.has(id));
    if (common.length > 0) {
      lines.push(`\nCommon opponents (${common.length}):`);
      common.slice(0, 8).forEach(cid => {
        const cNode = graph.nodes.find(n => n.id === cid);
        const aGame = aEdges.find(e => (e.from === nodeA.id && e.to === cid) || (e.to === nodeA.id && e.from === cid));
        const bGame = bEdges.find(e => (e.from === nodeB.id && e.to === cid) || (e.to === nodeB.id && e.from === cid));
        const aRes  = aGame ? (aGame.from === nodeA.id ? `W ${aGame.label}` : `L ${aGame.label}`) : '?';
        const bRes  = bGame ? (bGame.from === nodeB.id ? `W ${bGame.label}` : `L ${bGame.label}`) : '?';
        lines.push(`  vs ${cNode?.label ?? cid}: ${nodeA.label} ${aRes} | ${nodeB.label} ${bRes}`);
      });
    }
  }
  return lines.join('\n');
}

function toolGetStandings({ sort_by, region = 'all', limit = 10 }) {
  limit = parseInt(limit, 10) || 10;
  const { graph, torvik } = getData();
  let teams = graph.nodes.map(n => ({ node: n, tv: torvik?.teams?.[n.id]?.torvik }));
  if (region !== 'all') teams = teams.filter(t => t.node.region === region);

  const val = t => {
    if (sort_by === 'adj_em')        return t.tv?.adj_em ?? -999;
    if (sort_by === 'barthag')       return t.tv?.barthag ?? 0;
    if (sort_by === 'rank')          return -(t.tv?.rank ?? 9999);
    if (sort_by === 'wins_vs_field') return t.node.wins_vs_field;
    if (sort_by === 'seed')          return -(t.node.seed ?? 99);
    return 0;
  };

  teams.sort((a, b) => val(b) - val(a));
  const { form } = getData();
  return teams.slice(0, Math.min(limit, 25)).map((t, i) => {
    const seed     = t.node.seed != null ? `#${t.node.seed}` : 'bubble';
    const teamForm = form?.teams?.[t.node.id];
    const formStr  = teamForm ? ` | ${teamForm.last10} L10 ${teamForm.streak}` : '';
    const tv_s     = t.tv
      ? `T-Rank #${t.tv.rank} AdjEM ${t.tv.adj_em > 0 ? '+' : ''}${t.tv.adj_em} AdjOE ${t.tv.adj_oe} AdjDE ${t.tv.adj_de} Barthag ${(t.tv.barthag * 100).toFixed(1)}%`
      : 'no Torvik';
    return `${i + 1}. ${t.node.full_name} (${t.node.region} ${seed}, ${t.tv?.conf ?? '?'}) ${t.tv?.record ?? t.node.wins_vs_field + '-' + t.node.losses_vs_field}${formStr} | ${tv_s}`;
  }).join('\n');
}

// ── Arg coercion — fixes Groq passing wrong types against the JSON schema ────
function coerceArgs(name, raw) {
  const args = { ...raw };
  if (name === 'get_team_stats') {
    // Accept string or array
    if (typeof args.team_names === 'string') args.team_names = [args.team_names];
    if (!Array.isArray(args.team_names))     args.team_names = [String(args.team_names ?? '')];
    args.team_names = args.team_names.filter(Boolean);
  }
  if (name === 'get_matchup') {
    args.team_a = String(args.team_a ?? args.team_1 ?? '').trim();
    args.team_b = String(args.team_b ?? args.team_2 ?? '').trim();
  }
  if (name === 'get_standings') {
    args.limit  = parseInt(args.limit, 10)  || 10;
    args.region = args.region ?? 'all';
    const validSortBy = ['adj_em', 'barthag', 'rank', 'wins_vs_field', 'seed'];
    if (!validSortBy.includes(args.sort_by)) args.sort_by = 'barthag';
  }
  return args;
}

function dispatchTool(name, rawArgs) {
  try {
    const args = coerceArgs(name, rawArgs);
    if (name === 'get_team_stats') return toolGetTeamStats(args);
    if (name === 'get_matchup')    return toolGetMatchup(args);
    if (name === 'get_standings')  return toolGetStandings(args);
    return `Unknown tool: ${name}`;
  } catch (err) {
    return `Tool error (${name}): ${err.message}`;
  }
}

// ── Token budget ──────────────────────────────────────────────────────────────
function estTokens(content) {
  const text = typeof content === 'string' ? content : JSON.stringify(content ?? '');
  return Math.ceil(text.length / CHARS_PER_TOK);
}

function estMessagesTokens(messages) {
  return messages.reduce((sum, m) => sum + estTokens(m.content), 0);
}

function trimHistory(messages, systemTokens) {
  const budget = GROQ_TPM_CAP - systemTokens - MAX_TOKENS;
  let used = 0;
  const out = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const t = estTokens(messages[i].content);
    if (used + t > budget) break;
    out.unshift(messages[i]);
    used += t;
  }
  return out;
}

// ── System prompt — server-side, query-scoped ─────────────────────────────────
function buildSystemPrompt(userMsg, graph, torvik, form, prefetchedContext) {
  const msgLower  = (userMsg || '').toLowerCase();
  const mentioned = graph.nodes.filter(n =>
    msgLower.includes(n.label.toLowerCase()) ||
    msgLower.includes(n.full_name.toLowerCase().split(' ')[0])
  );
  const scope = mentioned.slice(0, 8);

  const teamLines = scope.map(n => fmtTeam(n, torvik, form)).join('\n\n');
  const scopedIds = new Set(scope.map(n => n.id));
  const edges = scope.length > 0
    ? graph.edges.filter(e => scopedIds.has(e.from) || scopedIds.has(e.to)).slice(0, 20)
    : [];
  const gameLines = edges.map(e => {
    const wNode = graph.nodes.find(n => n.id === e.from);
    const lNode = graph.nodes.find(n => n.id === e.to);
    const w = wNode ? wNode.label : e.from;
    const l = lNode ? lNode.label : e.to;
    return w + ' beat ' + l + ' ' + e.label + ' on ' + (e.date || '').slice(5, 10);
  }).join('\n');

  const contextBlock = prefetchedContext ||
    (scope.length > 0
      ? teamLines + (gameLines ? '\n\nBRACKET GAMES:\n' + gameLines : '')
      : '');

  let prompt = 'You are AI Scout, an expert NCAA basketball analyst for the 2026 March Madness bracket.\n\n';
  prompt += 'TOOLS - call when you need data not already in DATA below:\n';
  prompt += '- get_team_stats(team_names: string[]) - full stats for one or more teams\n';
  prompt += '- get_matchup(team_a, team_b) - head-to-head results + common opponents\n';
  prompt += '- get_standings(sort_by, region?, limit?) - ranked list\n';
  prompt += '  sort_by options: adj_em | barthag | rank | wins_vs_field | seed\n';
  prompt += '  limit: must be a NUMBER like 10 not "10", default 10\n\n';
  prompt += 'ANALYSIS RULES:\n';
  prompt += '- Always cite specific numbers: AdjEM, Barthag, shooting splits, form, SOS\n';
  prompt += '- Compare stats explicitly e.g. Florida AdjOE 126.9 vs St Johns AdjDE 94.9 = +32 edge\n';
  prompt += '- For sleeper picks: cite seed vs T-Rank gap, recent form, one specific statistical edge\n';
  prompt += '- For efficiency questions: rank by AdjEM, explain the margin between teams\n';
  prompt += '- Never say seems to have an advantage - state the exact number\n';
  prompt += '- Be direct and specific. No hedging.';
  if (contextBlock) {
    prompt += '\n\nDATA:\n' + contextBlock;
  }
  return prompt;
}

const REGIONS = ['East', 'West', 'South', 'Midwest'];

function classifyIntent(msg) {
  const m = msg.toLowerCase();
  // Check unplayed BEFORE top_teams so "best teams that haven't played" hits correct branch
  if (/haven.?t played|not played|could face|potential matchup|best matchup/i.test(m))
    return { type: 'unplayed_matchups' };
  if (/sleeper|dark.horse|cinderella|upset.pick|surprise pick|under.rated|overachiev/i.test(m))
    return { type: 'sleeper_all_regions' };
  // Region-specific check — Midwest before West to avoid substring collision
  const REGIONS_ORDERED = ['Midwest', 'East', 'West', 'South'];
  for (const r of REGIONS_ORDERED) {
    if (m.includes(r.toLowerCase()) && /best|top|strong|effici|rank|adj.?em|barthag|who/i.test(m))
      return { type: 'region_standings', region: r };
  }
  if (/best teams|top teams|strongest|who.?s best|who are the best/i.test(m))
    return { type: 'top_teams_all' };
  return { type: 'dynamic' };
}

function preFetch(intent, graph, torvik, form) {
  const thinking = [];
  const blocks   = [];

  if (intent.type === 'sleeper_all_regions') {
    for (const region of REGIONS) {
      thinking.push('Checking standings \u2014 ' + region);
      blocks.push('=== ' + region.toUpperCase() + ' ===\n' + toolGetStandings({ sort_by: 'adj_em', region, limit: 16 }));
    }
    return { context: blocks.join('\n\n'), thinking };
  }

  if (intent.type === 'top_teams_all') {
    thinking.push('Checking top teams overall');
    blocks.push(toolGetStandings({ sort_by: 'adj_em', region: 'all', limit: 20 }));
    return { context: blocks.join('\n\n'), thinking };
  }

  if (intent.type === 'unplayed_matchups') {
    thinking.push('Checking top teams by efficiency');
    const top = toolGetStandings({ sort_by: 'adj_em', region: 'all', limit: 8 });
    blocks.push('TOP TEAMS:\n' + top);
    const ranked = graph.nodes
      .map(n => ({ n, tv: torvik && torvik.teams && torvik.teams[n.id] && torvik.teams[n.id].torvik }))
      .filter(x => x.tv)
      .sort((a, b) => (b.tv.adj_em || -999) - (a.tv.adj_em || -999))
      .slice(0, 6);
    const edgeSet = new Set(graph.edges.map(e => e.from + '-' + e.to));
    const unplayed = [];
    for (let i = 0; i < ranked.length; i++) {
      for (let j = i + 1; j < ranked.length; j++) {
        const a = ranked[i].n, b = ranked[j].n;
        if (!edgeSet.has(a.id + '-' + b.id) && !edgeSet.has(b.id + '-' + a.id)) {
          unplayed.push(a.full_name + ' (' + a.region + ' #' + a.seed + ') vs ' + b.full_name + ' (' + b.region + ' #' + b.seed + ')');
          thinking.push('Unplayed: ' + a.label + ' vs ' + b.label);
        }
      }
    }
    if (unplayed.length) blocks.push('TOP UNPLAYED MATCHUPS:\n' + unplayed.join('\n'));
    return { context: blocks.join('\n\n'), thinking };
  }

  if (intent.type === 'region_standings') {
    thinking.push('Checking standings \u2014 ' + intent.region);
    blocks.push(toolGetStandings({ sort_by: 'adj_em', region: intent.region, limit: 16 }));
    return { context: blocks.join('\n\n'), thinking };
  }

  return { context: '', thinking: [] };
}

// ── Groq fetch with timeout + retry on 429/503 ────────────────────────────────
async function groqFetch(payload, groqKey, attempt = 0) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  let res;
  try {
    res = await fetch(GROQ_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
      body:    JSON.stringify(payload),
      signal:  ctrl.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('Groq request timed out');
    throw err;
  }
  clearTimeout(timer);

  if ((res.status === 429 || res.status === 503) && attempt < 2) {
    const wait = parseInt(res.headers.get('retry-after') || '2', 10);
    await new Promise(r => setTimeout(r, Math.min(wait, 10) * 1000));
    return groqFetch(payload, groqKey, attempt + 1);
  }
  return res;
}

// ── Vercel Node.js handler — (req, res) not Web API Request ──────────────────
export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'Method not allowed' } }));
    return;
  }

  // Parse body — Node.js IncomingMessage has no .json(), read the stream
  let body;
  try {
    const raw = await new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => { data += chunk; });
      req.on('end',  () => resolve(data));
      req.on('error', reject);
    });
    body = JSON.parse(raw);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'Invalid JSON' } }));
    return;
  }

  if (!body.messages || !Array.isArray(body.messages)) {
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

  const send = (status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json', ...CORS });
    res.end(JSON.stringify(data));
  };

  const TOOL_LABELS = {
    get_team_stats: (a) => `Looking up ${(a.team_names ?? []).join(', ') || 'team'} stats`,
    get_matchup:    (a) => `Analysing ${a.team_a ?? '?'} vs ${a.team_b ?? '?'}`,
    get_standings:  (a) => `Checking standings${a.region ? ' — ' + a.region : ''}`,
  };

  try {
    const { graph, torvik, form } = getData();
    const userMsg = body.userMsg || '';

    // ── Step 1: classify intent and pre-fetch deterministically ──────────────
    const intent  = classifyIntent(userMsg);
    const prefetch = preFetch(intent, graph, torvik, form);
    const thinking = [...prefetch.thinking];

    // ── Step 2: build system prompt, inject pre-fetched data as context ──────
    const system  = buildSystemPrompt(userMsg, graph, torvik, form, prefetch.context);
    const sysToks = estTokens(system);
    const history = trimHistory(body.messages, sysToks);

    // ── Step 3: for known intents, skip tool calling entirely ────────────────
    if (intent.type !== 'dynamic') {
      const messages = [{ role: 'system', content: system }, ...history];
      const groqRes  = await groqFetch({ model: MODEL, max_tokens: MAX_TOKENS, messages, tool_choice: 'none' }, groqKey);
      const groqData = await groqRes.json();
      if (!groqRes.ok) {
        send(groqRes.status, { error: { message: groqData?.error?.message ?? 'Groq error' } });
        return;
      }
      const text = groqData.choices?.[0]?.message?.content || 'No response — please try again.';
      send(200, { text, thinking });
      return;
    }

    // ── Step 4: dynamic — open-ended tool calling for unclassified queries ───
    let messages = [{ role: 'system', content: system }, ...history];

    for (let iter = 0; iter < TOOL_MAX_ITER; iter++) {
      const groqRes  = await groqFetch({ model: MODEL, max_tokens: MAX_TOKENS, messages, tools: TOOLS, tool_choice: 'auto' }, groqKey);
      const groqData = await groqRes.json();

      if (!groqRes.ok) {
        send(groqRes.status, { error: { message: groqData?.error?.message ?? 'Groq error' } });
        return;
      }

      const choice    = groqData.choices?.[0];
      const reason    = choice?.finish_reason;
      const toolCalls = choice?.message?.tool_calls;
      const content   = choice?.message?.content ?? '';

      if (reason === 'stop' || reason === 'length') {
        send(200, { text: content || '', thinking });
        return;
      }

      // Model failed to generate valid tool args — answer from context
      if (!toolCalls?.length) {
        const fallbackRes  = await groqFetch({ model: MODEL, max_tokens: MAX_TOKENS, messages, tool_choice: 'none' }, groqKey);
        const fallbackData = await fallbackRes.json();
        const fallbackText = fallbackData.choices?.[0]?.message?.content ?? '';
        send(200, { text: fallbackText || 'Unable to answer — try rephrasing.', thinking });
        return;
      }

      messages.push(choice.message);
      for (const tc of toolCalls) {
        let args = {};
        let parseOk = false;
        try { args = JSON.parse(tc.function.arguments); parseOk = true; } catch {}
        if (!parseOk) {
          messages.push({ role: 'tool', tool_call_id: tc.id, content: 'Could not parse tool arguments.' });
          continue;
        }
        thinking.push(TOOL_LABELS[tc.function.name]?.(args) ?? tc.function.name);
        const result = dispatchTool(tc.function.name, args || {});
        messages.push({ role: 'tool', tool_call_id: tc.id, content: String(result) });
      }

      if (estMessagesTokens(messages) > GROQ_TPM_CAP - MAX_TOKENS) break;
    }

    // Final synthesis — no tools, just write the answer
    const sysToksNow = estTokens(messages[0].content);
    const trimmed    = [messages[0], ...trimHistory(messages.slice(1), sysToksNow)];
    const groqRes    = await groqFetch({ model: MODEL, max_tokens: MAX_TOKENS, messages: trimmed, tool_choice: 'none' }, groqKey);
    const groqData   = await groqRes.json();
    const finalText  = groqData.choices?.[0]?.message?.content;
    const fallback   = !finalText ? messages.filter(m => m.role === 'tool').slice(-1)[0]?.content : null;
    send(200, { text: finalText || fallback || 'No response — please try again.', thinking });

  } catch (err) {
    send(500, { error: { message: err.message } });
  }
}
