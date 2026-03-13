/**
 * transitive.js — Transitive matchup path analysis
 *
 * For two teams that never played each other, traces indirect evidence:
 *   - Common opponents where one team won and the other lost
 *   - 2-hop chains: A beat C who beat B
 *   - Common opponents both beat or both lost to (margin comparison)
 *   - Aggregate confidence score and verdict
 *
 * Data is precomputed at build time (compute_transitive.py) and loaded from
 * public/data/transitive_analysis.json — no live computation in the browser.
 */

'use strict';

let TRANS_DATA   = null;
// Transitive path analysis renderer

// ── Data loader ───────────────────────────────────────────────────────────────
async function loadTransitiveData() {
  if (TRANS_DATA) return TRANS_DATA;
  try {
    const res  = await fetch('data/transitive_analysis.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    TRANS_DATA = await res.json();
    return TRANS_DATA;
  } catch (err) {
    console.warn('Transitive data load failed:', err);
    return null;
  }
}

// ── Paths picker: searchable inputs ──────────────────────────────────────────
let pathsSelA = null; // {id, full_name, region, seed}
let pathsSelB = null;

function initPathsPicker() {
  setupPathsInput('a');
  setupPathsInput('b');

  // Auto-run if both teams already selected (e.g. from clicking a dashed edge)
  if (pathsSelA && pathsSelB) runTransitiveAnalysisForIds(pathsSelA.id, pathsSelB.id);
}

function setupPathsInput(side) {
  const inp  = document.getElementById(`paths-input-${side}`);
  const drop = document.getElementById(`paths-drop-${side}`);
  const sel  = document.getElementById(`paths-sel-${side}`);
  if (!inp || inp.dataset.bound === '1') return; // already wired
  inp.dataset.bound = '1';

  inp.addEventListener('input', () => {
    const q = inp.value.trim().toLowerCase();
    drop.innerHTML = '';
    if (q.length < 1) { drop.style.display = 'none'; return; }

    const matches = [...ALL_NODES]
      .filter(n => n.full_name.toLowerCase().includes(q) || n.label.toLowerCase().includes(q))
      .slice(0, 7);

    if (!matches.length) { drop.style.display = 'none'; return; }

    matches.forEach(n => {
      const item = document.createElement('div');
      item.className = 'search-item';
      const rc = REGION_COLORS[n.region] || '#b0a898';
      item.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${rc};margin-right:7px;flex-shrink:0"></span>${n.full_name} <span style="color:var(--text-mute);font-size:.78rem">#${n.seed} ${n.region}</span>`;
      item.addEventListener('mousedown', e => {
        e.preventDefault();
        selectPathsTeam(side, n);
        inp.value = '';
        drop.style.display = 'none';
      });
      drop.appendChild(item);
    });
    const rect = inp.getBoundingClientRect();
    drop.style.top  = (rect.bottom + 3) + 'px';
    drop.style.left = rect.left + 'px';
    drop.style.display = 'block';
  });

  inp.addEventListener('keydown', e => {
    if (e.key === 'Escape') { drop.style.display = 'none'; }
  });

  document.addEventListener('click', e => {
    if (!e.target.closest(`#paths-input-${side}`) && !e.target.closest(`#paths-drop-${side}`)) {
      drop.style.display = 'none';
    }
  });
}

function selectPathsTeam(side, node) {
  if (side === 'a') pathsSelA = node;
  else              pathsSelB = node;

  const sel = document.getElementById(`paths-sel-${side}`);
  const rc  = REGION_COLORS[node.region] || '#b0a898';
  sel.innerHTML = `
    <span class="paths-sel-dot" style="background:${rc}"></span>
    <span class="paths-sel-name">${node.full_name}</span>
    <span class="paths-sel-meta">#${node.seed} ${node.region}</span>
    <button class="paths-sel-clear" onclick="clearPathsSel('${side}')">✕</button>
  `;
  sel.classList.add('visible');

  const inp = document.getElementById(`paths-input-${side}`);
  if (inp) inp.placeholder = '';
}

function clearPathsSel(side) {
  if (side === 'a') pathsSelA = null;
  else              pathsSelB = null;
  const sel = document.getElementById(`paths-sel-${side}`);
  sel.innerHTML = '';
  sel.classList.remove('visible');
  const inp = document.getElementById(`paths-input-${side}`);
  if (inp) inp.placeholder = side === 'a' ? 'Team A — type to search...' : 'Team B — type to search...';
}

function runPathsFromInputs() {
  if (!pathsSelA || !pathsSelB) {
    document.getElementById('trans-output').innerHTML =
      '<div class="trans-intro"><div class="trans-intro-body">Select two different teams to compare.</div></div>';
    return;
  }
  if (pathsSelA.id === pathsSelB.id) {
    document.getElementById('trans-output').innerHTML =
      '<div class="trans-intro"><div class="trans-intro-body">Pick two different teams.</div></div>';
    return;
  }
  runTransitiveAnalysisForIds(pathsSelA.id, pathsSelB.id);
}

// ── Entry point: called when Paths tab opens ──────────────────────────────────
function openTransitiveTab(aId, bId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.stab').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-transitive').classList.add('active');
  document.getElementById('trans-tab-btn').classList.add('active');

  initPathsPicker();

  if (aId && bId) {
    const na = ALL_NODES.find(n => n.id === aId);
    const nb = ALL_NODES.find(n => n.id === bId);
    if (na) selectPathsTeam('a', na);
    if (nb) selectPathsTeam('b', nb);
    runTransitiveAnalysisForIds(aId, bId);
  }
}


// ── Main analysis render ─────────────────────────────────────────────────────
async function runTransitiveAnalysis() {
  // Legacy: called from old selects — now delegates to ID-based version
  const aId = pathsSelA?.id;
  const bId = pathsSelB?.id;
  if (aId && bId) runTransitiveAnalysisForIds(aId, bId);
}

async function runTransitiveAnalysisForIds(aId, bId) {
  const out  = document.getElementById('trans-output');

  if (!aId || !bId || aId === bId) {
    out.innerHTML = '<div class="trans-intro"><div class="trans-intro-body">Select two different teams to compare.</div></div>';
    return;
  }

  const nodeA = ALL_NODES.find(n => n.id === aId);
  const nodeB = ALL_NODES.find(n => n.id === bId);

  if (!nodeA || !nodeB) {
    out.innerHTML = '<div class="trans-error">Team data not loaded yet. Please wait a moment and try again.</div>';
    return;
  }

  // Check if they actually played each other
  const playedEdge = ALL_EDGES.find(e =>
    (e.from === aId && e.to === bId) || (e.from === bId && e.to === aId)
  );

  if (playedEdge) {
    const winId  = playedEdge.from;
    const loseId = playedEdge.to;
    const winner = ALL_NODES.find(n => n.id === winId)?.full_name ?? winId;
    const loser  = ALL_NODES.find(n => n.id === loseId)?.full_name ?? loseId;
    out.innerHTML = `
      <div class="trans-played-card">
        <div class="trans-played-label">THEY PLAYED</div>
        <div class="trans-played-result">
          <span class="trans-winner">${winner}</span>
          <span class="trans-score">${playedEdge.label}</span>
          <span class="trans-loser">${loser}</span>
        </div>
        <div class="trans-played-meta">${playedEdge.date} · ${playedEdge.margin} pt margin</div>
        <div class="trans-played-hint">Transitive paths are most useful for teams that have never met. Select a not-played pair to explore indirect evidence.</div>
      </div>`;
    return;
  }

  out.innerHTML = loadingHTML('Loading path data...');

  const data = await loadTransitiveData();
  if (!data) {
    out.innerHTML = '<div class="trans-error">Could not load transitive analysis data.</div>';
    return;
  }

  // Try both key orderings
  const key  = `${aId}_${bId}`;
  const keyR = `${bId}_${aId}`;
  let pair   = data.pairs[key];
  let flipped = false;

  if (!pair) {
    pair    = data.pairs[keyR];
    flipped = true;
  }

  if (!pair) {
    out.innerHTML = `<div class="trans-error">No analysis available for this pair.</div>`;
    return;
  }

  // If we're reading the flipped key, swap A/B interpretation
  const teamA = nodeA;
  const teamB = nodeB;
  const sigA  = flipped ? pair.b  : pair.a;
  const sigB  = flipped ? pair.a  : pair.b;
  const net   = flipped ? -pair.net : pair.net;
  const verdict = pair.verdict === 'unclear' ? 'unclear' : (flipped ? (pair.verdict === 'a' ? 'b' : 'a') : pair.verdict);

  renderTransitiveResult(teamA, teamB, sigA, sigB, pair.both_beat, pair.both_lost, net, pair.conf, verdict, pair.n, out);
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderTransitiveResult(teamA, teamB, sigA, sigB, bothBeat, bothLost, net, conf, verdict, nSignals, out) {
  const rcA = REGION_COLORS[teamA.region] ?? '#94a3b8';
  const rcB = REGION_COLORS[teamB.region] ?? '#94a3b8';

  const verdictHTML = buildVerdictBar(teamA, teamB, net, conf, verdict, nSignals);

  const sigAHTML = sigA.length > 0
    ? sigA.map(s => signalRow(s, teamA, teamB, 'a')).join('')
    : `<div class="trans-none">No signals found favoring ${teamA.label}</div>`;

  const sigBHTML = sigB.length > 0
    ? sigB.map(s => signalRow(s, teamA, teamB, 'b')).join('')
    : `<div class="trans-none">No signals found favoring ${teamB.label}</div>`;

  // All common opponents combined for the margin chart
  const allCommon = [
    ...sigA.map(s => ({...s, type: 'a'})),
    ...sigB.map(s => ({...s, type: 'b'})),
    ...bothBeat.map(s => ({...s, type: 'both_beat'})),
    ...bothLost.map(s => ({...s, type: 'both_lost'})),
  ];

  const chartHTML = allCommon.length >= 2
    ? `<div class="trans-section-label">MARGIN COMPARISON — COMMON OPPONENTS</div>
       <div class="margin-chart-wrap">
         <canvas class="margin-chart-canvas" id="margin-chart-canvas" width="230" height="${Math.max(80, allCommon.length * 28 + 32)}"></canvas>
         <div class="margin-chart-legend">
           <div class="mcl-item"><span class="mcl-dot" style="background:${rcA}"></span>${teamA.label}</div>
           <div class="mcl-item"><span class="mcl-dot" style="background:${rcB}"></span>${teamB.label}</div>
         </div>
       </div>` : '';

  const noDataHTML = nSignals === 0
    ? `<div class="trans-no-data">
        <div class="trans-no-data-icon">∅</div>
        <div>No common opponents found in the 2025-26 regular season between bracket teams.
        These two teams played in completely separate scheduling universes this year — there is no indirect evidence to compare.</div>
       </div>` : '';

  out.innerHTML = `
    <div class="trans-matchup-header">
      <div class="trans-team-chip" style="border-color:${rcA}">
        <div class="trans-chip-name">${teamA.full_name}</div>
        <div class="trans-chip-meta">${teamA.region} · #${teamA.seed} · ${teamA.wins_vs_field}W-${teamA.losses_vs_field}L</div>
      </div>
      <div class="trans-vs-chip">vs</div>
      <div class="trans-team-chip" style="border-color:${rcB}">
        <div class="trans-chip-name">${teamB.full_name}</div>
        <div class="trans-chip-meta">${teamB.region} · #${teamB.seed} · ${teamB.wins_vs_field}W-${teamB.losses_vs_field}L</div>
      </div>
    </div>

    ${verdictHTML}
    ${noDataHTML}
    ${chartHTML}

    ${sigA.length > 0 ? `
    <div class="trans-section-label">SIGNALS FAVORING ${teamA.label.toUpperCase()}</div>
    ${sigAHTML}` : ''}

    ${sigB.length > 0 ? `
    <div class="trans-section-label">SIGNALS FAVORING ${teamB.label.toUpperCase()}</div>
    ${sigBHTML}` : ''}

    ${bothBeat.length > 0 ? `
    <div class="trans-section-label">BOTH BEAT</div>
    ${bothBeat.map(s => commonRow(s, teamA, teamB)).join('')}` : ''}

    ${bothLost.length > 0 ? `
    <div class="trans-section-label">BOTH LOST TO</div>
    ${bothLost.map(s => commonRow(s, teamA, teamB)).join('')}` : ''}

    <div class="trans-footnote">
      ${nSignals} signal${nSignals !== 1 ? 's' : ''} found · precomputed from 2025-26 regular season results
    </div>
  `;

  // Render margin chart after DOM is ready
  if (allCommon.length >= 2) {
    requestAnimationFrame(() => drawMarginChart(allCommon, teamA, teamB, rcA, rcB));
  }
}

function buildVerdictBar(teamA, teamB, net, conf, verdict, nSignals) {
  if (nSignals === 0) return '';

  const favored    = verdict === 'a' ? teamA : verdict === 'b' ? teamB : null;
  const rcFavored  = favored ? (REGION_COLORS[favored.region] ?? '#f97316') : '#5a7a96';
  const verdictLabel = favored
    ? `Indirect evidence favors <strong>${favored.full_name}</strong>`
    : 'Signals are split — unclear advantage';

  // Bar split: left = A signals, right = B signals
  const totalAbs = Math.abs(net) || 1;
  const aShare   = net > 0 ? Math.min(85, 50 + (net / (totalAbs + 20)) * 40) : Math.max(15, 50 + (net / (totalAbs + 20)) * 40);

  return `
    <div class="trans-verdict" style="border-color:${rcFavored}20;background:${rcFavored}08">
      <div class="trans-verdict-label">${verdictLabel}</div>
      <div class="trans-conf-bar">
        <div class="trans-conf-a" style="width:${aShare.toFixed(0)}%;background:${REGION_COLORS[teamA.region] ?? '#3b82f6'}">
          <span>${teamA.label}</span>
        </div>
        <div class="trans-conf-b" style="width:${(100 - aShare).toFixed(0)}%;background:${REGION_COLORS[teamB.region] ?? '#ef4444'}">
          <span>${teamB.label}</span>
        </div>
      </div>
      <div class="trans-verdict-meta">Confidence: ${conf}/100 · Net edge: ${net > 0 ? '+' : ''}${net} pts · ${nSignals} signal${nSignals !== 1 ? 's' : ''}</div>
    </div>`;
}

function signalRow(s, teamA, teamB, side) {
  const isChain   = s.chain_a || s.chain_b;
  const chainIcon = isChain ? '<span class="chain-badge">CHAIN</span>' : '';
  const desc      = isChain
    ? (side === 'a' ? s.chain_desc_a : s.chain_desc_b)
    : null;

  const aScoreClass = s.a_beat ? 'sig-win' : 'sig-loss';
  const bScoreClass = s.b_beat ? 'sig-win' : 'sig-loss';

  const edgeVal = side === 'a' ? s.edge : -s.edge;

  return `
    <div class="trans-signal ${side === 'a' ? 'sig-favors-a' : 'sig-favors-b'}">
      <div class="sig-top">
        <span class="sig-common">${s.common_name}</span>
        ${chainIcon}
        <span class="sig-edge ${edgeVal >= 0 ? 'edge-pos' : 'edge-neg'}">${edgeVal >= 0 ? '+' : ''}${edgeVal} pts</span>
      </div>
      ${desc ? `<div class="sig-chain-desc">${side === 'a' ? teamA.label : teamB.label} ${desc}</div>` : `
      <div class="sig-scores">
        <span class="${aScoreClass}">${teamA.label}: ${s.a_beat ? 'W' : 'L'} ${s.a_score}</span>
        <span class="${bScoreClass}">${teamB.label}: ${s.b_beat ? 'W' : 'L'} ${s.b_score}</span>
      </div>`}
    </div>`;
}

function commonRow(s, teamA, teamB) {
  const edge  = s.edge;
  const edgeLabel = Math.abs(edge) < 3 ? 'Even' : (edge > 0 ? `${teamA.label} +${edge}` : `${teamB.label} +${-edge}`);
  return `
    <div class="trans-common-row">
      <span class="tc-name">${s.common_name}</span>
      <span class="${s.a_beat ? 'sig-win' : 'sig-loss'}">${s.a_beat ? 'W' : 'L'} ${s.a_score}</span>
      <span class="${s.b_beat ? 'sig-win' : 'sig-loss'}">${s.b_beat ? 'W' : 'L'} ${s.b_score}</span>
      <span class="tc-edge ${Math.abs(edge) < 3 ? '' : (edge > 0 ? 'edge-pos' : 'edge-neg')}">${edgeLabel}</span>
    </div>`;
}

function loadingHTML(label) {
  return `<div class="ai-loading">
    <div class="dot-flash"><span></span><span></span><span></span></div>
    ${label}
  </div>`;
}

// Expose for app.js to call when clicking not-played edges
// ── Margin Chart ──────────────────────────────────────────────────────────────
// Paired horizontal bar chart: one row per common opponent
// Left bars = team A margin, right bars = team B margin
// Win margins are positive (extend right from 0), losses negative (extend left)
function drawMarginChart(allCommon, teamA, teamB, rcA, rcB) {
  const canvas = document.getElementById('margin-chart-canvas');
  if (!canvas) return;

  const ctx  = canvas.getContext('2d');
  const W    = canvas.width;
  const H    = canvas.height;
  const ROW  = 28;
  const PAD  = { top: 24, bottom: 8, left: 70, right: 8 };
  const midX = PAD.left + (W - PAD.left - PAD.right) / 2;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#080d14';
  ctx.fillRect(0, 0, W, H);

  // Max margin for scale (symmetric around 0)
  const allM   = allCommon.flatMap(s => [s.a_margin, s.b_margin]);
  const maxM   = Math.max(20, Math.ceil(Math.max(...allM.map(Math.abs)) / 5) * 5);
  const halfW  = (W - PAD.left - PAD.right) / 2;
  const toBarW = m => (Math.abs(m) / maxM) * halfW;

  // Column headers
  ctx.font      = 'bold 8px Barlow Condensed, sans-serif';
  ctx.fillStyle = '#2d4559';
  ctx.textAlign = 'right';
  ctx.fillText(teamA.label, midX - 4, 14);
  ctx.textAlign = 'left';
  ctx.fillText(teamB.label, midX + 4, 14);

  // Center line
  ctx.strokeStyle = '#1e2d3d';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(midX, PAD.top - 4);
  ctx.lineTo(midX, PAD.top + allCommon.length * ROW);
  ctx.stroke();

  // Tick lines at ±10, ±20
  [10, 20].forEach(v => {
    const xP = midX + toBarW(v);
    const xN = midX - toBarW(v);
    [xP, xN].forEach(x => {
      ctx.strokeStyle = '#131f2c';
      ctx.beginPath();
      ctx.moveTo(x, PAD.top - 4);
      ctx.lineTo(x, PAD.top + allCommon.length * ROW);
      ctx.stroke();
      ctx.fillStyle = '#1e2d3d';
      ctx.font = '7px Barlow, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(v, x, PAD.top - 6);
    });
  });

  // Rows
  allCommon.forEach((s, i) => {
    const y    = PAD.top + i * ROW;
    const rowH = ROW - 5;

    // Opponent label (truncated)
    const label = s.common_name.length > 11
      ? s.common_name.slice(0, 10) + '…'
      : s.common_name;
    ctx.font      = '8px Barlow Condensed, sans-serif';
    ctx.fillStyle = s.type === 'both_beat' ? '#4a7a5a' :
                    s.type === 'both_lost' ? '#7a4a4a' :
                    '#2d4559';
    ctx.textAlign = 'right';
    ctx.fillText(label, PAD.left - 3, y + rowH / 2 + 3);

    // Team A bar (extends LEFT from midX)
    const aW = toBarW(s.a_margin);
    const aWon = s.a_margin > 0;
    ctx.fillStyle = aWon
      ? hexWithAlpha(rcA, 0.75)
      : 'rgba(248,113,113,0.45)';
    ctx.fillRect(midX - aW, y + 2, aW, rowH);

    // Team B bar (extends RIGHT from midX)
    const bW = toBarW(s.b_margin);
    const bWon = s.b_margin > 0;
    ctx.fillStyle = bWon
      ? hexWithAlpha(rcB, 0.75)
      : 'rgba(248,113,113,0.45)';
    ctx.fillRect(midX, y + 2, bW, rowH);

    // Margin labels on bars (only if bar wide enough)
    ctx.font      = 'bold 8px Barlow Condensed, sans-serif';
    ctx.textAlign = 'center';
    if (aW > 14) {
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.fillText((s.a_margin > 0 ? '+' : '') + s.a_margin, midX - aW / 2, y + rowH / 2 + 3);
    }
    if (bW > 14) {
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.fillText((s.b_margin > 0 ? '+' : '') + s.b_margin, midX + bW / 2, y + rowH / 2 + 3);
    }

    // Type badge for signal rows
    if (s.type === 'a' || s.type === 'b') {
      const badge  = s.type === 'a' ? '▲A' : '▲B';
      const bcolor = s.type === 'a' ? rcA : rcB;
      ctx.font      = 'bold 7px Barlow Condensed, sans-serif';
      ctx.fillStyle = hexWithAlpha(bcolor, 0.6);
      ctx.textAlign = 'left';
      ctx.fillText(badge, W - PAD.right - 14, y + rowH / 2 + 3);
    }
  });
}

function hexWithAlpha(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0,2), 16);
  const g = parseInt(h.slice(2,4), 16);
  const b = parseInt(h.slice(4,6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

window.openTransitiveTab = openTransitiveTab;
window.populateTransSelects = function() { initPathsPicker(); };
window.runTransitiveAnalysis = runTransitiveAnalysis;
