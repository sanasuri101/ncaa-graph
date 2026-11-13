/**
 * bracket.js — NCAA Tournament bracket renderer
 *
 * Renders a real ESPN/NCAA-style bracket:
 *   Left half:  East (top) + South (bottom) — rounds expand rightward
 *   Right half: Midwest (top) + West (bottom) — rounds expand leftward
 *   Center:     Final Four + Championship
 *   Top:        First Four play-ins
 *
 * API response shape:
 *   regions.{East|West|South|Midwest}: { rounds[0..3], winner, playIns }
 *     rounds[0] = R64 (8 games), [1] = R32 (4), [2] = S16 (2), [3] = E8 (1)
 *   finalFour: { game1: {teamA,teamB,winner,prob}, game2 }
 *   championship: { teamA, teamB, winner, prob }
 *   champion: team object
 */

'use strict';

let _bracketData  = null;
let _bracketModel = 'evidence';

const MODEL_META = {
  evidence: {
    label: 'Evidence Model',
    desc:  'Daily rating from this season\'s results and closing point spreads.',
    color: 'var(--west)',
  },
  upset: {
    label: 'Upset Heavy',
    desc:  'Probabilistic simulation weighted toward chaos. Run multiple times.',
    color: 'var(--midwest)',
  },
};

const RC = {
  East:    'var(--east)',
  West:    'var(--west)',
  South:   'var(--south)',
  Midwest: 'var(--midwest)',
};

// ── Entry point ───────────────────────────────────────────────────────────────
function initBracket() { /* shell is static HTML */ }
function buildBracketShell() { return ''; }

function selectBracketModel(btn) {
  document.querySelectorAll('.br-model-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _bracketModel = btn.dataset.model;
}

// ── Fetch + render ────────────────────────────────────────────────────────────
async function generateBracket() {
  const btn   = document.getElementById('br-generate-btn');
  const stage = document.getElementById('bracket-stage');
  if (!btn || !stage) return;

  btn.disabled = true;
  btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Simulating…';
  stage.innerHTML = '<div class="br-loading"><div class="br-loading-spinner"></div>Running 63 games…</div>';

  if (window.posthog) posthog.capture('bracket_simulated', { model: _bracketModel });

  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    const res   = await fetch('/api/bracket', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ model: _bracketModel }),
      signal:  ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    _bracketData = await res.json();
    stage.innerHTML = renderBracket(_bracketData);
    bindTooltips();
  } catch (err) {
    stage.innerHTML = `<div class="br-error">${err.name === 'AbortError' ? 'Timed out — try again' : err.message}</div>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg> Simulate Bracket';
  }
}

// ── Core render ───────────────────────────────────────────────────────────────
function renderBracket(data) {
  const champColor = RC[data.champion?.region] || 'var(--accent)';
  const meta       = MODEL_META[data.model] || MODEL_META.evidence;

  const playInHTML  = renderPlayIns(data);
  const champBanner = `
    <div class="br-champ-banner">
      <span class="br-champ-trophy">🏆</span>
      <span class="br-champ-name" style="color:${champColor}">${data.champion.full_name}</span>
      <span class="br-champ-meta">${data.champion.region} · #${data.champion.seed} · ${meta.label}</span>
    </div>`;

  // Each half holds the two regions whose winners meet in the Final Four
  const [[l1, l2], [r1, r2]] = data.finalFourPairs;
  const eastHTML  = renderHalfRegion(data.regions[l1], 'left', l1);
  const southHTML = renderHalfRegion(data.regions[l2], 'left', l2);
  const midwestHTML = renderHalfRegion(data.regions[r1], 'right', r1);
  const westHTML    = renderHalfRegion(data.regions[r2], 'right', r2);

  // Center column: Final Four + Championship
  const centerHTML = renderCenter(data);

  return `
    <div class="ncaa-bracket">
      ${playInHTML}
      ${champBanner}
      <div class="br-edge-legend">
        First round: <span class="br-edge">+4.2</span> = points the better-rated team is ahead ·
        <span class="br-edge-flip-key">highlighted</span> = rating favours the lower seed.
        Picks follow the rating, not the seed.
      </div>
      <div class="bracket-body">
        <div class="bracket-left">
          <div class="bracket-half-region">${eastHTML}</div>
          <div class="bracket-half-region">${southHTML}</div>
        </div>
        <div class="bracket-center">${centerHTML}</div>
        <div class="bracket-right">
          <div class="bracket-half-region">${midwestHTML}</div>
          <div class="bracket-half-region">${westHTML}</div>
        </div>
      </div>
    </div>`;
}

// ── Half-region renderer ──────────────────────────────────────────────────────
// side = 'left' | 'right'
// Left regions: R64 | R32 | S16 | E8  (L→R toward center)
// Right regions: E8 | S16 | R32 | R64 (L→R away from center, mirrored)
function renderHalfRegion(regionData, side, regionName) {
  if (!regionData) return '';
  const rc     = RC[regionName];
  const rounds = regionData.rounds; // [R64(8), R32(4), S16(2), E8(1)]
  const labels = ['R64', 'R32', 'S16', 'E8'];

  // Left side: rounds 0→3 left-to-right
  // Right side: rounds 3→0 left-to-right (mirrored — E8 nearest center)
  const orderedRounds = side === 'left'
    ? rounds.map((r, i) => ({ games: r, label: labels[i], idx: i }))
    : [...rounds.map((r, i) => ({ games: r, label: labels[i], idx: i }))].reverse();

  const roundCols = orderedRounds.map(({ games, label, idx }) => {
    const gamesHTML = games.map(g => gameSlot(g, regionName, idx)).join('');
    return `<div class="br-col br-col-${label.toLowerCase()}" data-round="${idx}">
      <div class="br-col-label" style="color:${rc}">${label}</div>
      <div class="br-col-games">${gamesHTML}</div>
    </div>`;
  }).join('');

  return `
    <div class="br-region-block br-region-${side}" data-region="${regionName}">
      <div class="br-region-nameplate" style="color:${rc}">
        ${regionName.toUpperCase()}
        <span class="br-region-winner-chip">${regionData.winner?.label || ''}</span>
      </div>
      <div class="br-rounds-row">${roundCols}</div>
    </div>`;
}

// ── Center: Final Four + Championship ────────────────────────────────────────
function renderCenter(data) {
  const ff   = data.finalFour;
  const ch   = data.championship;

  const ff1HTML = finalFourSlot(ff.game1, data.finalFourPairs[0].join('/'));
  const ff2HTML = finalFourSlot(ff.game2, data.finalFourPairs[1].join('/'));
  const chHTML  = champSlot(ch);

  return `
    <div class="br-center-col">
      <div class="br-ff-label-top">FINAL FOUR</div>
      <div class="br-ff-game-wrap">${ff1HTML}</div>
      <div class="br-championship-wrap">
        <div class="br-championship-label">NATIONAL CHAMPIONSHIP</div>
        ${chHTML}
      </div>
      <div class="br-ff-game-wrap">${ff2HTML}</div>
      <div class="br-ff-label-bot">FINAL FOUR</div>
    </div>`;
}

// ── Individual game slot ──────────────────────────────────────────────────────
function gameSlot(game, regionName) {
  if (!game) return '<div class="br-slot br-slot-empty"></div>';
  const rc      = RC[regionName];
  const isActual = game.isPrediction === false;
  const cls     = isActual ? 'br-slot-actual' : 'br-slot-pred';
  const badge   = isActual ? '<span class="br-actual-badge">FINAL</span>' : '';
  // First-round games carry a rating edge: points the better seed (teamA) is ahead.
  // Negative means the lower seed is the better-rated team — the upset worth picking.
  const edge    = game.ratingEdge;
  const flip    = edge != null && edge < 0;
  const better  = edge == null ? null : flip ? game.teamB : game.teamA;
  const edgeTag = t => t === better ? `<span class="br-edge">+${Math.abs(edge).toFixed(1)}</span>` : '';
  const note    = edge == null ? '' : flip
    ? `Rating favours the lower seed: ${better.label} by ${Math.abs(edge).toFixed(1)} pts`
    : `Rating edge: ${better.label} by ${edge.toFixed(1)} pts`;
  return `<div class="br-slot ${cls} ${flip ? 'br-slot-flip' : ''}" data-prob="${game.prob}" data-actual="${isActual}" data-note="${note}">
    ${badge}
    ${teamLine(game.teamA, game.winner, game.prob, rc, isActual, game.actual, edgeTag(game.teamA))}
    ${teamLine(game.teamB, game.winner, game.prob, rc, isActual, game.actual, edgeTag(game.teamB))}
  </div>`;
}

function finalFourSlot(game, label) {
  if (!game) return '';
  const rcA     = RC[game.teamA?.region] || 'var(--accent)';
  const rcB     = RC[game.teamB?.region] || 'var(--accent)';
  const isActual = game.isPrediction === false;
  const cls     = isActual ? 'br-slot-actual' : 'br-slot-pred';
  const badge   = isActual ? ' · FINAL' : '';
  return `<div class="br-slot br-slot-ff ${cls}" data-prob="${game.prob}" data-actual="${isActual}">
    <div class="br-slot-sublabel">${label}${badge}</div>
    ${teamLine(game.teamA, game.winner, game.prob, rcA, isActual, game.actual)}
    ${teamLine(game.teamB, game.winner, game.prob, rcB, isActual, game.actual)}
  </div>`;
}

function champSlot(game) {
  if (!game) return '';
  const rcA     = RC[game.teamA?.region] || 'var(--accent)';
  const rcB     = RC[game.teamB?.region] || 'var(--accent)';
  const isActual = game.isPrediction === false;
  const cls     = isActual ? 'br-slot-actual' : 'br-slot-pred';
  return `<div class="br-slot br-slot-champ ${cls}" data-prob="${game.prob}" data-actual="${isActual}">
    ${teamLine(game.teamA, game.winner, game.prob, rcA, isActual, game.actual)}
    ${teamLine(game.teamB, game.winner, game.prob, rcB, isActual, game.actual)}
  </div>`;
}

function teamLine(team, winner, prob, rc, isActual, actual, edgeTag = '') {
  if (!team) return '<div class="br-team-line br-tbd"><span class="br-seed-num"></span><span class="br-team-nm">TBD</span></div>';
  const isWinner = winner && team.id === winner.id;
  const isTBD    = team.id?.startsWith('tbd-');
  const seedNum  = team.seed != null ? `<span class="br-seed-num">${team.seed}</span>` : '';

  // Trailer: actual score OR predicted win%
  let trailer = '';
  if (isActual && actual) {
    const score = isWinner ? actual.winnerScore : actual.loserScore;
    trailer = `<span class="br-score">${score}</span>`;
  } else if (!isActual && isWinner) {
    trailer = `<span class="br-win-pct">${(prob * 100).toFixed(0)}%</span>`;
  }

  const elimCls = isActual && !isWinner ? 'br-eliminated' : '';
  return `<div class="br-team-line ${isWinner ? 'br-winner-line' : 'br-loser-line'} ${elimCls} ${isTBD ? 'br-tbd' : ''}"
    style="${isWinner ? `border-left:2px solid ${rc}` : ''}">
    ${seedNum}<span class="br-team-nm">${team.label}</span>${edgeTag}${trailer}
  </div>`;
}

// ── Play-ins ──────────────────────────────────────────────────────────────────
function renderPlayIns(data) {
  const allPlayIns = ['East','West','South','Midwest']
    .flatMap(r => (data.regions[r]?.playIns || []).map(pi => ({ ...pi, region: r })));
  if (!allPlayIns.length) return '';

  const cards = allPlayIns.map(pi => {
    const rc = RC[pi.region];
    return `<div class="br-playin-card">
      <div class="br-playin-header" style="color:${rc}">${pi.region} · #${pi.seed}</div>
      ${teamLine(pi.teamA, pi.winner, pi.prob, rc, false, null)}
      ${teamLine(pi.teamB, pi.winner, pi.prob, rc, false, null)}
    </div>`;
  }).join('');

  return `<div class="br-firstfour">
    <div class="br-firstfour-label">FIRST FOUR — DAYTON</div>
    <div class="br-firstfour-grid">${cards}</div>
  </div>`;
}

// ── Tooltips ──────────────────────────────────────────────────────────────────
function bindTooltips() {
  document.querySelectorAll('.br-slot[data-prob]').forEach(el => {
    const isActual = el.dataset.actual === 'true';
    const winner   = el.querySelector('.br-winner-line .br-team-nm')?.textContent?.trim();
    const loser    = el.querySelector('.br-loser-line .br-team-nm')?.textContent?.trim();
    const wScore   = el.querySelector('.br-winner-line .br-score')?.textContent?.trim();
    const lScore   = el.querySelector('.br-loser-line .br-score')?.textContent?.trim();
    if (!winner) return;
    el.title = (isActual && wScore
      ? `FINAL: ${winner} ${wScore} · ${loser} ${lScore}`
      : `Predicted: ${winner} wins ${(parseFloat(el.dataset.prob)*100).toFixed(0)}%`)
      + (el.dataset.note ? ` · ${el.dataset.note}` : '');
  });
}

window.generateBracket    = generateBracket;
window.selectBracketModel = selectBracketModel;
window.initBracket        = initBracket;
