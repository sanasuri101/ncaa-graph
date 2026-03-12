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
  const sorted = [...ALL_NODES].sort((a, b) => a.full_name.localeCompare(b.full_name));
  sorted.forEach(n => {
    const opt = document.createElement('option');
    opt.value  = n.id;       // ESPN team ID
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

  // Chat: send on Enter (Shift+Enter = newline)
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
  try {
    const res = await fetch('data/torvik_stats.json');
    if (!res.ok) return null;
    TORVIK_DATA = await res.json();
    return TORVIK_DATA;
  } catch (_) { return null; }
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
        <div class="stat-cell torvik-cell"><div class="sv">${tv.adj_tempo ?? '—'}</div><div class="sl">Tempo Rk</div></div>
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
          <div class="stat-cell"><div class="sv">${get('offensive','fieldGoalPct')}%</div><div class="sl">FG%</div></div>
          <div class="stat-cell"><div class="sv">${get('offensive','threePointFieldGoalPct')}%</div><div class="sl">3P%</div></div>
          <div class="stat-cell"><div class="sv">${get('offensive','twoPointFieldGoalPct')}%</div><div class="sl">2P%</div></div>
          <div class="stat-cell"><div class="sv">${get('offensive','freeThrowPct')}%</div><div class="sl">FT%</div></div>
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
  const key = requireKey();
  if (!key) return;

  const btn    = document.getElementById('news-fetch-btn');
  const output = document.getElementById('news-output');
  btn.disabled = true;
  output.innerHTML = loadingHTML('Reading article...');

  try {
    const text = await callClaude(key, prompt, {
      system: systemPrompt(),
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    });
    output.innerHTML = `<div class="ai-text-block">${escapeHtml(text)}</div>`;
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

  const key = requireKey();
  if (!key) return;

  textarea.value = '';
  textarea.style.height = '';

  const messagesEl = document.getElementById('chat-messages');

  // Remove empty state
  messagesEl.querySelectorAll('.chat-empty').forEach(el => el.remove());

  // User bubble
  messagesEl.innerHTML += `<div class="chat-bubble-user">${escapeHtml(msg)}</div>`;

  // Thinking indicator
  const thinkId = 'think_' + Date.now();
  messagesEl.innerHTML += `<div class="chat-bubble-ai" id="${thinkId}"><div class="chat-bubble-ai-body">${loadingHTML('Thinking...')}</div></div>`;
  messagesEl.scrollTop = messagesEl.scrollHeight;

  document.getElementById('chat-send-btn').disabled = true;

  chatHistory.push({ role: 'user', content: msg });

  try {
    const reply = await callClaude(key, null, {
      system: systemPrompt(),
      messages: chatHistory,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    });

    chatHistory.push({ role: 'assistant', content: reply });

    document.getElementById(thinkId).outerHTML =
      `<div class="chat-bubble-ai">
         <div class="chat-bubble-ai-label">Scout</div>
         <div class="chat-bubble-ai-body">${escapeHtml(reply)}</div>
       </div>`;
  } catch (err) {
    document.getElementById(thinkId).outerHTML =
      `<div class="chat-msg assistant"><div class="ai-error">${escapeHtml(err.message)}</div></div>`;
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

// ── Anthropic API call ────────────────────────────────────────────────────────
async function callClaude(apiKey, singlePrompt, opts = {}) {
  const messages = opts.messages ?? [{ role: 'user', content: singlePrompt }];

  const body = {
    model:      'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system:     opts.system ?? systemPrompt(),
    messages,
  };

  if (opts.tools) body.tools = opts.tools;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error('Invalid API key. Click AI Scout again to re-enter.');
    throw new Error(err?.error?.message ?? `API error ${res.status}`);
  }

  const data = await res.json();

  // Collect all text blocks (tool_use blocks are skipped)
  const text = data.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n')
    .trim();

  return text || '(No response)';
}

// ── System prompt with graph context ─────────────────────────────────────────
function systemPrompt() {
  // Build a concise summary of the current graph state to give Claude context
  const topWins = [...ALL_NODES]
    .sort((a, b) => b.wins_vs_field - a.wins_vs_field)
    .slice(0, 5)
    .map(n => `${n.label} (${n.wins_vs_field}W-${n.losses_vs_field}L, ${n.region}, seed ${n.seed})`)
    .join(', ');

  const regions = ['East', 'West', 'South', 'Midwest'];
  const regionSummary = regions.map(r => {
    const rNodes = ALL_NODES.filter(n => n.region === r);
    const rEdges = ALL_EDGES.filter(e => e.same_region && e.winner_region === r);
    return `${r}: ${rNodes.length} teams, ${rEdges.length} intra-region games`;
  }).join(' | ');

  // Pull top Torvik teams if data is loaded
  let torvik_context = '';
  if (TORVIK_DATA?.teams) {
    const tv_ranked = Object.values(TORVIK_DATA.teams)
      .filter(t => t.torvik)
      .sort((a, b) => a.torvik.rank - b.torvik.rank)
      .slice(0, 5)
      .map(t => `${t.bracket_name} (T-Rank #${t.torvik.rank}, AdjEM=${t.torvik.adj_em > 0 ? '+' : ''}${t.torvik.adj_em}, barthag=${(t.torvik.barthag*100).toFixed(1)}%)`)
      .join(', ');
    torvik_context = `\n- Torvik T-Rank top 5: ${tv_ranked}`;
  }

  return `You are AI Scout, an expert NCAA college basketball analyst embedded in an interactive head-to-head graph of the 2026 March Madness bracket.

GRAPH DATA CONTEXT:
- 64 bracket teams, 264 inter-bracket regular season games, 1,782 pairs that never played
- Top teams by wins vs bracket field: ${topWins}
- ${regionSummary}${torvik_context}
- Season: 2025-26

Key stats available per team: ESPN box stats (PPG, RPG, FG%, etc.) and Torvik T-Rank metrics (AdjOE, AdjDE, AdjEM, Barthag win probability, WAB, Luck, Tempo rank).

Your role: help the user analyze matchups, predict tournament outcomes, find hidden patterns in the graph data, summarize news, and answer questions about any of the 64 teams. Reference specific T-Rank numbers when relevant.

Be concise and direct. Use specific numbers. Reference actual scores when discussing games. Avoid generic filler. If you search the web, cite briefly.`;
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
