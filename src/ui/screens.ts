// Full-screen UI: start screen (campaign + faction select), mission briefing,
// pause menu, win/loss screens.
import { FACTION_DEFS } from '../core/defs';
import type { CampaignDef, MissionDef, FactionDef } from '../core/types';
import { loadCampaignList, loadMission } from '../campaign/campaign';
import { showUnitCodex } from './unitCodex';
import { DIFFICULTIES, DIFFICULTY_ORDER, DEFAULT_DIFFICULTY, type DifficultyId } from '../data/difficulty';
import { doctrinesFor, defaultDoctrineFor } from '../data/doctrines';
import { buildCommanderBanner } from './commanderProfile';
import { showLocalScores } from './localScores';
import { formatScore, formatDuration, formatSigned, difficultyLabel, breakdownRows, type MatchResultView } from './scoreFormat';
import { factionCardView, factionDetailsView } from './factionCardView';
import { showAdminTools } from './adminTools';

const root = () => document.getElementById('ui-root')!;

/** Escape user-provided text (commander name) before HTML interpolation. */
function escapeText(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function el(html: string): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

/**
 * Faction details modal: the long strengths/weaknesses/profile that used to bloat
 * the card. A fixed overlay → it never grows the start screen's height. Closable
 * via the ✕ button, a backdrop click, or Escape. Read-only; no gameplay effect.
 */
function showFactionDetails(f: FactionDef): void {
  const d = factionDetailsView(f);
  const overlay = el(`
    <div class="faction-details-overlay">
      <div class="faction-modal tac-panel" style="--fc:${f.color}">
        <div class="swatch"></div>
        <div class="fm-head">
          <h3>${escapeText(d.name)}</h3>
          <button class="fm-close" type="button" aria-label="Schließen">✕</button>
        </div>
        <div class="fm-tag">${escapeText(d.tagline)}</div>
        ${d.doctrineLabel ? `<div class="fm-doctrine"><b>${escapeText(d.doctrineLabel)}</b></div>` : ''}
        ${d.profile ? `<div class="tac-grid">
          <span>Bau</span><b>${escapeText(d.profile.build)}</b>
          <span>Angriff</span><b>${escapeText(d.profile.attack)}</b>
          <span>Verteidigung</span><b>${escapeText(d.profile.defense)}</b>
          <span>Wirtschaft</span><b>${escapeText(d.profile.economy)}</b>
        </div>` : ''}
        <div class="fm-cols">
          ${d.strengths.length ? `<div><div class="fm-h">Stärken</div><ul class="sw">${d.strengths.map(s => `<li class="pos">+ ${escapeText(s)}</li>`).join('')}</ul></div>` : ''}
          ${d.weaknesses.length ? `<div><div class="fm-h">Schwächen</div><ul class="sw">${d.weaknesses.map(s => `<li class="neg">− ${escapeText(s)}</li>`).join('')}</ul></div>` : ''}
        </div>
        ${d.recommendation ? `<div class="reco">▸ ${escapeText(d.recommendation)}</div>` : ''}
      </div>
    </div>
  `);
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('.fm-close')!.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  root().appendChild(overlay);
}

export interface MissionChoice {
  campaign: CampaignDef;
  mission: MissionDef;
  factionId: string;
  difficulty: DifficultyId;
  doctrineId: string;     // player's chosen Tactical Doctrine
}

/** Start screen flow: title -> campaign select -> faction select -> difficulty -> briefing. */
export async function showStartScreen(): Promise<MissionChoice> {
  const campaigns = await loadCampaignList();
  let factionId = 'red';
  let difficulty: DifficultyId = DEFAULT_DIFFICULTY;
  let doctrineId = defaultDoctrineFor(factionId).id;

  return new Promise<MissionChoice>((resolve) => {
    const screen = el(`
      <div class="screen cinematic deploy-layout">
        <div class="screen-scroll">
          <div id="cmdr-banner-host"></div>
          <div class="subtitle">A real-time strategy game</div>
          <h1>Vireon Front</h1>
          <h2>HOSTILE WORLD &middot; CRYSTAL WAR</h2>
          <div class="menu-box tac-panel">
            <div class="menu-head">SELECT CAMPAIGN</div>
            <div id="campaign-list" style="display:flex;flex-direction:column;gap:8px;"></div>
          </div>
          <div class="menu-box tac-panel">
            <div class="menu-head">SCHWIERIGKEITSGRAD</div>
            <div class="menu-sub">Stärke der gegnerischen KI (ganze Partie)</div>
            <div class="difficulty-row" id="difficulty-row" style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;"></div>
          </div>
          <div class="menu-box tac-panel">
            <div class="menu-head">FRAKTION WÄHLEN</div>
            <div class="menu-sub">Feste Identität je Fraktion · Gegner = zufällige andere</div>
            <div class="faction-row" id="faction-row" style="justify-content:center;"></div>
          </div>
          <div class="adv-wrap">
            <button id="adv-toggle" class="adv-toggle" type="button">⚙ Erweitert</button>
            <div id="adv-box" class="adv-box" style="display:none;">
              <label class="doctrine-pick">KI-Doktrin-Vorschau (Advanced — verändert dein Gameplay noch nicht)
                <select id="adv-doctrine"></select></label>
            </div>
          </div>
        </div>
        <div class="screen-cta">
          <button class="primary" id="btn-start" style="font-size:18px;padding:13px 52px;letter-spacing:3px;">⬢ DEPLOY</button>
          <button id="btn-codex" style="padding:12px 30px;letter-spacing:2px;">⬡ UNIT CODEX</button>
          <button id="btn-scores" style="padding:12px 30px;letter-spacing:2px;">★ LOCAL SCORES</button>
          <button id="btn-tools" style="padding:12px 22px;letter-spacing:2px;font-size:13px;">⚙ TOOLS</button>
        </div>
      </div>
    `);

    // "Continue as <Commander>" banner (local profile · rename/delete). Re-mounts
    // itself after a rename so the displayed name refreshes.
    const bannerHost = screen.querySelector('#cmdr-banner-host') as HTMLElement;
    const mountBanner = () => { bannerHost.innerHTML = ''; bannerHost.appendChild(buildCommanderBanner(mountBanner)); };
    mountBanner();

    screen.querySelector('#btn-codex')!.addEventListener('click', async () => {
      screen.style.display = 'none';
      await showUnitCodex();
      screen.style.display = '';
    });

    screen.querySelector('#btn-scores')!.addEventListener('click', async () => {
      screen.style.display = 'none';
      await showLocalScores();
      screen.style.display = '';
    });

    // Admin / Tools: one compact entry point for performance settings + dev links
    // (keeps the start screen clean instead of scattering more buttons). Overlay.
    screen.querySelector('#btn-tools')!.addEventListener('click', () => showAdminTools());

    const list = screen.querySelector('#campaign-list')!;
    let chosen = { campaign: campaigns[0], missionRef: campaigns[0].missions[0] };
    for (const c of campaigns) {
      for (const m of c.missions) {
        const item = el(`
          <button class="campaign-item">
            <div><strong>${c.name}</strong> — Mission: ${m.name}</div>
            <div class="desc">${c.description}</div>
          </button>
        `);
        item.addEventListener('click', () => {
          chosen = { campaign: c, missionRef: m };
          list.querySelectorAll('button').forEach(b => b.classList.remove('primary'));
          item.classList.add('primary');
        });
        list.appendChild(item);
      }
    }
    (list.firstElementChild as HTMLElement)?.classList.add('primary');

    const row = screen.querySelector('#faction-row')!;
    for (const f of Object.values(FACTION_DEFS)) {
      const cv = factionCardView(f);
      // Compact card: identity + doctrine + up to 3 playstyle traits + ⓘ Details.
      // No faction "difficulty/Anspruch" badge (factions are playstyle, not
      // difficulty) and no long strengths/weaknesses lists (those live in the
      // details modal) — keeps the screen inside the viewport.
      const card = el(`
        <div class="faction-card" style="--fc:${f.color}">
          <div class="swatch"></div>
          <h3>${escapeText(cv.name)}</h3>
          <div class="tag">${escapeText(cv.tagline)}</div>
          ${cv.doctrineLabel ? `<div class="tac-label"><b>${escapeText(cv.doctrineLabel)}</b></div>` : ''}
          ${cv.traits.length ? `<div class="fc-traits">${cv.traits.map(tr => `<span>${escapeText(tr)}</span>`).join('')}</div>` : ''}
          <button class="fc-details-btn" type="button">ⓘ Details</button>
        </div>
      `);
      if (f.id === factionId) card.classList.add('selected');
      card.addEventListener('click', () => {
        factionId = f.id;
        doctrineId = defaultDoctrineFor(f.id).id;   // faction's default AI persona
        row.querySelectorAll('.faction-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        renderAdvDoctrine();
      });
      card.querySelector('.fc-details-btn')!.addEventListener('click', (e) => {
        e.stopPropagation();        // open details without also toggling selection
        showFactionDetails(f);
      });
      row.appendChild(card);
    }

    // Advanced (hidden by default): preview/override the AI persona. This has NO
    // player-gameplay effect yet — the player still commands manually — so it is
    // tucked away to avoid implying a mandatory doctrine choice.
    function renderAdvDoctrine() {
      const advSel = screen.querySelector('#adv-doctrine') as HTMLSelectElement;
      advSel.innerHTML = doctrinesFor(factionId).map(d => `<option value="${d.id}">${d.uiName}</option>`).join('');
      advSel.value = doctrineId;
    }
    const advBox = screen.querySelector('#adv-box') as HTMLElement;
    screen.querySelector('#adv-toggle')!.addEventListener('click', () => {
      advBox.style.display = advBox.style.display === 'none' ? 'block' : 'none';
    });
    screen.querySelector('#adv-doctrine')!.addEventListener('change', (e) => {
      doctrineId = (e.target as HTMLSelectElement).value;
    });
    renderAdvDoctrine();

    // Difficulty selector (default = Mittel).
    const diffRow = screen.querySelector('#difficulty-row')!;
    for (const id of DIFFICULTY_ORDER) {
      const d = DIFFICULTIES[id];
      const btn = el(`<button class="difficulty-btn" title="${d.blurb}"><b>${d.uiName}</b><span>${d.blurb}</span></button>`);
      if (id === difficulty) btn.classList.add('primary');
      btn.addEventListener('click', () => {
        difficulty = id;
        diffRow.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('primary'));
        btn.classList.add('primary');
      });
      diffRow.appendChild(btn);
    }

    screen.querySelector('#btn-start')!.addEventListener('click', async () => {
      const mission = await loadMission(chosen.campaign.id, chosen.missionRef.file);
      screen.remove();
      resolve({ campaign: chosen.campaign, mission, factionId, difficulty, doctrineId });
    });

    root().appendChild(screen);
  });
}

/** Mission briefing; resolves when the player launches. Shows the player's
 *  FACTION tactical profile (the fixed identity) — not a per-match doctrine. */
export function showBriefing(mission: MissionDef, faction: FactionDef): Promise<void> {
  const tp = faction.tactical;
  const profileLine = tp
    ? `<div class="brief-profile">Tactical Profile: <b>${tp.doctrineLabel}</b></div>
       <div class="brief-stats">Bau: ${tp.build} · Angriff: ${tp.attack} · Verteidigung: ${tp.defense} · Wirtschaft: ${tp.economy}</div>`
    : '';
  return new Promise((resolve) => {
    const screen = el(`
      <div class="screen cinematic" style="justify-content:center;">
        <h2 style="letter-spacing:6px;">MISSION BRIEFING</h2>
        <div class="briefing-box tac-panel">
          <div style="font-size:22px;font-weight:700;">${mission.name}</div>
          <div style="font-size:12px;color:var(--text-dim);">COMMANDING: ${faction.name}</div>
          ${profileLine}
          <p>${mission.briefing}</p>
          <div class="objectives">${mission.objectives.map(o => `<div>${o}</div>`).join('')}</div>
          <button class="primary" id="btn-launch" style="align-self:center;padding:11px 40px;letter-spacing:2px;">COMMENCE OPERATION</button>
        </div>
      </div>
    `);
    screen.querySelector('#btn-launch')!.addEventListener('click', () => { screen.remove(); resolve(); });
    root().appendChild(screen);
  });
}

export interface PauseResult { action: 'resume' | 'restart' | 'quit' }
export function showPauseMenu(): Promise<PauseResult> {
  return new Promise((resolve) => {
    const screen = el(`
      <div class="screen" style="background:rgba(8,7,18,0.78);">
        <h2 style="letter-spacing:6px;">PAUSED</h2>
        <div class="menu-box panel">
          <button class="primary" data-a="resume">Resume</button>
          <button data-a="restart">Restart Mission</button>
          <button data-a="quit">Quit to Menu</button>
        </div>
      </div>
    `);
    screen.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      screen.remove();
      resolve({ action: b.dataset.a as PauseResult['action'] });
    }));
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.removeEventListener('keydown', esc);
        screen.remove();
        resolve({ action: 'resume' });
      }
    };
    window.addEventListener('keydown', esc);
    root().appendChild(screen);
  });
}

export function showEndScreen(victory: boolean, stats: string, result?: MatchResultView): Promise<'restart' | 'menu'> {
  return new Promise((resolve) => {
    // Local score block (only when a Commander Profile exists → result provided).
    // Reuses the already-computed/stored score — no recalculation, no re-save.
    const scoreBlock = result ? `
      <div class="menu-box panel" style="max-width:420px;margin:0 auto 10px;text-align:left;">
        <div style="text-align:center;margin-bottom:6px;">
          <div style="font-size:12px;color:var(--text-dim);letter-spacing:1px;">COMMANDER ${escapeText(result.commanderName).toUpperCase()}</div>
          <div style="font-size:30px;font-weight:800;">${formatScore(result.score)}</div>
          <div style="font-size:12px;color:var(--text-dim);">${difficultyLabel(result.difficulty)} · ${formatDuration(result.durationSeconds)}</div>
        </div>
        <div style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;margin:8px 0 4px;">Breakdown</div>
        ${breakdownRows(result.breakdown).map(r => `<div style="display:flex;justify-content:space-between;font-size:13px;padding:1px 0;"><span>${r.label}</span><span style="font-variant-numeric:tabular-nums;">${formatSigned(r.value)}</span></div>`).join('')}
      </div>` : '';
    const screen = el(`
      <div class="screen endscreen">
        <h1 class="${victory ? 'victory' : 'defeat'}">${victory ? 'VICTORY' : 'DEFEAT'}</h1>
        <div class="stats">${stats}</div>
        ${scoreBlock}
        <div class="menu-box panel">
          <button class="primary" data-a="restart">${victory ? 'Play Again' : 'Retry Mission'}</button>
          <button data-a="menu">Back to Menu</button>
        </div>
      </div>
    `);
    screen.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      screen.remove();
      resolve(b.dataset.a as 'restart' | 'menu');
    }));
    root().appendChild(screen);
  });
}

let toastTimer = 0;
export function toast(msg: string) {
  let t = document.getElementById('toast');
  if (!t) {
    t = el(`<div id="toast" class="panel"></div>`);
    root().appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t!.classList.remove('show'), 2600);
}
