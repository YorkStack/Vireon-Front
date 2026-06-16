// Full-screen UI: start screen (campaign + faction select), mission briefing,
// pause menu, win/loss screens.
import { FACTION_DEFS } from '../core/defs';
import type { CampaignDef, MissionDef } from '../core/types';
import { loadCampaignList, loadMission } from '../campaign/campaign';
import { showUnitCodex } from './unitCodex';
import { DIFFICULTIES, DIFFICULTY_ORDER, DEFAULT_DIFFICULTY, type DifficultyId } from '../data/difficulty';
import { doctrinesFor, defaultDoctrineFor, DOCTRINES } from '../data/doctrines';

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
      <div class="screen cinematic">
        <div class="subtitle">A real-time strategy game</div>
        <h1>Vireon Front</h1>
        <h2>HOSTILE WORLD &middot; CRYSTAL WAR</h2>
        <div class="menu-box tac-panel">
          <div class="menu-head">SELECT CAMPAIGN</div>
          <div id="campaign-list" style="display:flex;flex-direction:column;gap:8px;"></div>
        </div>
        <div class="menu-box tac-panel">
          <div class="menu-head">SCHWIERIGKEITSGRAD</div>
          <div class="menu-sub">Spielstärke der gegnerischen KI — gilt für die ganze Partie</div>
          <div class="difficulty-row" id="difficulty-row" style="display:flex;gap:10px;justify-content:center;"></div>
        </div>
        <div class="menu-box tac-panel" style="min-width:740px;">
          <div class="menu-head">FRAKTION WÄHLEN</div>
          <div class="menu-sub">Deine Stärken &amp; Schwächen — der Gegner ist eine zufällige der drei anderen Fraktionen</div>
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
      const t = f.tactical;
      const profile = t ? `
        <div class="tac-grid">
          <span>Bau</span><b>${t.build}</b>
          <span>Angriff</span><b>${t.attack}</b>
          <span>Verteid.</span><b>${t.defense}</b>
          <span>Wirtschaft</span><b>${t.economy}</b>
        </div>` : '';
      const sw = (f.strengths || f.weaknesses) ? `
        <ul class="sw">
          ${(f.strengths || []).map(s => `<li class="pos">+ ${s}</li>`).join('')}
          ${(f.weaknesses || []).map(s => `<li class="neg">− ${s}</li>`).join('')}
        </ul>` : `<ul>${f.perks.map(p => `<li>${p}</li>`).join('')}</ul>`;
      const doctrineOpts = doctrinesFor(f.id)
        .map(d => `<option value="${d.id}">${d.uiName}</option>`).join('');
      const card = el(`
        <div class="faction-card" style="--fc:${f.color}">
          <div class="swatch"></div>
          <div class="fc-head"><h3>${f.name}</h3>${t ? `<span class="diff-badge">${t.archetype}</span>` : ''}</div>
          <div class="tag">${f.tagline}</div>
          ${profile}
          ${sw}
          <label class="doctrine-pick">Doktrin <select class="doctrine-sel">${doctrineOpts}</select></label>
          ${t?.recommended ? `<div class="reco">▸ ${t.recommended}</div>` : ''}
        </div>
      `);
      const dsel = card.querySelector('.doctrine-sel') as HTMLSelectElement;
      dsel.addEventListener('click', e => e.stopPropagation());   // opening dropdown ≠ picking faction
      dsel.addEventListener('change', () => { if (f.id === factionId) doctrineId = dsel.value; });
      if (f.id === factionId) card.classList.add('selected');
      card.addEventListener('click', () => {
        factionId = f.id;
        doctrineId = dsel.value;     // adopt this faction's currently-shown doctrine
        row.querySelectorAll('.faction-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      });
      row.appendChild(card);
    }

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

/** Mission briefing; resolves when the player launches. */
export function showBriefing(mission: MissionDef, factionName: string, doctrineId?: string): Promise<void> {
  const doctrineName = doctrineId ? DOCTRINES[doctrineId]?.uiName : undefined;
  return new Promise((resolve) => {
    const screen = el(`
      <div class="screen cinematic" style="justify-content:center;">
        <h2 style="letter-spacing:6px;">MISSION BRIEFING</h2>
        <div class="briefing-box tac-panel">
          <div style="font-size:22px;font-weight:700;">${mission.name}</div>
          <div style="font-size:12px;color:var(--text-dim);">COMMANDING: ${factionName}${doctrineName ? ` · Doktrin: ${doctrineName}` : ''}</div>
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
