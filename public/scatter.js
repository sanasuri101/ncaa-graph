/**
 * scatter.js — Efficiency scatter plot overlay
 *
 * Plots all 64 bracket teams as AdjOE (x) vs AdjDE (y).
 * Built on raw Canvas2D — no chart library needed, keeps bundle lean.
 *
 * Interactions:
 *   - Hover: tooltip with full stats
 *   - Click: focuses the team in the main graph + opens detail panel
 *   - Highlight mode: region color / seed tier / AdjEM gradient
 *   - Quadrant labels: elite, offensive, defensive, risky
 */

'use strict';

let SCATTER_OPEN    = false;
let TORVIK_SCATTER  = null;
let SCATTER_POINTS  = [];   // {x, y, team, node, torvik}
let HOVERED_IDX     = -1;

// ── Toggle ────────────────────────────────────────────────────────────────────
async function toggleScatter() {
  const overlay = document.getElementById('scatter-overlay');
  const btn     = document.getElementById('scatter-btn');
  SCATTER_OPEN  = !SCATTER_OPEN;

  overlay.classList.toggle('open', SCATTER_OPEN);
  btn.classList.toggle('active', SCATTER_OPEN);

  if (SCATTER_OPEN) {
    if (!TORVIK_SCATTER) {
      try {
        const res       = await fetch('data/torvik_stats.json');
        TORVIK_SCATTER  = await res.json();
      } catch (e) {
        console.warn('Could not load Torvik data for scatter:', e);
      }
    }
    buildScatterPoints();
    renderScatter();
    bindScatterEvents();
  }
}

// ── Build point data ──────────────────────────────────────────────────────────
function buildScatterPoints() {
  SCATTER_POINTS = [];

  ALL_NODES.forEach(node => {
    const tv = TORVIK_SCATTER?.teams?.[node.id]?.torvik;
    if (!tv) return;

    SCATTER_POINTS.push({
      node,
      tv,
      oe:   tv.adj_oe,
      de:   tv.adj_de,
      em:   tv.adj_em,
      rank: tv.rank,
    });
  });
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderScatter() {
  const canvas  = document.getElementById('scatter-canvas');
  const ctx     = canvas.getContext('2d');
  const W       = canvas.width;
  const H       = canvas.height;
  const PAD     = { top: 24, right: 20, bottom: 40, left: 52 };
  const plotW   = W - PAD.left - PAD.right;
  const plotH   = H - PAD.top  - PAD.bottom;

  ctx.clearRect(0, 0, W, H);

  if (!SCATTER_POINTS.length) {
    ctx.fillStyle = '#5a7a96';
    ctx.font = '13px Barlow, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Torvik data unavailable', W / 2, H / 2);
    return;
  }

  // ── Axis ranges (add 2pt padding) ─────────────────────────────────────────
  const allOE  = SCATTER_POINTS.map(p => p.oe);
  const allDE  = SCATTER_POINTS.map(p => p.de);
  const minOE  = Math.floor(Math.min(...allOE)) - 2;
  const maxOE  = Math.ceil(Math.max(...allOE))  + 2;
  const minDE  = Math.floor(Math.min(...allDE)) - 2;
  const maxDE  = Math.ceil(Math.max(...allDE))  + 2;

  // coordinate helpers
  const toX = oe => PAD.left  + ((oe - minOE) / (maxOE - minOE)) * plotW;
  const toY = de => PAD.top   + ((de - minDE) / (maxDE - minDE)) * plotH;  // high DE = worse = top

  // ── Background ─────────────────────────────────────────────────────────────
  ctx.fillStyle = '#080d14';
  ctx.fillRect(0, 0, W, H);

  // ── Quadrant tints ─────────────────────────────────────────────────────────
  const medOE = SCATTER_POINTS.reduce((s, p) => s + p.oe, 0) / SCATTER_POINTS.length;
  const medDE = SCATTER_POINTS.reduce((s, p) => s + p.de, 0) / SCATTER_POINTS.length;
  const cx    = toX(medOE);
  const cy    = toY(medDE);

  // Top-right = elite (good O, good D = low DE)
  drawQuadTint(ctx, cx, PAD.top,  PAD.left + plotW - cx, cy - PAD.top,   'rgba(52,211,153,.04)');
  // Bottom-right = offensive teams (good O, bad D)
  drawQuadTint(ctx, cx, cy,        PAD.left + plotW - cx, PAD.top + plotH - cy, 'rgba(96,165,250,.03)');
  // Top-left = defensive teams (bad O, good D)
  drawQuadTint(ctx, PAD.left, PAD.top, cx - PAD.left, cy - PAD.top,      'rgba(251,191,36,.03)');
  // Bottom-left = risky
  drawQuadTint(ctx, PAD.left, cy,  cx - PAD.left, PAD.top + plotH - cy,  'rgba(239,68,68,.03)');

  // ── Grid lines ──────────────────────────────────────────────────────────────
  ctx.strokeStyle = '#1e2d3d';
  ctx.lineWidth   = 1;
  const oeStep = 4;
  const deStep = 4;
  for (let v = Math.ceil(minOE / oeStep) * oeStep; v <= maxOE; v += oeStep) {
    const x = toX(v);
    ctx.beginPath(); ctx.moveTo(x, PAD.top); ctx.lineTo(x, PAD.top + plotH); ctx.stroke();
  }
  for (let v = Math.ceil(minDE / deStep) * deStep; v <= maxDE; v += deStep) {
    const y = toY(v);
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + plotW, y); ctx.stroke();
  }

  // ── Median crosshairs ──────────────────────────────────────────────────────
  ctx.strokeStyle = '#2a3d52';
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx, PAD.top); ctx.lineTo(cx, PAD.top + plotH); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(PAD.left, cy); ctx.lineTo(PAD.left + plotW, cy); ctx.stroke();
  ctx.setLineDash([]);

  // ── Quadrant labels ────────────────────────────────────────────────────────
  ctx.font = 'bold 9px Barlow Condensed, sans-serif';
  ctx.letterSpacing = '0.08em';
  const qLabel = (text, x, y, color) => {
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y);
  };
  qLabel('ELITE',      cx + (PAD.left + plotW - cx) / 2, PAD.top + 14,        'rgba(52,211,153,.5)');
  qLabel('OFFENSIVE',  cx + (PAD.left + plotW - cx) / 2, PAD.top + plotH - 6, 'rgba(96,165,250,.4)');
  qLabel('DEFENSIVE',  PAD.left + (cx - PAD.left) / 2,   PAD.top + 14,        'rgba(251,191,36,.4)');
  qLabel('VULNERABLE', PAD.left + (cx - PAD.left) / 2,   PAD.top + plotH - 6, 'rgba(239,68,68,.35)');

  // ── Axis labels ────────────────────────────────────────────────────────────
  ctx.fillStyle = '#2d4559';
  ctx.font = '10px Barlow, sans-serif';
  ctx.textAlign = 'center';
  // X axis ticks
  for (let v = Math.ceil(minOE / oeStep) * oeStep; v <= maxOE; v += oeStep) {
    ctx.fillText(v, toX(v), H - PAD.bottom + 14);
  }
  // Y axis ticks
  ctx.textAlign = 'right';
  for (let v = Math.ceil(minDE / deStep) * deStep; v <= maxDE; v += deStep) {
    ctx.fillText(v, PAD.left - 6, toY(v) + 4);
  }
  // Axis titles
  ctx.fillStyle = '#3d5a74';
  ctx.font = '10px Barlow Condensed, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('AdjOE →', PAD.left + plotW / 2, H - 4);
  ctx.save();
  ctx.translate(12, PAD.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('← AdjDE', 0, 0);
  ctx.restore();

  // ── Points ─────────────────────────────────────────────────────────────────
  const mode = document.getElementById('scatter-highlight')?.value ?? 'region';

  SCATTER_POINTS.forEach((p, i) => {
    const x    = toX(p.oe);
    const y    = toY(p.de);
    const r    = i === HOVERED_IDX ? 8 : 5.5;
    const col  = getPointColor(p, mode);

    // Glow for hovered
    if (i === HOVERED_IDX) {
      ctx.shadowColor = col;
      ctx.shadowBlur  = 14;
    }

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle   = col;
    ctx.globalAlpha = i === HOVERED_IDX ? 1 : 0.82;
    ctx.fill();

    ctx.strokeStyle = i === HOVERED_IDX ? '#fff' : 'rgba(255,255,255,.15)';
    ctx.lineWidth   = i === HOVERED_IDX ? 1.5 : 0.8;
    ctx.stroke();

    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1;

    // Label for hovered or top seeds
    if (i === HOVERED_IDX || p.node.seed <= 2) {
      ctx.font      = i === HOVERED_IDX ? 'bold 10px Barlow Condensed, sans-serif' : '9px Barlow Condensed, sans-serif';
      ctx.fillStyle = i === HOVERED_IDX ? '#fff' : 'rgba(255,255,255,.5)';
      ctx.textAlign = 'center';
      const labelY  = y - r - 3;
      ctx.fillText(p.node.label, x, labelY);
    }
  });

  // Store layout for hit testing
  canvas._plotMeta = { toX, toY, PAD, plotW, plotH };
}

function drawQuadTint(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

// ── Color schemes ─────────────────────────────────────────────────────────────
function getPointColor(p, mode) {
  if (mode === 'region') {
    return { East: '#3B82F6', West: '#10B981', South: '#F59E0B', Midwest: '#EF4444' }[p.node.region] ?? '#94a3b8';
  }
  if (mode === 'seed') {
    const s = p.node.seed;
    if (s <= 2)  return '#fbbf24';
    if (s <= 4)  return '#34d399';
    if (s <= 6)  return '#60a5fa';
    if (s <= 9)  return '#a78bfa';
    if (s <= 12) return '#f97316';
    return '#6b7280';
  }
  if (mode === 'em') {
    // Green (elite) → red (poor)
    const maxEM = Math.max(...SCATTER_POINTS.map(p => p.em));
    const minEM = Math.min(...SCATTER_POINTS.map(p => p.em));
    const t     = (p.em - minEM) / (maxEM - minEM);
    return lerpColor('#ef4444', '#34d399', t);
  }
  return '#94a3b8';
}

function lerpColor(a, b, t) {
  const ah = a.replace('#', '');
  const bh = b.replace('#', '');
  const ar = [parseInt(ah.slice(0,2),16), parseInt(ah.slice(2,4),16), parseInt(ah.slice(4,6),16)];
  const br = [parseInt(bh.slice(0,2),16), parseInt(bh.slice(2,4),16), parseInt(bh.slice(4,6),16)];
  const r  = ar.map((v, i) => Math.round(v + (br[i] - v) * t));
  return `rgb(${r[0]},${r[1]},${r[2]})`;
}

// ── Events ────────────────────────────────────────────────────────────────────
function bindScatterEvents() {
  const canvas  = document.getElementById('scatter-canvas');
  const tooltip = document.getElementById('scatter-tooltip');

  canvas.onmousemove = (e) => {
    const rect  = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx    = (e.clientX - rect.left) * scaleX;
    const my    = (e.clientY - rect.top)  * scaleY;
    const meta  = canvas._plotMeta;
    if (!meta) return;

    let closest = -1;
    let closestD = Infinity;

    SCATTER_POINTS.forEach((p, i) => {
      const px = meta.toX(p.oe);
      const py = meta.toY(p.de);
      const d  = Math.hypot(px - mx, py - my);
      if (d < closestD) { closestD = d; closest = i; }
    });

    if (closestD < 20 && closest !== HOVERED_IDX) {
      HOVERED_IDX = closest;
      renderScatter();
      showScatterTooltip(SCATTER_POINTS[closest], e, rect, tooltip);
    } else if (closestD >= 20) {
      HOVERED_IDX = -1;
      tooltip.style.display = 'none';
      document.getElementById('scatter-hovered').textContent = '';
      renderScatter();
    }
  };

  canvas.onmouseleave = () => {
    HOVERED_IDX = -1;
    tooltip.style.display = 'none';
    renderScatter();
  };

  canvas.onclick = (e) => {
    if (HOVERED_IDX < 0) return;
    const p = SCATTER_POINTS[HOVERED_IDX];
    // Focus team in main graph and open detail panel
    toggleScatter();
    setTimeout(() => focusTeam(p.node.id), 200);
  };

  // Close on overlay background click
  document.getElementById('scatter-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'scatter-overlay') toggleScatter();
  });

  // Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && SCATTER_OPEN) toggleScatter();
  });
}

function showScatterTooltip(p, e, canvasRect, tooltip) {
  const tv = p.tv;
  tooltip.innerHTML = `
    <div class="stt-name">${p.node.full_name}</div>
    <div class="stt-meta">${p.node.region} · Seed #${p.node.seed} · T-Rank #${tv.rank}</div>
    <div class="stt-grid">
      <div class="stt-cell"><div class="stt-val" style="color:#34d399">${tv.adj_oe}</div><div class="stt-lbl">AdjOE</div></div>
      <div class="stt-cell"><div class="stt-val" style="color:#f87171">${tv.adj_de}</div><div class="stt-lbl">AdjDE</div></div>
      <div class="stt-cell"><div class="stt-val" style="color:#a78bfa">${tv.adj_em > 0 ? '+' : ''}${tv.adj_em}</div><div class="stt-lbl">AdjEM</div></div>
      <div class="stt-cell"><div class="stt-val">${(tv.barthag * 100).toFixed(1)}%</div><div class="stt-lbl">Barthag</div></div>
    </div>
    <div class="stt-click">Click to focus in graph</div>
  `;
  tooltip.style.display = 'block';

  // Position tooltip near cursor but keep it inside panel
  const panel   = document.getElementById('scatter-panel');
  const pRect   = panel.getBoundingClientRect();
  let tx = e.clientX - pRect.left + 12;
  let ty = e.clientY - pRect.top  + 12;
  if (tx + 180 > pRect.width)  tx = tx - 200;
  if (ty + 120 > pRect.height) ty = ty - 130;
  tooltip.style.left = tx + 'px';
  tooltip.style.top  = ty + 'px';

  document.getElementById('scatter-hovered').textContent =
    `${p.node.full_name} — AdjEM ${tv.adj_em > 0 ? '+' : ''}${tv.adj_em}`;
}

// Re-render on window resize
window.addEventListener('resize', () => {
  if (SCATTER_OPEN) renderScatter();
});
