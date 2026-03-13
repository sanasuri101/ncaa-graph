/**
 * ai-panel.js — AI Scout panel
 *
 * Three modes:
 *   Stats  — fetches ESPN team statistics (no AI key required)
 *   News   — paste any article URL or use preset searches; AI reads + summarizes
 *   Chat   — free-form conversation with context about the graph/bracket
 *
 * News + Chat use the Anthropic API via claude-sonnet-4-20250514 with web_search.
 * The API key is read from localStorage key "ANTHROPIC_KEY". On first use, the
 * panel prompts the user to enter it. The key is stored only in their browser.
 */

'use strict';

// ── Panel open/close ─────────────────────────────────────────────────────────
function toggleAIPanel() {
  const panel  = document.getElementById('ai-panel');
  const btn    = document.getElementById('ai-toggle');
  const isOpen = panel.classList.toggle('open');
  btn.classList.toggle('active', isOpen);

  // On first open, populate the team select with sorted bracket teams
  if (isOpen && document.getElementById('stats-team-select').options.length === 1) {
    populateTeamSelect();
  }
}

function populateTeamSelect() {
  const sel = document.getElementById('stats-team-select');
  if (!sel) return;

  // If data not loaded yet, retry after a short wait
  if (!ALL_NODES || ALL_NODES.length === 0) {
    sel.innerHTML = '<option value="">Loading teams...</option>';
    setTimeout(populateTeamSelect, 500);
    return;
  }

  const sorted = [...ALL_NODES].sort((a, b) => a.full_name.localeCompare(b.full_name));
  sel.innerHTML = '<option value="">Select a team...</option>';
  sorted.forEach(n => {
    const opt = document.createElement('option');
    opt.value       = n.id;
    opt.textContent = `${n.full_name} (${n.region}, #${n.seed})`;
    sel.appendChild(opt);
  });
}

// ── Mode switching ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('ai-toggle').addEventListener('click', toggleAIPanel);

  // New segmented tab row
  document.querySelectorAll('.ai-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      document.querySelectorAll('.ai-tab').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
      document.querySelectorAll('.ai-mode-content').forEach(el => el.classList.toggle('active', el.id === `panel-${mode}`));
    });
  });

  // Auto-fetch stats when team is selected
  document.getElementById('stats-team-select').addEventListener('change', () => {
    const sel = document.getElementById('stats-team-select');
    if (sel.value) fetchTeamStats();
  });
  document.getElementById('chat-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
  });

  // Key drawer: submit on Enter
  document.getElementById('ai-key-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') submitKey();
    if (e.key === 'Escape') closeKeyDrawer();
  });

  // Show empty state in chat
  document.getElementById('chat-messages').innerHTML =
    '<div class="chat-empty">Ask anything about the bracket —<br>matchups, stats, trends, predictions.</div>';

  updateKeyStatus();
});

// ── API key management ───────────────────────────────────────────────────────
function getApiKey() {
  return localStorage.getItem('ANTHROPIC_KEY') || '';
}

function saveApiKey(key) {
  if (key && key.trim().startsWith('sk-')) {
    localStorage.setItem('ANTHROPIC_KEY', key.trim());
    return true;
  }
  return false;
}

function clearApiKey() {
  localStorage.removeItem('ANTHROPIC_KEY');
}

function requireKey() {
  const k = getApiKey();
  if (k) return k;
  // Show the settings drawer instead of a browser prompt
  openKeyDrawer();
  return null;
}

// ── Settings drawer ──────────────────────────────────────────────────────────
function toggleKeyDrawer() {
  const drawer = document.getElementById('ai-key-drawer');
  drawer.classList.toggle('open');
  if (drawer.classList.contains('open')) {
    setTimeout(() => document.getElementById('ai-key-input').focus(), 100);
  }
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

// ── ESPN + Torvik Stats fetcher (no API key needed) ──────────────────────────
let TORVIK_DATA = null;

async function loadTorvik() {
  if (TORVIK_DATA) return TORVIK_DATA;
  TORVIK_DATA = await window.getTorvik();
  return TORVIK_DATA;
}

async function fetchTeamStats() {
  const sel    = document.getElementById('stats-team-select');
  const teamId = sel.value;
  if (!teamId) return;

  const btn    = document.getElementById('stats-fetch-btn');
  const output = document.getElementById('stats-output');
  const node   = ALL_NODES.find(n => n.id === teamId);

  btn.disabled = true;
  output.innerHTML = loadingHTML('Fetching ESPN + Torvik stats...');

  try {
    // Parallel fetch: ESPN stats + Torvik data
    const [espnRes, tData] = await Promise.all([
      fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${teamId}/statistics`),
      loadTorvik(),
    ]);

    const espnData = await espnRes.json();
    const cats     = espnData?.results?.stats?.categories ?? [];

    const statsMap = {};
    cats.forEach(cat => {
      cat.stats.forEach(s => { statsMap[`${cat.name}:${s.name}`] = s; });
    });
    const get = (cat, name) => statsMap[`${cat}:${name}`]?.displayValue ?? '—';

    const pct = (cat, name) => {
      const v = get(cat, name);
      return v === '—' ? '—' : v + '%';
    };

    // Fetch season record
    let record = `${node.wins_vs_field}W vs bracket field`;
    try {
      const tr = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${teamId}`);
      const td = await tr.json();
      record   = td?.team?.record?.items?.[0]?.summary ?? record;
    } catch (_) {}

    const tv     = tData?.teams?.[teamId]?.torvik ?? null;
    const rgbMap = { East: '#4a7fb5', West: '#3a8c6e', South: '#b89030', Midwest: '#b84545' };
    const rc     = rgbMap[node.region] ?? '#b0a898';

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
    output.innerHTML = `<div class="ai-error">Failed to load stats: ${err.message}</div>`;
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
  await runNewsAI(`Read this article and give me a concise summary with the key takeaways that are relevant to March Madness bracket analysis: ${url}`);
}

async function fetchNewsSearch(query) {
  await runNewsAI(`Search the web for the latest news about: "${query}". Summarize the top findings in 3-5 bullet points. Focus on information useful for NCAA bracket decisions.`);
}

async function runNewsAI(prompt) {
  const key = WORKER_URL;

  const btn    = document.getElementById('news-fetch-btn');
  const output = document.getElementById('news-output');
  btn.disabled = true;
  output.innerHTML = loadingHTML('Reading article...');

  try {
    const text = await callClaude(key, prompt, {
      system: systemPrompt(prompt),
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    });
    output.innerHTML = `<div class="ai-text-block">${renderMarkdown(text)}</div>`;
  } catch (err) {
    output.innerHTML = `<div class="ai-error">${escapeHtml(err.message)}</div>`;
  } finally {
    btn.disabled = false;
  }
}

// ── Chat ─────────────────────────────────────────────────────────────────────
const chatHistory = [];

async function sendChat() {
  const textarea = document.getElementById('chat-input');
  const msg      = textarea.value.trim();
  if (!msg) return;

  const key = WORKER_URL;

  textarea.value = '';
  textarea.style.height = '';

  const messagesEl = document.getElementById('chat-messages');

  // Remove empty state
  messagesEl.querySelectorAll('.chat-empty').forEach(el => el.remove());

  // User bubble — use DOM append, not innerHTML +=
  const userBubble = document.createElement('div');
  userBubble.className = 'chat-bubble-user';
  userBubble.textContent = msg;
  messagesEl.appendChild(userBubble);

  // Thinking indicator
  const thinkEl = document.createElement('div');
  thinkEl.className = 'chat-bubble-ai';
  thinkEl.innerHTML = `<div class="chat-bubble-ai-body">${loadingHTML('Thinking...')}</div>`;
  messagesEl.appendChild(thinkEl);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  if (_inFlight) return; // prevent duplicate concurrent requests
  _inFlight = true;
  document.getElementById('chat-send-btn').disabled = true;

  chatHistory.push({ role: 'user', content: msg });
  // History length is managed server-side by token budget — keep last 30 messages locally
  // as a soft cap so localStorage doesn't grow unbounded across very long sessions
  if (chatHistory.length > 30) chatHistory.splice(0, chatHistory.length - 30);

  try {
    const reply = await callClaude(null, null, {
      messages: chatHistory,
      userMsg:  msg,
    });

    chatHistory.push({ role: 'assistant', content: reply });

    thinkEl.innerHTML = `
      <div class="chat-bubble-ai-label">Scout</div>
      <div class="chat-bubble-ai-body">${renderMarkdown(reply)}</div>`;
  } catch (err) {
    // Roll back the user message so history stays alternating user/assistant
    // Without this, next send would create two consecutive user messages → API 400
    chatHistory.pop();
    thinkEl.innerHTML = `<div class="ai-error">${escapeHtml(err.message)}</div>`;
  } finally {
    document.getElementById('chat-send-btn').disabled = false;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
}

function insertHint(text) {
  const ta = document.getElementById('chat-input');
  ta.value = text;
  ta.focus();
}

// ── API call ─────────────────────────────────────────────────────────────────
const WORKER_URL = '/api/ai';

// In-flight guard — prevents duplicate concurrent requests from rapid sends
let _inFlight = false;

async function callClaude(_unusedKey, singlePrompt, opts = {}) {
  // Server now builds system prompt — just send messages + last user message
  const messages = opts.messages ?? [{ role: 'user', content: singlePrompt }];
  const userMsg  = opts.userMsg ?? singlePrompt ?? '';

  const res = await fetch(WORKER_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ messages, userMsg }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `API error ${res.status}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    const errMsg = data.error?.message ?? JSON.stringify(data);
    throw new Error(`No response from model: ${errMsg}`);
  }
  return text;
}

// ── System prompt with graph context ─────────────────────────────────────────
function systemPrompt(userMsg) {
  // Compact team lines — all 91 teams, tight format
  const teamLines = ALL_NODES.map(n => {
    const tv = TORVIK_DATA?.teams?.[n.id]?.torvik;
    const seedLabel = n.seed != null ? `#${n.seed}` : 'bubble';
    const rec = `${n.wins_vs_field}W-${n.losses_vs_field}L`;
    const torvik = tv
      ? `Rk${tv.rank} OE${tv.adj_oe} DE${tv.adj_de} EM${tv.adj_em > 0 ? '+' : ''}${tv.adj_em} Bg${(tv.barthag*100).toFixed(1)}%`
      : 'no-torvik';
    return `${n.full_name} (${n.region} ${seedLabel}) ${rec} | ${torvik}`;
  }).join('\n');

  // Smart game selection — if user mentions specific teams, only include their games
  // Otherwise cap at 200 most recent games to stay under token limit
  let relevantEdges = ALL_EDGES;
  if (userMsg) {
    const msgLower = userMsg.toLowerCase();
    const mentionedIds = new Set(
      ALL_NODES.filter(n =>
        msgLower.includes(n.label.toLowerCase()) ||
        msgLower.includes(n.full_name.toLowerCase().split(' ')[0])
      ).map(n => n.id)
    );
    if (mentionedIds.size > 0) {
      relevantEdges = ALL_EDGES.filter(e => mentionedIds.has(e.from) || mentionedIds.has(e.to));
    } else {
      // No specific teams — send 200 most recent
      relevantEdges = ALL_EDGES.slice(-200);
    }
  }

  const gameLines = relevantEdges.map(e => {
    const w = ALL_NODES.find(n => n.id === e.from)?.label ?? e.from;
    const l = ALL_NODES.find(n => n.id === e.to)?.label ?? e.to;
    return `${w}>${l} ${e.label} ${e.date ? e.date.slice(5,10) : ''}`;
  }).join('\n');

  return `You are AI Scout, an expert NCAA basketball analyst for the 2026 March Madness bracket.
CRITICAL: Only use the stats below. Never invent numbers.

TEAMS (name | region seed | W-L vs field | Torvik: Rk=rank OE=AdjOE DE=AdjDE EM=AdjEM Bg=Barthag):
${teamLines}

GAMES (winner>loser score date, ${relevantEdges.length} shown):
${gameLines}

Be concise. Reference exact stats when asked.`;
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

// Render basic markdown — bold, bullets, numbered lists, newlines
function renderMarkdown(text) {
  return escapeHtml(text)
    // Bold **text**
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic *text*
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Numbered list lines: "1. foo"
    .replace(/^(\d+)\. (.+)$/gm, '<div class="md-li md-oli"><span class="md-ln">$1.</span>$2</div>')
    // Bullet list lines: "- foo" or "• foo"
    .replace(/^[-•] (.+)$/gm, '<div class="md-li"><span class="md-dot">·</span>$1</div>')
    // Newlines to <br> (but not after list items which already have block display)
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');
}
