/**
 * app.js — NCAA 2025-26 Head-to-Head Graph
 * Loads data/graph_data.json, renders vis.js network, handles all UI state.
 */

'use strict';

// ── State ────────────────────────────────────────────────────────────────────
let ALL_NODES   = [];
let ALL_EDGES   = [];
let NOT_PLAYED  = [];
let BRACKET_MAP = {};
let META        = {};
let NP_EDGES    = [];
let nodesDS, edgesDS, network;
let currentView  = 'played';
let physicsOn    = true;

const REGION_COLORS = {
  East:    '#4a7fb5',
  West:    '#3a8c6e',
  South:   '#b89030',
  Midwest: '#b84545',
  bubble:  '#7c3aed',
};

// Organic node background fill colors — soft, like Pickle dots
const REGION_NODE_BG = {
  East:    '#c8daf0',
  West:    '#b8ddd0',
  South:   '#ecddb0',
  Midwest: '#f0c8c8',
  bubble:  '#ddd6fe',
};

// ── Shared Torvik cache ────────────────────────────────────────────────────────────────────────────
// One fetch for the whole app. scatter.js, style-bars.js, and ai-panel.js
// previously each fetched torvik_stats.json independently on first use.
// Now they all call: const tvData = await window.getTorvik()
window._torvikPromise = null;
window.getTorvik = function () {
  if (!window._torvikPromise) {
    window._torvikPromise = fetch('data/torvik_stats.json')
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .catch(err => {
        console.warn('torvik_stats.json failed to load:', err);
        window._torvikPromise = null; // allow retry on next call
        return null;
      });
  }
  return window._torvikPromise;
};

// ── Boot ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const res  = await fetch('data/graph_data.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    ALL_NODES        = data.nodes.map(n => ({
      ...n,
      image: `https://a.espncdn.com/i/teamlogos/ncaa/500/${n.id}.png`,
      font:  { color: '#2a2520', size: 10, strokeWidth: 2, strokeColor: '#f5f2ed' },
    }));
    window.ALL_NODES = ALL_NODES; // expose for ai-panel.js detectMatchupIntent
    ALL_EDGES   = data.edges;
    NOT_PLAYED  = data.not_played;
    BRACKET_MAP = data.bracket_map;
    META        = data.meta || {};

    initGraph();
    try { populateStats(); } catch(e) { console.error('populateStats failed:', e); }
    try { populateRankings(); } catch(e) { console.error('populateRankings failed:', e); }
    bindUI();
    hideLoading();
    try { validateBracketIntegrity(); } catch(e) { console.error('validateBracketIntegrity failed:', e); }
  } catch (err) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.innerHTML =
      `<div style="color:#f87171;font-size:.85rem;text-align:center;padding:20px">
        Failed to load data.<br><span style="font-size:.72rem;color:#5a7a96">${err.message}</span>
       </div>`;
  }
});

// ── Graph init ────────────────────────────────────────────────────────────────
function initGraph() {
  // Build not-played edge objects once
  NP_EDGES = NOT_PLAYED.map((np, i) => ({
    id:           `np_${i}`,
    from:         np.a,
    to:           np.b,
    color:        { color: '#ccc6b9', opacity: 0.6 },
    dashes:       true,
    width:        2,  // wider for easier click detection
    arrows:       '',
    label:        '',
    title:        undefined, // no hover tooltip — sidebar shows detail on click
    is_not_played: true,
  }));

  // Start with empty graph — user builds it up dynamically
  nodesDS = new vis.DataSet([]);
  edgesDS = new vis.DataSet([]);
  showEmptyState(true);

  const options = {
    nodes: {
      shape:       'circularImage',
      borderWidth: 2,
      shadow:      { enabled: true, color: 'rgba(42,37,32,.15)', size: 6, x: 0, y: 2 },
      font:        { color: '#2a2520', size: 10, strokeWidth: 2, strokeColor: '#f5f2ed' },
      brokenImage: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="20" fill="%23c2551a"/><text x="50%25" y="54%25" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="10" font-family="sans-serif">?</text></svg>',
      chosen: {
        node: (values) => { values.size *= 1.35; values.borderWidth = 3; },
      },
    },
    edges: {
      font:   { color: '#b0a898', size: 8, align: 'middle', strokeWidth: 0 },
      smooth: { type: 'continuous', roundness: 0.12 },
      chosen: {
        edge: (values) => { values.width *= 2; values.color = '#c2551a'; },
      },
    },
    physics: {
      stabilization: { iterations: 250 },
      forceAtlas2Based: {
        gravitationalConstant: -60,
        centralGravity:        0.003,
        springLength:          130,
        springConstant:        0.07,
        damping:               0.6,
      },
      solver: 'forceAtlas2Based',
    },
    interaction: { hover: true, tooltipDelay: 150 },
  };

  network = new vis.Network(
    document.getElementById('network'),
    { nodes: nodesDS, edges: edgesDS },
    options,
  );

  network.on('click', onNetworkClick);
}

// ── Filters ───────────────────────────────────────────────────────────────────
function applyFilters() {
  const rv = document.getElementById('region-filter').value;

  // Selecting a specific region always drives the view directly —
  // exit custom mode so the dropdown is the source of truth
  if (rv !== 'all' && rv !== 'same' && rv !== 'cross') {
    if (customActive) {
      customActive = false;
      const pillsBar = document.getElementById('custom-pills-bar');
      const clearBtn = document.getElementById('custom-clear-btn');
      if (pillsBar) pillsBar.style.display = 'none';
      if (clearBtn) clearBtn.style.display = 'none';
    }
    showEmptyState(false);
  } else {
    // All / Same / Cross — respect existing custom mode
    if (customActive) { applyCustomView(); return; }
    // Nothing selected and graph empty — stay empty
    if (CUSTOM_SELECTION.size === 0 && nodesDS.length === 0) return;
  }

  // Nodes in scope
  let scopedIds;
  if (rv === 'all' || rv === 'same' || rv === 'cross') {
    scopedIds = new Set(ALL_NODES.map(n => n.id));
  } else {
    scopedIds = new Set(ALL_NODES.filter(n => n.region === rv).map(n => n.id));
  }

  let edges = [];

  // ── Played edges ──
  if (currentView === 'played' || currentView === 'both') {
    let e = ALL_EDGES;
    if (rv === 'same') {
      e = e.filter(x => x.same_region);
    } else if (rv === 'cross') {
      e = e.filter(x => !x.same_region);
    } else if (rv !== 'all') {
      e = e.filter(x => scopedIds.has(x.from) && scopedIds.has(x.to));
    }
    edges = edges.concat(e);
  }

  // ── Not-played edges ──
  if (currentView === 'notplayed' || currentView === 'both') {
    let np = NP_EDGES;
    if (rv === 'same') {
      const regionOf = {};
      ALL_NODES.forEach(n => { regionOf[n.id] = n.region; });
      np = np.filter(x => regionOf[x.from] && regionOf[x.from] === regionOf[x.to]);
    } else if (rv === 'cross') {
      const regionOf = {};
      ALL_NODES.forEach(n => { regionOf[n.id] = n.region; });
      np = np.filter(x => regionOf[x.from] && regionOf[x.from] !== regionOf[x.to]);
    } else if (rv !== 'all') {
      np = np.filter(x => scopedIds.has(x.from) && scopedIds.has(x.to));
    }
    edges = edges.concat(np);
  }

  // ── Visible nodes ──
  // Always show all nodes in scope — isolated teams (no inter-bracket games)
  // should still appear in the graph even if they have no edges.
  const activeIds = new Set([...edges.map(e => e.from), ...edges.map(e => e.to)]);
  const nodes = ALL_NODES.filter(n => scopedIds.has(n.id));

  nodesDS.clear();
  nodesDS.add(nodes);
  edgesDS.clear();
  edgesDS.add(edges);

  const teamCount = nodesDS.length;
  const playedCnt = edgesDS.get({ filter: e => !e.is_not_played }).length;
  const npCnt     = edgesDS.get({ filter: e =>  e.is_not_played }).length;
  updateStats(teamCount, playedCnt, npCnt);
}

function setView(view) {
  currentView = view;
  document.querySelectorAll('.view-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.view === view);
  });
  applyFilters();
}

// ── Layout ────────────────────────────────────────────────────────────────────
function changeLayout() {
  const layout = document.getElementById('layout-sel').value;

  if (layout === 'region') {
    const offsets = {
      East:    { cx: -340, cy: -190 },
      West:    { cx:  340, cy: -190 },
      South:   { cx: -340, cy:  190 },
      Midwest: { cx:  340, cy:  190 },
    };
    const rCount = {};
    const rIdx   = {};
    ALL_NODES.forEach(n => { rCount[n.region] = (rCount[n.region] || 0) + 1; });

    network.setOptions({ physics: { enabled: false } });
    // Only move nodes currently in the dataset — vis.js throws if you moveNode on a hidden node
    const visibleIds = new Set(nodesDS.getIds());
    ALL_NODES.forEach(n => {
      if (!visibleIds.has(n.id)) return;
      rIdx[n.region] = (rIdx[n.region] || 0) + 1;
      const idx  = rIdx[n.region];
      const tot  = rCount[n.region];
      const cols = Math.ceil(Math.sqrt(tot));
      const row  = Math.floor((idx - 1) / cols);
      const col  = (idx - 1) % cols;
      const off  = offsets[n.region] || { cx: 0, cy: 0 };
      network.moveNode(n.id, off.cx + (col - cols / 2) * 90, off.cy + (row - Math.ceil(tot / cols) / 2) * 78);
    });

    physicsOn = false;
    document.getElementById('phys-btn').textContent = '▶';
  } else {
    network.setOptions({ physics: { enabled: true } });
    physicsOn = true;
    document.getElementById('phys-btn').textContent = '⏸';
  }
}

function togglePhysics() {
  physicsOn = !physicsOn;
  network.setOptions({ physics: { enabled: physicsOn } });
  document.getElementById('phys-btn').textContent = physicsOn ? '⏸' : '▶';
}

// ── Detail on click ───────────────────────────────────────────────────────────
function onNetworkClick(params) {
  switchTab('detail');

  // On mobile, clicking a node/edge should open the sidebar overlay
  if (window.innerWidth <= 768 && (params.nodes.length > 0 || params.edges.length > 0)) {
    const sidebar    = document.querySelector('.sidebar');
    const sidebarBtn = document.getElementById('mob-sidebar-btn');
    if (sidebar) sidebar.classList.add('mob-open');
    if (sidebarBtn) sidebarBtn.style.display = 'none';
  }

  const box = document.getElementById('detail-box');

  if (params.nodes.length > 0) {
    renderTeamDetail(params.nodes[0], box);
  } else if (params.edges.length > 0) {
    const edge = edgesDS.get(params.edges[0]);
    if (edge) renderEdgeDetail(edge, box);
  } else {
    box.innerHTML = '<div class="detail-empty">Click a team or game edge to see details</div>';
  }
}

function renderTeamDetail(nodeId, box) {
  const node   = ALL_NODES.find(n => n.id === nodeId);
  if (!node) return;

  const wins   = ALL_EDGES.filter(e => e.from === nodeId);
  const losses = ALL_EDGES.filter(e => e.to   === nodeId);
  const npCnt  = NOT_PLAYED.filter(np => np.a === nodeId || np.b === nodeId).length;
  const getName = id => ALL_NODES.find(n => n.id === id)?.label ?? id;
  const rc = REGION_COLORS[node.region] ?? '#b0a898';
  const bg = REGION_NODE_BG[node.region] ?? '#f0ece4';

  const wRows = wins.map(e => `
    <div class="d-result-row">
      <div class="d-result-dot win-dot"></div>
      <span class="d-result-opp">${getName(e.to)}</span>
      <span class="d-result-score">${e.label}</span>
      <span class="d-result-date">${e.date.slice(5)}</span>
    </div>`).join('');

  const lRows = losses.map(e => `
    <div class="d-result-row">
      <div class="d-result-dot loss-dot"></div>
      <span class="d-result-opp">${getName(e.from)}</span>
      <span class="d-result-score">${e.label}</span>
      <span class="d-result-date">${e.date.slice(5)}</span>
    </div>`).join('');

  box.innerHTML = `
    <div class="d-team-card">
      <div class="d-team-badge" style="background:${bg};border-color:${rc}">
        <div class="d-team-badge-seed" style="color:${rc}">${node.seed != null ? '#' + node.seed : 'bubble'}</div>
        <div class="d-team-badge-name">${node.label}</div>
        <div class="d-team-badge-region" style="color:${rc}">${node.region}</div>
      </div>
      <div class="d-record-row">
        <div class="d-record-cell">
          <div class="d-record-val" style="color:var(--west)">${node.wins_vs_field}</div>
          <div class="d-record-lbl">wins</div>
        </div>
        <div class="d-record-sep"></div>
        <div class="d-record-cell">
          <div class="d-record-val" style="color:var(--midwest)">${node.losses_vs_field}</div>
          <div class="d-record-lbl">losses</div>
        </div>
        <div class="d-record-sep"></div>
        <div class="d-record-cell">
          <div class="d-record-val">${npCnt}</div>
          <div class="d-record-lbl">never met</div>
        </div>
      </div>
    </div>

    <div class="spark-container" id="spark-container-${nodeId}" style="margin:10px 0 4px"></div>

    ${wins.length > 0 ? `
      <div class="d-section-head">
        <span class="d-section-dot" style="background:var(--west)"></span>
        Wins <span class="d-section-cnt">${wins.length}</span>
      </div>
      <div class="d-result-list">${wRows}</div>` : ''}

    ${losses.length > 0 ? `
      <div class="d-section-head" style="margin-top:10px">
        <span class="d-section-dot" style="background:var(--midwest)"></span>
        Losses <span class="d-section-cnt">${losses.length}</span>
      </div>
      <div class="d-result-list">${lRows}</div>` : ''}
  `;

  // Remove from graph button — always visible in detail panel
  const removeBtn = document.createElement('button');
  removeBtn.className = 'remove-from-graph-btn';
  removeBtn.innerHTML = '✕ Remove from graph';
  removeBtn.addEventListener('click', () => removeNodeFromGraph(nodeId));
  box.appendChild(removeBtn);

  if (typeof renderSparkline === 'function') {
    renderSparkline(nodeId, document.getElementById(`spark-container-${nodeId}`));
  }
}

function renderEdgeDetail(edge, box) {
  if (edge.is_not_played) {
    const a  = ALL_NODES.find(n => n.id === edge.from);
    const b  = ALL_NODES.find(n => n.id === edge.to);
    const rcA = REGION_COLORS[a?.region] ?? '#b0a898';
    const rcB = REGION_COLORS[b?.region] ?? '#b0a898';
    box.innerHTML = `
      <div class="d-matchup-card unplayed">
        <div class="d-matchup-label">Haven't played</div>
        <div class="d-matchup-teams">
          <div class="d-matchup-team">
            <div class="d-matchup-dot" style="background:${rcA}"></div>
            <div class="d-matchup-name">${a?.label ?? edge.from}</div>
            <div class="d-matchup-sub" style="color:${rcA}">${a?.region ?? ''}${a?.seed != null ? ' #' + a.seed : ''}</div>
          </div>
          <div class="d-vs-col"><span class="d-vs-text">vs</span></div>
          <div class="d-matchup-team">
            <div class="d-matchup-dot" style="background:${rcB}"></div>
            <div class="d-matchup-name">${b?.label ?? edge.to}</div>
            <div class="d-matchup-sub" style="color:${rcB}">${b?.region ?? ''}${b?.seed != null ? ' #' + b.seed : ''}</div>
          </div>
        </div>
        <div class="d-matchup-hint">Opening transitive path analysis →</div>
      </div>`;
    setTimeout(() => openTransitiveTab(edge.from, edge.to), 50);

  } else {
    const w  = ALL_NODES.find(n => n.id === edge.from);
    const l  = ALL_NODES.find(n => n.id === edge.to);
    const rcW = REGION_COLORS[w?.region] ?? '#b0a898';
    const rcL = REGION_COLORS[l?.region] ?? '#b0a898';
    const [scoreW, scoreL] = edge.label.split('-').map(s => s.trim());

    // Check for rematches between these two teams
    const allMatchups = ALL_EDGES.filter(e =>
      (e.from === edge.from && e.to === edge.to) ||
      (e.from === edge.to   && e.to === edge.from)
    ).sort((a, b) => a.date.localeCompare(b.date));

    const rematchBadge = allMatchups.length > 1
      ? `<div class="d-rematch-badge">${allMatchups.length} games played — showing all below</div>`
      : '';

    const gameCards = allMatchups.map(e => {
      const ew  = ALL_NODES.find(n => n.id === e.from);
      const el  = ALL_NODES.find(n => n.id === e.to);
      const rcEw = REGION_COLORS[ew?.region] ?? '#b0a898';
      const rcEl = REGION_COLORS[el?.region] ?? '#b0a898';
      const [sw, sl] = e.label.split('-').map(s => s.trim());
      const isThisEdge = e === edge || (e.from === edge.from && e.to === edge.to && e.date === edge.date);
      return `
        <div class="d-matchup-card played ${isThisEdge ? 'highlighted-game' : ''}">
          <div class="d-matchup-label">${e.same_region ? 'Same-region' : 'Cross-region'} · ${e.date}</div>
          <div class="d-matchup-teams">
            <div class="d-matchup-team winner-side">
              <div class="d-wl-badge w-badge">W</div>
              <div class="d-matchup-dot" style="background:${rcEw}"></div>
              <div class="d-matchup-name">${ew?.label ?? '—'}</div>
            </div>
            <div class="d-score-col">
              <div class="d-score-main">${sw}<span class="d-score-dash">–</span>${sl}</div>
              <div class="d-score-margin">+${e.margin}</div>
            </div>
            <div class="d-matchup-team loser-side">
              <div class="d-wl-badge l-badge">L</div>
              <div class="d-matchup-dot" style="background:${rcEl}"></div>
              <div class="d-matchup-name">${el?.label ?? '—'}</div>
            </div>
          </div>
        </div>`;
    }).join('');

    box.innerHTML = `
      ${rematchBadge}
      ${gameCards}
      <div class="style-bars-container" id="style-bars-${edge.from}-${edge.to}"></div>`;

    if (w && l) renderStyleBars(w, l, `style-bars-${edge.from}-${edge.to}`);
  }
}

// ── Rankings ───────────────────────────────────────────────────────────────────
function populateRankings() {
  if (!ALL_NODES.length) return;
  const maxW = Math.max(...ALL_NODES.map(n => n.wins_vs_field))   || 1;
  const maxL = Math.max(...ALL_NODES.map(n => n.losses_vs_field)) || 1;

  const byWins   = [...ALL_NODES].sort((a, b) => b.wins_vs_field   - a.wins_vs_field);
  const byLosses = [...ALL_NODES].sort((a, b) => b.losses_vs_field - a.losses_vs_field);

  const renderList = (nodes, valKey, color) =>
    nodes.map((n, i) => `
      <div class="rank-item" onclick="focusTeam('${n.id}')">
        <span class="rank-num">${i + 1}</span>
        <span class="rank-name">${n.label}</span>
        <span class="rank-val" style="color:${color}">${n[valKey]}</span>
      </div>
      <div class="rank-bar-row">
        <div class="rank-bar" style="background:${color};width:${(n[valKey] / (valKey === 'wins_vs_field' ? maxW : maxL) * 100).toFixed(0)}%"></div>
      </div>`).join('');

  document.getElementById('rank-wins').innerHTML   = renderList(byWins,   'wins_vs_field',   'var(--west)');
  document.getElementById('rank-losses').innerHTML = renderList(byLosses, 'losses_vs_field', 'var(--midwest)');

  // Seed vs T-Rank divergence — loaded async from torvik_stats
  populateSeedDivergence();
}

async function populateSeedDivergence() {
  const tvData = await window.getTorvik();
  if (!tvData) return;

  const teams = ALL_NODES.map(n => {
    const tv = tvData?.teams?.[n.id]?.torvik;
    if (!tv || n.seed == null) return null;
    const seedRankMid = (n.seed - 1) * 4 + 2.5;
    const div = seedRankMid - tv.rank;
    return { node: n, trank: tv.rank, adj_em: tv.adj_em, div };
  }).filter(Boolean);

  // Underseeded: efficiency says better than seed (positive divergence), seeds 4-13
  const underseeded = teams
    .filter(t => t.div >= 4 && t.node.seed >= 4 && t.node.seed <= 13)
    .sort((a, b) => b.div - a.div);

  // Overseeded: seed is more favorable than T-Rank suggests, seeds 4-12
  const overseeded = teams
    .filter(t => t.div <= -6 && t.node.seed >= 4 && t.node.seed <= 12)
    .sort((a, b) => a.div - b.div)
    .slice(0, 12);

  const rcMap = REGION_COLORS;

  const renderDivRow = (t, isUnder) => {
    const rc    = rcMap[t.node.region] ?? '#94a3b8';
    const arrow = isUnder ? '↑' : '↓';
    const color = isUnder ? 'var(--east)' : 'var(--accent)';
    const diff  = Math.abs(t.div).toFixed(0);
    return `
      <div class="rank-item div-item" onclick="focusTeam('${t.node.id}')">
        <span class="rank-num" style="color:${rc}">#${t.node.seed}</span>
        <span class="rank-name">${t.node.label}</span>
        <span class="div-badge" style="color:${color}">${arrow}${diff}</span>
      </div>
      <div class="div-meta">T-Rank #${t.trank} · AdjEM ${t.adj_em > 0 ? '+' : ''}${t.adj_em}</div>`;
  };

  const uEl = document.getElementById('rank-underseeded');
  const oEl = document.getElementById('rank-overseeded');
  if (uEl) uEl.innerHTML = underseeded.map(t => renderDivRow(t, true)).join('') || '<div class="spark-unavail">No data</div>';
  if (oEl) oEl.innerHTML = overseeded.map(t => renderDivRow(t, false)).join('') || '<div class="spark-unavail">No data</div>';
}

// ── Stats bar ─────────────────────────────────────────────────────────────────
function updateStats(teamCount, playedCount, notPlayedCount) {
  document.getElementById('st-teams').textContent     = teamCount;
  document.getElementById('st-inter').textContent     = playedCount;
  document.getElementById('cnt-played').textContent   = playedCount;
  document.getElementById('cnt-notplayed').textContent = notPlayedCount;

  // Total games and rematches: scale from full dataset proportionally,
  // or show actuals if we have the full set loaded
  if (teamCount === ALL_NODES.length) {
    document.getElementById('st-games').textContent     = META.total_games ?? ALL_EDGES.length;
    document.getElementById('st-rematches').textContent = META.rematches ?? '—';
  } else {
    // Count rematches in current selection
    const rematches = playedCount > 0
      ? (() => {
          const pairs = {};
          const selEdges = customActive ? CUSTOM_EDGES : ALL_EDGES;
          selEdges.forEach(e => {
            const key = [e.from, e.to].sort().join('|');
            pairs[key] = (pairs[key] || 0) + 1;
          });
          return Object.values(pairs).filter(c => c > 1).length;
        })()
      : 0;
    document.getElementById('st-games').textContent     = playedCount;
    document.getElementById('st-rematches').textContent = rematches || '0';
  }

  if (teamCount === 0) {
    document.getElementById('sub-stats').textContent = 'No teams selected — use search or quick-add buttons';
  } else {
    document.getElementById('sub-stats').textContent =
      `${teamCount} team${teamCount !== 1 ? 's' : ''} · ${playedCount} game${playedCount !== 1 ? 's' : ''} played · ${notPlayedCount} pairs never met`;
  }
}

function populateStats() {
  // Boot call — show zeros since graph starts empty
  updateStats(0, 0, 0);

  if (META.generated_at) {
    const d = new Date(META.generated_at);
    const dateStr = d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
    const timeStr = d.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', timeZoneName:'short' });
    document.getElementById('last-updated').textContent =
      `ESPN data: ${dateStr} ${timeStr} · includes regular season + conf tournaments`;
  }
}

// ── Search ────────────────────────────────────────────────────────────────────
function bindSearch() {
  const input    = document.getElementById('search');
  const dropdown = document.getElementById('search-dropdown');

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 1) { dropdown.innerHTML = ''; dropdown.style.display = 'none'; return; }

    const matches = ALL_NODES.filter(n =>
      n.label.toLowerCase().includes(q) || n.full_name.toLowerCase().includes(q)
    ).slice(0, 12);

    if (!matches.length) { dropdown.innerHTML = ''; dropdown.style.display = 'none'; return; }

    // Build content first, then position and show — avoids empty-box flash
    dropdown.innerHTML = matches.map(n => `
      <div class="search-item" onclick="focusTeam('${n.id}');document.getElementById('search').value='';document.getElementById('search-dropdown').style.display='none'">
        <div>${n.full_name}</div>
        <div class="search-meta">${n.region} · Seed ${n.seed} · ${n.wins_vs_field}W-${n.losses_vs_field}L</div>
      </div>`).join('');
    const rect = input.getBoundingClientRect();
    dropdown.style.top  = (rect.bottom + 4) + 'px';
    dropdown.style.left = rect.left + 'px';
    dropdown.style.display = 'block';
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.search-group')) { dropdown.innerHTML = ''; dropdown.style.display = 'none'; }
  });
}

function focusTeam(id) {
  if (!id) return;
  // Ensure node is visible — reset custom selection if active
  if (typeof customActive !== 'undefined' && customActive) clearCustom();
  // Switch to Detail tab first so content renders
  switchTab('detail');
  const box = document.getElementById('detail-box');
  renderTeamDetail(id, box);
  // On mobile, open the sidebar so the detail is visible
  if (window.innerWidth <= 768) {
    const sidebar    = document.querySelector('.sidebar');
    const sidebarBtn = document.getElementById('mob-sidebar-btn');
    if (sidebar) sidebar.classList.add('mob-open');
    if (sidebarBtn) sidebarBtn.style.display = 'none';
  }
  // Then focus in graph
  try {
    network.selectNodes([id]);
    network.focus(id, { scale: 1.5, animation: { duration: 400, easingFunction: 'easeInOutQuad' } });
  } catch(e) {}
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.stab').forEach(el => el.classList.remove('active'));
  const tabEl = document.getElementById(`tab-${tab}`);
  const stabEl = document.querySelector(`.stab[data-tab="${tab}"]`);
  if (tabEl) tabEl.classList.add('active');
  if (stabEl) stabEl.classList.add('active');
  if (tab === 'transitive' && typeof populateTransSelects === 'function') populateTransSelects();
  if (tab === 'bracket'    && typeof initBracket           === 'function') initBracket();
}

// ── UI bindings ───────────────────────────────────────────────────────────────
function bindUI() {
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });

  document.getElementById('region-filter').addEventListener('change', applyFilters);
  document.getElementById('layout-sel').addEventListener('change', changeLayout);
  document.getElementById('fit-btn').addEventListener('click', () => network.fit());
  document.getElementById('phys-btn').addEventListener('click', togglePhysics);

  document.querySelectorAll('.stab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  bindSearch();
  initCustomSelector();
  initSidebarResize();
  // Do NOT call initPathsPicker here — paths-input-a/b are in a hidden tab
  // and dataset.bound would prevent re-wiring when the tab opens
}

function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  overlay.style.opacity = '0';
  overlay.style.transition = 'opacity .4s';
  setTimeout(() => {
    overlay.remove();
    initMobileUI();              // set up drag, tabs, sidebar toggle
    initMobileFirstImpression(); // open sheet, default to overview
  }, 400);
}

function validateBracketIntegrity() {
  const regionCounts = {};
  const regionSeeds  = {};
  ALL_NODES.forEach(n => {
    regionCounts[n.region] = (regionCounts[n.region] || 0) + 1;
    if (!regionSeeds[n.region]) regionSeeds[n.region] = [];
    regionSeeds[n.region].push(n.seed);
  });

  const issues = [];
  for (const [region, seeds] of Object.entries(regionSeeds)) {
    const counts = {};
    seeds.forEach(s => { counts[s] = (counts[s] || 0) + 1; });
    const dups = Object.entries(counts).filter(([, n]) => n > 1).map(([s]) => `#${s}`);
    if (dups.length) issues.push(`${region}: duplicate seeds ${dups.join(', ')}`);
    if (seeds.length !== 16) issues.push(`${region}: ${seeds.length} teams (expected 16)`);
  }

  if (issues.length) {
    const banner = document.createElement('div');
    banner.id = 'bracket-warning';
    banner.style.cssText = `
      background:#b89030;color:#fff;font-size:.75rem;padding:5px 16px;
      display:flex;align-items:center;gap:8px;font-family:var(--font-body);
    `;
    banner.innerHTML = `
      <span style="font-weight:600">⚠ Pre-Selection bracket:</span>
      <span>Seedings are projections only — official bracket releases March 15. ${issues.join(' · ')}</span>
      <button onclick="this.parentElement.remove()" style="margin-left:auto;background:none;border:none;color:#fff;cursor:pointer;font-size:.9rem">✕</button>
    `;
    document.querySelector('.toolbar').before(banner);
  }
}

// ── Empty state ───────────────────────────────────────────────────────────────
function showEmptyState(show) {
  let el = document.getElementById('graph-empty-state');
  if (show) {
    if (!el) {
      el = document.createElement('div');
      el.id = 'graph-empty-state';
      el.className = 'graph-empty-state';
      const isMobile = window.innerWidth <= 768;
      el.innerHTML = isMobile ? `
        <div class="ges-icon">⬡</div>
        <div class="ges-title">2026 NCAA Bracket</div>
        <div class="ges-sub">Head-to-head results for all 68 teams.</div>
        <div class="ges-btns">
          <button class="ges-btn" onclick="addAllToCustom()">Show all teams</button>
        </div>` : `
        <div class="ges-icon">⬡</div>
        <div class="ges-title">Build your graph</div>
        <div class="ges-sub">Search for teams above, or start with a quick-add:</div>
        <div class="ges-btns">
          <button class="ges-btn" onclick="addAllToCustom()">All 68 teams</button>
          <button class="ges-btn" onclick="addRegionToCustom('East');"    style="border-color:#4a7fb5;color:#4a7fb5">East</button>
          <button class="ges-btn" onclick="addRegionToCustom('West');"    style="border-color:#3a8c6e;color:#3a8c6e">West</button>
          <button class="ges-btn" onclick="addRegionToCustom('South');"   style="border-color:#b89030;color:#b89030">South</button>
          <button class="ges-btn" onclick="addRegionToCustom('Midwest');" style="border-color:#b84545;color:#b84545">Midwest</button>
          <button class="ges-btn" onclick="addRegionToCustom('bubble');"  style="border-color:#7c3aed;color:#7c3aed">Bubble</button>
        </div>`;
      document.getElementById('network').appendChild(el);
    }
    el.style.display = 'flex';
  } else {
    if (el) el.style.display = 'none';
  }
}

// Remove a single node from the live graph
function removeNodeFromGraph(nodeId) {
  CUSTOM_SELECTION.delete(nodeId);

  if (CUSTOM_SELECTION.size === 0) {
    // Nothing left — go back to empty state
    clearCustom();
    return;
  }

  // Remove node and any edges touching it from the DataSets directly
  nodesDS.remove(nodeId);
  const edgesToRemove = edgesDS.getIds({
    filter: e => e.from === nodeId || e.to === nodeId
  });
  edgesDS.remove(edgesToRemove);

  // Rebuild pills bar
  renderCustomPills();

  // Clear detail panel
  const box = document.getElementById('detail-box');
  if (box) box.innerHTML = '<div class="detail-empty">Team removed. Click another team or edge to see details.</div>';

  // Recount not-played pairs for current selection
  const selArr2  = [...CUSTOM_SELECTION];
  const playedSet = new Set(
    edgesDS.get({ filter: e => !e.is_not_played }).map(e => [e.from,e.to].sort().join('|'))
  );
  let npCount = 0;
  for (let i = 0; i < selArr2.length; i++)
    for (let j = i+1; j < selArr2.length; j++)
      if (!playedSet.has([selArr2[i],selArr2[j]].sort().join('|'))) npCount++;
  const playedCnt = edgesDS.get({ filter: e => !e.is_not_played }).length;
  updateStats(CUSTOM_SELECTION.size, playedCnt, npCount);
}

// Re-render just the pills without rebuilding the full graph
function renderCustomPills() {
  const pillsBar  = document.getElementById('custom-pills-bar');
  const pillsWrap = document.getElementById('custom-pills');
  const badge     = document.getElementById('pills-count-badge');
  if (CUSTOM_SELECTION.size === 0) {
    pillsBar.style.display = 'none';
    return;
  }
  pillsWrap.innerHTML = '';
  CUSTOM_SELECTION.forEach(id => {
    const node = ALL_NODES.find(n => n.id === id);
    if (!node) return;
    const rc = REGION_COLORS[node.region] || '#b0a898';
    const pill = document.createElement('span');
    pill.className = 'team-pill';
    pill.style.borderColor = rc;
    pill.innerHTML = `
      <span class="pill-dot" style="background:${rc}"></span>
      ${node.label}
      <button class="pill-remove" onclick="removeFromCustom('${id}')">✕</button>
    `;
    pillsWrap.appendChild(pill);
  });
  if (badge) badge.textContent = CUSTOM_SELECTION.size;
  pillsBar.style.display = 'flex';
}

// ── Custom team selector ──────────────────────────────────────────────────────
let CUSTOM_SELECTION = new Set(); // espn team IDs currently selected
let CUSTOM_NODES     = [];        // node objects for custom teams (may include non-bracket)
let CUSTOM_EDGES     = [];        // played edge objects for custom teams
let CUSTOM_NP        = [];        // not-played edge objects for custom teams
let customActive     = false;

function initCustomSelector() {
  const inp  = document.getElementById('custom-team-input');
  const drop = document.getElementById('custom-dropdown');

  inp.addEventListener('input', () => {
    const q = inp.value.trim().toLowerCase();
    drop.innerHTML = '';
    if (q.length < 1) { drop.style.display = 'none'; return; }

    const matches = ALL_NODES
      .filter(n => n.full_name.toLowerCase().includes(q) || n.label.toLowerCase().includes(q))
      .slice(0, 12);

    if (!matches.length) { drop.style.display = 'none'; return; }

    matches.forEach(n => {
      const item = document.createElement('div');
      item.className = 'search-item';
      const seedLabel = n.seed != null ? ` #${n.seed}` : '';
      item.textContent = `${n.full_name} (${n.region}${seedLabel})`;
      if (CUSTOM_SELECTION.has(n.id)) item.style.opacity = '0.4';
      item.addEventListener('mousedown', e => {
        e.preventDefault();
        addToCustom(n.id);
        inp.value = '';
        drop.style.display = 'none';
      });
      drop.appendChild(item);
    });

    const rect = inp.getBoundingClientRect();
    drop.style.top  = (rect.bottom + 4) + 'px';
    drop.style.left = rect.left + 'px';
    drop.style.display = 'block';
  });

  inp.addEventListener('keydown', e => {
    if (e.key === 'Escape') { drop.style.display = 'none'; inp.value = ''; }
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('#custom-selector-group')) drop.style.display = 'none';
  });
}

function addToCustom(teamId) {
  if (CUSTOM_SELECTION.has(teamId)) return;
  CUSTOM_SELECTION.add(teamId);
  renderCustom();
}

function removeFromCustom(teamId) {
  CUSTOM_SELECTION.delete(teamId);
  renderCustom();
}

function clearCustom() {
  CUSTOM_SELECTION.clear();
  renderCustom();
}

function addRegionToCustom(region) {
  ALL_NODES.filter(n => n.region === region).forEach(n => CUSTOM_SELECTION.add(n.id));
  renderCustom();
}

function removeRegionFromCustom(region) {
  ALL_NODES.filter(n => n.region === region).forEach(n => CUSTOM_SELECTION.delete(n.id));
  renderCustom();
}

function addAllToCustom() {
  ALL_NODES.filter(n => n.region !== 'bubble').forEach(n => CUSTOM_SELECTION.add(n.id));
  renderCustom();
}

function renderCustom() {
  const pillsBar  = document.getElementById('custom-pills-bar');
  const pillsWrap = document.getElementById('custom-pills');
  const clearBtn  = document.getElementById('custom-clear-btn');

  if (CUSTOM_SELECTION.size === 0) {
    customActive = false;
    pillsBar.style.display  = 'none';
    clearBtn.style.display  = 'none';
    // Empty graph — show the empty state prompt
    nodesDS.clear();
    edgesDS.clear();
    showEmptyState(true);
    updateStats(0, 0, 0);
    return;
  }

  showEmptyState(false);

  customActive = true;
  clearBtn.style.display = '';

  // Build pills
  pillsWrap.innerHTML = '';
  CUSTOM_SELECTION.forEach(id => {
    const node = ALL_NODES.find(n => n.id === id);
    if (!node) return;
    const rc = REGION_COLORS[node.region] || '#b0a898';
    const pill = document.createElement('span');
    pill.className = 'team-pill';
    pill.style.borderColor = rc;
    pill.innerHTML = `
      <span class="pill-dot" style="background:${rc}"></span>
      ${node.label}
      <button class="pill-remove" onclick="removeFromCustom('${id}')">✕</button>
    `;
    pillsWrap.appendChild(pill);
  });
  const badge = document.getElementById('pills-count-badge');
  if (badge) badge.textContent = CUSTOM_SELECTION.size;
  pillsBar.style.display = 'flex';

  // Filter nodes to selection
  const selIds   = CUSTOM_SELECTION;
  CUSTOM_NODES   = ALL_NODES.filter(n => selIds.has(n.id));

  // Filter played edges — both endpoints must be in selection
  CUSTOM_EDGES   = ALL_EDGES.filter(e => selIds.has(e.from) && selIds.has(e.to));

  // Build not-played pairs from selection
  const selArr   = [...selIds];
  const playedPairs = new Set(CUSTOM_EDGES.map(e => [e.from, e.to].sort().join('|')));
  CUSTOM_NP = [];
  for (let i = 0; i < selArr.length; i++) {
    for (let j = i + 1; j < selArr.length; j++) {
      const key = [selArr[i], selArr[j]].sort().join('|');
      if (!playedPairs.has(key)) {
        const na = ALL_NODES.find(n => n.id === selArr[i]);
        const nb = ALL_NODES.find(n => n.id === selArr[j]);
        CUSTOM_NP.push({
          id:            `cnp_${key}`,
          from:          selArr[i],
          to:            selArr[j],
          color:         { color: '#ccc6b9', opacity: 0.5 },
          dashes:        true,
          width:         1,
          arrows:        '',
          label:         '',
          title:         undefined, // no hover tooltip — sidebar shows detail on click
          is_not_played: true,
        });
      }
    }
  }

  applyCustomView();

  const playedCnt = CUSTOM_EDGES.length;
  const npCnt     = CUSTOM_NP.length;
  updateStats(CUSTOM_SELECTION.size, playedCnt, npCnt);
}

function applyCustomView() {
  if (!customActive) return;

  let edges = [];
  if (currentView === 'played' || currentView === 'both') edges = edges.concat(CUSTOM_EDGES);
  if (currentView === 'notplayed' || currentView === 'both') edges = edges.concat(CUSTOM_NP);

  nodesDS.clear();
  nodesDS.add(CUSTOM_NODES);
  edgesDS.clear();
  edgesDS.add(edges);
}

// ── Sidebar drag resize ───────────────────────────────────────────────────────
function initSidebarResize() {
  const handle  = document.getElementById('sidebar-resize-handle');
  const sidebar = document.getElementById('sidebar');
  if (!handle || !sidebar) return;

  let dragging = false;
  let startX   = 0;
  let startW   = 0;

  handle.addEventListener('mousedown', e => {
    dragging = true;
    startX   = e.clientX;
    startW   = sidebar.offsetWidth;
    handle.classList.add('dragging');
    document.body.style.cursor    = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const dx    = e.clientX - startX; // drag right = wider sidebar
    const newW  = Math.max(180, Math.min(420, startW + dx));
    sidebar.style.width = newW + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('dragging');
    document.body.style.cursor     = '';
    document.body.style.userSelect = '';
    // Let vis.js re-fit to new canvas size
    if (network) setTimeout(() => network.redraw(), 50);
  });
}

// ── Mobile bottom sheet + sidebar overlay ────────────────────────────────────
function initMobileUI() {
  if (window.innerWidth > 768) return;

  const aiPanel  = document.getElementById('ai-panel');
  const sidebar  = document.querySelector('.sidebar');
  const main     = document.querySelector('.main');
  if (!aiPanel || !sidebar || !main) return;

  // ── Floating sidebar toggle button ───────────────────────────────────────
  if (!document.getElementById('mob-sidebar-btn')) {
    const sidebarBtn = document.createElement('button');
    sidebarBtn.id = 'mob-sidebar-btn';
    sidebarBtn.className = 'mob-sidebar-btn';
    sidebarBtn.setAttribute('aria-label', 'Open stats panel');
    sidebarBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg><span style="font-size:.6rem;margin-left:3px;letter-spacing:.02em">STATS</span>`;
    main.appendChild(sidebarBtn);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'mob-sidebar-close';
    closeBtn.setAttribute('aria-label', 'Close stats panel');
    closeBtn.innerHTML = '\u2715';
    sidebar.appendChild(closeBtn);

    sidebarBtn.addEventListener('click', () => {
      sidebar.classList.add('mob-open');
      sidebarBtn.style.display = 'none';
    });
    closeBtn.addEventListener('click', () => {
      sidebar.classList.remove('mob-open');
      sidebarBtn.style.display = '';
    });
  }

  // ── Drag handle — declared before use ────────────────────────────────────
  const dragHandle = document.getElementById('mob-drag-handle');

  // ── Tap header or drag handle to toggle sheet ────────────────────────────
  const aiHeader = aiPanel.querySelector('.ai-panel-header');
  function toggleSheet() {
    if (aiPanel.classList.contains('open')) {
      aiPanel.classList.remove('open');
    } else {
      aiPanel.classList.add('open');
    }
  }
  if (aiHeader && !aiHeader._toggleBound) {
    aiHeader.style.cursor = 'pointer';
    aiHeader._toggleBound = true;
    aiHeader.addEventListener('click', toggleSheet);
  }
  if (dragHandle) {
    dragHandle.addEventListener('click', toggleSheet);
  }

  // ── Drag zone — handle pill + full header row ────────────────────────────
  // Both the drag handle pill and the header row are draggable.
  // Touch events are non-passive so we can preventDefault and block
  // Safari's swipe-back and iOS rubber-band overscroll.
  const SHEET_HEIGHT = window.innerHeight * 0.82;
  let dragStartY    = 0;
  let dragStartOpen = false;
  let isDragging    = false;
  let dragMoved     = false; // distinguish tap vs drag

  function onDragStart(e) {
    // Don't intercept taps on interactive elements (tab buttons etc)
    if (e.target.closest('button, a, input, select, textarea')) return;
    dragStartY    = e.touches[0].clientY;
    dragStartOpen = aiPanel.classList.contains('open');
    isDragging    = true;
    dragMoved     = false;
    aiPanel.style.transition = 'none';
    // Don't preventDefault here — let clicks fire on buttons inside the header
  }
  function onDragMove(e) {
    if (!isDragging) return;
    const dy = e.touches[0].clientY - dragStartY;
    if (Math.abs(dy) > 8) {
      dragMoved = true;
      // Only preventDefault once we know it's a drag, not a tap
      e.preventDefault();
      const closedOffset  = SHEET_HEIGHT - 56;
      const currentOffset = dragStartOpen ? 0 : closedOffset;
      const newOffset = Math.max(0, Math.min(closedOffset, currentOffset + dy));
      aiPanel.style.transform = `translateY(${newOffset}px)`;
    }
  }
  function onDragEnd(e) {
    if (!isDragging) return;
    isDragging = false;
    aiPanel.style.transition = '';
    aiPanel.style.transform  = '';
    const dy = e.changedTouches[0].clientY - dragStartY;
    if (!dragMoved) {
      // Pure tap on non-button area — toggle sheet
      toggleSheet();
    } else if (dragStartOpen) {
      if (dy > 80) aiPanel.classList.remove('open');
    } else {
      if (dy < -80) aiPanel.classList.add('open');
    }
  }

  // Drag handle pill — safe to preventDefault on touchstart (no buttons inside)
  if (dragHandle) {
    dragHandle.addEventListener('touchstart', e => {
      onDragStart(e);
      e.preventDefault(); // safe — drag handle has no interactive children
    }, { passive: false });
    dragHandle.addEventListener('touchmove',  onDragMove,  { passive: false });
    dragHandle.addEventListener('touchend',   onDragEnd,   { passive: false });
  }
  // Scout header — drag but DON'T preventDefault on touchstart so button clicks fire
  const scoutHeader = aiPanel.querySelector('.ai-scout-header');
  if (scoutHeader) {
    scoutHeader.addEventListener('touchstart', onDragStart, { passive: true });
    scoutHeader.addEventListener('touchmove',  onDragMove,  { passive: false });
    scoutHeader.addEventListener('touchend',   onDragEnd,   { passive: true });
  }

  // ── Chat and stats panels — allow scrolling without triggering drag ───────
  // CSS overscroll-behavior: contain handles this — no JS needed here.
  // stopPropagation would break tap-to-type and other interactions inside the panel.

  // ── Mobile-only tabs: Overview, Bracket, Rankings ─────────────────────────
  // These mirror content from the hidden sidebar into panels inside the sheet.
  // ai-panel.js also binds .ai-tab clicks but skips mob-only-tabs, so no conflict.
  document.querySelectorAll('.mob-only-tab').forEach(btn => {
    if (btn._mobTabBound) return;
    btn._mobTabBound = true;
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      const mobPanel = document.getElementById(`mob-panel-${mode}`);
      if (!mobPanel) return;
      // For bracket, initBracket() populates tab-bracket dynamically — run it first
      if (mode === 'bracket' && typeof initBracket === 'function') initBracket();
      // Sync fresh content from sidebar tab
      const sidebarContent = document.getElementById(`tab-${mode}`);
      if (sidebarContent) mobPanel.innerHTML = sidebarContent.innerHTML;
      // Deactivate ALL panels including native stats/chat panels
      document.querySelectorAll('.ai-mode-content').forEach(p => p.classList.remove('active'));
      mobPanel.classList.add('active');
      aiPanel.classList.add('open');
    });
  });

  // ── AI Scout header button opens sheet ───────────────────────────────────
  const aiToggle = document.getElementById('ai-toggle');
  if (aiToggle) {
    aiToggle.addEventListener('click', () => {
      if (window.innerWidth <= 768) aiPanel.classList.add('open');
    });
  }
}

// ── Mobile first impression: open Scout immediately on load ──────────────────
function initMobileFirstImpression() {
  if (window.innerWidth > 768) return;

  const aiPanel = document.getElementById('ai-panel');
  if (!aiPanel) return;

  // Open the bottom sheet
  aiPanel.classList.add('open');

  // Deactivate all tabs and panels
  document.querySelectorAll('.ai-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.ai-mode-content').forEach(p => p.classList.remove('active'));

  // Default to Overview — pre-populate it now so it's instant
  const overviewBtn = document.querySelector('.ai-tab[data-mode="overview"]');
  const mobOverview = document.getElementById('mob-panel-overview');
  const sidebarOverview = document.getElementById('tab-overview');
  if (overviewBtn && mobOverview && sidebarOverview) {
    overviewBtn.classList.add('active');
    mobOverview.innerHTML = sidebarOverview.innerHTML;
    mobOverview.classList.add('active');
  }
}

// Run after data loads — called directly from hideLoading
// (MutationObserver approach was fragile due to CSS fade timing)
