/**
 * bracket.js — bracket generator UI
 *
 * Fetches /api/bracket with chosen model, renders full 63-game bracket.
 * Activated by the Bracket tab in index.html.
 */

'use strict';

let _bracketData  = null;
let _bracketModel = 'evidence';

const MODEL_META = {
  evidence: {
    label:  'Evidence Model',
    desc:   'Multi-layer: efficiency + form + transitive paths + Four Factors + injuries. Best single prediction.',
    color:  'var(--west)',
  },
  upset: {
    label:  'Upset Heavy',
    desc:   'Probabilistic simulation weighted toward chaos. Run it multiple times for different outcomes.',
    color:  'var(--midwest)',
  },
};

const REGION_COLOR = {
  East:    'var(--east)',
  West:    'var(--west)',
  South:   'var(--south)',
  Midwest: 'var(--midwest)',
};

// ── Entry point — called once on page load ─────────────────────────────────
// The HTML already contains bracket-controls and bracket-stage.
// Nothing to inject — just mark as ready.
function initBracket() {
  // No-op: shell is in index.html. generateBracket() handles everything.
}

function buildBracketShell() {
  return ''; // shell is static HTML
}

function selectBracketModel(btn) {
  document.querySelectorAll('.br-model-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _bracketModel = btn.dataset.model;
}

function bindBracketEvents() {
  // Buttons use onclick attributes so they survive innerHTML cloning on mobile
  // Nothing to bind here — kept for compatibility
}

// ── Fetch + render ────────────────────────────────────────────────────────────
async function generateBracket() {
  const btn   = document.getElementById('br-generate-btn');
  const stage = document.getElementById('bracket-stage');
  if (!btn || !stage) return;
  btn.disabled = true;
  btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Simulating…';
  stage.innerHTML = '<div class="br-loading"><div class="br-loading-spinner"></div>Running 63 games…</div>';
  // alias so renderFullBracket can write into stage
  const out = { set innerHTML(v) { stage.innerHTML = v; } };

  if (window.posthog) posthog.capture('bracket_simulated', { model: _bracketModel });
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);
    const res = await fetch('/api/bracket', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ model: _bracketModel }),
      signal:  ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    _bracketData = await res.json();
    stage.innerHTML = renderFullBracket(_bracketData);
    bindGameTooltips();
  } catch (err) {
    stage.innerHTML = `<div class="br-error">${err.message}</div>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg> Simulate Bracket';
  }
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderFullBracket(data) {
  const meta = MODEL_META[data.model];
  const rNames = ['Round of 64', 'Round of 32', 'Sweet 16', 'Elite Eight'];

  const champion = data.champion;
  const champColor = REGION_COLOR[champion.region] || 'var(--accent)';

  // Play-in section
  const allPlayIns = ['East','West','South','Midwest']
    .flatMap(r => data.regions[r].playIns || []);
  const playInHTML = allPlayIns.length ? `
    <div class="br-section-header">First Four (Play-In Games)</div>
    <div class="br-playin-grid">
      ${allPlayIns.map(pi => `
        <div class="br-playin-game">
          <div class="br-playin-region">${pi.teamA.region} · Seed #${pi.seed}</div>
          ${gameRow(pi.teamA, pi.teamB, pi.winner, pi.prob)}
        </div>`).join('')}
    </div>` : '';

  // Region brackets
  const regionsHTML = ['East','West','South','Midwest'].map(rName => {
    const rData = data.regions[rName];
    const rc = REGION_COLOR[rName];
    const roundsHTML = rData.rounds.map((games, ri) => `
      <div class="br-round">
        <div class="br-round-label" style="color:${rc}">${rNames[ri]}</div>
        ${games.map(g => gameRow(g.teamA, g.teamB, g.winner, g.prob)).join('')}
      </div>`).join('');

    return `
      <div class="br-region">
        <div class="br-region-header" style="border-color:${rc};color:${rc}">${rName} Region</div>
        <div class="br-region-winner">
          <span class="br-region-winner-label">Regional Champion</span>
          <span class="br-region-winner-name" style="color:${rc}">${rData.winner.full_name}</span>
        </div>
        <div class="br-rounds">${roundsHTML}</div>
      </div>`;
  }).join('');

  // Final Four
  const ff = data.finalFour;
  const championship = data.championship;
  const finalFourHTML = `
    <div class="br-section-header">Final Four · Houston</div>
    <div class="br-ff-grid">
      <div class="br-ff-game">
        <div class="br-ff-label">East vs West</div>
        ${gameRow(ff.game1.teamA, ff.game1.teamB, ff.game1.winner, ff.game1.prob)}
      </div>
      <div class="br-ff-game">
        <div class="br-ff-label">South vs Midwest</div>
        ${gameRow(ff.game2.teamA, ff.game2.teamB, ff.game2.winner, ff.game2.prob)}
      </div>
    </div>
    <div class="br-section-header">National Championship</div>
    <div class="br-championship">
      ${gameRow(championship.teamA, championship.teamB, championship.winner, championship.prob)}
    </div>`;

  const champHTML = `
    <div class="br-champion-block">
      <div class="br-champion-label">🏆 ${(META?.season ? '20' + META.season.split('-')[1] : new Date().getFullYear())} NCAA Champion</div>
      <div class="br-champion-name" style="color:${champColor}">${champion.full_name}</div>
      <div class="br-champion-meta">
        ${champion.region} · Seed #${champion.seed} ·
        Model: <strong>${meta.label}</strong>
      </div>
    </div>`;

  return `
    <div class="br-results">
      ${champHTML}
      ${playInHTML}
      <div class="br-section-header">Regional Brackets</div>
      <div class="br-regions-grid">${regionsHTML}</div>
      ${finalFourHTML}
    </div>`;
}

function gameRow(teamA, teamB, winner, prob) {
  const pct = (prob * 100).toFixed(0);
  const aWins = winner.id === teamA.id;

  const teamHTML = (team, isWinner) => {
    const seed  = team.seed != null ? `<span class="br-seed">${team.seed}</span>` : '';
    const isTBD = team.id?.startsWith('tbd-');
    return `<div class="br-team ${isWinner ? 'br-winner' : 'br-loser'} ${isTBD ? 'br-tbd' : ''}">
      ${seed}<span class="br-name">${team.label}</span>
      ${isWinner ? `<span class="br-prob">${pct}%</span>` : ''}
    </div>`;
  };

  return `<div class="br-game" data-prob="${prob}">
    ${teamHTML(teamA, aWins)}
    ${teamHTML(teamB, !aWins)}
  </div>`;
}

function bindGameTooltips() {
  document.querySelectorAll('.br-game').forEach(el => {
    const prob = parseFloat(el.dataset.prob);
    if (!prob) return;
    const pct = (prob * 100).toFixed(1);
    const loser = el.querySelector('.br-loser .br-name')?.textContent;
    const winner = el.querySelector('.br-winner .br-name')?.textContent;
    el.title = `${winner} wins · ${pct}% probability · ${loser} eliminated`;
  });
}

// Expose to window so onclick attributes work in cloned elements (strict mode safe)
window.generateBracket   = generateBracket;
window.selectBracketModel = selectBracketModel;
