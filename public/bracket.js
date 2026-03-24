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
    desc:  'Torvik efficiency + form + Four Factors + injuries + transitive chains.',
    color: 'var(--west)',
  },
  market: {
    label: 'Market Consensus',
    desc:  'Evidence model anchored to live DraftKings lines and ESPN BPI. Most current.',
    color: 'var(--south)',
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

  // Left half: East (top) + South (bottom) — expands rightward toward center
  const eastHTML  = renderHalfRegion(data.regions['East'],  'left',  'East');
  const southHTML = renderHalfRegion(data.regions['South'], 'left',  'South');

  // Right half: Midwest (top) + West (bottom) — expands leftward toward center
  const midwestHTML = renderHalfRegion(data.regions['Midwest'], 'right', 'Midwest');
  const westHTML    = renderHalfRegion(data.regions['West'],    'right', 'West');

  // Center column: Final Four + Championship
  const centerHTML = renderCenter(data);

  return `
    <div class="ncaa-bracket">
      ${playInHTML}
      ${champBanner}
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

  const ff1HTML = finalFourSlot(ff.game1, 'East/South');
  const ff2HTML = finalFourSlot(ff.game2, 'Midwest/West');
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
function gameSlot(game, regionName, roundIdx) {
  if (!game) return '<div class="br-slot br-slot-empty"></div>';
  const rc = RC[regionName];
  return `<div class="br-slot" data-prob="${game.prob}" title="">
    ${teamLine(game.teamA, game.winner, game.prob, rc)}
    ${teamLine(game.teamB, game.winner, game.prob, rc)}
  </div>`;
}

function finalFourSlot(game, label) {
  if (!game) return '';
  const rcA = RC[game.teamA?.region] || 'var(--accent)';
  const rcB = RC[game.teamB?.region] || 'var(--accent)';
  return `<div class="br-slot br-slot-ff" data-prob="${game.prob}">
    <div class="br-slot-sublabel">${label}</div>
    ${teamLine(game.teamA, game.winner, game.prob, rcA)}
    ${teamLine(game.teamB, game.winner, game.prob, rcB)}
  </div>`;
}

function champSlot(game) {
  if (!game) return '';
  const rcA = RC[game.teamA?.region] || 'var(--accent)';
  const rcB = RC[game.teamB?.region] || 'var(--accent)';
  return `<div class="br-slot br-slot-champ" data-prob="${game.prob}">
    ${teamLine(game.teamA, game.winner, game.prob, rcA)}
    ${teamLine(game.teamB, game.winner, game.prob, rcB)}
  </div>`;
}

function teamLine(team, winner, prob, rc) {
  if (!team) return '<div class="br-team-line br-tbd"><span class="br-seed-num"></span><span class="br-team-nm">TBD</span></div>';
  const isWinner = winner && team.id === winner.id;
  const isTBD    = team.id?.startsWith('tbd-');
  const pct      = isWinner ? `<span class="br-win-pct">${(prob * 100).toFixed(0)}%</span>` : '';
  const seedNum  = team.seed != null ? `<span class="br-seed-num">${team.seed}</span>` : '';
  return `<div class="br-team-line ${isWinner ? 'br-winner-line' : 'br-loser-line'} ${isTBD ? 'br-tbd' : ''}"
    style="${isWinner ? `border-left:2px solid ${rc}` : ''}">
    ${seedNum}<span class="br-team-nm">${team.label}</span>${pct}
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
      ${teamLine(pi.teamA, pi.winner, pi.prob, rc)}
      ${teamLine(pi.teamB, pi.winner, pi.prob, rc)}
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
    const prob   = parseFloat(el.dataset.prob);
    if (!prob) return;
    const winner = el.querySelector('.br-winner-line .br-team-nm')?.textContent;
    const loser  = el.querySelector('.br-loser-line .br-team-nm')?.textContent;
    if (winner) el.title = `${winner} wins · ${(prob * 100).toFixed(1)}% · ${loser || '?'} eliminated`;
  });
}

window.generateBracket    = generateBracket;
window.selectBracketModel = selectBracketModel;
window.initBracket        = initBracket;
