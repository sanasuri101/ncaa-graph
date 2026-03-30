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

"use strict";

// Sanitize full LLM output — NEVER call on individual chunks, only complete text
function sanitize(text) {
  if (!text) return "";
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^(Disclaimer|Commentary|Reminder)[:\s].*/gim, "")
    .replace(/^(The response|As instructed|Following the|Per the)[^\n]*/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

let _chatInFlight = false;
let chatHistory = [];
let _activeMatchup = null; // tracks { team_a, team_b } after a multi-agent analysis
let _panelSessionContext = null; // rolling session context carried across turns

// Returns true only when message explicitly requests a NEW matchup analysis
// — contains at least 2 team names AND a matchup trigger word
function isFreshMatchupRequest(msg, matchup) {
  if (!matchup) return false;
  const m = msg.toLowerCase();
  // Direct matchup triggers
  const hasTrigger =
    /\bvs\.?\b|\bversus\b|\bcompare\b|\bagainst\b|\bmatchup\b|\banalyze\b|\banalysis\b|\bwho wins?\b|\bwho would win\b/i.test(
      m,
    );
  // Transitive / comparative queries mentioning two teams
  const hasComparative =
    /\bbeat\b|\bbeat\b|\bcan.{0,20}beat\b|\bwould.{0,20}win\b|\bstronger\b|\bbetter than\b|\bover\b|\bupset\b|\btransitive\b|\bif.{0,40}then\b|\bcan.{0,20}handle\b/i.test(
      m,
    );
  return hasTrigger || hasComparative;
}

// ── Token budget ──────────────────────────────────────────────────────────────
// window.getTorvik() is defined in app.js (loads first) — do not redefine here.
const CHARS_PER_TOK = 4;
const MAX_HISTORY_TOK = 6000;

function estTokens(text) {
  return Math.ceil(
    (typeof text === "string" ? text : JSON.stringify(text ?? "")).length /
      CHARS_PER_TOK,
  );
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
  const panel = document.getElementById("ai-panel");
  const btn = document.getElementById("ai-toggle");
  const isOpen = panel.classList.toggle("open");
  btn.classList.toggle("active", isOpen);
  if (
    isOpen &&
    document.getElementById("stats-team-select").options.length === 1
  ) {
    populateTeamSelect();
  }
}

function populateTeamSelect() {
  const sel = document.getElementById("stats-team-select");
  if (!sel) return;
  if (!ALL_NODES || ALL_NODES.length === 0) {
    sel.innerHTML = '<option value="">Loading teams...</option>';
    setTimeout(populateTeamSelect, 500);
    return;
  }
  const sorted = [...ALL_NODES].sort((a, b) =>
    a.full_name.localeCompare(b.full_name),
  );
  sel.innerHTML = '<option value="">Select a team...</option>';
  sorted.forEach((n) => {
    const opt = document.createElement("option");
    opt.value = n.id;
    const seedLabel = n.seed != null ? `#${n.seed}` : "bubble";
    opt.textContent = `${n.full_name} (${n.region} ${seedLabel})`;
    sel.appendChild(opt);
  });
}

// ── Mode switching ────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("ai-toggle")
    ?.addEventListener("click", toggleAIPanel);

  document.querySelectorAll(".ai-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;
      // Update active state on all tabs
      document
        .querySelectorAll(".ai-tab")
        .forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));

      // Mobile-only tabs: pull content from sidebar into the mob panel
      if (btn.classList.contains("mob-only-tab")) {
        document
          .querySelectorAll(".ai-mode-content")
          .forEach((el) => el.classList.remove("active"));
        const mobPanel = document.getElementById(`mob-panel-${mode}`);
        if (mobPanel) {
          if (mode === "bracket" && typeof initBracket === "function")
            initBracket();
          const sidebarTab = document.getElementById(
            mode === "paths" ? "tab-transitive" : `tab-${mode}`,
          );
          if (sidebarTab) mobPanel.innerHTML = sidebarTab.innerHTML;
          mobPanel.classList.add("active");
        }
        return;
      }

      // Native panels (stats, chat)
      document
        .querySelectorAll(".ai-mode-content")
        .forEach((el) =>
          el.classList.toggle("active", el.id === `panel-${mode}`),
        );
    });
  });

  document
    .getElementById("stats-team-select")
    .addEventListener("change", () => {
      if (document.getElementById("stats-team-select").value) fetchTeamStats();
    });

  const chatInput = document.getElementById("chat-input");
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  });
  // Auto-resize textarea — skip on iOS Safari where style.height
  // triggers synchronous reflow that causes maximum call stack exceeded
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (!isIOS) {
    chatInput.addEventListener("input", () => {
      requestAnimationFrame(() => {
        chatInput.style.height = "auto";
        chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + "px";
      });
    });
  }

  document.getElementById("chat-messages").innerHTML =
    '<div class="chat-empty">Ask anything about the bracket —<br>matchups, stats, trends, predictions.</div>';
});

// ── ESPN + Torvik Stats (no AI key needed) ────────────────────────────────────
async function fetchTeamStats() {
  const sel = document.getElementById("stats-team-select");
  const teamId = sel.value;
  if (!teamId) return;

  const btn = document.getElementById("stats-fetch-btn");
  const output = document.getElementById("stats-output");
  const node = ALL_NODES.find((n) => n.id === teamId);

  btn.disabled = true;
  output.innerHTML = loadingHTML("Fetching ESPN + Torvik stats...");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);

  try {
    const [espnRes, tData] = await Promise.all([
      fetch(
        `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${teamId}/statistics`,
        { signal: ctrl.signal },
      ),
      window.getTorvik(),
    ]);
    clearTimeout(timer);

    const espnData = await espnRes.json();
    const cats = espnData?.results?.stats?.categories ?? [];
    const statsMap = {};
    cats.forEach((cat) => {
      cat.stats.forEach((s) => {
        statsMap[`${cat.name}:${s.name}`] = s;
      });
    });
    const get = (cat, name) => statsMap[`${cat}:${name}`]?.displayValue ?? "—";
    const pct = (cat, name) => {
      const v = get(cat, name);
      return v === "—" ? "—" : v + "%";
    };

    let record = `${node.wins_vs_field}W vs bracket field`;
    try {
      const ctrl2 = new AbortController();
      setTimeout(() => ctrl2.abort(), 5000);
      const tr = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${teamId}`,
        { signal: ctrl2.signal },
      );
      const td = await tr.json();
      record = td?.team?.record?.items?.[0]?.summary ?? record;
    } catch (_) {}

    const tv = tData?.teams?.[teamId]?.torvik ?? null;
    const rgbMap = {
      East: "#4a7fb5",
      West: "#3a8c6e",
      South: "#b89030",
      Midwest: "#b84545",
    };
    const rc = rgbMap[node.region] ?? "#b0a898";

    const tBlock = tv
      ? `
      <div class="stats-section-label">TORVIK T-RANK</div>
      <div class="stats-grid-2">
        <div class="stat-cell torvik-cell"><div class="sv torvik-rank">#${tv.rank}</div><div class="sl">T-Rank</div></div>
        <div class="stat-cell torvik-cell"><div class="sv" style="color:var(--accent)">${tv.adj_em > 0 ? "+" : ""}${tv.adj_em}</div><div class="sl">AdjEM</div></div>
        <div class="stat-cell torvik-cell"><div class="sv" style="color:var(--west)">${tv.adj_oe}</div><div class="sl">AdjOE</div></div>
        <div class="stat-cell torvik-cell"><div class="sv" style="color:var(--midwest)">${tv.adj_de}</div><div class="sl">AdjDE</div></div>
        <div class="stat-cell torvik-cell"><div class="sv">${(tv.barthag * 100).toFixed(1)}%</div><div class="sl">Barthag</div></div>
        <div class="stat-cell torvik-cell"><div class="sv">${tv.wab > 0 ? "+" : ""}${parseFloat(tv.wab).toFixed(1)}</div><div class="sl">WAB</div></div>
        <div class="stat-cell torvik-cell"><div class="sv">${tv.adj_tempo != null ? (tv.adj_tempo >= 0.8 ? "Fast" : tv.adj_tempo >= 0.6 ? "Mod." : "Slow") + " (" + tv.adj_tempo.toFixed(2) + ")" : "—"}</div><div class="sl">Pace</div></div>
        <div class="stat-cell torvik-cell"><div class="sv">${tv.luck > 0 ? "+" : ""}${parseFloat(tv.luck).toFixed(3)}</div><div class="sl">Luck</div></div>
        <div class="stat-cell torvik-cell"><div class="sv">${tv.two_p != null ? tv.two_p + "%" : "—"}</div><div class="sl">2P%</div></div>
        <div class="stat-cell torvik-cell"><div class="sv">${tv.three_p != null ? tv.three_p + "%" : "—"}</div><div class="sl">3P%</div></div>
        <div class="stat-cell torvik-cell"><div class="sv">${tv.ft_pct != null ? tv.ft_pct + "%" : "—"}</div><div class="sl">FT%</div></div>
        <div class="stat-cell torvik-cell"><div class="sv">${tv.efg != null ? tv.efg + "%" : "—"}</div><div class="sl">eFG%</div></div>
      </div>`
      : `<div class="torvik-missing">Torvik data unavailable for this team</div>`;

    output.innerHTML = `
      <div class="stats-card">
        <div class="stats-card-name" style="border-left:3px solid ${rc};padding-left:8px">${node.full_name}</div>
        <div class="stats-card-sub">${node.region} · Seed #${node.seed} · ${record}</div>
        <div class="stats-section-label">ESPN BOX STATS</div>
        <div class="stats-grid-2">
          <div class="stat-cell"><div class="sv">${get("offensive", "avgPoints")}</div><div class="sl">PPG</div></div>
          <div class="stat-cell"><div class="sv">${get("general", "avgRebounds")}</div><div class="sl">RPG</div></div>
          <div class="stat-cell"><div class="sv">${get("offensive", "avgAssists")}</div><div class="sl">APG</div></div>
          <div class="stat-cell"><div class="sv">${get("offensive", "avgTurnovers")}</div><div class="sl">TOPG</div></div>
          <div class="stat-cell"><div class="sv">${pct("offensive", "fieldGoalPct")}</div><div class="sl">FG%</div></div>
          <div class="stat-cell"><div class="sv">${pct("offensive", "threePointFieldGoalPct")}</div><div class="sl">3P%</div></div>
          <div class="stat-cell"><div class="sv">${pct("offensive", "twoPointFieldGoalPct")}</div><div class="sl">2P%</div></div>
          <div class="stat-cell"><div class="sv">${pct("offensive", "freeThrowPct")}</div><div class="sl">FT%</div></div>
          <div class="stat-cell"><div class="sv">${get("general", "assistTurnoverRatio")}</div><div class="sl">AST/TO</div></div>
          <div class="stat-cell"><div class="sv">${get("defensive", "avgSteals")}</div><div class="sl">SPG</div></div>
          <div class="stat-cell"><div class="sv">${get("defensive", "avgBlocks")}</div><div class="sl">BPG</div></div>
          <div class="stat-cell"><div class="sv">${get("offensive", "avgThreePointFieldGoalsMade")} / ${get("offensive", "avgThreePointFieldGoalsAttempted")}</div><div class="sl">3PM/A</div></div>
        </div>
        ${tBlock}
      </div>
      <div style="font-size:.62rem;color:var(--text-mute);margin-top:4px;line-height:1.5">
        ESPN: 2025-26 season totals${tv ? ` · Torvik updated ${tData?.generated_at?.slice(0, 10) ?? "recently"}` : ""}
      </div>
    `;
  } catch (err) {
    clearTimeout(timer);
    output.innerHTML = `<div class="ai-error">Failed to load stats: ${err.name === "AbortError" ? "Request timed out" : err.message}</div>`;
  } finally {
    btn.disabled = false;
  }
}

let _chatAbortCtrl = null;

function setChatSending(sending) {
  const sendBtn = document.getElementById("chat-send-btn");
  const stopBtn = document.getElementById("chat-stop-btn");
  const input = document.getElementById("chat-input");
  sendBtn.style.display = sending ? "none" : "flex";
  stopBtn.style.display = sending ? "flex" : "none";
  input.disabled = sending;
}

function stopChat() {
  if (_chatAbortCtrl) _chatAbortCtrl.abort();
}

async function sendChat() {
  if (_chatInFlight) return;

  const textarea = document.getElementById("chat-input");
  const msg = textarea.value.trim();
  if (!msg) return;

  _chatInFlight = true;
  _chatAbortCtrl = new AbortController();
  textarea.value = "";
  textarea.style.height = "";
  setChatSending(true);

  const messagesEl = document.getElementById("chat-messages");
  messagesEl.querySelectorAll(".chat-empty").forEach((el) => el.remove());

  const userBubble = document.createElement("div");
  userBubble.className = "chat-bubble-user";
  userBubble.textContent = msg;
  messagesEl.appendChild(userBubble);

  const thinkEl = document.createElement("div");
  thinkEl.className = "chat-bubble-ai thinking";
  thinkEl.innerHTML = `<div class="chat-bubble-ai-body">${loadingHTML("Thinking...")}</div>`;
  messagesEl.appendChild(thinkEl);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  chatHistory.push({ role: "user", content: msg });

  // Trim for the API call only — don't mutate chatHistory
  const historyForApi = trimHistory(chatHistory);
  if (historyForApi.length < chatHistory.length) {
    const notice = document.createElement("div");
    notice.className = "chat-context-notice";
    notice.textContent =
      "Earlier messages trimmed to stay within context limit";
    messagesEl.insertBefore(notice, userBubble);
  }

  try {
    // Detect matchup queries — route to multi-agent pipeline only for fresh requests
    const matchup = detectMatchupIntent(msg);
    const freshRequest = isFreshMatchupRequest(msg, matchup);

    // If there's an active matchup and this looks like a follow-up (not a fresh vs request)
    // route through normal chat so the LLM can incorporate the user's context
    const useMultiAgent = matchup && freshRequest;

    if (useMultiAgent) {
      // Show agent thinking steps while waiting
      thinkEl.innerHTML = `<div class="chat-bubble-ai-body">${loadingHTML("Running 3 specialist agents in parallel...")}</div>`;
      if (window.posthog)
        posthog.capture("matchup_analyzed", {
          team_a: matchup.team_a,
          team_b: matchup.team_b,
        });
      const data = await callAnalyze(
        matchup.team_a,
        matchup.team_b,
        _chatAbortCtrl.signal,
        msg,
      );

      const agentSteps = (data.agent_results || []).map(
        (r) => `${r.agent} agent: ${r.win_pct}% for ${matchup.team_a}`,
      );
      agentSteps.push("synthesis: weighted confidence interval");

      const thinkHtml = `
        <div class="thinking-block thinking-done">
          <div class="thinking-header">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span class="thinking-label">Multi-agent analysis complete</span>
          </div>
          <div class="thinking-steps">
            ${agentSteps.map((s) => `<div class="thinking-step">${escapeHtml(s)}</div>`).join("")}
          </div>
        </div>`;

      const confHtml =
        data.confidence?.win_pct !== undefined
          ? renderConfidence(data.confidence, data.odds_data)
          : "";
      const reasoning = data.confidence?.reasoning ?? "Analysis complete.";
      // Store active matchup so follow-up messages route to chat, not re-analysis
      _activeMatchup = { team_a: matchup.team_a, team_b: matchup.team_b };
      // Push full context into history so follow-up questions have it
      const analysisContext = `Multi-agent analysis of ${matchup.team_a} vs ${matchup.team_b}: ${reasoning}`;
      chatHistory.push({ role: "assistant", content: analysisContext });
      // confHtml already contains all structured sections — don't repeat reasoning below it
      thinkEl.innerHTML = `${thinkHtml}<div class="chat-bubble-ai-label">Scout · Multi-Agent</div>${confHtml}`;
    } else {
      // Standard single-agent path — streaming
      if (window.posthog)
        posthog.capture("chat_query", { has_active_matchup: !!_activeMatchup });

      const thinkingSteps = [];
      let streamedText = "";

      // Set up streaming bubble immediately
      const bodyEl = document.createElement("div");
      bodyEl.className = "chat-bubble-ai-body";
      bodyEl.innerHTML = loadingHTML("Thinking…");
      thinkEl.innerHTML = "";
      thinkEl.appendChild(bodyEl);

      const { text, thinking } = await callAI(
        historyForApi,
        msg,
        _chatAbortCtrl.signal,
        {
          sessionContext: _panelSessionContext,
          onContext: (ctx) => {
            _panelSessionContext = ctx;
          },
          onThinking: (label) => {
            thinkingSteps.push(label);
            // Render thinking steps as they arrive
            const thinkHtml = `
            <div class="thinking-block thinking-done">
              <div class="thinking-header">
                <span class="thinking-spinner"></span>
                <span class="thinking-label">Thinking…</span>
              </div>
              <div class="thinking-steps">
                ${thinkingSteps.map((s) => `<div class="thinking-step">${escapeHtml(s)}</div>`).join("")}
              </div>
            </div>`;
            thinkEl.innerHTML =
              thinkHtml +
              '<div class="chat-bubble-ai-label">Scout</div><div class="chat-bubble-ai-body chat-streaming"></div>';
          },
          onChunk: (chunk) => {
            streamedText += chunk;
            let el = thinkEl.querySelector(".chat-streaming");
            if (!el) {
              el = document.createElement("div");
              el.className = "chat-bubble-ai-body chat-streaming";
              thinkEl.appendChild(el);
            }
            el.textContent = streamedText; // plain text while streaming — no broken markdown
            messagesEl.scrollTop = messagesEl.scrollHeight;
          },
        },
      );

      chatHistory.push({ role: "assistant", content: text });

      // Final render — mark thinking done, finalize text
      const thinkHtml = thinkingSteps.length
        ? `
        <div class="thinking-block thinking-done">
          <div class="thinking-header">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span class="thinking-label">Thought for a moment</span>
          </div>
          <div class="thinking-steps">
            ${thinkingSteps.map((s) => `<div class="thinking-step">${escapeHtml(s)}</div>`).join("")}
          </div>
        </div>`
        : "";
      thinkEl.innerHTML = `${thinkHtml}<div class="chat-bubble-ai-label">Scout</div><div class="chat-bubble-ai-body">${renderMarkdown(text)}</div>`;
    }
  } catch (err) {
    chatHistory.pop();
    if (err.name === "AbortError") {
      thinkEl.remove();
      userBubble.remove();
    } else {
      thinkEl.innerHTML = `<div class="ai-error">${escapeHtml(err.message)}</div>`;
    }
  } finally {
    _chatInFlight = false;
    _chatAbortCtrl = null;
    setChatSending(false);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
}

function insertHint(text) {
  document.getElementById("chat-input").value = text;
  document.getElementById("chat-input").focus();
}

// ── Multi-agent matchup detection ────────────────────────────────────────────
// Mirrors server-side classifyIntent for the matchup case only.
// Returns { type:'matchup', team_a, team_b } or null.
function detectMatchupIntent(msg) {
  if (!window.ALL_NODES) return null;

  // Abbreviation map — must match ALIASES in api/ai.js
  const ABBREVS = {
    isu: "iowa state",
    "iowa st": "iowa state",
    msu: "michigan st",
    "mich st": "michigan st",
    "michigan state": "michigan st",
    ku: "kansas",
    osu: "ohio state",
    fsu: "florida state",
    wvu: "west virginia",
    "a&m": "texas a&m",
    tamu: "texas a&m",
    "st john's": "saint johns",
    "st johns": "saint johns",
    sjr: "saint johns",
    uconn: "uconn",
    unc: "north carolina",
    pitt: "pittsburgh",
  };

  function normLabel(s) {
    return s
      .toLowerCase()
      .trim()
      .replace(/[.'`]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  function normInput(s) {
    let out = s
      .toLowerCase()
      .trim()
      .replace(/(?<!\w)st\.([a-z])/g, "saint $1")
      .replace(/[.'`]/g, "")
      .replace(/\bst\b/g, "saint")
      .replace(/\s+/g, " ")
      .trim();
    // Expand abbreviations — try longest first to avoid partial matches
    const sorted = Object.keys(ABBREVS).sort((a, b) => b.length - a.length);
    for (const abbrev of sorted) {
      const re = new RegExp(
        "\\b" + abbrev.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b",
        "g",
      );
      out = out.replace(re, ABBREVS[abbrev]);
    }
    return out;
  }

  if (!msg.trim()) return null;
  const mNorm = normInput(msg);

  // Build candidates: for each team, generate all alias forms the user might type
  const candidates = window.ALL_NODES.filter(
    (n) => n.region !== "bubble" && n.seed !== null,
  ).flatMap((n) => {
    const lbl = normLabel(n.label);
    const full = normLabel(n.full_name);
    // "Wright St" -> "Wright State" for users who type the full word
    const stateVariant = lbl.endsWith(" st")
      ? lbl.slice(0, -3) + " state"
      : null;
    // "St John's" -> "saint johns" for users who type "st johns" or "st.johns"
    const saintVariant = lbl.startsWith("st ") ? "saint " + lbl.slice(3) : null;
    // "Wright St" -> "wright saint" to match normInput("Wright St") -> "wright saint"
    const saintEndVariant = lbl.endsWith(" st")
      ? lbl.slice(0, -2) + "saint"
      : null;
    const aliases = [
      full,
      lbl,
      stateVariant,
      saintVariant,
      saintEndVariant,
    ].filter(Boolean);
    // Find the best matching alias in the message
    const matchStr =
      aliases
        .sort((a, b) => b.length - a.length) // try longest first
        .find((a) => mNorm.includes(a)) ?? null;
    if (!matchStr) return [];
    return [
      { n, matchStr, pos: mNorm.indexOf(matchStr), len: matchStr.length },
    ];
  });

  // Greedy longest-first assignment: assign each team its earliest non-overlapping position
  const sortedByLen = [...candidates].sort(
    (a, b) => b.len - a.len || a.pos - b.pos,
  );
  const usedRanges = [];
  const assigned = [];

  for (const c of sortedByLen) {
    let searchFrom = 0,
      bestPos = -1;
    while (searchFrom <= mNorm.length - c.len) {
      const idx = mNorm.indexOf(c.matchStr, searchFrom);
      if (idx === -1) break;
      const overlaps = usedRanges.some(([s, e]) => idx < e && idx + c.len > s);
      if (!overlaps) {
        bestPos = idx;
        break;
      }
      searchFrom = idx + 1;
    }
    if (bestPos !== -1) {
      usedRanges.push([bestPos, bestPos + c.len]);
      assigned.push({ ...c, pos: bestPos });
    }
  }

  // Sort by position in message, prefer longer on ties
  assigned.sort((a, b) => a.pos - b.pos || b.len - a.len);

  const found = assigned.map((x) => x.n);

  // Handle 3-team conditional questions: "if X beats Y, can they beat Z?"
  // The actual matchup being asked about is X vs Z, not X vs Y.
  if (found.length >= 3) {
    const conditional =
      /\bif\b.*\b(beat|defeat|get past|knock off|upset|eliminate|win against)\b.*\b(can|could|will|would|do)\b.*\b(beat|defeat|handle|face|take on|win)\b/i;
    if (conditional.test(msg)) {
      // First team is the subject, last team is the one they're being asked about
      return {
        type: "matchup",
        team_a: found[0].label,
        team_b: found[2].label,
      };
    }
  }

  if (found.length >= 2)
    return { type: "matchup", team_a: found[0].label, team_b: found[1].label };
  return null;
}

// ── Confidence interval renderer ─────────────────────────────────────────────
function renderConfidence(conf, oddsRaw) {
  const pct = conf.win_pct;
  const teamA = escapeHtml(conf.team_a);
  const teamB = escapeHtml(conf.team_b);
  const favor = pct >= 50 ? teamA : teamB;
  const dispPct = pct >= 50 ? pct : 100 - pct;
  const barPct = pct;
  const consensus =
    conf.consensus === "strong"
      ? "Agents in agreement"
      : conf.consensus === "moderate"
        ? "Some agent disagreement"
        : "Agents split";
  const consensusColor =
    conf.consensus === "strong"
      ? "var(--west)"
      : conf.consensus === "moderate"
        ? "var(--south)"
        : "var(--midwest)";

  const breakdown = (conf.agent_breakdown || [])
    .map((a) => {
      const aPct = a.win_pct;
      return `<div class="conf-agent-row">
      <span class="conf-agent-name">${escapeHtml(a.agent)}</span>
      <div class="conf-agent-bar-wrap">
        <div class="conf-agent-bar" style="width:${aPct}%;background:var(--accent)"></div>
      </div>
      <span class="conf-agent-pct">${aPct}%</span>
      <span class="conf-agent-edge">${escapeHtml(a.key_edge || "")}</span>
    </div>`;
    })
    .join("");

  // Build weights label dynamically from API response
  const w = conf.weights || {};
  const weightLabel = Object.keys(w).length
    ? Object.entries(w)
        .filter(([, v]) => v > 0)
        .map(
          ([k, v]) =>
            `${k.charAt(0).toUpperCase() + k.slice(1)} ${Math.round(v * 100)}%`,
        )
        .join(" · ")
    : "Efficiency 50% · Form 25% · Matchup 25%";

  // Build market + BPI data block from raw odds context string returned by API
  let marketBlock = "";
  if (oddsRaw && !oddsRaw.includes("No tournament game odds found")) {
    const rows = oddsRaw
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => {
        const t = l.trim();
        if (
          t.startsWith("DraftKings") ||
          t.startsWith("ESPN BPI") ||
          t.startsWith("Futures")
        ) {
          return `<div class="market-header">${escapeHtml(t.replace(/:$/, ""))}</div>`;
        }
        return `<div class="market-row">${escapeHtml(t)}</div>`;
      })
      .join("");
    marketBlock = `
    <div class="conf-market-block">
      <div class="conf-agents-title">Market &amp; BPI</div>
      <div class="market-rows">${rows}</div>
    </div>`;
  }

  // Build structured analysis sections if available
  const sec = conf.sections ?? {};
  const SECTION_DEFS = [
    { key: "injury_note", label: "⚠ Injury Alert", show: (s) => !!s },
    { key: "decisive_factor", label: "Decisive Factor", show: () => true },
    { key: "key_matchup", label: "Key Matchup", show: () => true },
    { key: "x_factors", label: "X-Factors", show: () => true },
    { key: "risk", label: "The Risk", show: () => true },
    { key: "market_vs_model", label: "Market vs Model", show: () => true },
    { key: "bottom_line", label: "Bottom Line", show: () => true },
  ];

  // Coerce every section value to a safe string — model can leak objects or raw JSON
  function coerceSectionVal(v) {
    if (v == null || v === "") return "";
    if (typeof v === "object") {
      // Object leaked — try to extract decisive_factor, else discard
      return typeof v.decisive_factor === "string" ? v.decisive_factor : "";
    }
    const s = String(v).trim();
    // Detect JSON blob: starts with { followed by whitespace+"  (key pattern)
    // Don't require closing } — truncated JSON still needs to be caught
    if (s.startsWith("{") && /^\{[\s\n]*"/.test(s)) return "";
    return s;
  }

  const sectionHTML = SECTION_DEFS.filter((d) => {
    const val = coerceSectionVal(sec[d.key]);
    return d.show(val) && val.length > 0;
  })
    .map((d) => {
      const val = coerceSectionVal(sec[d.key]);
      const isInjury = d.key === "injury_note";
      const isBottom = d.key === "bottom_line";
      return `<div class="conf-section ${isInjury ? "conf-section-injury" : ""} ${isBottom ? "conf-section-bottom-line" : ""}">
        <div class="conf-section-label">${d.label}</div>
        <div class="conf-section-text">${renderMarkdown(val)}</div>
      </div>`;
    })
    .join("");

  // Fallback to flat reasoning if no sections (old API response)
  const analysisHTML =
    sectionHTML ||
    (conf.reasoning
      ? `<div class="conf-section"><div class="conf-section-text">${escapeHtml(conf.reasoning)}</div></div>`
      : "");

  return `<div class="confidence-block" id="conf-block-${conf.team_a}-${conf.team_b}">
    <div class="conf-header">
      <span class="conf-label">AI SCOUT MULTI-AGENT ANALYSIS</span>
      <span class="conf-consensus" style="color:${consensusColor}">${consensus} (spread: ${conf.agent_spread}pp)</span>
    </div>
    <div class="conf-teams">
      <span class="conf-team-a">${teamA}</span>
      <span class="conf-vs">vs</span>
      <span class="conf-team-b">${teamB}</span>
    </div>
    <div class="conf-bar-wrap">
      <div class="conf-bar-a" style="width:${barPct}%"></div>
      <div class="conf-bar-b" style="width:${100 - barPct}%"></div>
    </div>
    <div class="conf-pct-row">
      <span class="conf-pct-a">${barPct}%</span>
      <span class="conf-range">${conf.range_low}–${conf.range_high}% range</span>
      <span class="conf-pct-b">${100 - barPct}%</span>
    </div>
    <div class="conf-favor">Favoring <strong>${favor}</strong> with ${dispPct}% confidence</div>
    <div class="conf-agents-title">Agent breakdown</div>
    <div class="conf-agents">${breakdown}</div>${marketBlock}
    <div class="conf-weights">Weights: ${weightLabel}</div>
    <div class="conf-analysis">${analysisHTML}</div>
    <button class="conf-export-btn" onclick="saveAnalysis(this)" data-team-a="${teamA}" data-team-b="${teamB}" data-pct="${barPct}" data-range="${conf.range_low}–${conf.range_high}" data-favor="${favor}" data-disppct="${dispPct}" data-consensus="${escapeHtml(consensus)}" data-reasoning="${escapeHtml(conf.reasoning ?? "")}" data-breakdown="${escapeHtml(JSON.stringify(conf.agent_breakdown ?? []))}">+ Save analysis</button>
  </div>`;
}

// ── Analysis exporter ─────────────────────────────────────────────────────────
// Draws the matchup analysis to a canvas and triggers a PNG download.
// ── Saved analyses cart ──────────────────────────────────────────────────────
let savedAnalyses = [];

function saveAnalysis(btn) {
  const teamA = btn.getAttribute("data-team-a");
  const teamB = btn.getAttribute("data-team-b");
  const pct = parseInt(btn.getAttribute("data-pct"));
  const range = btn.getAttribute("data-range");
  const favor = btn.getAttribute("data-favor");
  const dispPct = btn.getAttribute("data-disppct");
  const consensus = btn.getAttribute("data-consensus");
  const reasoning = btn.getAttribute("data-reasoning") || "";
  let breakdown = [];
  try {
    breakdown = JSON.parse(btn.getAttribute("data-breakdown") || "[]");
  } catch {}

  // Prevent duplicate saves for same matchup
  const key = `${teamA}|${teamB}`;
  if (savedAnalyses.find((a) => `${a.teamA}|${a.teamB}` === key)) {
    btn.textContent = "✓ Already saved";
    setTimeout(() => {
      btn.textContent = "+ Save analysis";
    }, 1500);
    return;
  }

  savedAnalyses.push({
    teamA,
    teamB,
    pct,
    range,
    favor,
    dispPct,
    consensus,
    reasoning,
    breakdown,
    timestamp: new Date().toLocaleString(),
  });
  if (window.posthog)
    posthog.capture("analysis_saved", {
      team_a: teamA,
      team_b: teamB,
      win_pct: pct,
      consensus,
    });

  btn.textContent = "✓ Saved";
  btn.disabled = true;
  btn.style.color = "var(--west)";
  btn.style.borderColor = "var(--west)";

  renderSavedPanel();
}

function renderSavedPanel() {
  const panel = document.getElementById("saved-analyses-panel");
  if (!panel) return;

  if (savedAnalyses.length === 0) {
    panel.style.display = "none";
    return;
  }

  panel.style.display = "block";
  const count = savedAnalyses.length;

  panel.innerHTML = `
    <div class="saved-panel-header">
      <span class="saved-panel-title">Saved analyses <span class="saved-count">${count}</span></span>
      <div class="saved-panel-actions">
        <button class="saved-export-btn" onclick="exportAllCSV()">↓ Export CSV</button>
        <button class="saved-clear-btn" onclick="clearSaved()">Clear all</button>
      </div>
    </div>
    <div class="saved-list">
      ${savedAnalyses
        .map(
          (a, i) => `
        <div class="saved-item">
          <div class="saved-item-teams">${escapeHtml(a.teamA)} <span class="saved-vs">vs</span> ${escapeHtml(a.teamB)}</div>
          <div class="saved-item-meta">
            <span class="saved-item-pct" style="color:var(--accent)">${a.pct}%</span>
            <span class="saved-item-range">${a.range}</span>
            <span class="saved-item-favor">→ ${escapeHtml(a.favor)}</span>
          </div>
          <div class="saved-item-time">${a.timestamp}</div>
          <button class="saved-item-remove" onclick="removeSaved(${i})" title="Remove">✕</button>
        </div>
      `,
        )
        .join("")}
    </div>
  `;
}

function removeSaved(index) {
  savedAnalyses.splice(index, 1);
  renderSavedPanel();
}

function clearSaved() {
  savedAnalyses = [];
  renderSavedPanel();
}

function exportAllCSV() {
  if (savedAnalyses.length === 0) return;
  if (window.posthog)
    posthog.capture("csv_exported", { count: savedAnalyses.length });

  const headers = [
    "Team A",
    "Team B",
    "Win % (A)",
    "Win % (B)",
    "Range Low",
    "Range High",
    "Favored Team",
    "Confidence",
    "Consensus",
    "Efficiency %",
    "Form %",
    "Matchup %",
    "Reasoning",
    "Saved At",
  ];

  const escCSV = (s) => {
    const str = String(s ?? "")
      .replace(/\r?\n/g, " ")
      .trim();
    return str.includes(",") || str.includes('"')
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };

  const rows = savedAnalyses.map((a) => {
    const [rangeLow, rangeHigh] = (a.range || "–").split("–");
    const eff =
      a.breakdown.find((b) => b.agent === "efficiency")?.win_pct ?? "";
    const frm = a.breakdown.find((b) => b.agent === "form")?.win_pct ?? "";
    const mch = a.breakdown.find((b) => b.agent === "matchup")?.win_pct ?? "";
    return [
      a.teamA,
      a.teamB,
      a.pct,
      100 - a.pct,
      rangeLow?.trim(),
      rangeHigh?.trim(),
      a.favor,
      a.dispPct + "%",
      a.consensus,
      eff,
      frm,
      mch,
      a.reasoning,
      a.timestamp,
    ]
      .map(escCSV)
      .join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ncaa-scout-analyses-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ── Multi-agent analyze call ──────────────────────────────────────────────────
async function callAnalyze(teamA, teamB, signal, userQuery) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 55000);
  signal?.addEventListener("abort", () => ctrl.abort(), { once: true });
  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        team_a: teamA,
        team_b: teamB,
        ...(userQuery ? { user_query: userQuery } : {}),
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e?.error ?? "Analysis failed");
    }
    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      const e = new Error("aborted");
      e.name = "AbortError";
      throw e;
    }
    throw err;
  }
}

// ── Core AI call — streaming SSE response ───────────────────────────────────
const WORKER_URL = "/api/ai";
const FETCH_TIMEOUT = 30000;

// callAI streams the response, calling callbacks as chunks arrive.
// onThinking(label)   — called when a thinking/tool step label arrives
// onChunk(text)       — called for each streamed text chunk
// onContext(text)     — called with compact session context after each response
// sessionContext      — compact context from previous turn (opaque JSON string)
// Returns the full assembled text when stream completes.
async function callAI(
  messages,
  userMsg,
  signal,
  { onThinking, onChunk, onContext, sessionContext } = {},
) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  signal?.addEventListener("abort", () => ctrl.abort(), { once: true });

  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        userMsg,
        ...(sessionContext ? { sessionContext } : {}),
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error?.message ?? `API error ${res.status}`);
    }

    // Check if response is SSE stream (new) or JSON (fallback)
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/event-stream")) {
      // Fallback: old JSON response format
      const data = await res.json();
      if (data.error) throw new Error(data.error.message ?? "Unknown error");
      (data.thinking ?? []).forEach((t) => onThinking?.(t));
      onChunk?.(data.text ?? "");
      return {
        text: data.text || "No response — please try again.",
        thinking: data.thinking ?? [],
      };
    }

    // SSE stream — read line by line
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";
    const thinking = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (!raw) continue;
        let evt;
        try {
          evt = JSON.parse(raw);
        } catch {
          continue;
        }

        if (evt.type === "thinking" || evt.type === "tool") {
          thinking.push(evt.text);
          onThinking?.(evt.text);
        } else if (evt.type === "text") {
          fullText += evt.text;
          onChunk?.(evt.text);
        } else if (evt.type === "context") {
          onContext?.(evt.text);
        } else if (evt.type === "error") {
          throw new Error(evt.text ?? "Stream error");
        } else if (evt.type === "done") {
          break;
        }
      }
    }

    return {
      text:
        sanitize(fullText) ||
        fullText.trim() ||
        "No response — try rephrasing.",
      thinking,
    };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      const e = new Error("aborted");
      e.name = "AbortError";
      throw e;
    }
    throw err;
  }
}

function renderThinking(thinkEl, steps) {
  thinkEl.innerHTML = `
    <div class="thinking-block">
      <div class="thinking-header">
        <span class="thinking-spinner"></span>
        <span class="thinking-label">Thinking</span>
      </div>
      <div class="thinking-steps">
        ${steps.map((s) => `<div class="thinking-step">${escapeHtml(s)}</div>`).join("")}
      </div>
    </div>`;
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
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMarkdown(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(
      /^(\d+)\. (.+)$/gm,
      '<div class="md-li md-oli"><span class="md-ln">$1.</span>$2</div>',
    )
    .replace(
      /^[-•] (.+)$/gm,
      '<div class="md-li"><span class="md-dot">·</span>$1</div>',
    )
    .replace(/\n\n/g, "<br><br>")
    .replace(/\n/g, "<br>");
}

// ── Stats page (full-page Stats view) ────────────────────────────────────────
function populateStatsPageSelect() {
  const sel = document.getElementById("stats-page-team-select");
  if (!sel || sel.options.length > 1) return;
  if (!ALL_NODES || ALL_NODES.length === 0) {
    setTimeout(populateStatsPageSelect, 300);
    return;
  }
  const sorted = [...ALL_NODES].sort((a, b) =>
    a.full_name.localeCompare(b.full_name),
  );
  sel.innerHTML = '<option value="">Select a team…</option>';
  sorted.forEach((n) => {
    const opt = document.createElement("option");
    opt.value = n.id;
    const seed = n.seed != null ? ` #${n.seed}` : "";
    opt.textContent = `${n.full_name} (${n.region}${seed})`;
    sel.appendChild(opt);
  });
}

async function fetchStatsPageTeam(teamId) {
  const sel = document.getElementById("stats-page-team-select");
  const id = teamId || sel?.value;
  if (!id) return;
  if (sel && sel.value !== id) sel.value = id;

  const output = document.getElementById("stats-page-output");
  if (!output) return;

  // Wait for ALL_NODES if needed
  if (!ALL_NODES || ALL_NODES.length === 0) {
    output.innerHTML = loadingHTML("Loading team data…");
    await new Promise((resolve) => {
      const check = () =>
        ALL_NODES && ALL_NODES.length > 0 ? resolve() : setTimeout(check, 200);
      check();
    });
  }

  const node = ALL_NODES?.find((n) => n.id === id);
  if (!node) {
    output.innerHTML = '<div class="ai-error">Team not found.</div>';
    return;
  }

  output.innerHTML = loadingHTML("Fetching ESPN + Torvik stats…");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);

  try {
    const [espnRes, tData] = await Promise.all([
      fetch(
        `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${id}/statistics`,
        { signal: ctrl.signal },
      ),
      window.getTorvik(),
    ]);
    clearTimeout(timer);

    const cats = (await espnRes.json())?.results?.stats?.categories ?? [];
    const statsMap = {};
    cats.forEach((cat) =>
      cat.stats.forEach((s) => {
        statsMap[`${cat.name}:${s.name}`] = s;
      }),
    );
    const get = (cat, name) => statsMap[`${cat}:${name}`]?.displayValue ?? "—";
    const pct = (cat, name) => {
      const v = get(cat, name);
      return v === "—" ? "—" : v + "%";
    };

    let record = `${node.wins_vs_field}W vs bracket field`;
    try {
      const ctrl2 = new AbortController();
      setTimeout(() => ctrl2.abort(), 5000);
      const td = await (
        await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${id}`,
          { signal: ctrl2.signal },
        )
      ).json();
      record = td?.team?.record?.items?.[0]?.summary ?? record;
    } catch (_) {}

    const tv = tData?.teams?.[id]?.torvik ?? null;
    const rgbMap = {
      East: "#4a7fb5",
      West: "#3a8c6e",
      South: "#b89030",
      Midwest: "#b84545",
    };
    const rc = rgbMap[node.region] ?? "#b0a898";

    const tBlock = tv
      ? `
      <div class="stats-section-label">TORVIK T-RANK</div>
      <div class="stats-grid-2">
        <div class="stat-cell torvik-cell"><div class="sv torvik-rank">#${tv.rank}</div><div class="sl">T-Rank</div></div>
        <div class="stat-cell torvik-cell"><div class="sv" style="color:var(--accent)">${tv.adj_em > 0 ? "+" : ""}${tv.adj_em}</div><div class="sl">AdjEM</div></div>
        <div class="stat-cell torvik-cell"><div class="sv" style="color:var(--west)">${tv.adj_oe}</div><div class="sl">AdjOE</div></div>
        <div class="stat-cell torvik-cell"><div class="sv" style="color:var(--midwest)">${tv.adj_de}</div><div class="sl">AdjDE</div></div>
        <div class="stat-cell torvik-cell"><div class="sv">${(tv.barthag * 100).toFixed(1)}%</div><div class="sl">Barthag</div></div>
        <div class="stat-cell torvik-cell"><div class="sv">${tv.wab > 0 ? "+" : ""}${parseFloat(tv.wab).toFixed(1)}</div><div class="sl">WAB</div></div>
        <div class="stat-cell torvik-cell"><div class="sv">${tv.adj_tempo != null ? (tv.adj_tempo >= 0.8 ? "Fast" : tv.adj_tempo >= 0.6 ? "Mod." : "Slow") + " (" + tv.adj_tempo.toFixed(2) + ")" : "—"}</div><div class="sl">Pace</div></div>
        <div class="stat-cell torvik-cell"><div class="sv">${tv.luck > 0 ? "+" : ""}${parseFloat(tv.luck).toFixed(3)}</div><div class="sl">Luck</div></div>
        <div class="stat-cell torvik-cell"><div class="sv">${tv.two_p != null ? tv.two_p + "%" : "—"}</div><div class="sl">2P%</div></div>
        <div class="stat-cell torvik-cell"><div class="sv">${tv.three_p != null ? tv.three_p + "%" : "—"}</div><div class="sl">3P%</div></div>
        <div class="stat-cell torvik-cell"><div class="sv">${tv.ft_pct != null ? tv.ft_pct + "%" : "—"}</div><div class="sl">FT%</div></div>
        <div class="stat-cell torvik-cell"><div class="sv">${tv.efg != null ? tv.efg + "%" : "—"}</div><div class="sl">eFG%</div></div>
      </div>`
      : '<div class="torvik-missing">Torvik data unavailable</div>';

    output.innerHTML = `
      <div class="stats-card">
        <div class="stats-card-name" style="border-left:3px solid ${rc};padding-left:8px">${node.full_name}</div>
        <div class="stats-card-sub">${node.region} · Seed #${node.seed} · ${record}</div>
        <div class="stats-section-label">ESPN BOX STATS</div>
        <div class="stats-grid-2">
          <div class="stat-cell"><div class="sv">${get("offensive", "avgPoints")}</div><div class="sl">PPG</div></div>
          <div class="stat-cell"><div class="sv">${get("general", "avgRebounds")}</div><div class="sl">RPG</div></div>
          <div class="stat-cell"><div class="sv">${get("offensive", "avgAssists")}</div><div class="sl">APG</div></div>
          <div class="stat-cell"><div class="sv">${get("offensive", "avgTurnovers")}</div><div class="sl">TOPG</div></div>
          <div class="stat-cell"><div class="sv">${pct("offensive", "fieldGoalPct")}</div><div class="sl">FG%</div></div>
          <div class="stat-cell"><div class="sv">${pct("offensive", "threePointFieldGoalPct")}</div><div class="sl">3P%</div></div>
          <div class="stat-cell"><div class="sv">${pct("offensive", "twoPointFieldGoalPct")}</div><div class="sl">2P%</div></div>
          <div class="stat-cell"><div class="sv">${pct("offensive", "freeThrowPct")}</div><div class="sl">FT%</div></div>
          <div class="stat-cell"><div class="sv">${get("general", "assistTurnoverRatio")}</div><div class="sl">AST/TO</div></div>
          <div class="stat-cell"><div class="sv">${get("defensive", "avgSteals")}</div><div class="sl">SPG</div></div>
          <div class="stat-cell"><div class="sv">${get("defensive", "avgBlocks")}</div><div class="sl">BPG</div></div>
          <div class="stat-cell"><div class="sv">${get("offensive", "avgThreePointFieldGoalsMade")} / ${get("offensive", "avgThreePointFieldGoalsAttempted")}</div><div class="sl">3PM/A</div></div>
        </div>
        ${tBlock}
      </div>
      <div style="font-size:.62rem;color:var(--text-mute);margin-top:8px">
        ESPN: 2025-26 season · Torvik: ${tData?.generated_at?.slice(0, 10) ?? "recent"}
      </div>`;
  } catch (err) {
    clearTimeout(timer);
    output.innerHTML = `<div class="ai-error">Failed: ${err.name === "AbortError" ? "Timed out" : err.message}</div>`;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SCOUT VIEW — full-page chat + stats
// ══════════════════════════════════════════════════════════════════════════════

let _scoutAbortCtrl = null;
let _scoutHistory = [];
let _scoutMatchup = null;
let _scoutSessionContext = null; // rolling session context for scout view

// ── Populate team select in scout view ───────────────────────────────────────
function populateScoutTeamSelect() {
  const sel = document.getElementById("scout-team-select");
  if (!sel || sel.options.length > 1) return;
  if (!ALL_NODES || ALL_NODES.length === 0) {
    setTimeout(populateScoutTeamSelect, 500);
    return;
  }
  const sorted = [...ALL_NODES].sort((a, b) =>
    a.full_name.localeCompare(b.full_name),
  );
  sel.innerHTML = '<option value="">Select a team…</option>';
  sorted.forEach((n) => {
    const opt = document.createElement("option");
    opt.value = n.id;
    const seed = n.seed != null ? ` #${n.seed}` : "";
    opt.textContent = `${n.full_name} (${n.region}${seed})`;
    sel.appendChild(opt);
  });
}

// ── Fetch + render team stats into scout left panel ───────────────────────────
async function fetchScoutTeamStats(teamId) {
  const sel = document.getElementById("scout-team-select");
  const id = teamId || sel?.value;
  if (!id) return;

  if (sel && sel.value !== id) sel.value = id;

  const output = document.getElementById("scout-stats-output");
  if (!output) return;

  // Wait for ALL_NODES to be populated (graph_data.json fetch may still be in flight)
  if (!ALL_NODES || ALL_NODES.length === 0) {
    output.innerHTML = loadingHTML("Loading team data…");
    await new Promise((resolve) => {
      const check = () =>
        ALL_NODES && ALL_NODES.length > 0 ? resolve() : setTimeout(check, 200);
      check();
    });
  }

  const node = ALL_NODES?.find((n) => n.id === id);
  if (!node) {
    output.innerHTML =
      '<div class="ai-error">Team not found. Try selecting from the dropdown.</div>';
    return;
  }

  output.innerHTML = loadingHTML("Loading stats…");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);

  try {
    const [espnRes, tData] = await Promise.all([
      fetch(
        `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${id}/statistics`,
        { signal: ctrl.signal },
      ),
      window.getTorvik(),
    ]);
    clearTimeout(timer);

    const espnData = await espnRes.json();
    const cats = espnData?.results?.stats?.categories ?? [];
    const statsMap = {};
    cats.forEach((cat) => {
      cat.stats.forEach((s) => {
        statsMap[`${cat.name}:${s.name}`] = s;
      });
    });
    const get = (cat, name) => statsMap[`${cat}:${name}`]?.displayValue ?? "—";
    const pct = (cat, name) => {
      const v = get(cat, name);
      return v === "—" ? "—" : v + "%";
    };

    let record = `${node.wins_vs_field}W vs bracket field`;
    try {
      const ctrl2 = new AbortController();
      setTimeout(() => ctrl2.abort(), 5000);
      const tr = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${id}`,
        { signal: ctrl2.signal },
      );
      const td = await tr.json();
      record = td?.team?.record?.items?.[0]?.summary ?? record;
    } catch (_) {}

    const tv = tData?.teams?.[id]?.torvik ?? null;
    const rgbMap = {
      East: "#4a7fb5",
      West: "#3a8c6e",
      South: "#b89030",
      Midwest: "#b84545",
    };
    const rc = rgbMap[node.region] ?? "#b0a898";

    const tBlock = tv
      ? `
      <div class="stats-section-label">TORVIK T-RANK</div>
      <div class="stats-grid-2">
        <div class="stat-cell torvik-cell"><div class="sv torvik-rank">#${tv.rank}</div><div class="sl">T-Rank</div></div>
        <div class="stat-cell torvik-cell"><div class="sv" style="color:var(--accent)">${tv.adj_em > 0 ? "+" : ""}${tv.adj_em}</div><div class="sl">AdjEM</div></div>
        <div class="stat-cell torvik-cell"><div class="sv" style="color:var(--west)">${tv.adj_oe}</div><div class="sl">AdjOE</div></div>
        <div class="stat-cell torvik-cell"><div class="sv" style="color:var(--midwest)">${tv.adj_de}</div><div class="sl">AdjDE</div></div>
        <div class="stat-cell torvik-cell"><div class="sv">${(tv.barthag * 100).toFixed(1)}%</div><div class="sl">Barthag</div></div>
        <div class="stat-cell torvik-cell"><div class="sv">${tv.wab > 0 ? "+" : ""}${parseFloat(tv.wab).toFixed(1)}</div><div class="sl">WAB</div></div>
        <div class="stat-cell torvik-cell"><div class="sv">${tv.adj_tempo != null ? (tv.adj_tempo >= 0.8 ? "Fast" : tv.adj_tempo >= 0.6 ? "Mod." : "Slow") + " (" + tv.adj_tempo.toFixed(2) + ")" : "—"}</div><div class="sl">Pace</div></div>
        <div class="stat-cell torvik-cell"><div class="sv">${tv.luck > 0 ? "+" : ""}${parseFloat(tv.luck).toFixed(3)}</div><div class="sl">Luck</div></div>
        <div class="stat-cell torvik-cell"><div class="sv">${tv.two_p != null ? tv.two_p + "%" : "—"}</div><div class="sl">2P%</div></div>
        <div class="stat-cell torvik-cell"><div class="sv">${tv.three_p != null ? tv.three_p + "%" : "—"}</div><div class="sl">3P%</div></div>
        <div class="stat-cell torvik-cell"><div class="sv">${tv.ft_pct != null ? tv.ft_pct + "%" : "—"}</div><div class="sl">FT%</div></div>
        <div class="stat-cell torvik-cell"><div class="sv">${tv.efg != null ? tv.efg + "%" : "—"}</div><div class="sl">eFG%</div></div>
      </div>`
      : `<div class="torvik-missing">Torvik data unavailable</div>`;

    output.innerHTML = `
      <div class="stats-card">
        <div class="stats-card-name" style="border-left:3px solid ${rc};padding-left:8px">${node.full_name}</div>
        <div class="stats-card-sub">${node.region} · Seed #${node.seed} · ${record}</div>
        <div class="stats-section-label">ESPN BOX STATS</div>
        <div class="stats-grid-2">
          <div class="stat-cell"><div class="sv">${get("offensive", "avgPoints")}</div><div class="sl">PPG</div></div>
          <div class="stat-cell"><div class="sv">${get("general", "avgRebounds")}</div><div class="sl">RPG</div></div>
          <div class="stat-cell"><div class="sv">${get("offensive", "avgAssists")}</div><div class="sl">APG</div></div>
          <div class="stat-cell"><div class="sv">${get("offensive", "avgTurnovers")}</div><div class="sl">TOPG</div></div>
          <div class="stat-cell"><div class="sv">${pct("offensive", "fieldGoalPct")}</div><div class="sl">FG%</div></div>
          <div class="stat-cell"><div class="sv">${pct("offensive", "threePointFieldGoalPct")}</div><div class="sl">3P%</div></div>
          <div class="stat-cell"><div class="sv">${pct("offensive", "twoPointFieldGoalPct")}</div><div class="sl">2P%</div></div>
          <div class="stat-cell"><div class="sv">${pct("offensive", "freeThrowPct")}</div><div class="sl">FT%</div></div>
          <div class="stat-cell"><div class="sv">${get("general", "assistTurnoverRatio")}</div><div class="sl">AST/TO</div></div>
          <div class="stat-cell"><div class="sv">${get("defensive", "avgSteals")}</div><div class="sl">SPG</div></div>
          <div class="stat-cell"><div class="sv">${get("defensive", "avgBlocks")}</div><div class="sl">BPG</div></div>
          <div class="stat-cell"><div class="sv">${get("offensive", "avgThreePointFieldGoalsMade")} / ${get("offensive", "avgThreePointFieldGoalsAttempted")}</div><div class="sl">3PM/A</div></div>
        </div>
        ${tBlock}
      </div>
      <div style="font-size:.62rem;color:var(--text-mute);margin-top:4px;line-height:1.5">
        ESPN: 2025-26 season · Torvik: ${tData?.generated_at?.slice(0, 10) ?? "recent"}
      </div>`;
  } catch (err) {
    clearTimeout(timer);
    output.innerHTML = `<div class="ai-error">Failed: ${err.name === "AbortError" ? "Timed out" : err.message}</div>`;
  }
}

// ── Send message in scout chat ────────────────────────────────────────────────
async function sendScoutChat() {
  const input = document.getElementById("scout-input");
  const msg = input?.value.trim();
  if (!msg) return;

  input.value = "";
  autoGrowTextarea(input);

  const messages = document.getElementById("scout-messages");
  if (!messages) return;

  // User bubble
  messages.insertAdjacentHTML(
    "beforeend",
    `
    <div class="chat-msg-user">${escapeHtml(msg)}</div>`,
  );

  // AI bubble placeholder
  const aiEl = document.createElement("div");
  aiEl.className = "chat-bubble-ai";
  aiEl.innerHTML = `<div class="chat-bubble-ai-label">Scout</div><div class="chat-bubble-ai-body">${loadingHTML("Thinking…")}</div>`;
  messages.appendChild(aiEl);
  messages.scrollTop = messages.scrollHeight;

  // Update send/stop buttons
  const sendBtn = document.getElementById("scout-send-btn");
  const stopBtn = document.getElementById("scout-stop-btn");
  if (sendBtn) sendBtn.style.display = "none";
  if (stopBtn) stopBtn.style.display = "flex";

  _scoutAbortCtrl = new AbortController();

  try {
    _scoutHistory.push({ role: "user", content: msg });

    // Detect matchup intent using existing function
    const matchup = detectMatchupIntent(msg);
    const useMultiAgent = matchup !== null;

    if (useMultiAgent) {
      aiEl.innerHTML = `<div class="chat-bubble-ai-label">Scout · Multi-Agent</div><div class="chat-bubble-ai-body">${loadingHTML("Running 4 specialist agents…")}</div>`;
      messages.scrollTop = messages.scrollHeight;

      const data = await callAnalyze(
        matchup.team_a,
        matchup.team_b,
        _scoutAbortCtrl.signal,
        msg,
      );
      _scoutMatchup = { team_a: matchup.team_a, team_b: matchup.team_b };

      // Update matchup meta in header
      const metaEl = document.getElementById("scout-active-matchup");
      if (metaEl) metaEl.textContent = `${matchup.team_a} vs ${matchup.team_b}`;

      // Auto-load team A stats in left panel
      // Exact label match first, then word-boundary full_name match
      // Prevents "Michigan" from matching "Michigan State"
      const _teamAQ = matchup.team_a.toLowerCase();
      const nodeA =
        ALL_NODES?.find((n) => n.label.toLowerCase() === _teamAQ) ??
        ALL_NODES?.find((n) => n.full_name.toLowerCase() === _teamAQ) ??
        ALL_NODES?.find((n) => {
          const fn = n.full_name.toLowerCase();
          // only match if query is a whole word in the full name
          const re = new RegExp(
            "\\b" + _teamAQ.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b",
          );
          return (
            re.test(fn) &&
            !fn.startsWith(_teamAQ + " state") &&
            !fn.startsWith(_teamAQ + " st")
          );
        });
      if (nodeA) fetchScoutTeamStats(nodeA.id);

      const agentSteps = (data.agent_results || []).map(
        (r) => `${r.agent} agent: ${r.win_pct}% for ${matchup.team_a}`,
      );
      agentSteps.push("synthesis: weighted confidence interval");

      const thinkHtml = `
        <div class="thinking-block thinking-done">
          <div class="thinking-header">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span class="thinking-label">Multi-agent analysis complete</span>
          </div>
          <div class="thinking-steps">
            ${agentSteps.map((s) => `<div class="thinking-step">${escapeHtml(s)}</div>`).join("")}
          </div>
        </div>`;

      const confHtml =
        data.confidence?.win_pct !== undefined
          ? renderConfidence(data.confidence, data.odds_data)
          : "";
      const reasoning = data.confidence?.reasoning ?? "Analysis complete.";
      _scoutHistory.push({
        role: "assistant",
        content: `Multi-agent analysis of ${matchup.team_a} vs ${matchup.team_b}: ${reasoning}`,
      });
      // confHtml already contains all structured sections — don't repeat reasoning below it
      aiEl.innerHTML = `<div class="chat-bubble-ai-label">Scout · Multi-Agent</div>${thinkHtml}${confHtml}`;
    } else {
      // Standard chat path — streaming
      const historyForApi = _scoutHistory.slice(-12);
      const thinkingSteps = [];
      let streamedText = "";

      // Render thinking steps and text chunks as they arrive
      const { text, thinking } = await callAI(
        historyForApi,
        msg,
        _scoutAbortCtrl.signal,
        {
          sessionContext: _scoutSessionContext,
          onContext: (ctx) => {
            _scoutSessionContext = ctx;
          },
          onThinking: (label) => {
            thinkingSteps.push(label);
            aiEl.innerHTML = `
            <div class="thinking-block thinking-done">
              <div class="thinking-header">
                <span class="thinking-spinner"></span>
                <span class="thinking-label">Thinking…</span>
              </div>
              <div class="thinking-steps">${thinkingSteps.map((s) => `<div class="thinking-step">${escapeHtml(s)}</div>`).join("")}</div>
            </div>
            <div class="chat-bubble-ai-label">Scout</div>
            <div class="chat-bubble-ai-body chat-streaming"></div>`;
          },
          onChunk: (chunk) => {
            streamedText += chunk;
            let el = aiEl.querySelector(".chat-streaming");
            if (!el) {
              el = document.createElement("div");
              el.className = "chat-bubble-ai-body chat-streaming";
              aiEl.appendChild(el);
            }
            el.textContent = streamedText; // plain text while streaming — no broken markdown
            messages.scrollTop = messages.scrollHeight;
          },
        },
      );

      _scoutHistory.push({ role: "assistant", content: text });

      const thinkHtml = thinkingSteps.length
        ? `
        <div class="thinking-block thinking-done">
          <div class="thinking-header">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span class="thinking-label">Thought for a moment</span>
          </div>
          <div class="thinking-steps">${thinkingSteps.map((s) => `<div class="thinking-step">${escapeHtml(s)}</div>`).join("")}</div>
        </div>`
        : "";

      aiEl.innerHTML = `<div class="chat-bubble-ai-label">Scout</div>${thinkHtml}<div class="chat-bubble-ai-body">${renderMarkdown(text)}</div>`;
    }
  } catch (err) {
    if (err.name === "AbortError") {
      aiEl.innerHTML = `<div class="chat-bubble-ai-label">Scout</div><div class="chat-bubble-ai-body" style="color:var(--text-mute)">Stopped.</div>`;
    } else {
      aiEl.innerHTML = `<div class="chat-bubble-ai-label">Scout</div><div class="chat-bubble-ai-body" style="color:var(--midwest)">${escapeHtml(err.message)}</div>`;
    }
  } finally {
    if (sendBtn) sendBtn.style.display = "flex";
    if (stopBtn) stopBtn.style.display = "none";
    messages.scrollTop = messages.scrollHeight;
  }
}

function stopScoutChat() {
  _scoutAbortCtrl?.abort();
}

function scoutInsertHint(text) {
  const input = document.getElementById("scout-input");
  if (input) {
    input.value = text;
    input.focus();
    autoGrowTextarea(input);
  }
}

// ── Auto-grow textarea ────────────────────────────────────────────────────────
function autoGrowTextarea(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 120) + "px";
}

// ── Wire scout input enter key ────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("scout-input");
  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendScoutChat();
      }
    });
    input.addEventListener("input", () => autoGrowTextarea(input));
  }

  // Wire stats page team select change
  const statsPageSel = document.getElementById("stats-page-team-select");
  if (statsPageSel) {
    statsPageSel.addEventListener("change", () => {
      if (statsPageSel.value) fetchStatsPageTeam(statsPageSel.value);
    });
  }

  // Wire scout team select change
  const scoutSel = document.getElementById("scout-team-select");
  if (scoutSel) {
    scoutSel.addEventListener("change", () => {
      if (scoutSel.value) fetchScoutTeamStats(scoutSel.value);
    });
  }
});

// ── Dynamic hint pills from live upcoming games ───────────────────────────────
async function populateScoutHints() {
  const container = document.getElementById("scout-hint-pills");
  if (!container) return;
  try {
    const res = await fetch("data/espn_odds.json");
    const data = await res.json();
    const upcoming = Object.values(data.games || {})
      .filter((g) => !g.completed && g.home && g.away)
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
      .slice(0, 3);
    if (!upcoming.length) return;

    const pills = upcoming
      .map((g) => {
        const homeShort = g.home.split(" ").pop();
        const awayShort = g.away.split(" ").pop();
        return `<button class="hint-pill" onclick="scoutInsertHint('${g.away} vs ${g.home}')">${awayShort} vs ${homeShort} 🏀</button>`;
      })
      .join("");

    container.innerHTML =
      pills +
      `<button class="hint-pill" onclick="scoutInsertHint('Best upset picks remaining')">Upset picks</button>` +
      `<button class="hint-pill" onclick="scoutInsertHint('Who are the Final Four favorites?')">Final Four</button>`;
  } catch {
    /* keep static fallback */
  }
}

// ── Init scout view when activated ───────────────────────────────────────────
function initScoutView() {
  populateScoutTeamSelect();
  populateScoutHints();
}

// Expose
window.fetchScoutTeamStats = fetchScoutTeamStats;
window.fetchStatsPageTeam = fetchStatsPageTeam;
window.sendScoutChat = sendScoutChat;
window.stopScoutChat = stopScoutChat;
window.scoutInsertHint = scoutInsertHint;
window.initScoutView = initScoutView;
