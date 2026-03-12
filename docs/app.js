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
};

// Organic node background fill colors — soft, like Pickle dots
const REGION_NODE_BG = {
  East:    '#c8daf0',
  West:    '#b8ddd0',
  South:   '#ecddb0',
  Midwest: '#f0c8c8',
};

// ── Boot ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const res  = await fetch('data/graph_data.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    ALL_NODES   = data.nodes;
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
    width:        1,
    arrows:       '',
    label:        '',
    title:        `${np.a_name} vs ${np.b_name}: Never played`,
    is_not_played: true,
  }));

  nodesDS = new vis.DataSet(ALL_NODES);
  edgesDS = new vis.DataSet(ALL_EDGES);

  const options = {
    nodes: {
      shape:       'dot',
      borderWidth: 1.2,
      shadow:      { enabled: true, color: 'rgba(42,37,32,.1)', size: 6, x: 0, y: 2 },
      chosen: {
        node: (values) => { values.size *= 1.4; values.borderWidth = 2.5; },
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
  if (customActive) { applyCustomView(); return; }

  const rv = document.getElementById('region-filter').value;

  // Nodes in scope for the selected region
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
      // Both endpoints must be in the selected region
      e = e.filter(x => scopedIds.has(x.from) && scopedIds.has(x.to));
    }
    edges = edges.concat(e);
  }

  // ── Not-played edges ──
  if (currentView === 'notplayed' || currentView === 'both') {
    let np = NP_EDGES;
    if (rv === 'same') {
      // Keep only NP pairs where both teams are in the same region
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

  // ── Visible nodes: only those in scope that appear in an edge ──
  const activeIds = new Set([...edges.map(e => e.from), ...edges.map(e => e.to)]);
  const nodes = ALL_NODES.filter(n =>
    scopedIds.has(n.id) && (activeIds.has(n.id) || edges.length === 0)
  );

  nodesDS.clear();
  nodesDS.add(nodes.length > 0 ? nodes : ALL_NODES.filter(n => scopedIds.has(n.id)));
  edgesDS.clear();
  edgesDS.add(edges);
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
        <div class="d-team-badge-seed" style="color:${rc}">#${node.seed}</div>
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
            <div class="d-matchup-sub" style="color:${rcA}">${a?.region ?? ''} #${a?.seed ?? '?'}</div>
          </div>
          <div class="d-vs-col"><span class="d-vs-text">vs</span></div>
          <div class="d-matchup-team">
            <div class="d-matchup-dot" style="background:${rcB}"></div>
            <div class="d-matchup-name">${b?.label ?? edge.to}</div>
            <div class="d-matchup-sub" style="color:${rcB}">${b?.region ?? ''} #${b?.seed ?? '?'}</div>
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
  let tvData = null;
  try {
    const res = await fetch('data/torvik_stats.json');
    tvData = await res.json();
  } catch (e) { return; }

  const teams = ALL_NODES.map(n => {
    const tv = tvData?.teams?.[n.id]?.torvik;
    if (!tv) return null;
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
function populateStats() {
  document.getElementById('st-teams').textContent    = ALL_NODES.length;
  document.getElementById('st-games').textContent    = META.total_games ?? ALL_EDGES.length;
  document.getElementById('st-inter').textContent    = ALL_EDGES.length;
  document.getElementById('st-rematches').textContent = META.rematches ?? '—';

  document.getElementById('cnt-played').textContent   = ALL_EDGES.length;
  document.getElementById('cnt-notplayed').textContent = NOT_PLAYED.length;

  document.getElementById('sub-stats').textContent =
    `${ALL_NODES.length} bracket teams · ${ALL_EDGES.length} inter-bracket matchups · ${NOT_PLAYED.length} pairs never met`;

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
    ).slice(0, 8);

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
  setTimeout(() => overlay.remove(), 400);
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
      .slice(0, 8);

    if (!matches.length) { drop.style.display = 'none'; return; }

    matches.forEach(n => {
      const item = document.createElement('div');
      item.className = 'search-item';
      item.textContent = `${n.full_name} (${n.region} #${n.seed})`;
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

function renderCustom() {
  const pillsBar  = document.getElementById('custom-pills-bar');
  const pillsWrap = document.getElementById('custom-pills');
  const clearBtn  = document.getElementById('custom-clear-btn');

  if (CUSTOM_SELECTION.size === 0) {
    // Restore full graph
    customActive = false;
    pillsBar.style.display  = 'none';
    clearBtn.style.display  = 'none';
    // Restore ALL_NODES / ALL_EDGES fully
    applyFilters();
    document.getElementById('sub-stats').textContent =
      `${ALL_NODES.length} bracket teams · ${ALL_EDGES.length} inter-bracket matchups · ${NOT_PLAYED.length} pairs never met`;
    return;
  }

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
          title:         `${na?.label ?? selArr[i]} vs ${nb?.label ?? selArr[j]}: Never played`,
          is_not_played: true,
        });
      }
    }
  }

  applyCustomView();

  const playedCnt = CUSTOM_EDGES.length;
  const npCnt     = CUSTOM_NP.length;
  document.getElementById('sub-stats').textContent =
    `${CUSTOM_SELECTION.size} teams selected · ${playedCnt} games played · ${npCnt} pairs never met`;
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
