/**
 * leaderboard.js — projected tournament field, refreshed daily by
 * scripts/project_field.py (data/leaderboard.json).
 */
(async function () {
  const el = document.getElementById('field-table');
  let board;
  try {
    board = await (await fetch('data/leaderboard.json')).json();
  } catch {
    el.innerHTML = '<div class="odds-loading">Projection not available.</div>';
    return;
  }

  document.getElementById('field-meta').textContent =
    `${board.season_str} season · ${board.games_counted.toLocaleString()} games through ${board.date}` +
    ` · field picked ${Math.round((1 - board.resume_share) * 100)}% on rating, ${Math.round(board.resume_share * 100)}% on résumé (WAB)`;

  const STATUS = { auto: 'Auto bid', 'at-large': 'At-large', bubble: 'First out', out: '' };
  const move = (t) => {
    if (t.prev_rank == null || t.prev_rank === t.rank) return '<span class="fl-flat">–</span>';
    const d = t.prev_rank - t.rank;
    return d > 0 ? `<span class="fl-up">▲${d}</span>` : `<span class="fl-down">▼${-d}</span>`;
  };

  el.innerHTML = `
    <table class="fl-table">
      <thead><tr>
        <th>#</th><th></th><th class="fl-left">Team</th><th class="fl-left">Conference</th>
        <th>Record</th><th>Rating</th><th title="Wins above bubble: wins minus what a bubble team would expect against the same schedule">WAB</th><th>Seed</th><th class="fl-left">Projection</th>
      </tr></thead>
      <tbody>${board.teams.map((t) => `
        <tr class="fl-${t.status}"${t.seed ? ` onclick="switchView('graph');setTimeout(()=>focusTeam('${t.espn_id}'),80)"` : ''}>
          <td class="fl-num">${t.rank}</td>
          <td class="fl-num">${move(t)}</td>
          <td class="fl-left fl-team">${t.name}</td>
          <td class="fl-left fl-dim">${t.conf}</td>
          <td class="fl-num">${t.record}</td>
          <td class="fl-num">${t.rating > 0 ? '+' : ''}${t.rating.toFixed(1)}</td>
          <td class="fl-num">${t.wab > 0 ? '+' : ''}${t.wab.toFixed(1)}</td>
          <td class="fl-num">${t.seed ?? ''}</td>
          <td class="fl-left">${t.region ? `<span class="rpill ${t.region.toLowerCase()}">${t.region}</span> ` : ''}<span class="fl-dim">${STATUS[t.status]}</span></td>
        </tr>`).join('')}
      </tbody>
    </table>`;
})();
