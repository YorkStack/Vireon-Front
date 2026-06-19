// Unit Codex / Faction Arsenal — browse every faction's vehicles with a live
// 3D preview of the REAL in-game model (same factory, same materials), full
// stats and the art design brief. Reached from the start screen.
//
// Preview controls: drag = rotate, wheel = zoom. Auto-rotates until touched.

import * as THREE from 'three';
import { FACTION_DEFS } from '../core/defs';
import { resolveUnit } from '../systems/unitFactory';
import { UNIT_CLASS_TEMPLATES, VEHICLE_CLASS_IDS, CUSTOM_CLASS_IDS } from '../data/unitClasses';

/** Where the external design studio runs (override with ?studio=URL). */
const STUDIO_URL = new URLSearchParams(location.search).get('studio') || 'http://localhost:5188';
import { WEAPONS } from '../data/weapons';
import { ART_METADATA } from '../data/artMetadata';
import { makeEntityGroup, pulseLights } from '../render/models';

const rootEl = () => document.getElementById('ui-root')!;

function el(html: string): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

const fmt = (n: number | undefined | null, suffix = '') =>
  n == null ? '—' : `${Math.round(n * 100) / 100}${suffix}`;

export function showUnitCodex(): Promise<void> {
  return new Promise((resolve) => {
    let factionId = 'red';
    let classId: string = VEHICLE_CLASS_IDS[0];

    const screen = el(`
      <div class="screen cinematic" style="justify-content:flex-start;padding-top:34px;">
        <h2 style="letter-spacing:6px;margin:0 0 10px;">UNIT CODEX — FACTION ARSENAL</h2>
        <div class="codex-tabs" id="cx-factions"></div>
        <div class="codex-main">
          <div class="codex-list tac-panel" id="cx-classes"></div>
          <div class="codex-preview tac-panel">
            <canvas id="cx-canvas"></canvas>
            <div class="codex-hint">drag: rotate &nbsp;·&nbsp; wheel: zoom</div>
          </div>
          <div class="codex-stats tac-panel" id="cx-stats"></div>
        </div>
        <div style="display:flex;gap:10px;margin-top:12px;">
          <button class="primary" id="cx-close" style="padding:10px 44px;letter-spacing:2px;">⬅ BACK</button>
          <button class="primary" id="cx-studio" style="padding:10px 28px;letter-spacing:2px;" title="Open the external Vehicle Design Studio (must be running: cd ../vireon-design-studio && npm run dev)">🎨 DESIGN STUDIO ↗</button>
        </div>
      </div>
    `);

    // ---------- preview renderer (own tiny scene) ----------
    const canvas = screen.querySelector('#cx-canvas') as HTMLCanvasElement;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    scene.add(new THREE.HemisphereLight('#cfd8ff', '#1c1830', 1.1));
    const sun = new THREE.DirectionalLight('#ffffff', 1.6);
    sun.position.set(5, 9, 4);
    scene.add(sun);
    const fill = new THREE.DirectionalLight('#7fd4ff', 0.45);
    fill.position.set(-5, 3, -5);
    scene.add(fill);
    const ground = new THREE.Mesh(
      new THREE.CylinderGeometry(3.4, 3.6, 0.18, 36),
      new THREE.MeshStandardMaterial({ color: '#2b2741', roughness: 0.95 }),
    );
    ground.position.y = -0.09;
    scene.add(ground);

    let model: THREE.Group | null = null;
    let yaw = 0.7, dist = 8, height = 4.2, autoRotate = true;

    const setModel = () => {
      if (model) { scene.remove(model); model = null; }
      const f = FACTION_DEFS[factionId];
      const def = resolveUnit(classId, f);
      model = makeEntityGroup('unit', def.id, f.emissive, def.class === 'vehicle', def.visual, factionId);
      scene.add(model);
      const pv = def.visual?.previewCamera;
      dist = pv?.distance ?? 8;
      height = pv?.height ?? dist * 0.55;
      autoRotate = true;
    };

    // Drag rotate + wheel zoom.
    let dragging = false, lastX = 0;
    canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; autoRotate = false; });
    window.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      yaw += (e.clientX - lastX) * 0.01;
      lastX = e.clientX;
    });
    window.addEventListener('pointerup', () => { dragging = false; });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      dist = Math.max(3.5, Math.min(16, dist + e.deltaY * 0.01));
      height = dist * 0.55;
    }, { passive: false });

    let raf = 0;
    const clock = new THREE.Clock();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const t = clock.getElapsedTime();
      if (autoRotate) yaw += clock.getDelta() * 0 + 0.004;
      pulseLights(t);
      const anim = model?.userData.anim as Record<string, THREE.Group> | undefined;
      if (anim?.spin) anim.spin.rotation.y = t * 1.6;
      cam.position.set(Math.sin(yaw) * dist, height, Math.cos(yaw) * dist);
      cam.lookAt(0, 1.0, 0);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (w && h && (canvas.width !== w || canvas.height !== h)) {
        renderer.setSize(w, h, false);
        cam.aspect = w / h;
        cam.updateProjectionMatrix();
      }
      renderer.render(scene, cam);
    };

    // ---------- stats panel ----------
    const statsEl = screen.querySelector('#cx-stats') as HTMLElement;
    const renderStats = () => {
      const f = FACTION_DEFS[factionId];
      const t = UNIT_CLASS_TEMPLATES[classId];
      const d = resolveUnit(classId, f);
      const spec = t.primaryWeapon ? WEAPONS[t.primaryWeapon] : null;
      const meta = ART_METADATA[`${factionId}_${classId}`] ?? {
        designBrief: { movementType: t.defaultMovementType, silhouette: t.description, palette: '—' },
        textureSetId: '—', status: 'needsRevision',
      };
      const r = t.resistances as Record<string, number | undefined>;
      const row = (k: string, v: string) => `<div class="cx-row"><span>${k}</span><b>${v}</b></div>`;
      const head = (s: string) => `<div class="cx-head">${s}</div>`;
      const specials: string[] = [];
      if (t.harvesting) specials.push(`cargo ${t.harvesting.cargoCapacity}, gathers in ${t.harvesting.gatherTime}s`);
      if (t.building) specials.push(`builds & repairs structures (${t.building.repairRate} hp/s)`);
      if (t.support) specials.push(`repair aura ${t.support.repairAuraRange} tiles, ${t.support.repairAmount} hp/s`);
      if (spec?.antiAirBonus) specials.push(`anti-air bonus x${spec.antiAirBonus} (vs future aircraft)`);

      statsEl.innerHTML = `
        <div style="font-size:19px;font-weight:700;">${d.name}</div>
        <div style="font-size:11px;color:var(--text-dim);margin-bottom:4px;">${f.name} · ${t.role.toUpperCase()} · TIER ${t.techTier}</div>
        <div style="font-size:11.5px;line-height:1.45;color:var(--text-dim);">${t.description}</div>
        ${head('GENERAL')}
        ${row('Class', classId)}${row('Cost', fmt(d.cost, ' ¢'))}${row('Build time', fmt(d.buildTime, 's'))}
        ${row('Hit points', fmt(d.hp))}${row('Armor class', t.armorClass)}${row('Armor value', fmt(t.armorValue))}
        ${head('MOBILITY')}
        ${row('Movement', d.visual?.movement ?? t.defaultMovementType)}${row('Speed', fmt(d.speed, ' t/s'))}
        ${head('WEAPON')}
        ${spec ? `
          ${row('Type', spec.weaponType)}${row('Damage', fmt(d.weapon?.damage))}
          ${row('Range', fmt(d.weapon?.range, ' t'))}${row('Fire rate', fmt(d.weapon ? 1 / d.weapon.cooldown : null, '/s'))}
          ${row('Targets', spec.targetTypes.join(', '))}
        ` : row('Armament', 'unarmed')}
        ${head('RESISTANCES')}
        ${row('Ballistic', fmt(r.ballistic))}${row('Explosive', fmt(r.explosive))}${row('Laser', fmt(r.laser))}
        ${row('Electric', fmt(r.electric))}${row('Plasma', fmt(r.plasma))}
        ${head('SENSORS & AUTONOMY')}
        ${row('Vision', fmt(t.visionRange, ' t'))}${row('Detection', fmt(t.detectionRange, ' t'))}
        ${row('Auto-acquire', fmt(t.autoAcquireRange, ' t'))}${row('Stance', t.defaultStance)}
        ${row('Max autonomy dist', fmt(t.maxAutonomousDistanceFromBase, ' t'))}${row('Patrol radius', fmt(t.patrolRadius, ' t'))}
        ${row('Intelligence', t.intelligenceLevel)}
        ${specials.length ? head('SPECIAL') + specials.map(s => `<div class="cx-row"><b>${s}</b></div>`).join('') : ''}
        ${head('DESIGN BRIEF')}
        <div style="font-size:11px;line-height:1.5;color:var(--text-dim);">
          <b style="color:var(--text);">${meta.designBrief.movementType}</b> · ${meta.designBrief.silhouette}<br>
          ${meta.designBrief.palette}<br>
          Texture set: <b>${meta.textureSetId}</b> · Status:
          <b style="color:${meta.status === 'approved' ? '#3aff7a' : meta.status === 'generated' ? '#ffd84d' : '#8d93ad'}">${meta.status}</b>
        </div>
      `;
    };

    // ---------- faction tabs + class list ----------
    const tabRow = screen.querySelector('#cx-factions')!;
    for (const f of Object.values(FACTION_DEFS)) {
      const b = el(`<button class="codex-tab" style="--fc:${f.color}">${f.name}</button>`);
      if (f.id === factionId) b.classList.add('active');
      b.addEventListener('click', () => {
        factionId = f.id;
        tabRow.querySelectorAll('button').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        setModel(); renderStats();
      });
      tabRow.appendChild(b);
    }
    const listEl = screen.querySelector('#cx-classes')!;
    for (const c of [...VEHICLE_CLASS_IDS, ...CUSTOM_CLASS_IDS]) {
      const t = UNIT_CLASS_TEMPLATES[c];
      const b = el(`<button class="codex-class"><b>${t.displayName}</b><span>${t.role}</span></button>`);
      if (c === classId) b.classList.add('active');
      b.addEventListener('click', () => {
        classId = c;
        listEl.querySelectorAll('button').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        setModel(); renderStats();
      });
      listEl.appendChild(b);
    }

    screen.querySelector('#cx-close')!.addEventListener('click', () => {
      cancelAnimationFrame(raf);
      renderer.dispose();
      screen.remove();
      resolve();
    });
    screen.querySelector('#cx-studio')!.addEventListener('click', () => {
      window.open(STUDIO_URL, '_blank', 'noopener');
    });

    rootEl().appendChild(screen);
    setModel();
    renderStats();
    tick();
  });
}
