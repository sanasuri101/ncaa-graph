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

import { readFileSync, statSync } from 'fs';
import { join }         from 'path';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ── Data ──────────────────────────────────────────────────────────────────────
let _cache     = null;
let _cacheMtime = 0;

function getCacheMtime() {
  // Key cache to the mtime of the most-recently-modified data file
  // If any file changed since last cache build, invalidate
  const files = [
    'data/all_games.json',
    'data/bracket_config.json',
    'public/data/torvik_stats.json',
    'public/data/recent_form.json',
    'data/injury_overrides.json',
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

function getData() {
  const mtime = getCacheMtime();
  if (_cache && mtime === _cacheMtime) return _cache;
  // Cache miss or stale — rebuild
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

  const actualResults = buildActualResults();

  _cache = { graph, torvik, form, trans, injuryMap, oppBarthag, actualResults };
  _cacheMtime = mtime;
  return _cache;
}

// ── Actual tournament results ─────────────────────────────────────────────────
// Reads all_games.json, finds completed tournament games, builds a lookup map
// keyed by sorted ESPN team ID pair so any two teams can be looked up fast.
function buildActualResults() {
  let allGames = [];
  try { allGames = JSON.parse(readFileSync(join(process.cwd(), 'data', 'all_games.json'), 'utf8')); } catch { return { gameResults: {}, eliminated: {} }; }

  let bracketIds = new Set();
  try {
    const cfg = JSON.parse(readFileSync(join(process.cwd(), 'data', 'bracket_config.json'), 'utf8'));
    cfg.bracket.forEach(t => bracketIds.add(String(t.espn_id)));
  } catch {}

  const gameResults = {};
  const eliminated  = {};
  const winners     = {};

  allGames
    .filter(g => {
      const meta = graph?.meta;
      const startDate = meta?.tourney_start ?? (() => {
        const yr = new Date().getFullYear();
        const d  = new Date(yr, 2, 1);
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
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach(g => {
      const t1 = String(g.team1_id), t2 = String(g.team2_id);
      if (!bracketIds.has(t1) && !bracketIds.has(t2)) return;

      const winnerId    = g.team1_winner ? t1 : t2;
      const loserId     = g.team1_winner ? t2 : t1;
      const winnerScore = g.team1_winner ? g.team1_score : g.team2_score;
      const loserScore  = g.team1_winner ? g.team2_score : g.team1_score;
      const winnerName  = g.team1_winner ? g.team1_name  : g.team2_name;
      const loserName   = g.team1_winner ? g.team2_name  : g.team1_name;

      winners[winnerId]   = true;
      eliminated[loserId] = { oppName: winnerName, winnerScore, loserScore, date: g.date };

      const key = [t1, t2].sort().join('_');
      gameResults[key] = { winnerId, winnerName, loserName, winnerScore, loserScore, date: g.date };
    });

  return { gameResults, eliminated };
}

function lookupActual(teamA, teamB, actualResults) {
  if (!actualResults?.gameResults) return null;
  const key = [String(teamA.id), String(teamB.id)].sort().join('_');
  return actualResults.gameResults[key] ?? null;
}

// ── Seed matchup table: standard NCAA bracket pairing ─────────────────────────
// Round of 64: 1v16, 8v9, 5v12, 4v13, 6v11, 3v14, 7v10, 2v15
const SEED_PAIRS_R1 = [[1,16],[8,9],[5,12],[4,13],[6,11],[3,14],[7,10],[2,15]];

// Seed-implied win probability (historical NCAA upset rates by matchup)
// Historical NCAA tournament win rates by seed matchup (1985-2024, n=2400+ games)
const SEED_WIN_PROB = {
  // R1 matchups
  '1v16': 0.991, '16v1': 0.009,
  '2v15': 0.942, '15v2': 0.058,
  '3v14': 0.850, '14v3': 0.150,
  '4v13': 0.795, '13v4': 0.205,
  '5v12': 0.647, '12v5': 0.353,
  '6v11': 0.622, '11v6': 0.378,
  '7v10': 0.601, '10v7': 0.399,
  '8v9':  0.509, '9v8':  0.491,
  // R2 matchups (common paths)
  '1v8':  0.760, '8v1':  0.240,
  '1v9':  0.800, '9v1':  0.200,
  '2v7':  0.660, '7v2':  0.340,
  '2v10': 0.720, '10v2': 0.280,
  '3v6':  0.590, '6v3':  0.410,
  '3v11': 0.720, '11v3': 0.280,
  '4v5':  0.530, '5v4':  0.470,
  '4v12': 0.700, '12v4': 0.300,
  // S16 matchups
  '1v4':  0.710, '4v1':  0.290,
  '1v5':  0.730, '5v1':  0.270,
  '1v12': 0.820, '12v1': 0.180,
  '2v3':  0.560, '3v2':  0.440,
  '2v6':  0.650, '6v2':  0.350,
  '2v11': 0.750, '11v2': 0.250,
  // E8 matchups
  '1v2':  0.560, '2v1':  0.440,
  '1v3':  0.620, '3v1':  0.380,
  '2v4':  0.590, '4v2':  0.410,
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
// qualMult uses logit-normalized barthag so top-end differences are meaningful:
// beating Duke(0.981) vs Vanderbilt(0.949) gives 6× more spread than raw barthag.
// Normalized to 0.5-1.5 range. Falls back to opp_barthag.json then 0.70.
const DECAY_LAMBDA = 0.018;
const DECAY_TODAY  = new Date(); // always today — not hardcoded
const LOGIT_MIN    = -1.10;     // logit(~0.25) low-major floor
const LOGIT_MAX    =  4.04;     // logit(~0.981) elite ceiling
function qualMult(b) {
  const bv = Math.max(0.001, Math.min(0.999, b ?? 0.70));
  const l  = Math.log(bv / (1 - bv));
  return 0.5 + (l - LOGIT_MIN) / (LOGIT_MAX - LOGIT_MIN);
}
function decayWinRate(teamId, form, torvik, oppBarthag) {
  const games = form?.teams?.[teamId]?.games ?? [];
  if (!games.length) return 0.5;
  let wins = 0, total = 0;
  for (const g of games) {
    const recencyW = Math.exp(-DECAY_LAMBDA * (DECAY_TODAY - new Date(g.date)) / 86400000);
    const b        = torvik?.teams?.[g.opp_id]?.torvik?.barthag
                  ?? oppBarthag?.[g.opp_id]
                  ?? 0.70;
    const w = recencyW * qualMult(b);
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
// Wins Above Bubble captures schedule-adjusted quality.
// Bracket field WAB range ~62-73 (diff ~11). Divisor 270 → max ±4% at diff=10.8.
function wabAdj(tvA, tvB) {
  return Math.max(-0.04, Math.min(0.04, ((tvA.wab ?? 0) - (tvB.wab ?? 0)) / 270));
}

// ── Layer IV: Luck regression adjustment ──────────────────────────────────────
// Torvik luck = actual wins minus pythagorean expected wins from scoring margin.
// Lucky teams (positive luck) are overperforming and due for regression.
// Unlucky teams (negative luck) are better than their record suggests.
// Scale: luck diff of 0.20 → 3% penalty. Cap ±4%.
function luckAdj(tvA, tvB) {
  const diff = (tvA.luck ?? 0) - (tvB.luck ?? 0);
  return Math.max(-0.04, Math.min(0.04, -diff * 0.15));
}

// ── Four Factors mismatch score ──────────────────────────────────────────────
// Identifies "Giant Killer" profiles: double-digit seeds that can math their way
// past higher seeds via style mismatches.
// Returns an adjustment in range [-0.06, +0.06] for team A
function fourFactorsAdj(tvA, tvB) {
  if (!tvA || !tvB) return 0;
  let adj = 0;

  // 1. eFG% edge — most important of Four Factors (~40% weight)
  const efgA = tvA.efg ?? 50, efgB = tvB.efg ?? 50;
  adj += (efgA - efgB) / 100 * 0.15;

  // 2. TOV% edge — lower TOV rate is better (~25% weight)
  const tovA = tvA.tov_rate ?? 18, tovB = tvB.tov_rate ?? 18;
  adj += (tovB - tovA) / 100 * 0.10;  // positive when A turns it over less

  // 3. ORB% edge (~20% weight)
  const orbA = tvA.orb_rate ?? 30, orbB = tvB.orb_rate ?? 30;
  adj += (orbA - orbB) / 100 * 0.08;

  // 4. FTR edge (~15% weight) — but high FTR = vulnerable to referee variability
  // In upsets: teams that DON'T rely on FTs are more consistent
  const ftrA = tvA.ftr ?? 35, ftrB = tvB.ftr ?? 35;
  adj += (ftrA - ftrB) / 100 * 0.05;

  // 5. 3PA rate mismatch — "Giant Killer" profile
  // A team shooting lots of 3s (high variance) vs interior-reliant team = upset potential
  const tpaA = tvA.three_pa_rate ?? 35, tpaB = tvB.three_pa_rate ?? 35;
  const threePctA = tvA.three_p ?? 33, threePctB = tvB.three_p ?? 33;
  // Bonus for lower seed with high 3PA rate AND good 3P% — classic upset profile
  if (tpaA > 45 && threePctA > 36) adj += 0.02;   // A is a 3P-reliant team
  if (tpaB > 45 && threePctB > 36) adj -= 0.02;   // B is a 3P-reliant team

  return Math.max(-0.06, Math.min(0.06, adj));
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
  const ffAdj     = fourFactorsAdj(tvA, tvB);
  const evidAdj   = Math.max(-0.12, Math.min(0.12, transAdj + wAdj + lAdj + ffAdj));
  const compress  = round <= 1 ? 0.10 : round <= 2 ? 0.06 : 0.02;
  const prob      = 0.5 + (base - 0.5) * (1 - compress) + evidAdj;

  return Math.max(0.01, Math.min(0.99, prob));
}

// ── Win probability calculation ───────────────────────────────────────────────
function winProb(teamA, teamB, torvik, model, round, form, trans, injuryMap, oppBarthag) {
  const rawTvA = torvik.teams?.[teamA.id]?.torvik;
  const rawTvB = torvik.teams?.[teamB.id]?.torvik;
  // Apply injury adjustments for ALL models
  const tvA = injuryMap?.[teamA.id]
    ? { ...rawTvA, adj_em: injuryMap[teamA.id].adj_em, barthag: injuryMap[teamA.id].barthag, proj_barthag: injuryMap[teamA.id].proj_barthag }
    : rawTvA;
  const tvB = injuryMap?.[teamB.id]
    ? { ...rawTvB, adj_em: injuryMap[teamB.id].adj_em, barthag: injuryMap[teamB.id].barthag, proj_barthag: injuryMap[teamB.id].proj_barthag }
    : rawTvB;
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
    // Pure efficiency — Torvik barthag ratio
    prob = barthagPrb;
  } else if (model === 'seed') {
    // Pure historical seed win rates
    prob = seedProb;
  } else if (model === 'upset') {
    // Upset model: seed-gap weighted base + mild compression + signal adjustments
    // Large seed gaps (1v16, 2v15): historical rates dominate — prevents statistically
    //   impossible runs like 15-seeds reaching Sweet 16
    // Small seed gaps (5v12, 6v11): efficiency dominates — these ARE close games
    // Result: ~3-5 upsets from seeds 12+, ~6-8 total upsets per R1
    const seedGap    = Math.abs(seedB - seedA);
    const histWeight = Math.min(0.90, 0.50 + seedGap * 0.04); // scales 50%→90% with seed gap
    const base       = (1 - histWeight) * barthagPrb + histWeight * seedProb;

    // Signal adjustments: form, Four Factors, luck, WAB
    const dA      = decayWinRate(teamA.id, form, torvik, oppBarthag);
    const dB      = decayWinRate(teamB.id, form, torvik, oppBarthag);
    const dP      = dA / (dA + dB);
    const formAdj = (dP - 0.5) * 0.08;
    const ffAdj   = fourFactorsAdj(tvA, tvB);
    const lAdj    = luckAdj(tvA, tvB);
    const wAdj    = wabAdj(tvA, tvB);
    const allAdj  = Math.max(-0.06, Math.min(0.06, formAdj + ffAdj + lAdj + wAdj));
    const adjusted = base + allAdj;

    // Only compress games that are not already dominant favorites (base < 0.85)
    // Dominant matchups (1v16 after weighting) stay near historical chalk
    if (adjusted >= 0.85) {
      prob = adjusted; // don't compress — too dominant
    } else {
      const compression = round <= 1 ? 0.20 : round <= 2 ? 0.14 : 0.08;
      prob = 0.5 + (adjusted - 0.5) * (1 - compression);
    }
  } else {
    // blended: 40% Barthag + 60% historical seed rates
    // Seed rates are historically calibrated — barthag adds efficiency signal
    // This weights early-round chalk correctly while letting efficiency matter in later rounds
    const seedWeight = round <= 1 ? 0.60 : round <= 2 ? 0.45 : 0.25;
    prob = (1 - seedWeight) * barthagPrb + seedWeight * seedProb;
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

// ── Probabilistic winner pick ─────────────────────────────────────────────────
// For deterministic models (barthag, blended, seed): always pick chalk
// upset = probabilistic (Math.random weighted by prob)
// evidence = deterministic (always pick higher probability team — best single prediction)
function pickWinner(teamA, teamB, prob, model) {
  if (model === 'upset') {
    return Math.random() < prob ? teamA : teamB;
  }
  return prob >= 0.5 ? teamA : teamB;
}

// ── Build one region's bracket ────────────────────────────────────────────────
function simulateRegion(regionName, nodes, torvik, model, form, trans, injuryMap, oppBarthag, actualResults) {
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

  // Round 1 — lock actual results, predict the rest
  let survivors = [];
  const r1 = [];
  for (const [sA, sB] of SEED_PAIRS_R1) {
    const teamA  = bySlot[sA];
    const teamB  = bySlot[sB];
    const actual = lookupActual(teamA, teamB, actualResults);
    let winner, prob, isPrediction;
    if (actual) {
      winner       = actual.winnerId === String(teamA.id) ? teamA : teamB;
      prob         = 1;
      isPrediction = false;
    } else {
      prob         = winProb(teamA, teamB, torvik, model, 0, form, trans, injuryMap, oppBarthag);
      winner       = pickWinner(teamA, teamB, prob, model);
      prob         = Math.max(winner === teamA ? prob : 1 - prob, 0.01);
      isPrediction = true;
    }
    r1.push({ teamA, teamB, winner, prob, isPrediction, actual: actual ?? null });
    survivors.push(winner);
  }
  rounds.push(r1);

  // Rounds 2-4 — lock actuals, predict rest
  for (let round = 1; round <= 3; round++) {
    const next   = [];
    const rGames = [];
    for (let i = 0; i < survivors.length; i += 2) {
      const teamA  = survivors[i];
      const teamB  = survivors[i + 1];
      const actual = lookupActual(teamA, teamB, actualResults);
      let winner, prob, isPrediction;
      if (actual) {
        winner       = actual.winnerId === String(teamA.id) ? teamA : teamB;
        prob         = 1;
        isPrediction = false;
      } else {
        prob         = winProb(teamA, teamB, torvik, model, round, form, trans, injuryMap, oppBarthag);
        winner       = pickWinner(teamA, teamB, prob, model);
        prob         = Math.max(winner === teamA ? prob : 1 - prob, 0.01);
        isPrediction = true;
      }
      rGames.push({ teamA, teamB, winner, prob, isPrediction, actual: actual ?? null });
      next.push(winner);
    }
    rounds.push(rGames);
    survivors = next;
  }

  return { region: regionName, rounds, winner: survivors[0], playIns };
}

// ── Full bracket simulation ───────────────────────────────────────────────────
function simulateBracket(model, graph, torvik, form, trans, injuryMap, oppBarthag, actualResults) {
  const REGIONS = ['East', 'West', 'South', 'Midwest'];
  const nodesByRegion = {};
  REGIONS.forEach(r => {
    nodesByRegion[r] = graph.nodes.filter(n => n.region === r);
  });

  const regionResults = {};
  REGIONS.forEach(r => {
    regionResults[r] = simulateRegion(r, nodesByRegion[r], torvik, model, form, trans, injuryMap, oppBarthag, actualResults);
  });

  // Final Four: East vs South (left half), Midwest vs West (right half)
  // Left half of bracket: East (top-left) + South (bottom-left) -> their winners meet
  // Right half of bracket: Midwest (top-right) + West (bottom-right) -> their winners meet
  const ff1A = regionResults['East'].winner;
  const ff1B = regionResults['South'].winner;
  const ff2A = regionResults['Midwest'].winner;
  const ff2B = regionResults['West'].winner;

  const ff1Prob = winProb(ff1A, ff1B, torvik, model, 4, form, trans, injuryMap, oppBarthag);
  const ff2Prob = winProb(ff2A, ff2B, torvik, model, 4, form, trans, injuryMap, oppBarthag);
  const ff1Win  = pickWinner(ff1A, ff1B, ff1Prob, model);
  const ff2Win  = pickWinner(ff2A, ff2B, ff2Prob, model);

  const finalProb = winProb(ff1Win, ff2Win, torvik, model, 5, form, trans, injuryMap, oppBarthag);
  const champion  = pickWinner(ff1Win, ff2Win, finalProb, model);

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

  const model = ['evidence', 'upset', 'market'].includes(body.model)
    ? body.model : 'evidence';

  try {
    const { graph, torvik, form, trans, injuryMap, oppBarthag, actualResults } = getData();
    const result = simulateBracket(model, graph, torvik, form, trans, injuryMap, oppBarthag, actualResults);
    res.writeHead(200, { 'Content-Type': 'application/json', ...CORS });
    res.end(JSON.stringify(result));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json', ...CORS });
    res.end(JSON.stringify({ error: err.message }));
  }
}
