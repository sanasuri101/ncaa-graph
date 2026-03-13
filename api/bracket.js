/**
 * api/bracket.js — bracket simulation endpoint
 *
 * POST /api/bracket
 * Body: { model: 'barthag' | 'upset' | 'seed' | 'blended' }
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
  const graph  = JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'graph_data.json'), 'utf8'));
  const torvik = JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'torvik_stats.json'), 'utf8'));
  _cache = { graph, torvik };
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

// ── Win probability calculation ───────────────────────────────────────────────
function winProb(teamA, teamB, torvik, model, round) {
  const tvA = torvik.teams?.[teamA.id]?.torvik;
  const tvB = torvik.teams?.[teamB.id]?.torvik;
  const barthagA = tvA?.barthag ?? 0.5;
  const barthagB = tvB?.barthag ?? 0.5;
  const seedA = teamA.seed ?? 17;
  const seedB = teamB.seed ?? 17;

  // Pure Barthag: P(A beats B) = barthagA / (barthagA + barthagB)
  const barthagProb = barthagA / (barthagA + barthagB);

  // Seed-implied probability from historical rates
  const seedProb = seedWinProb(seedA, seedB);

  let prob;
  if (model === 'barthag') {
    prob = barthagProb;
  } else if (model === 'seed') {
    prob = seedProb;
  } else if (model === 'upset') {
    // Compress Barthag toward 50% — more upsets, especially early rounds
    const compression = round <= 1 ? 0.45 : round <= 2 ? 0.35 : 0.20;
    prob = 0.5 + (barthagProb - 0.5) * (1 - compression);
  } else {
    // blended: 70% Barthag + 30% seed
    prob = 0.70 * barthagProb + 0.30 * seedProb;
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
function simulateRegion(regionName, nodes, torvik, model) {
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
    const prob  = winProb(teamA, teamB, torvik, model, 0);
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
      const prob  = winProb(teamA, teamB, torvik, model, round);
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
function simulateBracket(model, graph, torvik) {
  const REGIONS = ['East', 'West', 'South', 'Midwest'];
  const nodesByRegion = {};
  REGIONS.forEach(r => {
    nodesByRegion[r] = graph.nodes.filter(n => n.region === r);
  });

  const regionResults = {};
  REGIONS.forEach(r => {
    regionResults[r] = simulateRegion(r, nodesByRegion[r], torvik, model);
  });

  // Final Four: East vs West, South vs Midwest (standard bracket)
  const ff1A = regionResults['East'].winner;
  const ff1B = regionResults['West'].winner;
  const ff2A = regionResults['South'].winner;
  const ff2B = regionResults['Midwest'].winner;

  const ff1Prob = winProb(ff1A, ff1B, torvik, model, 4);
  const ff2Prob = winProb(ff2A, ff2B, torvik, model, 4);
  const ff1Win  = ff1Prob >= 0.5 ? ff1A : ff1B;
  const ff2Win  = ff2Prob >= 0.5 ? ff2A : ff2B;

  const finalProb = winProb(ff1Win, ff2Win, torvik, model, 5);
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

  const model = ['barthag', 'upset', 'seed', 'blended'].includes(body.model)
    ? body.model : 'blended';

  try {
    const { graph, torvik } = getData();
    const result = simulateBracket(model, graph, torvik);
    res.writeHead(200, { 'Content-Type': 'application/json', ...CORS });
    res.end(JSON.stringify(result));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json', ...CORS });
    res.end(JSON.stringify({ error: err.message }));
  }
}
