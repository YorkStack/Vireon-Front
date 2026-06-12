// Mouse + keyboard input: selection (click & box), command issuing,
// building placement mode, camera pan/zoom/edge-scroll.
import * as THREE from 'three';
import { TILE, F_CRYSTAL, LEVEL_H } from '../map/map';
import { BUILDING_DEFS, buildingStats } from '../core/defs';
import type { World, Unit, Building } from '../sim/world';
import type { SceneRig } from '../render/scene';
import type { Effects } from '../render/effects';
import { makeGhost } from '../render/models';
import { toast } from './screens';

type PickResult =
  | { kind: 'unit'; unit: Unit }
  | { kind: 'building'; building: Building }
  | { kind: 'crystal'; nodeId: number }
  | { kind: 'ground'; x: number; z: number }
  | null;

export class InputController {
  selectedUnits: Unit[] = [];
  selectedBuilding: Building | null = null;
  placement: { defId: string; ghost: THREE.Group; valid: boolean; tx: number; tz: number } | null = null;

  private rig: SceneRig;
  private world: World;
  private effects: Effects;
  private terrain: THREE.Mesh;
  private ray = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private keys = new Set<string>();
  private mouseX = 0; private mouseY = 0;
  private mouseSeen = false; // no edge-scroll until the pointer is actually in the window
  private dragStart: { x: number; y: number } | null = null;
  private dragging = false;
  private selboxEl: HTMLElement;
  private enabled = true;
  onSelectionChanged: () => void = () => {};
  openPause: () => void = () => {};

  constructor(rig: SceneRig, world: World, effects: Effects, terrain: THREE.Mesh) {
    this.rig = rig; this.world = world; this.effects = effects; this.terrain = terrain;

    this.selboxEl = document.createElement('div');
    this.selboxEl.id = 'selbox';
    document.getElementById('ui-root')!.appendChild(this.selboxEl);

    const canvas = rig.renderer.domElement;
    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  setEnabled(v: boolean) {
    this.enabled = v;
    if (!v) { this.keys.clear(); this.cancelPlacement(); }
  }

  // ---------------- picking ----------------

  private updateNdc(clientX: number, clientY: number) {
    this.ndc.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
  }

  private pick(clientX: number, clientY: number): PickResult {
    this.updateNdc(clientX, clientY);
    this.ray.setFromCamera(this.ndc, this.rig.camera);
    const targets: THREE.Object3D[] = [];
    for (const u of this.world.units) targets.push(u.group);
    for (const b of this.world.buildings) targets.push(b.group);
    for (const g of this.world.crystalGroups.values()) if (g.visible) targets.push(g);
    targets.push(this.terrain);
    const hits = this.ray.intersectObjects(targets, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o) {
        if (o.userData.unit) return { kind: 'unit', unit: o.userData.unit };
        if (o.userData.building) return { kind: 'building', building: o.userData.building };
        if (o.userData.crystalId !== undefined) return { kind: 'crystal', nodeId: o.userData.crystalId };
        if (o === this.terrain) return { kind: 'ground', x: h.point.x, z: h.point.z };
        o = o.parent;
      }
    }
    return null;
  }

  groundPoint(clientX: number, clientY: number): [number, number] | null {
    this.updateNdc(clientX, clientY);
    this.ray.setFromCamera(this.ndc, this.rig.camera);
    const hits = this.ray.intersectObject(this.terrain, false);
    return hits.length ? [hits[0].point.x, hits[0].point.z] : null;
  }

  // ---------------- selection ----------------

  private clearSelection() {
    for (const u of this.selectedUnits) u.selected = false;
    if (this.selectedBuilding) this.selectedBuilding.selected = false;
    this.selectedUnits = [];
    this.selectedBuilding = null;
  }

  private selectUnits(units: Unit[]) {
    this.clearSelection();
    this.selectedUnits = units;
    for (const u of units) u.selected = true;
    this.onSelectionChanged();
  }

  private selectBuilding(b: Building) {
    this.clearSelection();
    this.selectedBuilding = b;
    b.selected = true;
    this.onSelectionChanged();
  }

  /** Prune dead entities from the selection (called every frame). */
  validateSelection() {
    const before = this.selectedUnits.length + (this.selectedBuilding ? 1 : 0);
    this.selectedUnits = this.selectedUnits.filter(u => u.alive);
    if (this.selectedBuilding && !this.selectedBuilding.alive) this.selectedBuilding = null;
    if (before !== this.selectedUnits.length + (this.selectedBuilding ? 1 : 0)) this.onSelectionChanged();
  }

  // ---------------- pointer handlers ----------------

  private onPointerDown = (e: PointerEvent) => {
    if (!this.enabled) return;
    if (e.button === 0) {
      if (this.placement) { this.confirmPlacement(); return; }
      this.dragStart = { x: e.clientX, y: e.clientY };
      this.dragging = false;
    } else if (e.button === 2) {
      if (this.placement) { this.cancelPlacement(); return; }
      this.issueCommand(e.clientX, e.clientY);
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    this.mouseX = e.clientX; this.mouseY = e.clientY;
    this.mouseSeen = true;
    if (!this.enabled) return;
    if (this.placement) this.updatePlacementGhost();
    if (this.dragStart) {
      const dx = e.clientX - this.dragStart.x, dy = e.clientY - this.dragStart.y;
      if (!this.dragging && Math.hypot(dx, dy) > 7) this.dragging = true;
      if (this.dragging) {
        const x = Math.min(e.clientX, this.dragStart.x), y = Math.min(e.clientY, this.dragStart.y);
        Object.assign(this.selboxEl.style, {
          display: 'block', left: `${x}px`, top: `${y}px`,
          width: `${Math.abs(dx)}px`, height: `${Math.abs(dy)}px`,
        });
      }
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    if (e.button !== 0 || !this.dragStart) return;
    const start = this.dragStart;
    this.dragStart = null;
    this.selboxEl.style.display = 'none';
    if (!this.enabled) return;

    if (this.dragging) {
      // Box select: player units whose screen projection is inside the rect.
      const x0 = Math.min(start.x, e.clientX), x1 = Math.max(start.x, e.clientX);
      const y0 = Math.min(start.y, e.clientY), y1 = Math.max(start.y, e.clientY);
      const v = new THREE.Vector3();
      const picked: Unit[] = [];
      for (const u of this.world.units) {
        if (u.team !== 0) continue;
        v.set(u.x, this.world.map.groundHeight(u.x, u.z) + 0.5, u.z).project(this.rig.camera);
        const sx = (v.x + 1) / 2 * window.innerWidth;
        const sy = (1 - v.y) / 2 * window.innerHeight;
        if (sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1) picked.push(u);
      }
      if (picked.length) {
        // Prefer combat units if the box mixes army and workers... keep all; players expect all.
        this.selectUnits(picked);
      } else {
        this.clearSelection();
        this.onSelectionChanged();
      }
      this.dragging = false;
      return;
    }

    // Single click select.
    const hit = this.pick(e.clientX, e.clientY);
    if (hit?.kind === 'unit' && hit.unit.team === 0) this.selectUnits([hit.unit]);
    else if (hit?.kind === 'building' && hit.building.team === 0) this.selectBuilding(hit.building);
    else { this.clearSelection(); this.onSelectionChanged(); }
  };

  private onWheel = (e: WheelEvent) => {
    if (!this.enabled) return;
    e.preventDefault();
    this.rig.zoom(e.deltaY * 0.0011);
  };

  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    this.keys.add(k);
    if (!this.enabled) return;
    if (k === 'escape') {
      if (this.placement) this.cancelPlacement();
      else this.openPause();
    }
    if (k === 's') {
      for (const u of this.selectedUnits) this.world.stop(u);
    }
    if (k === ' ') {
      e.preventDefault();
      const home = this.world.buildings.find(b => b.team === 0 && b.def.id === 'nexus')
        ?? this.world.buildings.find(b => b.team === 0);
      if (home) this.rig.lookAt(home.cx, home.cz);
      else {
        const fab = this.world.units.find(u => u.team === 0 && u.def.builder);
        if (fab) this.rig.lookAt(fab.x, fab.z);
      }
    }
  };

  // ---------------- commands ----------------

  private issueCommand(clientX: number, clientY: number) {
    if (!this.selectedUnits.length) return;
    const hit = this.pick(clientX, clientY);
    if (!hit) return;
    const attackMod = this.keys.has('a');

    if (hit.kind === 'unit' && hit.unit.team !== 0) {
      for (const u of this.selectedUnits) this.world.orderAttack(u, hit.unit);
      this.markerAt(hit.unit.x, hit.unit.z, 'attack');
      return;
    }
    if (hit.kind === 'building' && hit.building.team !== 0) {
      for (const u of this.selectedUnits) this.world.orderAttack(u, hit.building);
      this.markerAt(hit.building.cx, hit.building.cz, 'attack');
      return;
    }
    if (hit.kind === 'crystal') {
      const node = this.world.map.crystals.find(c => c.id === hit.nodeId);
      if (node) {
        const [wx, wz] = this.world.map.tileToWorld(node.tx, node.tz);
        let gathered = false;
        for (const u of this.selectedUnits) {
          if (u.def.harvester) { this.world.orderGather(u, node); gathered = true; }
          else this.world.orderMove(u, wx, wz);
        }
        this.markerAt(wx, wz, gathered ? 'gather' : 'move');
      }
      return;
    }
    if (hit.kind === 'building') {
      const b = hit.building;
      const fabs = this.selectedUnits.filter(u => u.def.builder);
      if (fabs.length && !b.complete) {
        for (const f of fabs) this.world.orderBuild(f, b);
        this.markerAt(b.cx, b.cz, 'move');
        return;
      }
      if (fabs.length && b.hp < b.def.hp) {
        for (const f of fabs) this.world.orderRepair(f, b);
        this.markerAt(b.cx, b.cz, 'move');
        return;
      }
      for (const u of this.selectedUnits) this.world.orderMove(u, b.cx, b.cz);
      this.markerAt(b.cx, b.cz, 'move');
      return;
    }
    if (hit.kind === 'ground') {
      this.moveFormation(this.selectedUnits, hit.x, hit.z, attackMod);
      this.markerAt(hit.x, hit.z, attackMod ? 'attack' : 'move');
    }
  }

  moveFormation(units: Unit[], x: number, z: number, attackMove: boolean) {
    const cols = Math.ceil(Math.sqrt(units.length));
    const spacing = 2.0;
    units.forEach((u, i) => {
      const ox = ((i % cols) - (cols - 1) / 2) * spacing;
      const oz = (Math.floor(i / cols) - (Math.ceil(units.length / cols) - 1) / 2) * spacing;
      this.world.orderMove(u, x + ox, z + oz, attackMove);
    });
  }

  private markerAt(x: number, z: number, kind: 'move' | 'attack' | 'gather') {
    const y = this.world.map.groundHeight(x, z);
    this.effects.marker(new THREE.Vector3(x, y, z), kind);
  }

  // ---------------- building placement ----------------

  startPlacement(defId: string) {
    this.cancelPlacement();
    const [fw, fh] = BUILDING_DEFS[defId].footprint;
    const ghost = makeGhost(defId, fw, fh);
    this.rig.scene.add(ghost);
    this.placement = { defId, ghost, valid: false, tx: 0, tz: 0 };
    this.updatePlacementGhost();
  }

  cancelPlacement() {
    if (this.placement) {
      this.rig.scene.remove(this.placement.ghost);
      this.placement = null;
    }
  }

  private updatePlacementGhost() {
    const p = this.placement;
    if (!p) return;
    const g = this.groundPoint(this.mouseX, this.mouseY);
    if (!g) return;
    const def = BUILDING_DEFS[p.defId];
    const [w, h] = def.footprint;
    p.tx = Math.round(g[0] / TILE - w / 2);
    p.tz = Math.round(g[1] / TILE - h / 2);
    const team = this.world.teams[0];
    const stats = buildingStats(p.defId, team.faction);
    p.valid = this.world.canPlace(0, p.defId, p.tx, p.tz)
      && this.world.hasPrereqs(0, p.defId)
      && team.credits >= stats.cost;
    const lvl = this.world.map.inBounds(p.tx, p.tz) ? this.world.map.level[this.world.map.idx(p.tx, p.tz)] : 0;
    p.ghost.position.set((p.tx + w / 2) * TILE, lvl * LEVEL_H, (p.tz + h / 2) * TILE);
    (p.ghost.userData.setValid as (ok: boolean) => void)(p.valid);
  }

  private confirmPlacement() {
    const p = this.placement;
    if (!p) return;
    this.updatePlacementGhost();
    if (!p.valid) { toast('Cannot build here'); return; }
    const site = this.world.placeBuilding(0, p.defId, p.tx, p.tz);
    if (!site) { toast('Cannot build here'); return; }
    site.group.userData.building = site;
    const fab = this.selectedUnits.find(u => u.def.builder)
      ?? this.world.units.find(u => u.team === 0 && u.def.builder);
    if (fab) this.world.orderBuild(fab, site);
    // Walls chain-place; everything else is one-shot.
    if (p.defId !== 'wall') this.cancelPlacement();
    this.onSelectionChanged();
  }

  // ---------------- camera ----------------

  update(dt: number) {
    if (!this.enabled) return;
    const pan = this.rig.dist * 0.9 * dt;
    let dx = 0, dz = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) dz -= pan;
    if (this.keys.has('s') && this.selectedUnits.length === 0) dz += pan; // S pans only when not used as stop
    if (this.keys.has('arrowdown')) dz += pan;
    if (this.keys.has('a') && this.selectedUnits.length === 0) dx -= pan;
    if (this.keys.has('arrowleft')) dx -= pan;
    if (this.keys.has('d') || this.keys.has('arrowright')) dx += pan;
    // Edge scrolling (only once the pointer has entered the window).
    if (this.mouseSeen && document.hasFocus()) {
      const m = 14;
      if (this.mouseY <= m) dz -= pan;
      if (this.mouseY >= window.innerHeight - m) dz += pan;
      if (this.mouseX <= m) dx -= pan;
      if (this.mouseX >= window.innerWidth - m) dx += pan;
    }
    if (dx || dz) this.rig.pan(dx, dz);
  }
}
