/**
 * sparkline.js — Recent form sparkline for team detail panel
 *
 * Shows last 10 games as a W/L strip with:
 *   - Color-coded blocks (green=W, red=L)
 *   - Streak badge
 *   - Record label
 *   - Hover tooltip per game (score, opponent, date)
 *   - Trend line drawn over the blocks showing momentum
 *
 * Called from renderNodeDetail() in app.js when a team node is clicked.
 * Data loaded once and cached from public/data/recent_form.json.
 */

'use strict';

let FORM_DATA   = null;
// Recent form sparkline renderer

// ── Loader ────────────────────────────────────────────────────────────────────
async function loadFormData() {
  if (FORM_DATA) return FORM_DATA;
  try {
    const res = await fetch('data/recent_form.json');
    FORM_DATA = await res.json();
    return FORM_DATA;
  } catch (e) {
    console.warn('recent_form.json load failed:', e);
    return null;
  }
}

// ── Main entry — call this from the team detail panel ─────────────────────────
async function renderSparkline(teamId, containerEl) {
  const raw = await loadFormData();
  // Support both old format (flat dict) and new format ({generated_at, teams})
  const data = raw?.teams ?? raw;
  if (!data || !data[teamId]) {
    containerEl.innerHTML = '<div class="spark-unavail">Form data unavailable</div>';
    return;
  }

  const form   = data[teamId];
  const games  = form.games;           // [{date, won, score, opp, opp_id}]
  const last10 = form.last10;          // "9-1"
  const streak = form.streak;          // "W8"

  if (!games.length) {
    containerEl.innerHTML = '<div class="spark-unavail">No games on record</div>';
    return;
  }

  const streakClass = streak.startsWith('W') ? 'streak-w' : 'streak-l';
  const [w, l]      = last10.split('-').map(Number);
  const isHot       = w >= 8;
  const isCold      = l >= 4;
  const formClass   = isHot ? 'form-hot' : isCold ? 'form-cold' : '';

  containerEl.innerHTML = `
    <div class="spark-section-label">LAST ${games.length} GAMES</div>
    <div class="spark-row">
      <div class="spark-blocks" id="spark-blocks-${teamId}"></div>
      <div class="spark-meta">
        <div class="spark-record ${formClass}">${last10}</div>
        <div class="spark-streak ${streakClass}">${streak}</div>
      </div>
    </div>
    <div class="spark-trend-wrap">
      <canvas class="spark-trend-canvas" id="spark-trend-${teamId}" width="220" height="30"></canvas>
    </div>
    <div class="spark-game-detail" id="spark-game-detail-${teamId}">
      <span class="spark-hint">Hover a game block for details</span>
    </div>
  `;

  buildBlocks(teamId, games);
  drawTrendLine(teamId, games);
}

// ── W/L Blocks ────────────────────────────────────────────────────────────────
function buildBlocks(teamId, games) {
  const wrap = document.getElementById(`spark-blocks-${teamId}`);
  if (!wrap) return;

  games.forEach((g, i) => {
    const block = document.createElement('div');
    block.className = `spark-block ${g.won ? 'sb-win' : 'sb-loss'}`;
    block.title     = `${g.won ? 'W' : 'L'} ${g.score} vs ${g.opp} (${g.date})`;

    block.addEventListener('mouseenter', () => {
      showGameDetail(teamId, g);
      block.classList.add('sb-hover');
    });
    block.addEventListener('mouseleave', () => {
      clearGameDetail(teamId);
      block.classList.remove('sb-hover');
    });

    // Click: if opponent is in bracket, focus their node
    if (g.opp_id) {
      const oppNode = ALL_NODES?.find(n => n.id === g.opp_id);
      if (oppNode) {
        block.style.cursor = 'pointer';
        block.addEventListener('click', () => focusTeam(g.opp_id));
      }
    }

    wrap.appendChild(block);
  });
}

function showGameDetail(teamId, g) {
  const el = document.getElementById(`spark-game-detail-${teamId}`);
  if (!el) return;
  const oppNode = ALL_NODES?.find(n => n.id === g.opp_id);
  const oppLabel = oppNode ? oppNode.label : g.opp.replace(/ (Blue Devils|Wolverines|Gators|Cougars|Wildcats|Trojans|Cardinals|Bulldogs|Panthers|Tigers|Bears|Bruins|Ducks|Knights|Horned Frogs|Thunderbirds)$/, '');
  el.innerHTML = `
    <div class="spark-game-row">
      <span class="spark-wl ${g.won ? 'sig-win' : 'sig-loss'}">${g.won ? 'W' : 'L'}</span>
      <span class="spark-score">${g.score}</span>
      <span class="spark-opp">vs ${oppLabel}</span>
      <span class="spark-date">${formatShortDate(g.date)}</span>
    </div>
  `;
}

function clearGameDetail(teamId) {
  const el = document.getElementById(`spark-game-detail-${teamId}`);
  if (el) el.innerHTML = '<span class="spark-hint">Hover a game block for details</span>';
}

// ── Trend line — running win% over the game sequence ─────────────────────────
function drawTrendLine(teamId, games) {
  const canvas = document.getElementById(`spark-trend-${teamId}`);
  if (!canvas || games.length < 2) return;  // need at least 2 points for a line

  const ctx = canvas.getContext('2d');
  const W   = canvas.width;
  const H   = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Running win percentage at each game
  const pts = games.map((_, i) => {
    const slice = games.slice(0, i + 1);
    return slice.filter(g => g.won).length / slice.length;
  });

  const padX  = 4;
  const padY  = 4;
  // Guard: if only 1 point, stepX would be Infinity — render as single dot instead
  const stepX = pts.length > 1 ? (W - padX * 2) / (pts.length - 1) : 0;

  // Gradient under the line
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(52,211,153,.25)');
  grad.addColorStop(1, 'rgba(52,211,153,0)');

  ctx.beginPath();
  pts.forEach((p, i) => {
    const x = padX + i * stepX;
    const y = padY + (1 - p) * (H - padY * 2);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.lineTo(padX + (pts.length - 1) * stepX, H);
  ctx.lineTo(padX, H);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  pts.forEach((p, i) => {
    const x = padX + i * stepX;
    const y = padY + (1 - p) * (H - padY * 2);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#34d399';
  ctx.lineWidth   = 1.5;
  ctx.lineJoin    = 'round';
  ctx.stroke();

  // End dot
  const lastX = padX + (pts.length - 1) * stepX;
  const lastY = padY + (1 - pts[pts.length - 1]) * (H - padY * 2);
  ctx.beginPath();
  ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#34d399';
  ctx.fill();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatShortDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

window.renderSparkline = renderSparkline;
