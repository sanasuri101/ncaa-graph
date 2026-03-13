/**
 * ai-panel.js — AI Scout panel
 *
 * Production fixes vs previous version:
 *   - systemPrompt() removed — server builds it query-scoped (api/ai.js)
 *   - Browser sends only {messages, userMsg} — no team data, no model name
 *   - torvik_stats.json fetched once globally via window.getTorvik() shared promise
 *   - AbortController on every AI fetch — 30s timeout
 *   - chatHistory trimmed by token estimate, not message count
 *   - Double-send guard via _chatInFlight flag
 *   - ESPN stats fetch has 10s timeout
 */

'use strict';

// ── Token budget ──────────────────────────────────────────────────────────────
// window.getTorvik() is defined in app.js (loads first) — do not redefine here.
const CHARS_PER_TOK   = 4;
const MAX_HISTORY_TOK = 6000;

function estTokens(text) {
  return Math.ceil((typeof text === 'string' ? text : JSON.stringify(text ?? '')).length / CHARS_PER_TOK);
}

function trimHistory(messages) {
  let used = 0;
  const out = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const t = estTokens(messages[i].content);
    if (used + t > MAX_HISTORY_TOK) break;
    out.unshift(messages[i]);
    used += t;
  }
  return out;
}

// ── Panel open/close ──────────────────────────────────────────────────────────
function toggleAIPanel() {
  const panel  = document.getElementById('ai-panel');
  const btn    = document.getElementById('ai-toggle');
  const isOpen = panel.classList.toggle('open');
  btn.classList.toggle('active', isOpen);
  if (isOpen && document.getElementById('stats-team-select').options.length === 1) {
    populateTeamSelect();
  }
}

function populateTeamSelect() {
  const sel = document.getElementById('stats-team-select');
  if (!sel) return;
  if (!ALL_NODES || ALL_NODES.length === 0) {
    sel.innerHTML = '<option value="">Loading teams...</option>';
    setTimeout(populateTeamSelect, 500);
    return;
  }
  const sorted = [...ALL_NODES].sort((a, b) => a.full_name.localeCompare(b.full_name));
  sel.innerHTML = '<option value="">Select a team...</option>';
  sorted.forEach(n => {
    const opt = document.createElement('option');
    opt.value = n.id;
    const seedLabel = n.seed != null ? `#${n.seed}` : 'bubble';
    opt.textContent = `${n.full_name} (${n.region} ${seedLabel})`;
    sel.appendChild(opt);
  });
}

// ── Mode switching ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('ai-toggle').addEventListener('click', toggleAIPanel);

  document.querySelectorAll('.ai-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      document.querySelectorAll('.ai-tab').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
      document.querySelectorAll('.ai-mode-content').forEach(el => el.classList.toggle('active', el.id === `panel-${mode}`));
    });
  });

  document.getElementById('stats-team-select').addEventListener('change', () => {
    if (document.getElementById('stats-team-select').value) fetchTeamStats();
  });

  document.getElementById('chat-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
  });

  document.getElementById('ai-key-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') submitKey();
    if (e.key === 'Escape') closeKeyDrawer();
  });

  document.getElementById('chat-messages').innerHTML =
    '<div class="chat-empty">Ask anything about the bracket —<br>matchups, stats, trends, predictions.</div>';

  updateKeyStatus();
});

// ── API key management ────────────────────────────────────────────────────────
function getApiKey()     { return localStorage.getItem('ANTHROPIC_KEY') || ''; }
function saveApiKey(key) {
  if (key && key.trim().startsWith('sk-')) { localStorage.setItem('ANTHROPIC_KEY', key.trim()); return true; }
  return false;
}
function clearApiKey()   { localStorage.removeItem('ANTHROPIC_KEY'); }

// ── Settings drawer ───────────────────────────────────────────────────────────
function toggleKeyDrawer() {
  const drawer = document.getElementById('ai-key-drawer');
  drawer.classList.toggle('open');
  if (drawer.classList.contains('open')) setTimeout(() => document.getElementById('ai-key-input').focus(), 100);
}
function openKeyDrawer()  { document.getElementById('ai-key-drawer').classList.add('open'); }
function closeKeyDrawer() { document.getElementById('ai-key-drawer').classList.remove('open'); }

function submitKey() {
  const val = document.getElementById('ai-key-input').value.trim();
  const msg = document.getElementById('ai-key-msg');
  if (!val.startsWith('sk-')) {
    msg.textContent = 'Key should start with sk-ant- — check and try again.';
    msg.style.color = 'var(--midwest)';
    return;
  }
  saveApiKey(val);
  msg.textContent = 'Key saved — stored only in your browser, never sent anywhere else.';
  msg.style.color = 'var(--west)';
  document.getElementById('ai-key-input').value = '';
  updateKeyStatus();
  setTimeout(closeKeyDrawer, 1200);
}

function updateKeyStatus() {
  const has   = !!getApiKey();
  const btn   = document.getElementById('ai-key-btn');
  const label = document.getElementById('ai-key-label');
  if (btn)   btn.classList.toggle('has-key', has);
  if (label) label.textContent = has ? 'Key set ✓' : 'Add key';
}

// ── ESPN + Torvik Stats (no AI key needed) ────────────────────────────────────
async function fetchTeamStats() {
  const sel    = document.getElementById('stats-team-select');
  const teamId = sel.value;
  if (!teamId) return;

  const btn    = document.getElementById('stats-fetch-btn');
  const output = document.getElementById('stats-output');
  const node   = ALL_NODES.find(n => n.id === teamId);

  btn.disabled = true;
  output.innerHTML = loadingHTML('Fetching ESPN + Torvik stats...');

  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);

  try {
    const [espnRes, tData] = await Promise.all([
      fetch(
        `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${teamId}/statistics`,
        { signal: ctrl.signal }
      ),
      window.getTorvik(),
    ]);
    clearTimeout(timer);

    const espnData = await espnRes.json();
    const cats     = espnData?.results?.stats?.categories ?? [];
    const statsMap = {};
    cats.forEach(cat => { cat.stats.forEach(s => { statsMap[`${cat.name}:${s.name}`] = s; }); });
    const get = (cat, name) => statsMap[`${cat}:${name}`]?.displayValue ?? '—';
    const pct = (cat, name) => { const v = get(cat, name); return v === '—' ? '—' : v + '%'; };

    let record = `${node.wins_vs_field}W vs bracket field`;
    try {
      const ctrl2 = new AbortController();
      setTimeout(() => ctrl2.abort(), 5000);
      const tr = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${teamId}`,
        { signal: ctrl2.signal }
      );
      const td = await tr.json();
      record   = td?.team?.record?.items?.[0]?.summary ?? record;
    } catch (_) {}

    const tv  = tData?.teams?.[teamId]?.torvik ?? null;
    const rgbMap = { East: '#4a7fb5', West: '#3a8c6e', South: '#b89030', Midwest: '#b84545' };
    const rc  = rgbMap[node.region] ?? '#b0a898';

    const tBlock = tv ? `
      <div class="stats-section-label">TORVIK T-RANK</div>
      <div class="stats-grid-2">
        <div class="stat-cell torvik-cell"><div class="sv torvik-rank">#${tv.rank}</div><div class="sl">T-Rank</div></div>
        <div class="stat-cell torvik-cell"><div class="sv" style="color:var(--accent)">${tv.adj_em > 0 ? '+' : ''}${tv.adj_em}</div><div class="sl">AdjEM</div></div>
        <div class="stat-cell torvik-cell"><div class="sv" style="color:var(--west)">${tv.adj_oe}</div><div class="sl">AdjOE</div></div>
        <div class="stat-cell torvik-cell"><div class="sv" style="color:var(--midwest)">${tv.adj_de}</div><div class="sl">AdjDE</div></div>
        <div class="stat-cell torvik-cell"><div class="sv">${(tv.barthag * 100).toFixed(1)}%</div><div class="sl">Barthag</div></div>
        <div class="stat-cell torvik-cell"><div class="sv">${tv.wab > 0 ? '+' : ''}${parseFloat(tv.wab).toFixed(1)}</div><div class="sl">WAB</div></div>
        <div class="stat-cell torvik-cell"><div class="sv">${tv.adj_tempo != null ? (tv.adj_tempo >= 0.8 ? 'Fast' : tv.adj_tempo >= 0.6 ? 'Mod.' : 'Slow') + ' (' + tv.adj_tempo.toFixed(2) + ')' : '—'}</div><div class="sl">Pace</div></div>
        <div class="stat-cell torvik-cell"><div class="sv">${tv.luck > 0 ? '+' : ''}${parseFloat(tv.luck).toFixed(3)}</div><div class="sl">Luck</div></div>
        <div class="stat-cell torvik-cell"><div class="sv">${tv.two_p != null ? tv.two_p + '%' : '—'}</div><div class="sl">2P%</div></div>
        <div class="stat-cell torvik-cell"><div class="sv">${tv.three_p != null ? tv.three_p + '%' : '—'}</div><div class="sl">3P%</div></div>
        <div class="stat-cell torvik-cell"><div class="sv">${tv.ft_pct != null ? tv.ft_pct + '%' : '—'}</div><div class="sl">FT%</div></div>
        <div class="stat-cell torvik-cell"><div class="sv">${tv.efg != null ? tv.efg + '%' : '—'}</div><div class="sl">eFG%</div></div>
      </div>` : `<div class="torvik-missing">Torvik data unavailable for this team</div>`;

    output.innerHTML = `
      <div class="stats-card">
        <div class="stats-card-name" style="border-left:3px solid ${rc};padding-left:8px">${node.full_name}</div>
        <div class="stats-card-sub">${node.region} · Seed #${node.seed} · ${record}</div>
        <div class="stats-section-label">ESPN BOX STATS</div>
        <div class="stats-grid-2">
          <div class="stat-cell"><div class="sv">${get('offensive','avgPoints')}</div><div class="sl">PPG</div></div>
          <div class="stat-cell"><div class="sv">${get('general','avgRebounds')}</div><div class="sl">RPG</div></div>
          <div class="stat-cell"><div class="sv">${get('offensive','avgAssists')}</div><div class="sl">APG</div></div>
          <div class="stat-cell"><div class="sv">${get('offensive','avgTurnovers')}</div><div class="sl">TOPG</div></div>
          <div class="stat-cell"><div class="sv">${pct('offensive','fieldGoalPct')}</div><div class="sl">FG%</div></div>
          <div class="stat-cell"><div class="sv">${pct('offensive','threePointFieldGoalPct')}</div><div class="sl">3P%</div></div>
          <div class="stat-cell"><div class="sv">${pct('offensive','twoPointFieldGoalPct')}</div><div class="sl">2P%</div></div>
          <div class="stat-cell"><div class="sv">${pct('offensive','freeThrowPct')}</div><div class="sl">FT%</div></div>
          <div class="stat-cell"><div class="sv">${get('general','assistTurnoverRatio')}</div><div class="sl">AST/TO</div></div>
          <div class="stat-cell"><div class="sv">${get('defensive','avgSteals')}</div><div class="sl">SPG</div></div>
          <div class="stat-cell"><div class="sv">${get('defensive','avgBlocks')}</div><div class="sl">BPG</div></div>
          <div class="stat-cell"><div class="sv">${get('offensive','avgThreePointFieldGoalsMade')} / ${get('offensive','avgThreePointFieldGoalsAttempted')}</div><div class="sl">3PM/A</div></div>
        </div>
        ${tBlock}
      </div>
      <div style="font-size:.62rem;color:var(--text-mute);margin-top:4px;line-height:1.5">
        ESPN: 2025-26 season totals${tv ? ` · Torvik updated ${tData?.generated_at?.slice(0,10) ?? 'recently'}` : ''}
      </div>
    `;
  } catch (err) {
    clearTimeout(timer);
    output.innerHTML = `<div class="ai-error">Failed to load stats: ${err.name === 'AbortError' ? 'Request timed out' : err.message}</div>`;
  } finally {
    btn.disabled = false;
  }
}

// ── News / article summarizer ─────────────────────────────────────────────────
async function fetchNewsArticle() {
  const url = document.getElementById('news-url').value.trim();
  if (!url) return;
  if (!url.startsWith('http')) {
    document.getElementById('news-output').innerHTML = '<div class="ai-error">Please enter a full URL starting with http/https.</div>';
    return;
  }
  await runNewsAI(`Read this article and give me a concise summary with the key takeaways relevant to March Madness bracket analysis: ${url}`);
}

async function fetchNewsSearch(query) {
  await runNewsAI(`Search for the latest news about: "${query}". Summarize the top findings in 3-5 bullet points focused on NCAA bracket decisions.`);
}

async function runNewsAI(prompt) {
  const btn    = document.getElementById('news-fetch-btn');
  const output = document.getElementById('news-output');
  btn.disabled = true;
  output.innerHTML = loadingHTML('Reading article...');
  try {
    const text = await callAI([{ role: 'user', content: prompt }], prompt);
    output.innerHTML = `<div class="ai-text-block">${renderMarkdown(text)}</div>`;
  } catch (err) {
    output.innerHTML = `<div class="ai-error">${escapeHtml(err.message)}</div>`;
  } finally {
    btn.disabled = false;
  }
}

// ── Chat ──────────────────────────────────────────────────────────────────────
const chatHistory = [];
let _chatInFlight = false;

async function sendChat() {
  if (_chatInFlight) return;

  const textarea = document.getElementById('chat-input');
  const msg      = textarea.value.trim();
  if (!msg) return;

  _chatInFlight = true;
  textarea.value = '';
  textarea.style.height = '';

  const messagesEl = document.getElementById('chat-messages');
  messagesEl.querySelectorAll('.chat-empty').forEach(el => el.remove());

  const userBubble = document.createElement('div');
  userBubble.className = 'chat-bubble-user';
  userBubble.textContent = msg;
  messagesEl.appendChild(userBubble);

  const thinkEl = document.createElement('div');
  thinkEl.className = 'chat-bubble-ai';
  thinkEl.innerHTML = `<div class="chat-bubble-ai-body">${loadingHTML('Thinking...')}</div>`;
  messagesEl.appendChild(thinkEl);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  document.getElementById('chat-send-btn').disabled = true;

  chatHistory.push({ role: 'user', content: msg });

  // Trim by token budget before sending — sync chatHistory to what we actually send
  const trimmed = trimHistory(chatHistory);
  if (trimmed.length < chatHistory.length) {
    chatHistory.splice(0, chatHistory.length - trimmed.length);
    const notice = document.createElement('div');
    notice.className = 'chat-context-notice';
    notice.textContent = 'Earlier messages trimmed to stay within context limit';
    messagesEl.insertBefore(notice, userBubble);
  }

  try {
    const reply = await callAI(chatHistory, msg);
    chatHistory.push({ role: 'assistant', content: reply });
    thinkEl.innerHTML = `
      <div class="chat-bubble-ai-label">Scout</div>
      <div class="chat-bubble-ai-body">${renderMarkdown(reply)}</div>`;
  } catch (err) {
    chatHistory.pop();
    thinkEl.innerHTML = `<div class="ai-error">${escapeHtml(err.message)}</div>`;
  } finally {
    document.getElementById('chat-send-btn').disabled = false;
    _chatInFlight = false;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
}

function insertHint(text) {
  document.getElementById('chat-input').value = text;
  document.getElementById('chat-input').focus();
}

// ── Core AI call — server owns system prompt and model ────────────────────────
// Sends only { messages, userMsg } — no team data, no games, no model name.
// api/ai.js builds the query-scoped system prompt server-side.
const WORKER_URL    = '/api/ai';
const FETCH_TIMEOUT = 30000;

async function callAI(messages, userMsg) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(WORKER_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ messages, userMsg }),
      signal:  ctrl.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message ?? `API error ${res.status}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error(data.error?.message ?? 'No response from model');
    return text;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('Request timed out after 30s — try again');
    throw err;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function loadingHTML(label) {
  return `<div class="ai-loading">
    <div class="dot-flash"><span></span><span></span><span></span></div>
    ${escapeHtml(label)}
  </div>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderMarkdown(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^(\d+)\. (.+)$/gm, '<div class="md-li md-oli"><span class="md-ln">$1.</span>$2</div>')
    .replace(/^[-•] (.+)$/gm, '<div class="md-li"><span class="md-dot">·</span>$1</div>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');
}
