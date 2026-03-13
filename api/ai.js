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
const MAX_TOKENS    = 1024;
const GROQ_TPM_CAP  = 11000;
const CHARS_PER_TOK = 4;
const TOOL_MAX_ITER = 3;
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
          limit: { type: 'number' },
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

  _cache = { graph, torvik, nodeByName, edgesByNode };
  return _cache;
}

// ── Team lookup — tolerant of partial names ───────────────────────────────────
function resolveTeam(name, nodeByName) {
  const q = name.toLowerCase().trim();
  if (nodeByName[q]) return nodeByName[q];
  const key = Object.keys(nodeByName).find(k => k.includes(q) || q.includes(k));
  return key ? nodeByName[key] : null;
}

function fmtTeam(node, torvik) {
  const tv   = torvik?.teams?.[node.id]?.torvik;
  const seed = node.seed != null ? `#${node.seed}` : 'bubble';
  const base = `${node.full_name} (${node.region} ${seed}) ${node.wins_vs_field}W-${node.losses_vs_field}L`;
  if (!tv) return base + ' | no Torvik data';
  return `${base} | T-Rank #${tv.rank} AdjEM ${tv.adj_em > 0 ? '+' : ''}${tv.adj_em} AdjOE ${tv.adj_oe} AdjDE ${tv.adj_de} Barthag ${(tv.barthag * 100).toFixed(1)}% WAB ${parseFloat(tv.wab).toFixed(1)}`;
}

// ── Tool implementations ──────────────────────────────────────────────────────
function toolGetTeamStats({ team_names }) {
  const { torvik, nodeByName } = getData();
  return team_names.map(name => {
    const node = resolveTeam(name, nodeByName);
    return node ? fmtTeam(node, torvik) : `${name}: not found`;
  }).join('\n');
}

function toolGetMatchup({ team_a, team_b }) {
  const { graph, torvik, nodeByName, edgesByNode } = getData();
  const nodeA = resolveTeam(team_a, nodeByName);
  const nodeB = resolveTeam(team_b, nodeByName);
  if (!nodeA) return `Team not found: ${team_a}`;
  if (!nodeB) return `Team not found: ${team_b}`;

  const lines = [
    `=== ${nodeA.full_name} vs ${nodeB.full_name} ===`,
    fmtTeam(nodeA, torvik),
    fmtTeam(nodeB, torvik),
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
  return teams.slice(0, Math.min(limit, 25)).map((t, i) => {
    const seed = t.node.seed != null ? `#${t.node.seed}` : 'bubble';
    const tv_s = t.tv ? `T-Rank #${t.tv.rank} AdjEM ${t.tv.adj_em > 0 ? '+' : ''}${t.tv.adj_em}` : 'no Torvik';
    return `${i + 1}. ${t.node.full_name} (${t.node.region} ${seed}) ${t.node.wins_vs_field}W-${t.node.losses_vs_field}L | ${tv_s}`;
  }).join('\n');
}

function dispatchTool(name, args) {
  try {
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
function buildSystemPrompt(userMsg, graph, torvik) {
  const msgLower  = (userMsg || '').toLowerCase();
  const mentioned = graph.nodes.filter(n =>
    msgLower.includes(n.label.toLowerCase()) ||
    msgLower.includes(n.full_name.toLowerCase().split(' ')[0])
  );
  // Only include team data for mentioned teams — use tools for everything else
  const scope = mentioned.slice(0, 8);

  const teamLines = scope.map(n => {
    const tv   = torvik?.teams?.[n.id]?.torvik;
    const seed = n.seed != null ? `#${n.seed}` : 'bubble';
    const tv_s = tv
      ? `Rk${tv.rank} OE${tv.adj_oe} DE${tv.adj_de} EM${tv.adj_em > 0 ? '+' : ''}${tv.adj_em} Bg${(tv.barthag * 100).toFixed(1)}%`
      : 'no-torvik';
    return `${n.label} (${n.region} ${seed}) ${n.wins_vs_field}W-${n.losses_vs_field}L | ${tv_s}`;
  }).join('\n');

  const scopedIds = new Set(scope.map(n => n.id));
  const edges = scope.length > 0
    ? graph.edges.filter(e => scopedIds.has(e.from) || scopedIds.has(e.to)).slice(0, 30)
    : [];

  const gameLines = edges.map(e => {
    const w = graph.nodes.find(n => n.id === e.from)?.label ?? e.from;
    const l = graph.nodes.find(n => n.id === e.to)?.label ?? e.to;
    return `${w}>${l} ${e.label} ${(e.date || '').slice(5, 10)}`;
  }).join('\n');

  return `You are AI Scout, an expert NCAA basketball analyst for the 2026 March Madness bracket.
Use get_team_stats, get_matchup, and get_standings tools to look up data — always call a tool before citing numbers.
Never invent stats.
${scope.length > 0 ? `\nQUICK CONTEXT:\n${teamLines}${gameLines ? `\n\nRECENT GAMES:\n${gameLines}` : ''}` : ''}
Be concise. Cite exact stats.`;
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
    get_team_stats: (a) => `Looking up ${a.team_name ?? 'team'} stats`,
    get_matchup:    (a) => `Analysing ${a.team_a ?? '?'} vs ${a.team_b ?? '?'}`,
    get_standings:  (a) => `Checking standings${a.region ? ' — ' + a.region : ''}`,
  };

  try {
    const { graph, torvik } = getData();
    const system   = buildSystemPrompt(body.userMsg || '', graph, torvik);
    const sysToks  = estTokens(system);
    const history  = trimHistory(body.messages, sysToks);
    let   messages = [{ role: 'system', content: system }, ...history];
    const thinking = [];

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

      if (!toolCalls?.length || reason === 'length') {
        send(200, { text: choice?.message?.content ?? '', thinking });
        return;
      }

      messages.push(choice.message);
      for (const tc of toolCalls) {
        let args = {};
        try { args = JSON.parse(tc.function.arguments); } catch {}
        thinking.push(TOOL_LABELS[tc.function.name]?.(args) ?? tc.function.name);
        const result = dispatchTool(tc.function.name, args);
        messages.push({ role: 'tool', tool_call_id: tc.id, content: String(result) });
      }

      if (estMessagesTokens(messages) > GROQ_TPM_CAP - MAX_TOKENS) break;
    }

    const sysToksNow = estTokens(messages[0].content);
    const trimmed    = [messages[0], ...trimHistory(messages.slice(1), sysToksNow)];
    const groqRes    = await groqFetch({ model: MODEL, max_tokens: MAX_TOKENS, messages: trimmed }, groqKey);
    const groqData   = await groqRes.json();
    send(200, { text: groqData.choices?.[0]?.message?.content ?? '', thinking });

  } catch (err) {
    send(500, { error: { message: err.message } });
  }
}
