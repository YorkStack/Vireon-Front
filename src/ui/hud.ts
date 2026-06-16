// In-game HUD: top resource bar, selection/command panel, build queues.
import { BUILDING_DEFS, UNIT_DEFS, unitStats, buildingStats } from '../core/defs';
import type { World, Unit, Building } from '../sim/world';
import { toast } from './screens';

export interface HudCallbacks {
  startPlacement: (defId: string) => void;
  openPause: () => void;
  getSelection: () => { units: Unit[]; building: Building | null };
  armAttack: () => void;   // toggle attack-move arming
  stopSel: () => void;     // stop selected units
  holdSel: () => void;     // hold position
  isArmed: () => boolean;  // attack-move currently armed?
}

const BUILD_ORDER = ['nexus', 'spire', 'refinery', 'barracks', 'foundry', 'wall', 'cannon', 'lance'];

export class Hud {
  private world: World;
  private cb: HudCallbacks;
  private topbar: HTMLElement;
  private creditsEl: HTMLElement;
  private powerEl: HTMLElement;
  private fpsEl: HTMLElement;
  private panel: HTMLElement;
  private refreshTimer = 0;
  private shownCredits = 0;
  private lastHtml = ''; // last panel markup — skip DOM writes when unchanged (clicks stay alive)

  constructor(world: World, cb: HudCallbacks) {
    this.world = world;
    this.cb = cb;
    const root = document.getElementById('ui-root')!;

    this.topbar = document.createElement('div');
    this.topbar.id = 'topbar';
    this.topbar.className = 'panel';
    this.topbar.innerHTML = `
      <div class="res"><div class="ico"></div><span id="hud-credits">0</span></div>
      <div class="power" id="hud-power">⚡ 0/0</div>
      <div class="fps" id="hud-fps"></div>
      <button id="hud-menu">Menu</button>
    `;
    root.appendChild(this.topbar);
    this.creditsEl = this.topbar.querySelector('#hud-credits')!;
    this.powerEl = this.topbar.querySelector('#hud-power')!;
    this.fpsEl = this.topbar.querySelector('#hud-fps')!;
    this.topbar.querySelector('#hud-menu')!.addEventListener('click', () => cb.openPause());

    this.panel = document.createElement('div');
    this.panel.id = 'cmdpanel';
    this.panel.className = 'panel';
    root.appendChild(this.panel);

    this.shownCredits = world.teams[0].credits;
  }

  setFps(fps: number) {
    this.fpsEl.textContent = `${fps.toFixed(0)} FPS`;
  }

  update(dt: number) {
    const t = this.world.teams[0];
    // Animated credit counter.
    const diff = t.credits - this.shownCredits;
    this.shownCredits += Math.abs(diff) < 1 ? diff : diff * Math.min(1, dt * 8);
    this.creditsEl.textContent = `${Math.round(this.shownCredits)}`;
    this.powerEl.textContent = `⚡ ${t.powerUsed}/${t.powerProduced}`;
    this.powerEl.classList.toggle('low', t.lowPower);

    this.refreshTimer -= dt;
    if (this.refreshTimer <= 0) {
      this.refreshTimer = 0.25;
      this.renderPanel();
    }
  }

  renderPanel() {
    const { units, building } = this.cb.getSelection();

    if (!units.length && !building) {
      this.panel.classList.remove('visible');
      this.lastHtml = '';
      return;
    }
    this.panel.classList.add('visible');

    const html = building ? this.buildingHtml(building) : this.unitsHtml(units);
    // Only rewrite the DOM when the markup actually changes. The old code rebuilt
    // innerHTML on every 0.25s refresh tick, which destroyed the buttons mid-click
    // → clicks were silently dropped (the reported "hacklige" selection).
    if (html !== this.lastHtml) {
      this.panel.innerHTML = html;
      this.lastHtml = html;
      this.wirePanel();
    }
    // Live production-bar widths are updated in place (kept out of the signature).
    if (building) this.refreshQueueBars(building);
  }

  private unitsHtml(units: Unit[]): string {
    const t = this.world.teams[0];
    const builder = units.find(u => u.def.builder);
    const names = new Map<string, number>();
    for (const u of units) names.set(u.def.name, (names.get(u.def.name) ?? 0) + 1);
    const title = units.length === 1
      ? units[0].def.name
      : [...names.entries()].map(([n, c]) => `${c}× ${n}`).join(', ');
    const one = units.length === 1 ? units[0] : null;

    let html = `
      <div>
        <div class="sel-title">${title}</div>
        <div class="sel-sub">${one ? `${Math.ceil(one.hp)} / ${one.def.hp} HP — ${one.def.description}` : `${units.length} units selected`}</div>
      </div>
    `;

    // Mac-friendly command buttons (work without right-click / keyboard).
    const anyWeapon = units.some(u => u.def.weapon);
    const armed = this.cb.isArmed();
    html += `<div class="cmd-actions">
      ${anyWeapon ? `<button class="cmd-act${armed ? ' active' : ''}" data-act="attack" title="Angriffsbewegung — dann Ziel/Boden anklicken (Taste A)">⚔ Angriff</button>` : ''}
      <button class="cmd-act" data-act="stop" title="Stoppen (Taste S)">⛔ Stopp</button>
      <button class="cmd-act" data-act="hold" title="Position halten">✋ Halten</button>
    </div>`;

    if (builder) {
      html += `<div class="sel-sub" style="letter-spacing:1.5px;">CONSTRUCT</div><div class="btn-grid">`;
      for (const defId of BUILD_ORDER) {
        const stats = buildingStats(defId, t.faction);
        const hasPre = this.world.hasPrereqs(0, defId);
        const nexusCap = defId === 'nexus' && this.world.buildings.some(b => b.team === 0 && b.alive && b.def.id === 'nexus');
        const afford = t.credits >= stats.cost;
        const dis = !hasPre || !afford || nexusCap;
        const reason = nexusCap ? 'limit 1' : !hasPre ? `needs ${stats.prereq.map(p => BUILDING_DEFS[p].name).join(', ')}` : !afford ? 'low funds' : '';
        html += `
          <button class="cmd-btn" data-build="${defId}" ${dis ? 'disabled' : ''} title="${stats.description}">
            <span class="nm">${stats.name}</span>
            <span class="cost">◆ ${stats.cost}</span>
            ${reason ? `<span class="req">${reason}</span>` : ''}
          </button>`;
      }
      html += `</div><div class="hint">Struktur wählen, dann auf Gelände klicken zum Bauen. ESC bricht ab.</div>`;
    } else {
      html += `<div class="hint">Linksklick: Boden = bewegen · Gegner = angreifen${units.some(u => u.def.harvester) ? ' · Kristall = sammeln' : ''} · ⚔/Taste A = Angriffsbewegung · eigene Einheit = neu wählen · ESC = abwählen</div>`;
    }
    return html;
  }

  private buildingHtml(b: Building): string {
    const t = this.world.teams[0];
    let html = `
      <div>
        <div class="sel-title">${b.def.name}</div>
        <div class="sel-sub">${Math.ceil(b.hp)} / ${b.def.hp} HP — ${b.complete ? b.def.description : `Under construction (${Math.round(100 * b.progress / b.def.buildTime)}%)`}</div>
      </div>
    `;

    if (b.complete && b.def.produces) {
      const buildable = Object.values(UNIT_DEFS).filter(u => u.builtAt === b.def.id);
      html += `<div class="sel-sub" style="letter-spacing:1.5px;">PRODUCE</div><div class="btn-grid">`;
      for (const u of buildable) {
        const stats = unitStats(u.id, t.faction);
        const afford = t.credits >= stats.cost;
        const full = b.queue.length >= 5;
        html += `
          <button class="cmd-btn" data-train="${u.id}" ${(!afford || full) ? 'disabled' : ''} title="${stats.description}">
            <span class="nm">${stats.name}</span>
            <span class="cost">◆ ${stats.cost}</span>
            ${full ? '<span class="req">queue full</span>' : !afford ? '<span class="req">low funds</span>' : ''}
          </button>`;
      }
      html += `</div>`;
      if (b.queue.length) {
        html += `<div class="sel-sub" style="letter-spacing:1.5px;">QUEUE <span style="opacity:.6">(click to cancel)</span></div><div class="queue-row">`;
        b.queue.forEach((q, i) => {
          // Width is set live in refreshQueueBars so the per-tick change doesn't
          // alter the signature (which would rebuild + steal clicks).
          html += `<div class="queue-item" data-qi="${i}">${UNIT_DEFS[q.defId].name}<div class="prog" style="width:0%"></div></div>`;
        });
        html += `</div>`;
      }
    }
    return html;
  }

  /** Update the live production-progress bar width without rebuilding the panel. */
  private refreshQueueBars(b: Building) {
    if (!b.queue.length) return;
    const first = this.panel.querySelector<HTMLElement>('.queue-item[data-qi="0"] .prog');
    if (first) {
      const q = b.queue[0];
      first.style.width = `${Math.round(100 * (1 - q.remaining / q.total))}%`;
    }
  }

  /** Wire panel button listeners (only called when the DOM is actually rebuilt).
   *  Train/cancel resolve the building live so a same-markup re-selection can't
   *  leave a stale closure pointing at the previously selected structure. */
  private wirePanel() {
    this.panel.querySelectorAll<HTMLButtonElement>('[data-build]').forEach(btn => {
      btn.addEventListener('click', () => this.cb.startPlacement(btn.dataset.build!));
    });
    this.panel.querySelectorAll<HTMLButtonElement>('[data-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        const a = btn.dataset.act;
        if (a === 'attack') this.cb.armAttack();
        else if (a === 'stop') this.cb.stopSel();
        else if (a === 'hold') this.cb.holdSel();
        this.renderPanel();
      });
    });
    this.panel.querySelectorAll<HTMLButtonElement>('[data-train]').forEach(btn => {
      btn.addEventListener('click', () => {
        const b = this.cb.getSelection().building;
        if (b && !this.world.enqueue(b, btn.dataset.train!)) toast('Cannot train: check funds');
        this.renderPanel();
      });
    });
    this.panel.querySelectorAll<HTMLElement>('[data-qi]').forEach(q => {
      q.addEventListener('click', () => {
        const b = this.cb.getSelection().building;
        if (b) this.world.cancelQueue(b, Number(q.dataset.qi));
        this.renderPanel();
      });
    });
  }
}
