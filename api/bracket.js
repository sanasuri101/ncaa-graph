/**
 * api/bracket.js — bracket simulation endpoint
 *
 * POST /api/bracket
 * Body: { model: 'barthag' | 'upset' | 'seed' | 'blended' | 'evidence' }
 *
 * Returns: {
 *   model: string,
 *   regions: { East, West, South, Midwest },  // each: rounds[0..3] of matchups
 *   finalFour: { matchups, winners },
 *   championship: { matchup, winner },
 *   champion: string
 * }
 *
 * Win probability models:
 *   barthag  — pure Torvik Barthag (power rating)
 *   upset    — Barthag but compresses toward 50% for early rounds (upsets more likely)
 *   seed     — seed-based only, ignores efficiency metrics
 *   blended  — 70% Barthag + 30% seed-implied probability
 */

import { readFileSync } from 'fs';
import { join }         from 'path';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ── Data ──────────────────────────────────────────────────────────────────────
let _cache = null;
function getData() {
  if (_cache) return _cache;
  const graph    = JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'graph_data.json'), 'utf8'));
  const torvik   = JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'torvik_stats.json'), 'utf8'));
  const form     = JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'recent_form.json'), 'utf8'));
  const trans    = JSON.parse(readFileSync(join(process.cwd(), 'data', 'transitive_analysis.json'), 'utf8'));

  // Injury overrides — manual file updated when key players go down
  let injuries = { overrides: {} };
  try {
    injuries = JSON.parse(readFileSync(join(process.cwd(), 'data', 'injury_overrides.json'), 'utf8'));
  } catch {}

  // Pre-compute injury-adjusted AdjEM and Barthag for each affected team
  // adj_em_penalty reduces AdjEM; re-derive Barthag via logit relationship
  // logit(Barthag) ≈ k * AdjEM where k is calibrated per team from current values
  const injuryMap = {};
  for (const [espnId, override] of Object.entries(injuries.overrides ?? {})) {
    const penalty = override.adj_em_penalty ?? 0;
    if (penalty <= 0) continue;
    const tv = torvik.teams?.[espnId]?.torvik;
    if (!tv) continue;
    const adjEM = (tv.adj_em ?? 0) - penalty;
    // Logit-based Barthag re-derivation: logit(b) = k*em → k = logit(b)/em → b_new = sigmoid(k*em_new)
    const logit  = p => Math.log(Math.max(0.001, p) / Math.max(0.001, 1 - p));
    const k      = logit(tv.barthag) / Math.max(0.01, tv.adj_em);
    const sigmoid = x => 1 / (1 + Math.exp(-x));
    const adjBarthag = Math.max(0.01, Math.min(0.99, sigmoid(k * adjEM)));
    // Apply same proportional adjustment to proj_barthag
    const projAdj = tv.proj_barthag
      ? Math.max(0.01, Math.min(0.99, sigmoid(k * (Math.max(0.01, logit(tv.proj_barthag) / k) - penalty))))
      : adjBarthag;
    injuryMap[espnId] = {
      adj_em:       adjEM,
      barthag:      adjBarthag,
      proj_barthag: projAdj,
      penalty,
      players:      override.players ?? [],
    };
  }

  let oppBarthag = {};
  try { oppBarthag = JSON.parse(readFileSync(join(process.cwd(), 'data', 'opp_barthag.json'), 'utf8')).opp_barthag ?? {}; } catch {}

  _cache = { graph, torvik, form, trans, injuryMap, oppBarthag };
  return _cache;
}

// ── Seed matchup table: standard NCAA bracket pairing ─────────────────────────
// Round of 64: 1v16, 8v9, 5v12, 4v13, 6v11, 3v14, 7v10, 2v15
const SEED_PAIRS_R1 = [[1,16],[8,9],[5,12],[4,13],[6,11],[3,14],[7,10],[2,15]];

// Seed-implied win probability (historical NCAA upset rates by matchup)
const SEED_WIN_PROB = {
  '1v16': 0.991, '16v1': 0.009,
  '1v15': 0.982, '15v1': 0.018,
  '1v14': 0.970, '14v1': 0.030,
  '1v13': 0.960, '13v1': 0.040,
  '1v12': 0.940, '12v1': 0.060,
  '1v11': 0.930, '11v1': 0.070,
  '1v10': 0.920, '10v1': 0.080,
  '1v9':  0.900, '9v1':  0.100,
  '1v8':  0.840, '8v1':  0.160,
  '2v16': 0.960, '16v2': 0.040,
  '2v15': 0.960, '15v2': 0.040,
  '2v14': 0.950, '14v2': 0.050,
  '2v13': 0.940, '13v2': 0.060,
  '2v12': 0.930, '12v2': 0.070,
  '2v11': 0.910, '11v2': 0.090,
  '2v10': 0.890, '10v2': 0.110,
  '2v9':  0.860, '9v2':  0.140,
  '2v8':  0.720, '8v2':  0.280,
  '3v16': 0.940, '16v3': 0.060,
  '3v14': 0.850, '14v3': 0.150,
  '3v11': 0.780, '11v3': 0.220,
  '3v6':  0.600, '6v3':  0.400,
  '4v13': 0.800, '13v4': 0.200,
  '4v12': 0.780, '12v4': 0.220,
  '4v5':  0.560, '5v4':  0.440,
  '5v12': 0.640, '12v5': 0.360,
  '6v11': 0.620, '11v6': 0.380,
  '7v10': 0.600, '10v7': 0.400,
  '8v9':  0.510, '9v8':  0.490,
};

function seedWinProb(seedA, seedB) {
  const key1 = `${seedA}v${seedB}`;
  const key2 = `${seedB}v${seedA}`;
  if (SEED_WIN_PROB[key1] !== undefined) return SEED_WIN_PROB[key1];
  if (SEED_WIN_PROB[key2] !== undefined) return 1 - SEED_WIN_PROB[key2];
  // fallback: lower seed wins with probability proportional to seed difference
  if (seedA < seedB) return 0.5 + Math.min((seedB - seedA) * 0.04, 0.45);
  return 0.5 - Math.min((seedA - seedB) * 0.04, 0.45);
}

// ── Layer I: Barthag ratio (Pythagorean) ─────────────────────────────────────
function barthagRatio(tvA, tvB) {
  return tvA.barthag / (tvA.barthag + tvB.barthag);
}

// ── Layer I: Projected Barthag ratio (forward-looking) ───────────────────────
// proj_barthag is Torvik's forward projection — accounts for schedule regression
// and implicitly captures recent player absences that haven't fully shown in AdjEM yet.
// Falls back to current barthag for 6 teams that lack a projection.
function projBarthagRatio(tvA, tvB) {
  if (tvA.proj_barthag && tvB.proj_barthag)
    return tvA.proj_barthag / (tvA.proj_barthag + tvB.proj_barthag);
  return barthagRatio(tvA, tvB); // graceful fallback
}

// ── Layer II: Logit win probability from AdjEM ────────────────────────────────
// Calibrated k=0.112 from NCAA historical backtesting (Pomeroy/Torvik lineage)
function logitEM(tvA, tvB) {
  return 1 / (1 + Math.exp(-0.112 * (tvA.adj_em - tvB.adj_em)));
}

// ── Layer II: Skellam win probability from projected scores ──────────────────
// Projects each team's expected score using cross-efficiency (AdjOE vs opponent AdjDE)
// then applies normal approximation to Skellam distribution (score difference model)
function skellamWinProb(tvA, tvB) {
  const poss  = ((tvA.adj_tempo + tvB.adj_tempo) / 2) * 80; // possessions per game
  const expA  = (tvA.adj_oe / 100) * (tvB.adj_de / 100) * poss;
  const expB  = (tvB.adj_oe / 100) * (tvA.adj_de / 100) * poss;
  const mu    = expA - expB;
  const sigma = Math.sqrt(expA + expB);  // Skellam variance = sum of Poisson rates
  if (sigma === 0) return 0.5;           // degenerate case: identical teams
  const z     = mu / sigma;
  // Normal CDF via Abramowitz & Stegun rational approximation
  const t    = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const phi  = Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);
  const cdf  = 1 - phi * poly;
  return z >= 0 ? cdf : 1 - cdf;
}

// ── Layer IV: Exponential time-decay win rate (opponent-quality weighted) ─────
// λ=0.018 → ~50% weight at 38 days — March games ~3× heavier than November.
// Each game weight also scaled by opponent quality (barthag). A win vs a 98%
// Barthag team counts ~40% more than a win vs an unrated mid-major.
// qualMult = 0.5 + barthag → range 0.5–1.5 (bracket opponents ~1.1–1.5).
// Falls back to opp_barthag.json for non-bracket opponents, then 0.70 default.
const DECAY_LAMBDA = 0.018;
const DECAY_TODAY  = new Date(); // always today — not hardcoded
function decayWinRate(teamId, form, torvik, oppBarthag) {
  const games = form?.teams?.[teamId]?.games ?? [];
  if (!games.length) return 0.5;
  let wins = 0, total = 0;
  for (const g of games) {
    const recencyW = Math.exp(-DECAY_LAMBDA * (DECAY_TODAY - new Date(g.date)) / 86400000);
    const b        = torvik?.teams?.[g.opp_id]?.torvik?.barthag
                  ?? oppBarthag?.[g.opp_id]
                  ?? 0.70;
    const w = recencyW * (0.5 + b);
    if (g.won) wins += w;
    total += w;
  }
  return total > 0 ? wins / total : 0.5;
}

// ── Layer IV: Transitive verdict adjustment ───────────────────────────────────
// Uses pre-computed common-opponent chains to adjust probability by ±8% max
function transitiveAdj(idA, idB, pairs) {
  const p = pairs?.[`${idA}_${idB}`] || pairs?.[`${idB}_${idA}`];
  if (!p || p.verdict === 'unclear' || !p.conf) return 0;
  const confNorm  = Math.min(p.conf / 100, 1);
  const direction = pairs?.[`${idA}_${idB}`]
    ? (p.verdict === 'a' ? 1 : -1)
    : (p.verdict === 'a' ? -1 : 1);
  return direction * confNorm * 0.08;
}

// ── Layer IV: WAB quality-wins adjustment ─────────────────────────────────────
// Wins Above Bubble captures schedule-adjusted quality. Scale to ±5% adjustment.
function wabAdj(tvA, tvB) {
  return Math.max(-0.05, Math.min(0.05, ((tvA.wab ?? 0) - (tvB.wab ?? 0)) / 1000));
}

// ── Evidence model: combined Layers I + II + IV ───────────────────────────────
// Weights: 35% Barthag · 25% Logit(AdjEM) · 20% Skellam · 20% decay form
// Plus additive adjustments: transitive chains + WAB (capped ±12%)
// Round compression: 10% in R64, 6% in R32, 2% in S16+ (March variance)
function evidenceWinProb(teamA, teamB, torvik, form, trans, round, injuryMap, oppBarthag) {
  const rawTvA = torvik.teams?.[teamA.id]?.torvik;
  const rawTvB = torvik.teams?.[teamB.id]?.torvik;
  const sA  = teamA.seed ?? 17;
  const sB  = teamB.seed ?? 17;

  // Apply injury-adjusted values if overrides exist for this team
  const tvA = injuryMap?.[teamA.id]
    ? { ...rawTvA, adj_em: injuryMap[teamA.id].adj_em, barthag: injuryMap[teamA.id].barthag, proj_barthag: injuryMap[teamA.id].proj_barthag }
    : rawTvA;
  const tvB = injuryMap?.[teamB.id]
    ? { ...rawTvB, adj_em: injuryMap[teamB.id].adj_em, barthag: injuryMap[teamB.id].barthag, proj_barthag: injuryMap[teamB.id].proj_barthag }
    : rawTvB;

  // Fall back to seed-based when torvik missing
  if (!tvA && !tvB) return seedWinProb(sA, sB);
  if (!tvA)         return 1 - seedWinProb(sB, sA);
  if (!tvB)         return seedWinProb(sA, sB);

  const bP = barthagRatio(tvA, tvB);
  const pB = projBarthagRatio(tvA, tvB); // forward-looking — captures injury regression
  const lP = logitEM(tvA, tvB);
  const sP = skellamWinProb(tvA, tvB);
  const dA = decayWinRate(teamA.id, form, torvik, oppBarthag);
  const dB = decayWinRate(teamB.id, form, torvik, oppBarthag);
  const dP = dA / (dA + dB);

  const pairs    = trans?.pairs ?? {};
  const transAdj = transitiveAdj(teamA.id, teamB.id, pairs);
  const wAdj     = wabAdj(tvA, tvB);
  const lAdj     = luckAdj(tvA, tvB);

  // 20% backward Barthag · 15% projected Barthag · 25% Logit(AdjEM) · 20% Skellam · 20% quality-decay form
  // proj_barthag forward signal captures roster/injury changes Torvik has already modelled
  const base      = 0.20*bP + 0.15*pB + 0.25*lP + 0.20*sP + 0.20*dP;
  const evidAdj   = Math.max(-0.12, Math.min(0.12, transAdj + wAdj + lAdj));
  const compress  = round <= 1 ? 0.10 : round <= 2 ? 0.06 : 0.02;
  const prob      = 0.5 + (base - 0.5) * (1 - compress) + evidAdj;

  return Math.max(0.01, Math.min(0.99, prob));
}

// ── Win probability calculation ───────────────────────────────────────────────
function winProb(teamA, teamB, torvik, model, round, form, trans, injuryMap, oppBarthag) {
  const tvA = torvik.teams?.[teamA.id]?.torvik;
  const tvB = torvik.teams?.[teamB.id]?.torvik;
  const barthagA = tvA?.barthag ?? 0.5;
  const barthagB = tvB?.barthag ?? 0.5;
  const seedA = teamA.seed ?? 17;
  const seedB = teamB.seed ?? 17;

  // Pure Barthag: P(A beats B) = barthagA / (barthagA + barthagB)
  const barthagPrb = barthagA / (barthagA + barthagB);

  // Seed-implied probability from historical rates
  const seedProb = seedWinProb(seedA, seedB);

  if (model === 'evidence') {
    return evidenceWinProb(teamA, teamB, torvik, form, trans, round, injuryMap, oppBarthag);
  }

  let prob;
  if (model === 'barthag') {
    prob = barthagPrb;
  } else if (model === 'seed') {
    prob = seedProb;
  } else if (model === 'upset') {
    // Compress Barthag toward 50% — more upsets, especially early rounds
    const compression = round <= 1 ? 0.45 : round <= 2 ? 0.35 : 0.20;
    prob = 0.5 + (barthagPrb - 0.5) * (1 - compression);
  } else {
    // blended: 70% Barthag + 30% seed
    prob = 0.70 * barthagPrb + 0.30 * seedProb;
  }

  return Math.max(0.01, Math.min(0.99, prob));
}

// ── Play-in resolver: pick winner of two teams with same seed ─────────────────
function playInWinner(teamA, teamB, torvik) {
  const tvA = torvik.teams?.[teamA.id]?.torvik;
  const tvB = torvik.teams?.[teamB.id]?.torvik;
  const barthagA = tvA?.barthag ?? 0.5;
  const barthagB = tvB?.barthag ?? 0.5;
  const prob = barthagA / (barthagA + barthagB);
  return {
    winner: prob >= 0.5 ? teamA : teamB,
    loser:  prob >= 0.5 ? teamB : teamA,
    prob:   prob >= 0.5 ? prob : 1 - prob,
  };
}

// ── Build one region's bracket ────────────────────────────────────────────────
function simulateRegion(regionName, nodes, torvik, model, form, trans, injuryMap, oppBarthag) {
  // Collect seeded teams, resolve play-in games first
  const bySlot = {}; // slot = seed (1-16 after play-ins resolved)
  const playIns = [];

  // Group by seed
  const bySeed = {};
  nodes.forEach(n => {
    const s = n.seed ?? 17;
    (bySeed[s] = bySeed[s] || []).push(n);
  });

  // Resolve play-ins (seeds with 2 teams)
  Object.entries(bySeed).forEach(([seed, teams]) => {
    if (teams.length === 2) {
      const result = playInWinner(teams[0], teams[1], torvik);
      playIns.push({
        seed: parseInt(seed),
        teamA: teams[0],
        teamB: teams[1],
        winner: result.winner,
        prob: result.prob,
      });
      bySlot[parseInt(seed)] = result.winner;
    } else if (teams.length === 1) {
      bySlot[parseInt(seed)] = teams[0];
    }
  });

  // Fill missing seeds (Midwest is missing 6, 11 pre-Selection Sunday)
  // Use TBD placeholder
  for (const [a, b] of SEED_PAIRS_R1) {
    if (!bySlot[a]) bySlot[a] = { id: `tbd-${regionName}-${a}`, label: 'TBD', full_name: `TBD (#${a})`, seed: a, region: regionName, wins_vs_field: 0, losses_vs_field: 0 };
    if (!bySlot[b]) bySlot[b] = { id: `tbd-${regionName}-${b}`, label: 'TBD', full_name: `TBD (#${b})`, seed: b, region: regionName, wins_vs_field: 0, losses_vs_field: 0 };
  }

  const rounds = []; // rounds[0] = R64, rounds[1] = R32, rounds[2] = S16, rounds[3] = E8

  // Round 1 — seed pairs
  let survivors = [];
  const r1 = [];
  for (const [sA, sB] of SEED_PAIRS_R1) {
    const teamA = bySlot[sA];
    const teamB = bySlot[sB];
    const prob  = winProb(teamA, teamB, torvik, model, 0, form, trans, injuryMap, oppBarthag);
    const winner = prob >= 0.5 ? teamA : teamB;
    r1.push({ teamA, teamB, winner, prob: prob >= 0.5 ? prob : 1 - prob, winnerSide: prob >= 0.5 ? 'A' : 'B' });
    survivors.push(winner);
  }
  rounds.push(r1);

  // Rounds 2-4 — winners advance
  for (let round = 1; round <= 3; round++) {
    const next = [];
    const rGames = [];
    for (let i = 0; i < survivors.length; i += 2) {
      const teamA = survivors[i];
      const teamB = survivors[i + 1];
      const prob  = winProb(teamA, teamB, torvik, model, round, form, trans, injuryMap, oppBarthag);
      const winner = prob >= 0.5 ? teamA : teamB;
      rGames.push({ teamA, teamB, winner, prob: prob >= 0.5 ? prob : 1 - prob, winnerSide: prob >= 0.5 ? 'A' : 'B' });
      next.push(winner);
    }
    rounds.push(rGames);
    survivors = next;
  }

  return { region: regionName, rounds, winner: survivors[0], playIns };
}

// ── Full bracket simulation ───────────────────────────────────────────────────
function simulateBracket(model, graph, torvik, form, trans, injuryMap, oppBarthag) {
  const REGIONS = ['East', 'West', 'South', 'Midwest'];
  const nodesByRegion = {};
  REGIONS.forEach(r => {
    nodesByRegion[r] = graph.nodes.filter(n => n.region === r);
  });

  const regionResults = {};
  REGIONS.forEach(r => {
    regionResults[r] = simulateRegion(r, nodesByRegion[r], torvik, model, form, trans, injuryMap, oppBarthag);
  });

  // Final Four: East vs West, South vs Midwest (standard bracket)
  const ff1A = regionResults['East'].winner;
  const ff1B = regionResults['West'].winner;
  const ff2A = regionResults['South'].winner;
  const ff2B = regionResults['Midwest'].winner;

  const ff1Prob = winProb(ff1A, ff1B, torvik, model, 4, form, trans, injuryMap, oppBarthag);
  const ff2Prob = winProb(ff2A, ff2B, torvik, model, 4, form, trans, injuryMap, oppBarthag);
  const ff1Win  = ff1Prob >= 0.5 ? ff1A : ff1B;
  const ff2Win  = ff2Prob >= 0.5 ? ff2A : ff2B;

  const finalProb = winProb(ff1Win, ff2Win, torvik, model, 5, form, trans, injuryMap, oppBarthag);
  const champion  = finalProb >= 0.5 ? ff1Win : ff2Win;

  return {
    model,
    regions: regionResults,
    finalFour: {
      game1: { teamA: ff1A, teamB: ff1B, winner: ff1Win, prob: ff1Prob >= 0.5 ? ff1Prob : 1 - ff1Prob },
      game2: { teamA: ff2A, teamB: ff2B, winner: ff2Win, prob: ff2Prob >= 0.5 ? ff2Prob : 1 - ff2Prob },
    },
    championship: {
      teamA: ff1Win,
      teamB: ff2Win,
      winner: champion,
      prob: finalProb >= 0.5 ? finalProb : 1 - finalProb,
    },
    champion,
    season: graph?.meta?.season ?? '',
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS); res.end(); return;
  }
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' })); return;
  }

  let body = {};
  try {
    const raw = await new Promise((resolve, reject) => {
      let d = ''; req.on('data', c => { d += c; }); req.on('end', () => resolve(d)); req.on('error', reject);
    });
    body = raw ? JSON.parse(raw) : {};
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON' })); return;
  }

  const model = ['barthag', 'upset', 'seed', 'blended', 'evidence'].includes(body.model)
    ? body.model : 'blended';

  try {
    const { graph, torvik, form, trans, injuryMap, oppBarthag } = getData();
    const result = simulateBracket(model, graph, torvik, form, trans, injuryMap, oppBarthag);
    res.writeHead(200, { 'Content-Type': 'application/json', ...CORS });
    res.end(JSON.stringify(result));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json', ...CORS });
    res.end(JSON.stringify({ error: err.message }));
  }
}
