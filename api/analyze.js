/**
 * api/analyze.js — Multi-agent matchup analysis using LangGraph.js
 *
 * Architecture:
 *   START
 *     └─► router — validates teams, fetches all data via tool functions
 *           ├─► efficiency_agent  — analyzes efficiency data, returns JSON
 *           ├─► form_agent        — analyzes form data, returns JSON
 *           ├─► matchup_agent     — analyzes H2H/common opp data, returns JSON
 *           └─► odds_agent        — analyzes market data, returns JSON
 *     └─► synthesis — agentic: can call tools to verify/deepen, writes sections
 *   END
 *
 * Specialist agents receive pre-fetched scoped data (reliable).
 * Synthesis is agentic — it can fetch additional detail to verify claims.
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
  return name.slice(0, 60).replace(/[\n\r\t]/g, ' ').replace(/[`"\\]/g, '')
    .replace(/\b(ignore|system|return|instructions?|json|you must|your (role|task))[\s\S]*/gi, '').trim();
}

// ── Constants ─────────────────────────────────────────────────────────────────
const MODEL            = 'llama-3.3-70b-versatile';
const MAX_TOKENS       = 1024;
const MAX_TOKENS_SY    = 2048;
const MAX_STEPS_SYNTH  = 3;
const FETCH_TIMEOUT    = 25000;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ── Data loading ──────────────────────────────────────────────────────────────
let _cache = null, _cacheMtime = 0;

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
  const graph  = JSON.parse(readFileSync(join(process.cwd(), 'public/data/graph_data.json'),  'utf8'));
  const torvik = JSON.parse(readFileSync(join(process.cwd(), 'public/data/torvik_stats.json'), 'utf8'));
  const form   = JSON.parse(readFileSync(join(process.cwd(), 'public/data/recent_form.json'),  'utf8'));
  let injuryMap = {};
  try {
    const raw = JSON.parse(readFileSync(join(process.cwd(), 'data/injury_overrides.json'), 'utf8'));
    for (const [id, ov] of Object.entries(raw.overrides ?? {}))
      if ((ov.adj_em_penalty ?? 0) > 0)
        injuryMap[id] = { penalty: ov.adj_em_penalty, players: ov.players ?? [], notes: ov.notes ?? '' };
  } catch {}
  const nodeByName = {};
  graph.nodes.forEach(n => { nodeByName[n.label.toLowerCase()] = n; nodeByName[n.full_name.toLowerCase()] = n; });
  const edgesByNode = {};
  graph.edges.forEach(e => { (edgesByNode[e.from] = edgesByNode[e.from] || []).push(e); (edgesByNode[e.to] = edgesByNode[e.to] || []).push(e); });
  let transPairs = {};
  try { transPairs = JSON.parse(readFileSync(join(process.cwd(), 'data/transitive_analysis.json'), 'utf8')).pairs ?? {}; } catch {}
  let oddsData = { games: {}, futures: {} };
  try { oddsData = JSON.parse(readFileSync(join(process.cwd(), 'public/data/espn_odds.json'), 'utf8')); } catch {}
  let injuryNews = {};
  try { injuryNews = JSON.parse(readFileSync(join(process.cwd(), 'data/injury_news.json'), 'utf8'))?.teams ?? {}; } catch {}
  let rosterStats = {};
  try { rosterStats = JSON.parse(readFileSync(join(process.cwd(), 'data/roster_stats.json'), 'utf8')).teams ?? {}; } catch {}
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
  'unc':'north carolina','uconn':'uconn huskies','ucf':'ucf knights','ucla':'ucla bruins',
  'umbc':'umbc retrievers','vcu':'vcu rams','tcu':'tcu horned frogs','smu':'smu mustangs',
  'byu':'byu cougars','lsu':'lsu tigers','liu':'long island university','sam houston':'sam houston bearkats',
  'isu':'iowa state cyclones','iowa st':'iowa state cyclones',
  'msu':'michigan state spartans','mich st':'michigan state spartans',
  'ku':'kansas jayhawks','osu':'ohio state buckeyes',
  'a&m':'texas a&m aggies','tamu':'texas a&m aggies',
  "st john's":'saint johns red storm','sjr':'saint johns red storm','st johns':'saint johns red storm',
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
    .sort((a, b) => (b.startsWith(queryStr)?1:0)-(a.startsWith(queryStr)?1:0) || b.length-a.length);
  return candidates.length ? normMap[candidates[0]] : null;
}

// ── Data formatters ───────────────────────────────────────────────────────────
function fmtRoster(players) {
  if (!players?.length) return '';
  return players.slice(0, 8).map((p, i) => {
    const inj = p.injured ? ` ⚠ ${p.injured}${p.injury_impact ? ' — '+p.injury_impact : ''}` : '';
    return `  ${i+1}. ${p.name} (${p.exp}, ${p.pos}, ${p.height})${inj}\n     ${p.mpg} MPG | ${p.ppg}/${p.rpg}/${p.apg} pts/reb/ast | FG ${p.fg}% | 3P ${p.three_pct}% | FT ${p.ft_pct}% | PER ${p.per}`;
  }).join('\n');
}

function fmtTeamEfficiency(node, torvik, injuryMap) {
  const tv  = torvik?.teams?.[node.id]?.torvik;
  const inj = injuryMap?.[node.id];
  if (!tv) return `${node.full_name}: no Torvik data`;
  return [
    `${node.full_name} (${node.region} #${node.seed}, ${tv.conf}) — Record: ${tv.record}`,
    `T-Rank #${tv.rank} | AdjEM: ${tv.adj_em>0?'+':''}${tv.adj_em} | AdjOE: ${tv.adj_oe} | AdjDE: ${tv.adj_de}`,
    `Barthag: ${(tv.barthag*100).toFixed(1)}% | WAB: ${parseFloat(tv.wab).toFixed(1)} | SOS: ${tv.sos_rank?.toFixed(2)??'?'}`,
    `Shooting: eFG% ${tv.efg} | 2P% ${tv.two_p} | 3P% ${tv.three_p} | FT% ${tv.ft_pct}`,
    `Four Factors: TOV% ${tv.tov_rate} | ORB% ${tv.orb_rate} | FTR ${tv.ftr} | Opp eFG% ${tv.opp_efg??'?'}`,
    `Pace: adj_tempo ${tv.adj_tempo?.toFixed(2)??'?'} | Luck: ${parseFloat(tv.luck??0).toFixed(3)}`,
    inj ? `⚠ INJURY (AdjEM penalty -${inj.penalty}): ${inj.players.map(p=>`${p.name} — ${p.status}`).join('; ')}${inj.notes?' | '+inj.notes:''}` : '',
  ].filter(Boolean).join('\n');
}

function fmtTeamForm(node, form) {
  const tf = form?.teams?.[node.id];
  if (!tf) return `${node.full_name}: no form data`;
  const games   = tf.games?.slice(-10) ?? [];
  const margins = games.map(g => { const [a,b]=(g.score??'0-0').split('-').map(Number); return g.won?(a-b):(b-a); });
  const avg     = margins.length ? (margins.reduce((s,m)=>s+m,0)/margins.length).toFixed(1) : '?';
  const last5   = games.slice(-5).map(g=>`${g.won?'W':'L'} ${g.score} vs ${g.opp} (${g.date.slice(5)})`).join(' | ');
  return [`${node.full_name} form:`, `Last 10: ${tf.last10} | Streak: ${tf.streak} | Avg margin: ${avg>0?'+':''}${avg}`, `Last 5: ${last5}`].join('\n');
}

function fmtMatchupData(nodeA, nodeB, graph, edgesByNode, transPairs) {
  const aEdges = edgesByNode[nodeA.id] ?? [];
  const bEdges = edgesByNode[nodeB.id] ?? [];
  const h2h    = aEdges.filter(e => (e.from===nodeA.id&&e.to===nodeB.id)||(e.from===nodeB.id&&e.to===nodeA.id));
  const aOpps  = new Set(aEdges.map(e=>e.from===nodeA.id?e.to:e.from));
  const bOpps  = new Set(bEdges.map(e=>e.from===nodeB.id?e.to:e.from));
  const common = [...aOpps].filter(id=>bOpps.has(id)).slice(0,6);

  const h2hStr = h2h.length
    ? `H2H: ${h2h.map(e=>`${e.from===nodeA.id?nodeA.label:nodeB.label} won ${e.label} by ${e.margin} on ${e.date}`).join(', ')}`
    : 'H2H: No head-to-head games this season.';

  const commonStr = common.length ? `Common opponents (${common.length}):\n` + common.map(cid => {
    const cn = graph.nodes.find(n=>n.id===cid);
    const ag = aEdges.find(e=>(e.from===nodeA.id&&e.to===cid)||(e.to===nodeA.id&&e.from===cid));
    const bg = bEdges.find(e=>(e.from===nodeB.id&&e.to===cid)||(e.to===nodeB.id&&e.from===cid));
    const ar = ag?(ag.from===nodeA.id?`W ${ag.label}`:`L ${ag.label}`):'?';
    const br = bg?(bg.from===nodeB.id?`W ${bg.label}`:`L ${bg.label}`):'?';
    return `  vs ${cn?.label??cid}: ${nodeA.label} ${ar} | ${nodeB.label} ${br}`;
  }).join('\n') : 'No common opponents.';

  const tKey = `${nodeA.id}_${nodeB.id}`, tKeyR = `${nodeB.id}_${nodeA.id}`;
  const tp   = transPairs[tKey] || transPairs[tKeyR];
  let transStr = 'Transitive evidence: none found.';
  if (tp?.n > 0) {
    const flipped = !!transPairs[tKeyR] && !transPairs[tKey];
    const favors  = tp.verdict==='a'?(flipped?nodeB.label:nodeA.label):tp.verdict==='b'?(flipped?nodeA.label:nodeB.label):'neither';
    const chains  = [...(tp.a||[]).slice(0,2).map(s=>`  ${nodeA.label} beat ${s.common_name} (${s.a_score}), who beat ${nodeB.label} (${s.b_score})`),
                    ...(tp.b||[]).slice(0,2).map(s=>`  ${nodeB.label} beat ${s.common_name} (${s.b_score}), who beat ${nodeA.label} (${s.a_score})`)];
    transStr = `Transitive (${tp.n} signals, conf ${tp.conf?.toFixed(0)??'?'}/100, favors ${favors}):\n${chains.join('\n')}`;
  }
  return [h2hStr, commonStr, transStr].join('\n');
}

function fmtOdds(nodeA, nodeB, teamA, teamB, oddsData) {
  const games = Object.values(oddsData?.games ?? {});
  const game  = games.find(g=>(g.home_id===nodeA.id&&g.away_id===nodeB.id)||(g.home_id===nodeB.id&&g.away_id===nodeA.id));
  if (!game) return 'No tournament game odds found for this matchup yet.';
  const isAHome = game.home_id === nodeA.id;
  const odds = game.odds, bpi = game.bpi;
  const lines = [];
  if (odds) {
    const aML=isAHome?odds.home_moneyline:odds.away_moneyline, bML=isAHome?odds.away_moneyline:odds.home_moneyline;
    const aImp=isAHome?odds.home_implied_pct:odds.away_implied_pct, bImp=isAHome?odds.away_implied_pct:odds.home_implied_pct;
    const openA=isAHome?odds.open_home_ml:odds.open_away_ml;
    const mvmt=odds.line_movement!=null?(isAHome?odds.line_movement:-odds.line_movement):null;
    lines.push(`DraftKings: Spread ${odds.spread>=0?'+':''}${odds.spread} | O/U ${odds.over_under}`);
    lines.push(`${teamA} ML: ${aML} (${aImp}% implied) | ${teamB} ML: ${bML} (${bImp}% implied)`);
    if (openA!=null) lines.push(`Opening ML ${teamA}: ${openA}${mvmt!=null?` → ${mvmt>0?'+':''}${mvmt.toFixed(1)}% shift (${mvmt>2?'sharp on '+teamA:mvmt<-2?'sharp on '+teamB:'no significant movement'})`:''}`);
  }
  if (bpi) {
    const aBpi=isAHome?bpi.home_bpi_win_pct:bpi.away_bpi_win_pct, bBpi=isAHome?bpi.away_bpi_win_pct:bpi.home_bpi_win_pct;
    lines.push(`ESPN BPI: ${teamA} ${aBpi}% | ${teamB} ${bBpi}% | margin ${bpi.bpi_pred_margin>0?'+':''}${bpi.bpi_pred_margin} | quality ${bpi.matchup_quality}/100`);
  }
  const futA=oddsData?.futures?.[teamA.toLowerCase()], futB=oddsData?.futures?.[teamB.toLowerCase()];
  if (futA?.markets||futB?.markets) {
    const fmtFut=(fut,name)=>!fut?.markets?'':name+': '+Object.entries(fut.markets).map(([k,v])=>`${k.replace(/_/g,' ')}: ${v.moneyline} (${v.implied_pct}%)`).join(' | ');
    if (futA) lines.push('Futures — '+fmtFut(futA,teamA));
    if (futB) lines.push('Futures — '+fmtFut(futB,teamB));
  }
  return lines.join('\n');
}

// ── Groq helper for specialist agents ────────────────────────────────────────
async function groqCall(systemPrompt, userPrompt, groqKey, maxTokens=MAX_TOKENS) {
  const ctrl  = new AbortController();
  const timer = setTimeout(()=>ctrl.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ]}),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (res.status === 429) {
      const wait = parseInt(res.headers.get('retry-after')||'5', 10);
      await new Promise(r=>setTimeout(r, Math.min(wait,10)*1000));
      return groqCall(systemPrompt, userPrompt, groqKey, maxTokens);
    }
    if (!res.ok) throw new Error(`Groq ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  } catch(err) { clearTimeout(timer); throw err; }
}

function parseAgentJSON(raw, agentName) {
  const clean = raw.replace(/```json|```/g,'').trim();
  const s=clean.indexOf('{'), e=clean.lastIndexOf('}');
  try { return JSON.parse(s>=0&&e>s ? clean.slice(s,e+1) : clean); }
  catch { return { agent:agentName, win_pct:50, confidence:'low', key_edge:'parse error', reasoning:sanitizeLLMOutput(raw).slice(0,200)||`${agentName} parse error` }; }
}

// ── LangGraph State ───────────────────────────────────────────────────────────
const GraphState = Annotation.Root({
  team_a:        Annotation({ reducer: (_,b)=>b }),
  team_b:        Annotation({ reducer: (_,b)=>b }),
  // Pre-fetched scoped data (set by router, used by agents)
  eff_data:      Annotation({ reducer: (_,b)=>b }),
  form_data:     Annotation({ reducer: (_,b)=>b }),
  matchup_data:  Annotation({ reducer: (_,b)=>b }),
  odds_data:     Annotation({ reducer: (_,b)=>b }),
  roster_data:   Annotation({ reducer: (_,b)=>b }),
  agent_results: Annotation({ reducer: (a,b)=>[...(a??[]),...(Array.isArray(b)?b:[b])] }),
  confidence:    Annotation({ reducer: (_,b)=>b }),
  error:         Annotation({ reducer: (_,b)=>b }),
});

// ── Router — validates teams and pre-fetches SCOPED data per domain ────────────
function routerNode(state) {
  const { graph, torvik, form, injuryMap, transPairs, nodeByName, edgesByNode, oddsData, rosterStats } = getData();
  const nodeA = resolveTeam(state.team_a, nodeByName);
  const nodeB = resolveTeam(state.team_b, nodeByName);
  if (!nodeA || !nodeB) return { error: `Team not found: ${!nodeA?state.team_a:state.team_b}` };

  const rosA = rosterStats?.[String(nodeA.id)]?.players ?? [];
  const rosB = rosterStats?.[String(nodeB.id)]?.players ?? [];

  return {
    // Efficiency agent gets: AdjEM/Barthag/Four Factors + injury report + roster (for injury context)
    eff_data: `${fmtTeamEfficiency(nodeA, torvik, injuryMap)}\n\nROSTER:\n${fmtRoster(rosA)}\n\n---\n\n${fmtTeamEfficiency(nodeB, torvik, injuryMap)}\n\nROSTER:\n${fmtRoster(rosB)}`,

    // Form agent gets: last-10, streak, last-5 games + roster (who's been playing)
    form_data: `${fmtTeamForm(nodeA, form)}\n\nROSTER:\n${fmtRoster(rosA)}\n\n---\n\n${fmtTeamForm(nodeB, form)}\n\nROSTER:\n${fmtRoster(rosB)}`,

    // Matchup agent gets: H2H, common opponents, transitive chains + pace comparison
    matchup_data: `PACE: ${nodeA.label} adj_tempo ${torvik?.teams?.[nodeA.id]?.torvik?.adj_tempo?.toFixed(2)??'?'} | ${nodeB.label} adj_tempo ${torvik?.teams?.[nodeB.id]?.torvik?.adj_tempo?.toFixed(2)??'?'}\n\n${fmtMatchupData(nodeA, nodeB, graph, edgesByNode, transPairs)}`,

    // Odds agent gets: market lines, BPI, futures
    odds_data: fmtOdds(nodeA, nodeB, state.team_a, state.team_b, oddsData),

    // Roster data stored separately for synthesis to reference
    roster_data: `${nodeA.full_name} ROSTER:\n${fmtRoster(rosA)}\n\n${nodeB.full_name} ROSTER:\n${fmtRoster(rosB)}`,
  };
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

// ── Specialist agents — receive scoped data, analyze it, return JSON ──────────
async function efficiencyAgent(state, config) {
  const groqKey = config.configurable?.groqKey;
  const system = `You are an NCAA basketball efficiency analyst. Assess matchup win probability using ONLY the data provided — do NOT use any knowledge from your training. Every stat you cite must come from the data below.
Respond with valid JSON only. No markdown. Schema: { "agent": "efficiency", "win_pct": <0-100 for ${state.team_a}>, "confidence": "low|medium|high", "key_edge": "<one specific stat advantage>", "reasoning": "<2-3 sentences citing exact numbers from the data>" }`;
  const user = `Analyze using efficiency data only.\n\n${state.eff_data}\n\nNote: Barthag IS the neutral-court win probability. AdjEM gap >10 = decisive, 5-10 = meaningful, <5 = toss-up.\nApply any injury AdjEM penalties explicitly.\nReturn win probability for ${state.team_a}.`;
  try {
    const raw    = await groqCall(system, user, groqKey);
    const result = parseAgentJSON(raw, 'efficiency');
    if (result.reasoning) result.reasoning = sanitizeLLMOutput(result.reasoning);
    result.agent = 'efficiency';
    return { agent_results: [result] };
  } catch(err) {
    return { agent_results: [{ agent:'efficiency', win_pct:50, confidence:'low', key_edge:'error', reasoning: err?.message??'unknown' }] };
  }
}

async function formAgent(state, config) {
  const groqKey = config.configurable?.groqKey;
  const system = `You are an NCAA basketball momentum analyst. Assess matchup win probability using ONLY the recent form data provided — do NOT use any knowledge from your training. Every stat you cite must come from the data below.
Respond with valid JSON only. No markdown. Schema: { "agent": "form", "win_pct": <0-100 for ${state.team_a}>, "confidence": "low|medium|high", "key_edge": "<one specific form advantage>", "reasoning": "<2-3 sentences citing specific recent games or trends from the data>" }`;
  const user = `Analyze using recent form data only.\n\n${state.form_data}\n\nFocus on: last-10 W-L, current streak, scoring margins in last 5 games, any injured players affecting recent performance.\nReturn win probability for ${state.team_a}.`;
  try {
    const raw    = await groqCall(system, user, groqKey);
    const result = parseAgentJSON(raw, 'form');
    if (result.reasoning) result.reasoning = sanitizeLLMOutput(result.reasoning);
    result.agent = 'form';
    return { agent_results: [result] };
  } catch(err) {
    return { agent_results: [{ agent:'form', win_pct:50, confidence:'low', key_edge:'error', reasoning: err?.message??'unknown' }] };
  }
}

async function matchupAgent(state, config) {
  const groqKey = config.configurable?.groqKey;
  const system = `You are an NCAA basketball matchup specialist. Assess win probability using ONLY the head-to-head and common opponent data provided — do NOT use any knowledge from your training. Every result you cite must come from the data below.
Respond with valid JSON only. No markdown. Schema: { "agent": "matchup", "win_pct": <0-100 for ${state.team_a}>, "confidence": "low|medium|high", "key_edge": "<one specific matchup advantage>", "reasoning": "<2-3 sentences citing H2H or common opponent results from the data>" }`;
  const user = `Analyze using head-to-head and common opponent data only.\n\n${state.matchup_data}\n\nWeight evidence: H2H > common opponents > transitive chains.\nPace mismatch matters: faster team (higher adj_tempo) usually controls tempo.\nReturn win probability for ${state.team_a}.`;
  try {
    const raw    = await groqCall(system, user, groqKey);
    const result = parseAgentJSON(raw, 'matchup');
    if (result.reasoning) result.reasoning = sanitizeLLMOutput(result.reasoning);
    result.agent = 'matchup';
    return { agent_results: [result] };
  } catch(err) {
    return { agent_results: [{ agent:'matchup', win_pct:50, confidence:'low', key_edge:'error', reasoning: err?.message??'unknown' }] };
  }
}

async function oddsAgent(state, config) {
  const groqKey = config.configurable?.groqKey;
  if (!state.odds_data || state.odds_data.includes('No tournament game odds')) {
    return { agent_results: [{ agent:'odds', win_pct:50, confidence:'low', key_edge:'no market data', reasoning:'No tournament betting lines available yet.' }] };
  }
  const system = `You are a sports betting market analyst. Assess win probability using ONLY the market data provided — do NOT use any knowledge from your training.
Respond with valid JSON only. No markdown. Schema: { "agent": "odds", "win_pct": <0-100 for ${state.team_a}>, "confidence": "low|medium|high", "key_edge": "<one specific market signal>", "reasoning": "<2-3 sentences citing the market-implied probability, BPI, and any line movement from the data>" }`;
  const user = `Assess win probability using market data only.\n\n${state.odds_data}\n\nRules: Market-implied probability is your baseline. BPI is independent model. Line movement >3% = sharp money. If market and BPI agree within 5pp = high confidence. If they diverge >10pp = note the conflict.\nReturn win probability for ${state.team_a}.`;
  try {
    const raw    = await groqCall(system, user, groqKey);
    const result = parseAgentJSON(raw, 'odds');
    if (result.reasoning) result.reasoning = sanitizeLLMOutput(result.reasoning);
    result.agent = 'odds';
    return { agent_results: [result] };
  } catch(err) {
    return { agent_results: [{ agent:'odds', win_pct:50, confidence:'low', key_edge:'error', reasoning: err?.message??'unknown' }] };
  }
}

// ── Synthesis — agentic: can call tools to verify/deepen claims ───────────────
async function synthesisNode(state, config) {
  const groqKey = config.configurable?.groqKey;
  const results = state.agent_results ?? [];
  await new Promise(r=>setTimeout(r, 500));

  const get = name => results.find(r=>r.agent===name) ?? { win_pct:50, confidence:'low', key_edge:'', reasoning:'' };
  const eff  = get('efficiency'), frm = get('form'), mtch = get('matchup'), odds = get('odds');
  const safe = r => { const n=Number(r.win_pct); return isNaN(n)?50:Math.max(1,Math.min(99,n)); };

  const oddsAvailable = !(odds.confidence==='low' && (odds.key_edge==='error'||odds.key_edge==='no market data'));
  let weights = oddsAvailable
    ? { efficiency:0.40, odds:0.20, form:0.20, matchup:0.20 }
    : { efficiency:0.50, odds:0.00, form:0.25, matchup:0.25 };
  if (oddsAvailable) {
    const gap = Math.abs(safe(eff)-safe(odds));
    if (odds.confidence==='high'&&gap>10) weights = { efficiency:0.30, odds:0.35, form:0.20, matchup:0.15 };
    else if (gap<5) weights = { efficiency:0.45, odds:0.20, form:0.20, matchup:0.15 };
  }

  const weightedPct = Math.round(safe(eff)*weights.efficiency+safe(odds)*weights.odds+safe(frm)*weights.form+safe(mtch)*weights.matchup);
  const pcts        = oddsAvailable ? [safe(eff),safe(frm),safe(mtch),safe(odds)] : [safe(eff),safe(frm),safe(mtch)];
  const spread      = Math.max(...pcts)-Math.min(...pcts);
  const half        = Math.round(spread/2+3);
  const rangeLow    = Math.max(1, weightedPct-half);
  const rangeHigh   = Math.min(99, weightedPct+half);

  const agentSummary = results.map(r=>`${r.agent.toUpperCase()}: ${r.win_pct}% for ${state.team_a} (${r.confidence})\nEdge: ${r.key_edge}\n${r.reasoning}`).join('\n\n');
  const weightDesc   = oddsAvailable
    ? `Efficiency ${Math.round(weights.efficiency*100)}%, Market/BPI ${Math.round(weights.odds*100)}%, Form ${Math.round(weights.form*100)}%, Matchup ${Math.round(weights.matchup*100)}%`
    : 'Efficiency 50%, Form 25%, Matchup 25% (no market data)';

  // Build synthesis tool set — synthesis can fetch additional detail to verify claims
  const groq = createGroq({ apiKey: groqKey });
  const { nodeByName } = getData();
  const nodeA = resolveTeam(state.team_a, nodeByName);
  const nodeB = resolveTeam(state.team_b, nodeByName);

  const synthTools = {
    get_efficiency_stats: tool({
      description: 'Get efficiency stats for a team to verify a specific claim.',
      parameters: z.object({ team: z.string() }),
      execute: async ({ team }) => {
        const { torvik, injuryMap, nodeByName } = getData();
        const n = resolveTeam(team, nodeByName);
        return n ? fmtTeamEfficiency(n, torvik, injuryMap) : `Not found: ${team}`;
      },
    }),
    get_roster: tool({
      description: 'Get current roster with stats for a team.',
      parameters: z.object({ team: z.string() }),
      execute: async ({ team }) => {
        const { rosterStats, nodeByName } = getData();
        const n = resolveTeam(team, nodeByName);
        if (!n) return `Not found: ${team}`;
        const players = rosterStats?.[String(n.id)]?.players ?? [];
        return `${n.full_name} roster:\n${fmtRoster(players)}`;
      },
    }),
    get_injury_detail: tool({
      description: 'Get injury news and model penalty for a team.',
      parameters: z.object({ team: z.string() }),
      execute: async ({ team }) => {
        const { injuryMap, injuryNews, nodeByName } = getData();
        const n = resolveTeam(team, nodeByName);
        if (!n) return `Not found: ${team}`;
        const inj  = injuryMap?.[n.id];
        const news = injuryNews?.[n.id]?.articles ?? [];
        const lines = [];
        if (inj) lines.push(`Penalty: AdjEM -${inj.penalty} | ${inj.players.map(p=>`${p.name} (${p.status})`).join(', ')}`);
        if (news.length) lines.push('Headlines:', ...news.slice(0,3).map(a=>`  • ${a.headline}`));
        return lines.length ? lines.join('\n') : `No injury data for ${n.full_name}`;
      },
    }),
  };

  const synthSystem = `You are a senior NCAA tournament analyst writing a pre-game scouting report.
You have access to tools — use them to verify specific claims from the agent reports or get roster detail.
CRITICAL: Only cite players and stats from the data you fetch via tools or from the team data provided. Do NOT invent players or stats from your training memory.
You MUST respond with valid JSON only. No markdown fences, no text outside the JSON.
Schema: { "injury_note": "<string>", "decisive_factor": "<string>", "key_matchup": "<string>", "x_factors": "<string>", "risk": "<string>", "market_vs_model": "<string>", "bottom_line": "<string>" }`;

  const synthPrompt = `Write a deep expert analysis of ${state.team_a} vs ${state.team_b}.

TEAM DATA (use this — do not invent stats):
${state.eff_data}

ROSTER DATA:
${state.roster_data}

AGENT REPORTS:
${agentSummary}

WEIGHTED WIN PROBABILITY for ${state.team_a}: ${weightedPct}% (range: ${rangeLow}-${rangeHigh}%)
Weights: ${weightDesc} | Agent spread: ${spread.toFixed(0)}pp (${spread<10?'strong consensus':spread<20?'moderate agreement':'significant disagreement'})

Use your tools if you need to verify a specific claim or get more roster detail.
Then return the JSON analysis.
RULES:
- Every player name and stat you cite MUST come from the team data or roster data above, or from a tool call you make
- Do NOT use players like Filipowski, Sanogo, Newton — check the actual roster data for current players
- injury_note: only if ⚠ appears in the data, name the actual player and their stats
- decisive_factor: cite exact AdjEM/Barthag numbers from the data
- key_matchup: name actual players from the roster data with their real stat lines
- bottom_line: specific score, name the player who seals it (must be in the roster)
Return ONLY the JSON object. No backticks. No preamble.`;

  try {
    const { text } = await generateText({
      model:     groq(MODEL),
      maxTokens: MAX_TOKENS_SY,
      maxSteps:  MAX_STEPS_SYNTH,
      tools:     synthTools,
      toolChoice:'auto',
      system:    synthSystem,
      prompt:    synthPrompt,
    });

    let clean = text.replace(/```json|```/g,'').trim();
    const s=clean.indexOf('{'), e=clean.lastIndexOf('}');
    if (s>0&&e>s) clean=clean.slice(s,e+1);

    const KEYS = ['injury_note','decisive_factor','key_matchup','x_factors','risk','market_vs_model','bottom_line'];
    let sections = {};
    try {
      const parsed = JSON.parse(clean);
      const df = parsed.decisive_factor;
      if (df&&typeof df==='object') sections=df.decisive_factor?df:parsed;
      else if (typeof df==='string'&&df.trim().startsWith('{')) {
        try { const i=JSON.parse(df); sections=i.decisive_factor?i:parsed; } catch { sections=parsed; }
      } else sections=parsed;
      const filled = KEYS.filter(k=>typeof sections[k]==='string'&&sections[k].length>10);
      if (filled.length<3) throw new Error('insufficient content');
    } catch {
      const fb = sanitizeLLMOutput(clean)||results.map(r=>r.reasoning).filter(Boolean).join(' ');
      const paras = fb.split('\n\n').filter(Boolean);
      sections = { decisive_factor:paras[0]??fb, key_matchup:paras[1]??'', x_factors:paras[2]??'', risk:paras[3]??'', market_vs_model:paras[4]??'', bottom_line:paras[paras.length-1]??'', injury_note:'' };
    }

    const san = s => s ? sanitizeLLMOutput(String(s)) : '';
    const reasoningParts = ['decisive_factor','key_matchup','risk','market_vs_model','bottom_line']
      .map(k=>san(sections[k])).filter(s=>s.length>10);
    const reasoning = reasoningParts.join('\n\n') || `${state.team_a} vs ${state.team_b}: model ${weightedPct}% for ${state.team_a}.`;

    return {
      confidence: {
        team_a:state.team_a, team_b:state.team_b,
        win_pct:weightedPct, range_low:rangeLow, range_high:rangeHigh,
        agent_spread:Math.round(spread),
        consensus:spread<10?'strong':spread<20?'moderate':'split',
        weights, reasoning,
        sections: {
          injury_note:     san(sections.injury_note     ??''),
          decisive_factor: san(sections.decisive_factor ??''),
          key_matchup:     san(sections.key_matchup     ??''),
          x_factors:       san(sections.x_factors       ??''),
          risk:            san(sections.risk             ??''),
          market_vs_model: san(sections.market_vs_model ??''),
          bottom_line:     san(sections.bottom_line      ??''),
        },
        agent_breakdown: results.map(r=>({ agent:r.agent, win_pct:r.win_pct, confidence:r.confidence, key_edge:r.key_edge })),
      },
    };
  } catch(err) {
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
  if (req.method==='OPTIONS') { res.writeHead(204,CORS); res.end(); return; }
  if (req.method!=='POST') { res.writeHead(405,{'Content-Type':'application/json',...CORS}); res.end(JSON.stringify({error:'Method not allowed'})); return; }
  let body;
  try {
    const raw = await new Promise((resolve,reject)=>{ let d=''; req.on('data',c=>{d+=c;}); req.on('end',()=>resolve(d)); req.on('error',reject); });
    body = JSON.parse(raw);
  } catch { res.writeHead(400,{'Content-Type':'application/json',...CORS}); res.end(JSON.stringify({error:'Invalid JSON'})); return; }
  const rawA=body.team_a, rawB=body.team_b;
  if (!rawA||!rawB) { res.writeHead(400,{'Content-Type':'application/json',...CORS}); res.end(JSON.stringify({error:'team_a and team_b required'})); return; }
  if (typeof rawA!=='string'||typeof rawB!=='string'||rawA.length>200||rawB.length>200) { res.writeHead(400,{'Content-Type':'application/json',...CORS}); res.end(JSON.stringify({error:'Invalid team names'})); return; }
  const team_a=sanitizeTeamName(rawA), team_b=sanitizeTeamName(rawB);
  if (!team_a||!team_b) { res.writeHead(400,{'Content-Type':'application/json',...CORS}); res.end(JSON.stringify({error:'Invalid team names after sanitization'})); return; }
  const groqKey=process.env.GROQ_KEY;
  if (!groqKey) { res.writeHead(500,{'Content-Type':'application/json',...CORS}); res.end(JSON.stringify({error:'Server configuration error'})); return; }
  try {
    const result = await graph.invoke({ team_a, team_b, agent_results:[] }, { configurable:{ groqKey } });
    if (result.error) { res.writeHead(400,{'Content-Type':'application/json',...CORS}); res.end(JSON.stringify({error:result.error})); return; }
    res.writeHead(200,{'Content-Type':'application/json',...CORS});
    res.end(JSON.stringify({ agents:result.agent_results??[], confidence:result.confidence??{}, odds_data:null }));
  } catch(err) {
    console.error('[analyze] error:', err);
    res.writeHead(500,{'Content-Type':'application/json',...CORS});
    res.end(JSON.stringify({error:err.message??'Internal server error'}));
  }
}
