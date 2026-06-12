// Full-screen UI: start screen (campaign + faction select), mission briefing,
// pause menu, win/loss screens.
import { FACTION_DEFS } from '../core/defs';
import type { CampaignDef, MissionDef } from '../core/types';
import { loadCampaignList, loadMission } from '../campaign/campaign';
import { showUnitCodex } from './unitCodex';

const root = () => document.getElementById('ui-root')!;

function el(html: string): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

export interface MissionChoice {
  campaign: CampaignDef;
  mission: MissionDef;
  factionId: string;
}

/** Start screen flow: title -> campaign select -> faction select -> briefing. */
export async function showStartScreen(): Promise<MissionChoice> {
  const campaigns = await loadCampaignList();
  let factionId = 'red';

  return new Promise<MissionChoice>((resolve) => {
    const screen = el(`
      <div class="screen cinematic">
        <div class="subtitle">A real-time strategy game</div>
        <h1>Vireon Front</h1>
        <h2>HOSTILE WORLD &middot; CRYSTAL WAR</h2>
        <div class="menu-box tac-panel">
          <div class="menu-head">SELECT CAMPAIGN</div>
          <div id="campaign-list" style="display:flex;flex-direction:column;gap:8px;"></div>
        </div>
        <div class="menu-box tac-panel" style="min-width:740px;">
          <div class="menu-head">SELECT FACTION</div>
          <div class="faction-row" id="faction-row" style="justify-content:center;"></div>
        </div>
        <div style="display:flex;gap:14px;align-items:center;">
          <button class="primary" id="btn-start" style="font-size:18px;padding:13px 52px;letter-spacing:3px;">⬢ DEPLOY</button>
          <button id="btn-codex" style="padding:12px 30px;letter-spacing:2px;">⬡ UNIT CODEX</button>
        </div>
      </div>
    `);

    screen.querySelector('#btn-codex')!.addEventListener('click', async () => {
      screen.style.display = 'none';
      await showUnitCodex();
      screen.style.display = '';
    });

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
      const card = el(`
        <div class="faction-card" style="--fc:${f.color}">
          <div class="swatch"></div>
          <h3>${f.name}</h3>
          <div class="tag">${f.tagline}</div>
          <ul>${f.perks.map(p => `<li>${p}</li>`).join('')}</ul>
        </div>
      `);
      if (f.id === factionId) card.classList.add('selected');
      card.addEventListener('click', () => {
        factionId = f.id;
        row.querySelectorAll('.faction-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      });
      row.appendChild(card);
    }

    screen.querySelector('#btn-start')!.addEventListener('click', async () => {
      const mission = await loadMission(chosen.campaign.id, chosen.missionRef.file);
      screen.remove();
      resolve({ campaign: chosen.campaign, mission, factionId });
    });

    root().appendChild(screen);
  });
}

/** Mission briefing; resolves when the player launches. */
export function showBriefing(mission: MissionDef, factionName: string): Promise<void> {
  return new Promise((resolve) => {
    const screen = el(`
      <div class="screen cinematic" style="justify-content:center;">
        <h2 style="letter-spacing:6px;">MISSION BRIEFING</h2>
        <div class="briefing-box tac-panel">
          <div style="font-size:22px;font-weight:700;">${mission.name}</div>
          <div style="font-size:12px;color:var(--text-dim);">COMMANDING: ${factionName}</div>
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

export function showEndScreen(victory: boolean, stats: string): Promise<'restart' | 'menu'> {
  return new Promise((resolve) => {
    const screen = el(`
      <div class="screen endscreen">
        <h1 class="${victory ? 'victory' : 'defeat'}">${victory ? 'VICTORY' : 'DEFEAT'}</h1>
        <div class="stats">${stats}</div>
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
