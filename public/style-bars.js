/**
 * style-bars.js — Head-to-head style comparison
 * Pickle-aesthetic card design shown in the Detail tab when a game edge is clicked.
 */

'use strict';

let STYLE_TV_DATA = null;

async function loadStyleData() {
  if (STYLE_TV_DATA) return STYLE_TV_DATA;
  STYLE_TV_DATA = await window.getTorvik();
  return STYLE_TV_DATA;
}

async function renderStyleBars(nodeW, nodeL, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const tv = await loadStyleData();
  if (!tv) return;

  const tvW = tv.teams?.[nodeW.id]?.torvik;
  const tvL = tv.teams?.[nodeL.id]?.torvik;
  if (!tvW || !tvL) return;

  const rcW = REGION_COLORS[nodeW.region] ?? '#4a7fb5';
  const rcL = REGION_COLORS[nodeL.region] ?? '#b84545';

  const allTeams = Object.values(tv.teams).map(t => t.torvik).filter(Boolean);
  if (!allTeams.length) return; // no data to normalize against

  const metrics = [
    {
      label: 'Offense', sub: 'AdjOE',
      valW: tvW.adj_oe, valL: tvL.adj_oe,
      min: Math.min(...allTeams.map(t => t.adj_oe)),
      max: Math.max(...allTeams.map(t => t.adj_oe)),
      better: 'higher', fmt: v => v.toFixed(1),
    },
    {
      label: 'Defense', sub: 'AdjDE',
      valW: tvW.adj_de, valL: tvL.adj_de,
      min: Math.min(...allTeams.map(t => t.adj_de)),
      max: Math.max(...allTeams.map(t => t.adj_de)),
      better: 'lower', fmt: v => v.toFixed(1),
    },
    {
      label: 'Pace', sub: 'adj_tempo',
      valW: tvW.adj_tempo ?? 0.5, valL: tvL.adj_tempo ?? 0.5,
      min: 0, max: 1, better: 'neutral',
      fmt: v => v >= 0.8 ? 'Fast' : v >= 0.6 ? 'Mod.' : 'Slow',
    },
    {
      label: 'Luck', sub: 'Torvik luck',
      valW: tvW.luck ?? 0, valL: tvL.luck ?? 0,
      min: Math.min(...allTeams.map(t => t.luck ?? 0)),
      max: Math.max(...allTeams.map(t => t.luck ?? 0)),
      better: 'neutral', fmt: v => (v >= 0 ? '+' : '') + v.toFixed(3),
    },
    {
      label: 'Schedule', sub: 'Opp. quality',
      valW: tvW.sos_rank ?? 0, valL: tvL.sos_rank ?? 0,
      min: Math.min(...allTeams.map(t => t.sos_rank ?? 0)),
      max: Math.max(...allTeams.map(t => t.sos_rank ?? 0)),
      better: 'higher', fmt: v => v.toFixed(3),
    },
  ];

  const norm = (v, min, max, lowerBetter) => {
    const t = (max - min) > 0 ? (v - min) / (max - min) : 0.5;
    return lowerBetter ? 1 - t : t;
  };

  const rows = metrics.map(m => {
    const nW = norm(m.valW, m.min, m.max, m.better === 'lower');
    const nL = norm(m.valL, m.min, m.max, m.better === 'lower');
    const edge = m.better === 'neutral' ? 0
               : m.better === 'higher'  ? m.valW - m.valL
               : m.valL - m.valW;
    const wWins = edge > 0.005;
    const lWins = edge < -0.005;

    return `
      <div class="sb2-row">
        <div class="sb2-meta">
          <span class="sb2-label">${m.label}</span>
          <span class="sb2-sub">${m.sub}</span>
        </div>
        <div class="sb2-bars">
          <div class="sb2-team-row">
            <span class="sb2-team-name" style="color:${rcW}">${nodeW.label}</span>
            <div class="sb2-track">
              <div class="sb2-fill" style="width:${(nW*100).toFixed(0)}%;background:${rcW};opacity:${wWins?0.85:0.28}"></div>
            </div>
            <span class="sb2-val ${wWins?'sb2-winner':''}">${m.fmt(m.valW)}</span>
          </div>
          <div class="sb2-team-row">
            <span class="sb2-team-name" style="color:${rcL}">${nodeL.label}</span>
            <div class="sb2-track">
              <div class="sb2-fill" style="width:${(nL*100).toFixed(0)}%;background:${rcL};opacity:${lWins?0.85:0.28}"></div>
            </div>
            <span class="sb2-val ${lWins?'sb2-winner':''}">${m.fmt(m.valL)}</span>
          </div>
        </div>
      </div>`;
  });

  const paceDiff   = Math.abs((tvW.adj_tempo??0.5) - (tvL.adj_tempo??0.5));
  const adjEmDiff  = Math.abs(tvW.adj_em - tvL.adj_em);
  let callouts = [];
  if (paceDiff > 0.2) {
    const faster = (tvW.adj_tempo??0.5) > (tvL.adj_tempo??0.5) ? nodeW.label : nodeL.label;
    const slower = faster === nodeW.label ? nodeL.label : nodeW.label;
    callouts.push(`<div class="sb2-callout"><span class="sb2-ci">⚡</span><span>Pace mismatch — ${faster} plays fast, ${slower} prefers slower. Tempo will matter.</span></div>`);
  }
  if (adjEmDiff > 15) {
    const stronger = tvW.adj_em > tvL.adj_em ? nodeW.label : nodeL.label;
    callouts.push(`<div class="sb2-callout"><span class="sb2-ci">△</span><span>Large efficiency gap — ${stronger} is significantly stronger on paper.</span></div>`);
  }

  container.innerHTML = `
    <div class="sb2-wrap">
      <div class="sb2-header">
        <span class="sb2-title">Style Comparison</span>
        <span class="sb2-source">Torvik 2025-26</span>
      </div>
      <div class="sb2-body">${rows.join('')}</div>
      ${callouts.length ? `<div class="sb2-callouts">${callouts.join('')}</div>` : ''}
    </div>`;
}

window.renderStyleBars = renderStyleBars;
