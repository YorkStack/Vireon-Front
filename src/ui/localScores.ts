// Local Scores screen (offline, read-only over the existing stores). Shows the
// Commander aggregates + the top-10 local score entries. No backend, no network.
import { LocalStorageLeaderboardStore } from '../platform/leaderboard/LocalLeaderboardStore';
import { LocalStorageCommanderProfileStore } from '../platform/profile/CommanderProfileStore';
import { leaderboardRows, formatScore, type LeaderboardRowView } from './scoreFormat';

const root = () => document.getElementById('ui-root')!;
function el(html: string): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}
function esc(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function rowHtml(r: LeaderboardRowView): string {
  return `<tr>
    <td style="color:var(--text-dim);">${r.rank}</td>
    <td style="font-weight:700;font-variant-numeric:tabular-nums;">${r.score}</td>
    <td class="${r.outcome === 'Victory' ? 'victory' : 'defeat'}">${r.outcome}</td>
    <td>${r.faction}</td>
    <td>${r.difficulty}</td>
    <td style="font-variant-numeric:tabular-nums;">${r.duration}</td>
    <td style="color:var(--text-dim);">${r.date}</td>
  </tr>`;
}

/** Show the Local Scores screen. Resolves when the player clicks Back. */
export function showLocalScores(): Promise<void> {
  const profileStore = new LocalStorageCommanderProfileStore();
  const leaderboardStore = new LocalStorageLeaderboardStore();

  return new Promise<void>((resolve) => {
    const render = () => {
      const profile = profileStore.getProfile();
      const rows = leaderboardRows(leaderboardStore.getTopScores(10), 10);

      const header = profile
        ? `<div style="font-size:20px;font-weight:700;">${esc(profile.displayName)}</div>
           <div style="font-size:13px;color:var(--text-dim);margin-top:2px;">Matches: ${profile.totalMatches} &nbsp;|&nbsp; Wins: ${profile.wins} &nbsp;|&nbsp; Losses: ${profile.losses} &nbsp;|&nbsp; Best: ${formatScore(profile.bestScore)}</div>`
        : `<div style="font-size:14px;color:var(--text-dim);">Kein Commander-Profil — starte ein Spiel, um Scores zu sammeln.</div>`;

      const table = rows.length
        ? `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:6px;">
            <thead><tr style="color:var(--text-dim);text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;">
              <th>#</th><th>Score</th><th>Result</th><th>Faction</th><th>Difficulty</th><th>Time</th><th>Date</th>
            </tr></thead>
            <tbody>${rows.map(rowHtml).join('')}</tbody>
          </table>`
        : `<div style="font-size:13px;color:var(--text-dim);padding:12px 0;">Noch keine lokalen Scores. Beende ein Match, um deinen ersten Eintrag zu speichern.</div>`;

      const screen = el(`
        <div class="screen cinematic">
          <div class="subtitle">Vireon Front</div>
          <h1>LOCAL SCORES</h1>
          <div class="menu-box tac-panel" style="max-width:760px;margin:0 auto;text-align:left;">
            <div style="text-align:center;">${header}</div>
            <div class="menu-head" style="margin-top:14px;">TOP LOCAL SCORES</div>
            ${table}
          </div>
          <div class="screen-cta" style="margin-top:14px;">
            <button class="primary" id="ls-back" style="padding:11px 40px;letter-spacing:2px;">◂ Back</button>
            ${rows.length ? `<button id="ls-clear" style="padding:11px 28px;">Clear Local Scores</button>` : ''}
          </div>
          <div style="color:var(--text-dim);font-size:11px;margin-top:8px;">Lokal im Browser gespeichert · kein Online-Leaderboard.</div>
        </div>
      `);

      screen.querySelector('#ls-back')!.addEventListener('click', () => { screen.remove(); resolve(); });
      const clearBtn = screen.querySelector('#ls-clear');
      if (clearBtn) clearBtn.addEventListener('click', () => {
        const ok = typeof confirm === 'function' ? confirm('Alle lokalen Scores löschen? (Commander-Profil bleibt erhalten.)') : true;
        if (!ok) return;
        leaderboardStore.clearScores(); // profile + progress untouched
        screen.remove();
        render(); // re-render the now-empty screen
      });

      root().appendChild(screen);
    };
    render();
  });
}
