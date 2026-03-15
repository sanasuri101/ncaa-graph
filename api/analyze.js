/**
 * api/analyze.js — Multi-agent matchup analysis using LangGraph.js
 *
 * Architecture:
 *   START
 *     └─► router node — validates teams, fans out via Send()
 *           ├─► efficiency_agent  (Torvik AdjEM/OE/DE/Barthag)
 *           ├─► form_agent        (last-10, streak, recent margins)
 *           └─► matchup_agent     (H2H, common opponents, pace)
 *     └─► synthesis_node — weights all three, produces confidence interval
 *   END
 *
 * The three specialist agents run in parallel (LangGraph Send API).
 * Synthesis fires only after all three complete.
 *
 * Request:  POST { team_a: string, team_b: string }
 * Response: { agents: AgentResult[], confidence: ConfidenceResult, thinking: string[] }
 */

import { readFileSync }                              from 'fs';
import { join }                                      from 'path';
import { Annotation, StateGraph, END, START, Send } from '@langchain/langgraph';

// ── Constants ─────────────────────────────────────────────────────────────────
const GROQ_URL      = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL         = 'llama-3.3-70b-versatile';
const MAX_TOKENS    = 1024;
const FETCH_TIMEOUT = 20000;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ── Data loading ──────────────────────────────────────────────────────────────
let _cache = null;

function getData() {
  if (_cache) return _cache;
  const graph  = JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'graph_data.json'),  'utf8'));
  const torvik = JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'torvik_stats.json'), 'utf8'));
  const form   = JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'recent_form.json'),  'utf8'));

  // Injury overrides — read-only, never written by this file
  let injuryMap = {};
  try {
    const raw = JSON.parse(readFileSync(join(process.cwd(), 'data', 'injury_overrides.json'), 'utf8'));
    for (const [espnId, override] of Object.entries(raw.overrides ?? {})) {
      const penalty = override.adj_em_penalty ?? 0;
      if (penalty <= 0) continue;
      injuryMap[espnId] = {
        penalty,
        players: override.players ?? [],
        notes:   override.notes ?? '',
        updated: override.updated ?? '',
      };
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

  // Transitive path analysis — precomputed common-opponent chains
  let transPairs = {};
  try {
    const tp = JSON.parse(readFileSync(join(process.cwd(), 'data', 'transitive_analysis.json'), 'utf8'));
    transPairs = tp.pairs ?? {};
  } catch {}

  _cache = { graph, torvik, form, injuryMap, transPairs, nodeByName, edgesByNode };
  return _cache;
}

// ── Team resolution (same normalization as api/ai.js) ────────────────────────
function normalizeTeamName(s) {
  return s.toLowerCase().trim()
    .replace(/\bst\.\s*/g, 'saint ')
    .replace(/\bst\s+/g,   'saint ')
    .replace(/\bft\.?\s+/g, 'fort ')
    .replace(/[.'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const TEAM_ALIASES = {
  'unc': 'north carolina', 'uconn': 'uconn huskies', 'ucf': 'ucf knights',
  'ucla': 'ucla bruins',   'umbc': 'umbc retrievers', 'vcu': 'vcu rams',
  'tcu': 'tcu horned frogs', 'smu': 'smu mustangs',  'byu': 'byu cougars',
  'lsu': 'lsu tigers',     'ndsu': 'north dakota state', 'a&m': 'texas a&m',
  'liu': 'long island university', 'sam houston': 'sam houston bearkats',
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
    .sort((a, b) => {
      const aS = a.startsWith(queryStr) ? 1 : 0;
      const bS = b.startsWith(queryStr) ? 1 : 0;
      if (aS !== bS) return bS - aS;
      return b.length - a.length;
    });
  return candidates.length ? normMap[candidates[0]] : null;
}

// ── Data formatters ───────────────────────────────────────────────────────────
function fmtTeamFull(node, torvik, form, injuryMap) {
  const tv = torvik?.teams?.[node.id]?.torvik;
  const tf = form?.teams?.[node.id];
  if (!tv) return `${node.full_name}: no Torvik data`;

  const pace = tv.adj_tempo >= 0.7 ? 'fast' : tv.adj_tempo >= 0.4 ? 'moderate' : 'slow';
  const recent = tf?.games?.slice(-5).map(g =>
    `${g.date.slice(5)}: ${g.won ? 'W' : 'L'} ${g.score} vs ${g.opp}`
  ).join(', ') ?? 'no recent data';

  const inj = injuryMap?.[node.id];
  const injStr = inj
    ? `⚠ INJURY REPORT (model AdjEM penalty applied: -${inj.penalty}): ` +
      inj.players.map(p => `${p.name} — ${p.status}`).join('; ') +
      (inj.notes ? ` | ${inj.notes}` : '')
    : '';

  return [
    `${node.full_name} (${node.region !== 'bubble' ? `${node.region} #${node.seed}` : 'bubble — not in bracket'}, ${tv.conf})`,
    `Season: ${tv.record} | Bracket field: ${node.wins_vs_field}W-${node.losses_vs_field}L`,
    `T-Rank #${tv.rank} | AdjEM: ${tv.adj_em > 0 ? '+' : ''}${tv.adj_em} | AdjOE: ${tv.adj_oe} | AdjDE: ${tv.adj_de}`,
    `Barthag: ${(tv.barthag * 100).toFixed(1)}% | WAB: ${parseFloat(tv.wab).toFixed(1)} | SOS: ${tv.sos_rank?.toFixed(2) ?? '?'} | Pace: ${pace}`,
    `Shooting: 2P% ${tv.two_p} | 3P% ${tv.three_p} | FT% ${tv.ft_pct} | eFG% ${tv.efg}`,
    `Form: ${tf?.last10 ?? '?'} last 10, ${tf?.streak ?? '?'} streak`,
    `Last 5: ${recent}`,
    injStr,
  ].filter(Boolean).join('\n');
}

// ── Groq fetch helper ─────────────────────────────────────────────────────────
async function groqCall(systemPrompt, userPrompt, groqKey) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(GROQ_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: MAX_TOKENS,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt   },
        ],
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(`Groq ${res.status}: ${errBody?.error?.message ?? 'unknown error'}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// ── LangGraph State definition ────────────────────────────────────────────────
// Each agent writes its result into agent_results (array, appended).
// Synthesis reads all results and writes final confidence.
const GraphState = Annotation.Root({
  team_a:        Annotation({ reducer: (_, b) => b }),
  team_b:        Annotation({ reducer: (_, b) => b }),
  team_a_data:   Annotation({ reducer: (_, b) => b }),
  team_b_data:   Annotation({ reducer: (_, b) => b }),
  matchup_data:  Annotation({ reducer: (_, b) => b }),
  agent_results: Annotation({ reducer: (a, b) => [...(a ?? []), ...(Array.isArray(b) ? b : [b])] }),
  confidence:    Annotation({ reducer: (_, b) => b }),
  error:         Annotation({ reducer: (_, b) => b }),
});

// ── Node: router ──────────────────────────────────────────────────────────────
// Validates teams, enriches state with data. Returns plain object — NOT Send.
// Send/fan-out happens in routerEdge (the conditional edge function).
function routerNode(state) {
  const { graph, torvik, form, injuryMap, transPairs, nodeByName, edgesByNode } = getData();
  const nodeA = resolveTeam(state.team_a, nodeByName);
  const nodeB = resolveTeam(state.team_b, nodeByName);

  if (!nodeA || !nodeB) {
    return { error: `Team not found: ${!nodeA ? state.team_a : state.team_b}` };
  }

  const teamAData = fmtTeamFull(nodeA, torvik, form, injuryMap);
  const teamBData = fmtTeamFull(nodeB, torvik, form, injuryMap);

  const aEdges = edgesByNode[nodeA.id] || [];
  const bEdges = edgesByNode[nodeB.id] || [];
  const h2h    = aEdges.filter(e =>
    (e.from === nodeA.id && e.to === nodeB.id) ||
    (e.from === nodeB.id && e.to === nodeA.id)
  );
  const aOpps = new Set(aEdges.map(e => e.from === nodeA.id ? e.to : e.from));
  const bOpps = new Set(bEdges.map(e => e.from === nodeB.id ? e.to : e.from));
  const common = [...aOpps].filter(id => bOpps.has(id)).slice(0, 6);

  const commonLines = common.map(cid => {
    const cNode = graph.nodes.find(n => n.id === cid);
    const aGame = aEdges.find(e => (e.from === nodeA.id && e.to === cid) || (e.to === nodeA.id && e.from === cid));
    const bGame = bEdges.find(e => (e.from === nodeB.id && e.to === cid) || (e.to === nodeB.id && e.from === cid));
    const aRes  = aGame ? (aGame.from === nodeA.id ? `W ${aGame.label} by ${aGame.margin}` : `L ${aGame.label} by ${aGame.margin}`) : '?';
    const bRes  = bGame ? (bGame.from === nodeB.id ? `W ${bGame.label} by ${bGame.margin}` : `L ${bGame.label} by ${bGame.margin}`) : '?';
    return `  vs ${cNode?.label ?? cid}: ${nodeA.label} ${aRes} | ${nodeB.label} ${bRes}`;
  });

  // Transitive path evidence from precomputed analysis
  const tKey  = `${nodeA.id}_${nodeB.id}`;
  const tKeyR = `${nodeB.id}_${nodeA.id}`;
  const tPair = transPairs[tKey] || transPairs[tKeyR];
  let transLines = '';
  if (tPair && tPair.n > 0) {
    const flipped = !!transPairs[tKeyR] && !transPairs[tKey];
    const favors  = tPair.verdict === 'a' ? (flipped ? nodeB.label : nodeA.label)
                  : tPair.verdict === 'b' ? (flipped ? nodeA.label : nodeB.label)
                  : 'neither';
    const chains  = [
      ...(tPair.a || []).slice(0, 2).map(s =>
        `  ${nodeA.label} beat ${s.common_name} (${s.a_score}), who beat ${nodeB.label} (${s.b_score})`),
      ...(tPair.b || []).slice(0, 2).map(s =>
        `  ${nodeB.label} beat ${s.common_name} (${s.b_score}), who beat ${nodeA.label} (${s.a_score})`),
    ];
    transLines = `Transitive evidence (${tPair.n} signals, conf ${tPair.conf?.toFixed(0) ?? '?'}/100, favors ${favors}):\n${chains.join('\n')}`;
  } else {
    transLines = 'Transitive evidence: none found in schedule data.';
  }

  const matchupData = [
    h2h.length
      ? `H2H: ${h2h.map(e => `${e.from === nodeA.id ? nodeA.label : nodeB.label} won ${e.label} by ${e.margin} on ${e.date}`).join(', ')}`
      : 'H2H: No head-to-head games this season.',
    common.length
      ? `Common bracket opponents (${common.length}):\n${commonLines.join('\n')}`
      : 'No common bracket opponents.',
    transLines,
  ].join('\n');

  return { team_a_data: teamAData, team_b_data: teamBData, matchup_data: matchupData };
}

// ── Conditional edge function: routerEdge ─────────────────────────────────────
// LangGraph requires Send to come from the edge fn, not from the node itself.
// This fans out to 3 specialist agents in parallel.
function routerEdge(state) {
  if (state.error) return END;
  return [
    new Send('efficiency_agent', state),
    new Send('form_agent',       state),
    new Send('matchup_agent',    state),
  ];
}

// ── Node: efficiency_agent ────────────────────────────────────────────────────
// Uses Barthag (a literal head-to-head win probability) + AdjEM margin.
async function efficiencyAgent(state, config) {
  const groqKey = config.configurable?.groqKey;
  const system  = `You are an NCAA basketball efficiency analyst. Your job is to assess matchup probability using only efficiency metrics.
Respond with valid JSON only. No markdown, no explanation outside the JSON.
Schema: { "agent": "efficiency", "win_pct": <number 0-100 for ${state.team_a}>, "confidence": "low|medium|high", "key_edge": "<one specific stat advantage>", "reasoning": "<2-3 sentences citing exact numbers>" }`;

  const user = `Analyze this matchup using efficiency data only.

${state.team_a_data}

vs

${state.team_b_data}

Note: Barthag is a direct win probability estimate. An AdjEM gap >10 points is decisive, 5-10 is meaningful, <5 is a toss-up.
Return win probability for ${state.team_a}.`;

  try {
    const raw    = await groqCall(system, user, groqKey);
    const clean  = raw.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);
    return { agent_results: [result] };
  } catch {
    return { agent_results: [{ agent: 'efficiency', win_pct: 50, confidence: 'low', key_edge: 'parse error', reasoning: 'Could not parse efficiency analysis.' }] };
  }
}

// ── Node: form_agent ──────────────────────────────────────────────────────────
// Focuses on momentum: last-10, streak, recent scoring margins.
async function formAgent(state, config) {
  const groqKey = config.configurable?.groqKey;
  const system  = `You are an NCAA basketball momentum and form analyst. Assess matchup probability using only recent performance data.
Respond with valid JSON only. No markdown, no explanation outside the JSON.
Schema: { "agent": "form", "win_pct": <number 0-100 for ${state.team_a}>, "confidence": "low|medium|high", "key_edge": "<one specific form advantage>", "reasoning": "<2-3 sentences citing specific recent games or trends>" }`;

  const user = `Analyze this matchup using recent form data only.

${state.team_a_data}

vs

${state.team_b_data}

Focus on: last-10 W-L record, current win/loss streak, and scoring trends in the last 5 games.
Return win probability for ${state.team_a}.`;

  try {
    const raw    = await groqCall(system, user, groqKey);
    const clean  = raw.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);
    return { agent_results: [result] };
  } catch {
    return { agent_results: [{ agent: 'form', win_pct: 50, confidence: 'low', key_edge: 'parse error', reasoning: 'Could not parse form analysis.' }] };
  }
}

// ── Node: matchup_agent ───────────────────────────────────────────────────────
// Focuses on H2H, common opponents, pace mismatch.
async function matchupAgent(state, config) {
  const groqKey = config.configurable?.groqKey;
  const system  = `You are an NCAA basketball matchup specialist. Assess win probability using head-to-head history and common opponent analysis.
Respond with valid JSON only. No markdown, no explanation outside the JSON.
Schema: { "agent": "matchup", "win_pct": <number 0-100 for ${state.team_a}>, "confidence": "low|medium|high", "key_edge": "<one specific matchup advantage>", "reasoning": "<2-3 sentences citing H2H or common opponent results>" }`;

  const user = `Analyze this matchup using head-to-head and common opponent data.

${state.team_a_data}

vs

${state.team_b_data}

Head-to-head and common opponent data:
${state.matchup_data}

Also consider pace mismatch: if one team plays fast and the other slow, the faster team usually dictates tempo.
Return win probability for ${state.team_a}.`;

  try {
    const raw    = await groqCall(system, user, groqKey);
    const clean  = raw.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);
    return { agent_results: [result] };
  } catch {
    return { agent_results: [{ agent: 'matchup', win_pct: 50, confidence: 'low', key_edge: 'parse error', reasoning: 'Could not parse matchup analysis.' }] };
  }
}

// ── Node: synthesis ───────────────────────────────────────────────────────────
// Weights: efficiency 50%, form 25%, matchup 25%.
// Produces final confidence interval and unified reasoning.
async function synthesisNode(state, config) {
  const groqKey = config.configurable?.groqKey;
  const results = state.agent_results ?? [];

  const effResult  = results.find(r => r.agent === 'efficiency') ?? { win_pct: 50, confidence: 'low', reasoning: '' };
  const formResult = results.find(r => r.agent === 'form')       ?? { win_pct: 50, confidence: 'low', reasoning: '' };
  const matchResult= results.find(r => r.agent === 'matchup')    ?? { win_pct: 50, confidence: 'low', reasoning: '' };

  // Guard against NaN/undefined/out-of-range win_pct from malformed LLM responses
  const safePct = (r) => {
    const n = Number(r.win_pct);
    if (isNaN(n)) return 50;
    return Math.max(1, Math.min(99, n));
  };

  // Weighted average: efficiency 50%, form 25%, matchup 25%
  const weights    = { efficiency: 0.50, form: 0.25, matchup: 0.25 };
  const weightedPct = Math.round(
    (safePct(effResult)   * weights.efficiency) +
    (safePct(formResult)  * weights.form) +
    (safePct(matchResult) * weights.matchup)
  );

  // Confidence interval width based on agent agreement
  const pcts      = [safePct(effResult), safePct(formResult), safePct(matchResult)];
  const spread    = Math.max(...pcts) - Math.min(...pcts);
  const halfRange = Math.round(spread / 2 + 3); // minimum ±3
  const rangeLow  = Math.max(1,  weightedPct - halfRange);
  const rangeHigh = Math.min(99, weightedPct + halfRange);

  const agentSummary = results.map(r =>
    `${r.agent.toUpperCase()} AGENT: ${r.win_pct}% for ${state.team_a} (${r.confidence} confidence)\nKey edge: ${r.key_edge}\n${r.reasoning}`
  ).join('\n\n');

  const system = `You are a senior NCAA tournament analyst synthesizing multiple expert reports into a final prediction.
Write a concise, data-driven analysis. Be specific. Cite exact numbers. No hedging.`;

  const user = `Synthesize these three expert analyses into a final matchup prediction.

${agentSummary}

WEIGHTED WIN PROBABILITY for ${state.team_a}: ${weightedPct}% (range: ${rangeLow}-${rangeHigh}%)
Weights: Efficiency 50%, Recent Form 25%, Matchup History 25%
Agent spread: ${spread.toFixed(0)} percentage points (${spread < 10 ? 'strong consensus' : spread < 20 ? 'moderate agreement' : 'significant disagreement'})

Write 3-4 sentences: the decisive factor, the key risk, and one thing that could flip the outcome. Cite specific stats.`;

  try {
    const reasoning = await groqCall(system, user, groqKey);
    const confidence = {
      team_a:    state.team_a,
      team_b:    state.team_b,
      win_pct:   weightedPct,
      range_low: rangeLow,
      range_high:rangeHigh,
      agent_spread: Math.round(spread),
      consensus: spread < 10 ? 'strong' : spread < 20 ? 'moderate' : 'split',
      weights,
      reasoning,
      agent_breakdown: results.map(r => ({
        agent:      r.agent,
        win_pct:    r.win_pct,
        confidence: r.confidence,
        key_edge:   r.key_edge,
      })),
    };
    return { confidence };
  } catch (err) {
    return { confidence: { error: err.message } };
  }
}

// ── Build LangGraph graph ─────────────────────────────────────────────────────
function buildGraph() {
  const workflow = new StateGraph(GraphState)
    .addNode('router',           routerNode)
    .addNode('efficiency_agent', efficiencyAgent)
    .addNode('form_agent',       formAgent)
    .addNode('matchup_agent',    matchupAgent)
    .addNode('synthesis',        synthesisNode);

  // routerEdge returns Send objects for parallel fan-out — correct LangGraph pattern
  workflow.addConditionalEdges('router', routerEdge);

  // All three agents converge to synthesis
  workflow.addEdge('efficiency_agent', 'synthesis');
  workflow.addEdge('form_agent',       'synthesis');
  workflow.addEdge('matchup_agent',    'synthesis');
  workflow.addEdge('synthesis',        END);
  workflow.addEdge(START, 'router');

  return workflow.compile();
}

const graph = buildGraph();

// ── Vercel handler ────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    res.writeHead(405, CORS);
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

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
    res.writeHead(400, { 'Content-Type': 'application/json', ...CORS });
    res.end(JSON.stringify({ error: 'Invalid JSON' }));
    return;
  }

  const groqKey = process.env.GROQ_KEY;
  if (!groqKey) {
    res.writeHead(500, { 'Content-Type': 'application/json', ...CORS });
    res.end(JSON.stringify({ error: 'Server configuration error' }));
    return;
  }

  const { team_a, team_b } = body;
  if (!team_a || !team_b) {
    res.writeHead(400, { 'Content-Type': 'application/json', ...CORS });
    res.end(JSON.stringify({ error: 'team_a and team_b required' }));
    return;
  }
  if (typeof team_a !== 'string' || typeof team_b !== 'string' ||
      team_a.length > 200 || team_b.length > 200) {
    res.writeHead(400, { 'Content-Type': 'application/json', ...CORS });
    res.end(JSON.stringify({ error: 'Invalid team names' }));
    return;
  }

  try {
    const result = await graph.invoke(
      { team_a, team_b, agent_results: [] },
      { configurable: { groqKey } }
    );

    if (result.error) {
      res.writeHead(404, { 'Content-Type': 'application/json', ...CORS });
      res.end(JSON.stringify({ error: result.error }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json', ...CORS });
    res.end(JSON.stringify({
      team_a,
      team_b,
      agent_results: result.agent_results,
      confidence:    result.confidence,
    }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json', ...CORS });
    res.end(JSON.stringify({ error: err.message }));
  }
}
