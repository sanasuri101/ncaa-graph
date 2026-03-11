/**
 * style-bars.js — Head-to-head style comparison bars
 *
 * Shown in the edge detail panel when a played game edge is clicked.
 * Renders paired horizontal bars for 5 style dimensions:
 *
 *   Offense  — AdjOE (higher = better)
 *   Defense  — AdjDE (lower = better, inverted for display)
 *   Pace     — adj_tempo (0-1, higher = faster)
 *   Luck     — Torvik luck factor (positive = lucky, negative = unlucky)
 *   Schedule — SOS rank (higher = tougher schedule)
 *
 * Each bar shows both teams side-by-side from a shared center line.
 * Color follows each team's region color.
 */

'use strict';

let STYLE_TV_DATA = null;

async function loadStyleData() {
  if (STYLE_TV_DATA) return STYLE_TV_DATA;
  try {
    const res     = await fetch('data/torvik_stats.json');
    STYLE_TV_DATA = await res.json();
    return STYLE_TV_DATA;
  } catch (e) {
    return null;
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────
async function renderStyleBars(nodeW, nodeL, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const tv = await loadStyleData();
  if (!tv) return;

  const tvW = tv.teams?.[nodeW.id]?.torvik;
  const tvL = tv.teams?.[nodeL.id]?.torvik;
  if (!tvW || !tvL) return;

  const rcW = REGION_COLORS[nodeW.region] ?? '#3b82f6';
  const rcL = REGION_COLORS[nodeL.region] ?? '#ef4444';

  // Define metrics: {label, valW, valL, lowerIsBetter, unit}
  // Normalize to 0-1 within field range for bar width
  const allTeams = Object.values(tv.teams).map(t => t.torvik).filter(Boolean);

  const metrics = [
    {
      label:  'Offense',
      sub:    'AdjOE',
      valW:   tvW.adj_oe,
      valL:   tvL.adj_oe,
      min:    Math.min(...allTeams.map(t => t.adj_oe)),
      max:    Math.max(...allTeams.map(t => t.adj_oe)),
      better: 'higher',
      fmt:    v => v.toFixed(1),
    },
    {
      label:  'Defense',
      sub:    'AdjDE',
      valW:   tvW.adj_de,
      valL:   tvL.adj_de,
      min:    Math.min(...allTeams.map(t => t.adj_de)),
      max:    Math.max(...allTeams.map(t => t.adj_de)),
      better: 'lower',
      fmt:    v => v.toFixed(1),
    },
    {
      label:  'Pace',
      sub:    'adj_tempo (0-1)',
      valW:   tvW.adj_tempo,
      valL:   tvL.adj_tempo,
      min:    0,
      max:    1,
      better: 'neutral',
      fmt:    v => v >= 0.8 ? 'Fast' : v >= 0.6 ? 'Mod.' : 'Slow',
    },
    {
      label:  'Luck',
      sub:    'Torvik luck',
      valW:   tvW.luck,
      valL:   tvL.luck,
      min:    Math.min(...allTeams.map(t => t.luck ?? 0)),
      max:    Math.max(...allTeams.map(t => t.luck ?? 0)),
      better: 'neutral',
      fmt:    v => (v >= 0 ? '+' : '') + v.toFixed(3),
    },
    {
      label:  'Schedule',
      sub:    'Opp. quality',
      valW:   tvW.sos_rank ?? 0,
      valL:   tvL.sos_rank ?? 0,
      min:    Math.min(...allTeams.map(t => t.sos_rank ?? 0)),
      max:    Math.max(...allTeams.map(t => t.sos_rank ?? 0)),
      better: 'higher',
      fmt:    v => v.toFixed(3),
    },
  ];

  // Normalize a value to 0-1 within [min, max]
  const norm = (v, min, max, lowerBetter) => {
    const t = (max - min) > 0 ? (v - min) / (max - min) : 0.5;
    return lowerBetter ? 1 - t : t;
  };

  const rows = metrics.map(m => {
    const nW = norm(m.valW, m.min, m.max, m.better === 'lower');
    const nL = norm(m.valL, m.min, m.max, m.better === 'lower');

    // Which team is stronger on this dimension?
    const wEdge = m.better === 'neutral' ? 0
                : m.better === 'higher'  ? m.valW - m.valL
                : m.valL  - m.valW;   // lower is better, so L - W means W is better when positive

    const wWins = wEdge > 0.005;
    const lWins = wEdge < -0.005;

    const barW = (pct) => `${(pct * 46).toFixed(0)}px`;

    return `
      <div class="sb-row">
        <div class="sb-label-col">
          <div class="sb-metric">${m.label}</div>
          <div class="sb-sub">${m.sub}</div>
        </div>
        <div class="sb-bars-col">
          <div class="sb-team-row">
            <span class="sb-val ${wWins ? 'sb-val-better' : ''}">${m.fmt(m.valW)}</span>
            <div class="sb-bar-wrap sb-bar-w">
              <div class="sb-bar-fill" style="width:${barW(nW)};background:${rcW};opacity:${wWins ? 0.9 : 0.4}"></div>
            </div>
            <span class="sb-name" style="color:${rcW}">${nodeW.label}</span>
          </div>
          <div class="sb-team-row">
            <span class="sb-val ${lWins ? 'sb-val-better' : ''}">${m.fmt(m.valL)}</span>
            <div class="sb-bar-wrap sb-bar-l">
              <div class="sb-bar-fill" style="width:${barW(nL)};background:${rcL};opacity:${lWins ? 0.9 : 0.4}"></div>
            </div>
            <span class="sb-name" style="color:${rcL}">${nodeL.label}</span>
          </div>
        </div>
      </div>`;
  });

  // Mismatch callout — biggest stylistic divergence
  const paceDiff = Math.abs(tvW.adj_tempo - tvL.adj_tempo);
  let callout = '';
  if (paceDiff > 0.2) {
    const faster = tvW.adj_tempo > tvL.adj_tempo ? nodeW.label : nodeL.label;
    const slower = tvW.adj_tempo > tvL.adj_tempo ? nodeL.label : nodeW.label;
    callout = `<div class="sb-callout">⚡ Pace mismatch — ${faster} plays fast, ${slower} prefers a slower game. Tempo battle may decide this.</div>`;
  }

  container.innerHTML = `
    <div class="sb-header">
      <div class="sb-title">STYLE COMPARISON</div>
    </div>
    ${rows.join('')}
    ${callout}
    <div class="sb-footer">Torvik 2025-26 · bars normalized to bracket field</div>
  `;
}

window.renderStyleBars = renderStyleBars;
