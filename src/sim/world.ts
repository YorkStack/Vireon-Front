// The simulation world: units, buildings, economy, combat. Owns both the
// gameplay state and each entity's visual group (kept in sync every frame).
import * as THREE from 'three';
import { GameMap, TILE, LEVEL_H, F_BUILDING, F_CRYSTAL, CrystalNode } from '../map/map';
import { findPath } from '../path/astar';
import { unitStats, buildingStats, DAMAGE_MATRIX, BUILDING_DEFS } from '../core/defs';
import type { UnitDef, BuildingDef, FactionDef, WeaponDef, TeamId } from '../core/types';
import { makeEntityGroup, makeSelectionRing, makeHealthBar, makeCargoBar, makePctLabel, makePowerIcon, makeDarkOverlay, makeGroundDecal, makeFoundationPad, foundationDoneMat, accentMat, pulseLights, HealthBar, TextLabel } from '../render/models';
import { getPowerRatio, getPowerOutageEffects, getEconomyModifiers, getModifiedRepairRate, type FactionId } from '../data/factionModifiers';
import { activeBuildingAsset, makeGlbBuildingGroup, BUILDING_SOURCE } from '../render/buildingGlb';
import { Effects } from '../render/effects';
import { MOVEMENT_PROFILES, type MovementType } from '../data/movementProfiles';
import { getCrystalVisualStage, CRYSTAL_STAGE_SCALE, type CrystalVisualStage } from './resources';

/** Per-crystal-group render metadata stashed in THREE.Group.userData by terrain.ts. */
interface CrystalGroupUD {
  stage: CrystalVisualStage;
  mat?: THREE.SpriteMaterial;
  tex?: { full: THREE.Texture; reduced: THREE.Texture; small: THREE.Texture };
}

let nextId = 1;

export type Order =
  | { kind: 'idle' }
  | { kind: 'move'; x: number; z: number }
  | { kind: 'attackmove'; x: number; z: number }
  | { kind: 'attack'; target: Unit | Building }
  | { kind: 'gather'; node: CrystalNode | null }
  | { kind: 'build'; site: Building }
  | { kind: 'repair'; building: Building };

export class Unit {
  id = nextId++;
  team: TeamId;
  def: UnitDef;
  x: number; z: number;
  heading = 0;
  hp: number;
  alive = true;
  order: Order = { kind: 'idle' };
  sub: 'toNode' | 'gathering' | 'toDropoff' | '' = '';
  cargo = 0;
  harvAttack = false; // harvester commanded to ram-attack -> suspends auto-harvest
  path: [number, number][] | null = null;
  pathGoal: [number, number] | null = null;
  cooldown = 0;
  scanTimer = Math.random() * 0.3;
  gatherTimer = 0;
  stuckTimer = 0;
  lastX = 0; lastZ = 0;
  engage: Unit | Building | null = null; // auto-acquired target while idle/attackmoving
  anchorX = 0; anchorZ = 0;
  turretYaw = 0; // visual turret heading relative to hull
  stance: 'holdFire' | 'returnFire' | 'defendArea' | 'aggressive' = 'aggressive';
  auraTimer = 0; // support repair-aura tick
  visHeading = 0; // previous frame heading (movement-style banking)
  visRoll = 0;
  selected = false;
  group: THREE.Group;
  ring: THREE.Mesh;
  hb: HealthBar;
  cargoBar: HealthBar | null = null; // crystal load bar (harvesters only)

  constructor(team: TeamId, def: UnitDef, x: number, z: number, accent: string) {
    this.team = team; this.def = def; this.x = x; this.z = z;
    this.hp = def.hp;
    this.anchorX = x; this.anchorZ = z;
    this.stance = def.defaultStance ?? (def.weapon ? 'aggressive' : 'holdFire');
    this.group = makeEntityGroup('unit', def.id, accent, def.class === 'vehicle', def.visual);
    this.ring = makeSelectionRing(def.radius + 0.25, accent);
    this.ring.visible = false;
    this.ring.position.y = 0.06;
    this.group.add(this.ring);
    this.hb = makeHealthBar(Math.max(1.0, def.radius * 2));
    this.hb.group.position.y = (this.group.userData.topY ?? 1.5) + 0.5;
    this.hb.group.visible = false;
    this.group.add(this.hb.group);
    if (def.harvester) {
      this.cargoBar = makeCargoBar(Math.max(1.0, def.radius * 2));
      this.cargoBar.group.position.y = (this.group.userData.topY ?? 1.5) + 0.74;
      this.cargoBar.group.visible = false;
      this.group.add(this.cargoBar.group);
    }
  }
  get isInfantry() { return this.def.class === 'infantry'; }
  get tile(): [number, number] { return [Math.floor(this.x / TILE), Math.floor(this.z / TILE)]; }
}

export interface QueueItem { defId: string; remaining: number; total: number }

export class Building {
  id = nextId++;
  team: TeamId;
  def: BuildingDef;
  tx: number; tz: number; // footprint origin (tiles)
  w: number; h: number;
  level: number;
  hp: number;
  alive = true;
  complete: boolean;
  progress = 0; // construction seconds completed
  started = false; // a builder has reached the site at least once -> self-builds
  pad: THREE.Mesh | null = null; // foundation pad (swaps texture when complete)
  builder: Unit | null = null;
  queue: QueueItem[] = [];
  cooldown = 0;
  scanTimer = Math.random() * 0.4;
  target: Unit | Building | null = null;
  selected = false;
  group: THREE.Group;
  ring: THREE.Mesh;
  hb: HealthBar;
  pct: TextLabel; // construction-progress % label (visible only while building)
  darkOverlay?: THREE.Mesh;     // low-power shroud (consumers only)
  powerIcon?: THREE.Sprite;     // pulsing low-power lightning indicator

  constructor(team: TeamId, def: BuildingDef, tx: number, tz: number, level: number, accent: string, complete: boolean, factionId?: string) {
    this.team = team; this.def = def; this.tx = tx; this.tz = tz;
    this.w = def.footprint[0]; this.h = def.footprint[1];
    this.level = level;
    this.complete = complete;
    this.hp = complete ? def.hp : Math.max(1, Math.round(def.hp * 0.1));
    // Prefer a building GLB (powerplants only this phase); fall back to the
    // procedural renderer for everything else / missing / load-failed GLBs.
    const asset = factionId ? activeBuildingAsset(def.id, factionId as FactionId) : null;
    const glb = asset ? makeGlbBuildingGroup(asset, accent, Math.max(this.w, this.h)) : null;
    this.group = glb ?? makeEntityGroup('building', def.id, accent);
    if (!glb) BUILDING_SOURCE[`${factionId ?? '?'}:${def.id}`] = 'procedural';
    // Foundation pad + contact-shadow decal + beacon tie the building into the scene.
    // Walls are tiny 1x1 segments - skip the pad there, it would just be noise.
    if (!def.wall) {
      this.pad = makeFoundationPad(this.w * TILE, this.h * TILE, complete);
      this.group.add(this.pad);
    }
    this.group.add(makeGroundDecal(this.w * TILE, this.h * TILE));
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), accentMat(accent));
    beacon.position.y = (this.group.userData.topY ?? 3) + 0.3;
    this.group.add(beacon);
    this.group.userData.beacon = beacon;
    const r = Math.max(this.w, this.h) * TILE * 0.62;
    this.ring = makeSelectionRing(r, accent);
    this.ring.visible = false;
    this.ring.position.y = 0.06;
    this.group.add(this.ring);
    this.hb = makeHealthBar(this.w * TILE * 0.9);
    this.hb.group.position.y = (this.group.userData.topY ?? 3) + 0.6;
    this.hb.group.visible = false;
    this.group.add(this.hb.group);
    this.pct = makePctLabel();
    this.pct.sprite.position.y = (this.group.userData.topY ?? 3) + 1.05;
    this.pct.sprite.visible = false;
    this.group.add(this.pct.sprite);
    // Low-power state visuals: a dark shroud + pulsing lightning, for power
    // consumers (def.power < 0). Walls/producers get none.
    if (!def.wall && def.power < 0) {
      const topY = this.group.userData.topY ?? 3;
      this.darkOverlay = makeDarkOverlay(this.w * TILE * 0.98, this.h * TILE * 0.98, topY * 1.02);
      this.darkOverlay.visible = false;
      this.group.add(this.darkOverlay);
      this.powerIcon = makePowerIcon();
      this.powerIcon.position.y = topY + 0.55;
      this.powerIcon.visible = false;
      this.group.add(this.powerIcon);
    }
    if (!complete) this.group.scale.y = 0.15;
  }
  get cx() { return (this.tx + this.w / 2) * TILE; }
  get cz() { return (this.tz + this.h / 2) * TILE; }
  get radius() { return Math.max(this.w, this.h) * TILE * 0.55; }
}

export interface TeamState {
  faction: FactionDef;
  credits: number;
  powerProduced: number;
  powerUsed: number;
  lowPower: boolean;
  powerRatio: number; // availablePower / requiredPower (1 = fine, <1 = deficit)
  incomeMul: number; // ore-yield multiplier (AI difficulty handicap; player = 1)
}

export class World {
  map: GameMap;
  scene: THREE.Scene;
  effects: Effects;
  units: Unit[] = [];
  buildings: Building[] = [];
  teams: [TeamState, TeamState];
  crystalGroups: Map<number, THREE.Group>;
  onDeath: ((e: Unit | Building) => void)[] = [];
  time = 0;
  private grid = new Map<number, Unit[]>(); // spatial hash, cell = 4 world units
  private camQuat = new THREE.Quaternion();

  constructor(
    map: GameMap, scene: THREE.Scene, effects: Effects,
    playerFaction: FactionDef, enemyFaction: FactionDef,
    crystalGroups: Map<number, THREE.Group>,
  ) {
    this.map = map; this.scene = scene; this.effects = effects;
    this.crystalGroups = crystalGroups;
    this.teams = [
      { faction: playerFaction, credits: 0, powerProduced: 0, powerUsed: 0, lowPower: false, powerRatio: 1, incomeMul: 1 },
      { faction: enemyFaction, credits: 0, powerProduced: 0, powerUsed: 0, lowPower: false, powerRatio: 1, incomeMul: 1 },
    ];
  }

  // ---------------- spawning / placement ----------------

  spawnUnit(team: TeamId, defId: string, x: number, z: number): Unit {
    const def = unitStats(defId, this.teams[team].faction);
    const u = new Unit(team, def, x, z, this.teams[team].faction.emissive);
    u.group.position.set(x, this.map.groundHeight(x, z), z);
    this.scene.add(u.group);
    this.units.push(u);
    return u;
  }

  /** Validates building placement: in bounds, flat, unoccupied, near the base. */
  canPlace(team: TeamId, defId: string, tx: number, tz: number): boolean {
    const def = BUILDING_DEFS[defId];
    const [w, h] = def.footprint;
    let lvl = -1;
    for (let dz = 0; dz < h; dz++) {
      for (let dx = 0; dx < w; dx++) {
        const X = tx + dx, Z = tz + dz;
        if (!this.map.inBounds(X, Z)) return false;
        const i = this.map.idx(X, Z);
        if (this.map.flags[i] !== 0) return false; // rocks, ramps, crystal, buildings
        if (lvl < 0) lvl = this.map.level[i];
        else if (this.map.level[i] !== lvl) return false;
      }
    }
    // No units standing inside the footprint.
    const cx = (tx + w / 2) * TILE, cz = (tz + h / 2) * TILE;
    for (const u of this.queryUnits(cx, cz, Math.max(w, h) * TILE)) {
      const [utx, utz] = u.tile;
      if (utx >= tx && utx < tx + w && utz >= tz && utz < tz + h) return false;
    }
    // Base proximity: within 14 tiles of a completed own building (first building is free).
    const own = this.buildings.filter(b => b.team === team && b.alive);
    if (own.length === 0) return true;
    const R = 14;
    return own.some(b => Math.hypot(b.cx - cx, b.cz - cz) <= R * TILE + Math.max(w, h) * TILE);
  }

  hasPrereqs(team: TeamId, defId: string): boolean {
    const def = BUILDING_DEFS[defId];
    return def.prereq.every(p => this.buildings.some(b => b.team === team && b.alive && b.complete && b.def.id === p));
  }

  /** Places a construction site (or an instantly-complete building). Deducts cost. */
  placeBuilding(team: TeamId, defId: string, tx: number, tz: number, instant = false): Building | null {
    if (!this.canPlace(team, defId, tx, tz)) return null;
    const def = buildingStats(defId, this.teams[team].faction);
    if (this.teams[team].credits < def.cost) return null;
    this.teams[team].credits -= def.cost;
    const lvl = this.map.level[this.map.idx(tx, tz)];
    const b = new Building(team, def, tx, tz, lvl, this.teams[team].faction.emissive, instant, this.teams[team].faction.id);
    for (let dz = 0; dz < b.h; dz++)
      for (let dx = 0; dx < b.w; dx++)
        this.map.flags[this.map.idx(tx + dx, tz + dz)] |= F_BUILDING;
    b.group.position.set(b.cx, lvl * LEVEL_H, b.cz);
    this.scene.add(b.group);
    this.buildings.push(b);
    this.recomputePower(team);
    return b;
  }

  /** Queue a unit at a production building. */
  enqueue(b: Building, defId: string): boolean {
    if (!b.complete || b.queue.length >= 5) return false;
    const def = unitStats(defId, this.teams[b.team].faction);
    if (this.teams[b.team].credits < def.cost) return false;
    this.teams[b.team].credits -= def.cost;
    b.queue.push({ defId, remaining: def.buildTime, total: def.buildTime });
    return true;
  }

  cancelQueue(b: Building, index: number) {
    const item = b.queue[index];
    if (!item) return;
    const def = unitStats(item.defId, this.teams[b.team].faction);
    this.teams[b.team].credits += def.cost;
    b.queue.splice(index, 1);
  }

  recomputePower(team: TeamId) {
    let prod = 0, used = 0;
    for (const b of this.buildings) {
      if (b.team !== team || !b.alive || !b.complete) continue;
      if (b.def.power > 0) prod += b.def.power; else used -= b.def.power;
    }
    const t = this.teams[team];
    t.powerProduced = prod; t.powerUsed = used; t.lowPower = used > prod;
    t.powerRatio = getPowerRatio(t);
  }

  /** Per-faction consequences of this team's current power level (cached helper). */
  private powerOutage(team: TeamId) {
    const t = this.teams[team];
    return getPowerOutageEffects(t.faction.id as FactionId, t.powerRatio);
  }

  // ---------------- queries ----------------

  private cellKey(x: number, z: number) { return Math.floor(x / 4) * 4096 + Math.floor(z / 4); }

  rebuildGrid() {
    this.grid.clear();
    for (const u of this.units) {
      const k = this.cellKey(u.x, u.z);
      let arr = this.grid.get(k);
      if (!arr) { arr = []; this.grid.set(k, arr); }
      arr.push(u);
    }
  }

  queryUnits(x: number, z: number, r: number): Unit[] {
    const out: Unit[] = [];
    const c = Math.ceil(r / 4);
    const cx = Math.floor(x / 4), cz = Math.floor(z / 4);
    for (let dz = -c; dz <= c; dz++) {
      for (let dx = -c; dx <= c; dx++) {
        const arr = this.grid.get((cx + dx) * 4096 + (cz + dz));
        if (!arr) continue;
        for (const u of arr) {
          if (u.alive && (u.x - x) ** 2 + (u.z - z) ** 2 <= r * r) out.push(u);
        }
      }
    }
    return out;
  }

  nearestEnemy(team: TeamId, x: number, z: number, r: number): Unit | Building | null {
    let best: Unit | Building | null = null;
    let bd = r * r;
    for (const u of this.queryUnits(x, z, r)) {
      if (u.team === team) continue;
      const d = (u.x - x) ** 2 + (u.z - z) ** 2;
      if (d < bd) { bd = d; best = u; }
    }
    for (const b of this.buildings) {
      if (b.team === team || !b.alive) continue;
      const d = (b.cx - x) ** 2 + (b.cz - z) ** 2;
      const rr = (r + b.radius) ** 2;
      if (d < rr && d < bd + b.radius * b.radius) { bd = d; best = b; }
    }
    return best;
  }

  nearestDropoff(team: TeamId, x: number, z: number): Building | null {
    let best: Building | null = null, bd = Infinity;
    for (const b of this.buildings) {
      if (b.team !== team || !b.alive || !b.complete || !b.def.dropoff) continue;
      const d = (b.cx - x) ** 2 + (b.cz - z) ** 2;
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  nearestCrystal(x: number, z: number): CrystalNode | null {
    let best: CrystalNode | null = null, bd = Infinity;
    for (const c of this.map.crystals) {
      if (c.amount <= 0) continue;
      const [wx, wz] = this.map.tileToWorld(c.tx, c.tz);
      const d = (wx - x) ** 2 + (wz - z) ** 2;
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  /** A free walkable tile adjacent to a building's footprint. */
  freeTileNear(b: Building, infantry = true): [number, number] | null {
    for (let ring = 1; ring <= 4; ring++) {
      for (let dz = -ring; dz <= b.h + ring - 1; dz++) {
        for (let dx = -ring; dx <= b.w + ring - 1; dx++) {
          if (dx > -ring && dx < b.w + ring - 1 && dz > -ring && dz < b.h + ring - 1) continue;
          const X = b.tx + dx, Z = b.tz + dz;
          if (this.map.isWalkable(X, Z)) return [X, Z];
        }
      }
    }
    return null;
  }

  // ---------------- orders ----------------

  private setPath(u: Unit, gx: number, gz: number) {
    const [tx, tz] = u.tile;
    u.path = findPath(this.map, tx, tz, gx, gz, u.isInfantry);
    u.pathGoal = [gx, gz];
    u.stuckTimer = 0;
  }

  orderMove(u: Unit, x: number, z: number, attackMove = false) {
    const [gx, gz] = this.map.worldToTile(x, z);
    u.order = attackMove ? { kind: 'attackmove', x, z } : { kind: 'move', x, z };
    u.engage = null;
    u.sub = '';
    u.anchorX = x; u.anchorZ = z;
    this.setPath(u, gx, gz);
  }

  orderAttack(u: Unit, target: Unit | Building) {
    // Harvesters have no gun but can ram: stop harvesting and run targets over.
    if (!u.def.weapon && u.def.harvester) {
      u.harvAttack = true;
      u.order = { kind: 'attack', target };
      u.engage = null;
      u.sub = '';
      return;
    }
    if (!u.def.weapon) { this.orderMove(u, targetX(target), targetZ(target)); return; }
    u.order = { kind: 'attack', target };
    u.engage = null;
    u.sub = '';
  }

  orderGather(u: Unit, node: CrystalNode) {
    if (!u.def.harvester) return;
    u.harvAttack = false; // back to harvesting duty
    u.order = { kind: 'gather', node };
    u.sub = u.cargo >= (u.def.capacity ?? 1) ? 'toDropoff' : 'toNode';
    const [wx, wz] = this.map.tileToWorld(node.tx, node.tz);
    this.setPath(u, ...this.map.worldToTile(wx, wz));
  }

  /**
   * Manually send a (possibly partially-loaded) harvester back to a dropoff to
   * unload now — for when the player urgently needs credits. It resumes
   * gathering afterwards. Returns true if it had cargo and a dropoff exists.
   */
  orderReturn(u: Unit, drop?: Building): boolean {
    if (!u.def.harvester || u.cargo <= 0) return false;
    const dropoff = drop ?? this.nearestDropoff(u.team, u.x, u.z);
    if (!dropoff) return false;
    u.harvAttack = false;
    const node = u.order.kind === 'gather' ? u.order.node : this.nearestCrystal(u.x, u.z);
    u.order = { kind: 'gather', node };
    u.sub = 'toDropoff';
    const t = this.freeTileNear(dropoff, u.isInfantry);
    if (t) this.setPath(u, t[0], t[1]);
    return true;
  }

  orderBuild(u: Unit, site: Building) {
    if (!u.def.builder) return;
    if (site.builder && site.builder !== u && site.builder.alive) return;
    site.builder = u;
    u.order = { kind: 'build', site };
    const t = this.freeTileNear(site, u.isInfantry);
    if (t) this.setPath(u, t[0], t[1]);
  }

  orderRepair(u: Unit, b: Building) {
    if (!u.def.repairs || b.team !== u.team) return;
    u.order = { kind: 'repair', building: b };
    const t = this.freeTileNear(b, u.isInfantry);
    if (t) this.setPath(u, t[0], t[1]);
  }

  stop(u: Unit) {
    u.order = { kind: 'idle' };
    u.path = null;
    u.engage = null;
    u.anchorX = u.x; u.anchorZ = u.z;
  }

  // ---------------- combat ----------------

  applyDamage(target: Unit | Building, weapon: WeaponDef, attackerTeam: TeamId) {
    if (!target.alive) return;
    const armor = target instanceof Building ? 'structure' : target.def.armor;
    const mult = DAMAGE_MATRIX[weapon.damageType][armor] ?? 1;
    target.hp -= weapon.damage * mult;
    // returnFire stance: shoot back at whoever hits us (no proactive scanning).
    if (target instanceof Unit && target.stance === 'returnFire' && target.def.weapon
        && (!target.engage || !target.engage.alive)) {
      const attacker = this.nearestEnemy(target.team, target.x, target.z,
        (target.def.autoAcquireRange ?? target.def.vision) * TILE);
      if (attacker) target.engage = attacker;
    }
    if (target.hp <= 0) this.kill(target);
  }

  /** Support vehicles slowly repair nearby damaged friendly vehicles. */
  private supportAuraStep(u: Unit, dt: number) {
    const aura = u.def.supportAura!;
    u.auraTimer -= dt;
    if (u.auraTimer > 0) return;
    u.auraTimer = 0.5;
    const r = aura.repairRange * TILE;
    for (const ally of this.units) {
      if (ally === u || !ally.alive || ally.team !== u.team) continue;
      if (ally.def.class !== 'vehicle' || ally.hp >= ally.def.hp) continue;
      if ((ally.x - u.x) ** 2 + (ally.z - u.z) ** 2 > r * r) continue;
      ally.hp = Math.min(ally.def.hp, ally.hp + aura.repairAmount * 0.5);
    }
  }

  kill(e: Unit | Building) {
    if (!e.alive) return;
    e.alive = false;
    const pos = e instanceof Building
      ? new THREE.Vector3(e.cx, e.level * LEVEL_H + 1, e.cz)
      : new THREE.Vector3(e.x, this.map.groundHeight(e.x, e.z) + 0.7, e.z);
    const fxScale = e instanceof Building ? Math.max(e.w, e.h) * 1.2 : 0.9;
    this.effects.explosion(pos, fxScale);
    const groundPos = pos.clone().setY(e instanceof Building ? e.level * LEVEL_H : this.map.groundHeight(pos.x, pos.z));
    this.effects.deathBlast(groundPos, fxScale * 0.8);
    this.scene.remove(e.group);
    if (e instanceof Building) {
      for (let dz = 0; dz < e.h; dz++)
        for (let dx = 0; dx < e.w; dx++)
          this.map.flags[this.map.idx(e.tx + dx, e.tz + dz)] &= ~F_BUILDING;
      this.recomputePower(e.team);
    }
    for (const fn of this.onDeath) fn(e);
  }

  private fireWeapon(shooter: Unit | Building, target: Unit | Building, weapon: WeaponDef) {
    const team = shooter instanceof Building ? shooter.team : shooter.team;
    const sy = shooter instanceof Building
      ? shooter.level * LEVEL_H + (shooter.group.userData.topY ?? 2) * 0.7
      : this.map.groundHeight(shooter.x, shooter.z) + (shooter.group.userData.topY ?? 1) * 0.75;
    const from = shooter instanceof Building
      ? new THREE.Vector3(shooter.cx, sy, shooter.cz)
      : new THREE.Vector3(shooter.x, sy, shooter.z);
    const ty = target instanceof Building
      ? target.level * LEVEL_H + 0.8
      : this.map.groundHeight(target.x, target.z) + 0.6;
    const to = target instanceof Building
      ? new THREE.Vector3(target.cx, ty, target.cz)
      : new THREE.Vector3(target.x, ty, target.z);

    // GLB vehicles expose a 'muzzle' socket on the (rotating) turret — resolve its
    // CURRENT world position each shot so the flash sits at the barrel tip.
    const muzzle = shooter.group.userData.muzzle as THREE.Object3D | undefined;
    if (muzzle) { muzzle.updateWorldMatrix(true, false); muzzle.getWorldPosition(from); }

    this.effects.muzzleFlash(from);
    if (weapon.projectile === 'laser') {
      const color = this.teams[team].faction.emissive;
      this.effects.beam(from, to, color);
      this.applyDamage(target, weapon, team);
    } else {
      this.effects.projectile(weapon.projectile, from, to, () => {
        if (weapon.projectile !== 'bullet') this.effects.explosion(to, 0.5);
        else this.effects.hitSpark(to);
        this.applyDamage(target, weapon, team);
      });
    }
  }

  /** Range check with high-ground bonus (+1 tile when shooting downhill). */
  inRange(shooter: Unit | Building, target: Unit | Building, weapon: WeaponDef): boolean {
    const sx = shooter instanceof Building ? shooter.cx : shooter.x;
    const sz = shooter instanceof Building ? shooter.cz : shooter.z;
    const tx = targetX(target), tz = targetZ(target);
    const shooterH = shooter instanceof Building ? shooter.level : this.map.walkHeight[this.map.idx(...(shooter as Unit).tile)];
    const targetH = target instanceof Building ? target.level : this.map.walkHeight[this.map.idx(...(target as Unit).tile)];
    let range = weapon.range * TILE;
    if (shooterH > targetH + 0.4) range += TILE;
    const pad = target instanceof Building ? target.radius : target.def.radius;
    return (sx - tx) ** 2 + (sz - tz) ** 2 <= (range + pad) ** 2;
  }

  // ---------------- per-frame update ----------------

  update(dt: number, camera: THREE.Camera) {
    this.time += dt;
    camera.getWorldQuaternion(this.camQuat);
    this.rebuildGrid();

    for (const u of this.units) if (u.alive) this.updateUnit(u, dt);
    for (const b of this.buildings) if (b.alive) this.updateBuilding(b, dt);

    // Cull dead entities from the arrays.
    if (this.units.some(u => !u.alive)) this.units = this.units.filter(u => u.alive);
    if (this.buildings.some(b => !b.alive)) this.buildings = this.buildings.filter(b => b.alive);
  }

  private updateUnit(u: Unit, dt: number) {
    u.cooldown = Math.max(0, u.cooldown - dt);
    const o = u.order;

    switch (o.kind) {
      case 'idle':
      case 'attackmove': {
        // Idle harvesters return to work on their own (unless told to ram-attack).
        if (o.kind === 'idle' && u.def.harvester && !u.harvAttack && this.nearestDropoff(u.team, u.x, u.z)) {
          if (u.cargo > 0) {
            u.order = { kind: 'gather', node: null }; // carry the load home
            u.sub = 'toDropoff';
            return;
          }
          const node = this.nearestCrystal(u.x, u.z);
          if (node) { this.orderGather(u, node); return; }
        }
        // Support vehicles: repair aura for nearby damaged friendly vehicles.
        if (u.def.supportAura) this.supportAuraStep(u, dt);
        // Auto-acquire targets — driven by the unit's autonomy settings
        // (data-driven; defaults reproduce the legacy vision-based behavior).
        u.scanTimer -= dt;
        const autonomous = u.def.weapon && (u.def.canAutoAttack ?? true) && u.stance !== 'holdFire';
        if (autonomous && u.scanTimer <= 0) {
          u.scanTimer = 0.3;
          if (!u.engage || !u.engage.alive) {
            const acquireR = (u.def.autoAcquireRange ?? u.def.vision) * TILE;
            // defendArea stance scans around the anchor, not the unit.
            const sx = u.stance === 'defendArea' ? u.anchorX : u.x;
            const sz = u.stance === 'defendArea' ? u.anchorZ : u.z;
            u.engage = this.nearestEnemy(u.team, sx, sz, acquireR);
          }
        }
        if (u.engage && u.engage.alive && u.def.weapon) {
          this.combatStep(u, u.engage, dt, false);
          // Leash: don't chase beyond the configured pursuit range.
          const leash = (u.def.pursuitRange ?? u.def.vision * 1.6) * TILE;
          if (Math.hypot(u.x - u.anchorX, u.z - u.anchorZ) > leash) {
            u.engage = null;
            if (o.kind === 'attackmove') this.setPath(u, ...this.map.worldToTile(o.x, o.z));
          }
          return;
        }
        if (o.kind === 'attackmove') {
          if (!this.stepAlongPath(u, dt)) u.order = { kind: 'idle' };
        }
        return;
      }
      case 'move': {
        if (!this.stepAlongPath(u, dt)) this.stop(u);
        return;
      }
      case 'attack': {
        if (!o.target.alive) {
          // Harvester: after the kill, look for the next nearby enemy or idle.
          if (u.def.harvester) {
            const next = this.nearestEnemy(u.team, u.x, u.z, u.def.vision * TILE);
            if (next) { o.target = next; } else { u.order = { kind: 'idle' }; }
            return;
          }
          this.stop(u); return;
        }
        if (!u.def.weapon && u.def.harvester) { this.ramStep(u, o.target, dt); return; }
        this.combatStep(u, o.target, dt, true);
        return;
      }
      case 'gather': this.gatherStep(u, o, dt); return;
      case 'build': {
        const site = o.site;
        if (!site.alive || site.complete) { this.stop(u); return; }
        // The builder only needs to REACH the site to kick off construction.
        // Once started, the structure finishes on its own (see updateBuilding),
        // so the builder is freed and can move on to the next job.
        if (this.nearBuilding(u, site)) {
          site.started = true;
          this.stop(u);
        } else if (!this.stepAlongPath(u, dt)) {
          const t = this.freeTileNear(site, u.isInfantry);
          if (t) this.setPath(u, t[0], t[1]);
        }
        return;
      }
      case 'repair': {
        const b = o.building;
        if (!b.alive || b.hp >= b.def.hp) { this.stop(u); return; }
        if (this.nearBuilding(u, b)) {
          u.path = null;
          this.faceToward(u, b.cx, b.cz, dt);
          // Faction repair rate × power-outage repair efficiency (Azure repairs
          // fast but suffers under low power; Verdant repairs slowly).
          const fid = this.teams[u.team].faction.id as FactionId;
          const repairMul = getModifiedRepairRate(1, fid) * this.powerOutage(u.team).repairEfficiencyMultiplier;
          b.hp = Math.min(b.def.hp, b.hp + 35 * dt * repairMul);
        } else if (!this.stepAlongPath(u, dt)) {
          const t = this.freeTileNear(b, u.isInfantry);
          if (t) this.setPath(u, t[0], t[1]);
        }
        return;
      }
    }
  }

  private nearBuilding(u: Unit, b: Building): boolean {
    const dx = Math.max(b.tx * TILE - u.x, 0, u.x - (b.tx + b.w) * TILE);
    const dz = Math.max(b.tz * TILE - u.z, 0, u.z - (b.tz + b.h) * TILE);
    // Generous: covers the worst corner of a diagonally-adjacent tile plus
    // separation jitter, so builders/harvesters can't deadlock at the doorstep.
    return Math.hypot(dx, dz) < 3.0;
  }

  private combatStep(u: Unit, target: Unit | Building, dt: number, chase: boolean) {
    const w = u.def.weapon!;
    if (this.inRange(u, target, w)) {
      u.path = null;
      this.faceToward(u, targetX(target), targetZ(target), dt);
      if (u.cooldown <= 0) {
        u.cooldown = w.cooldown;
        this.fireWeapon(u, target, w);
      }
    } else {
      // Move toward the target, repathing as it moves.
      const [gx, gz] = this.map.worldToTile(targetX(target), targetZ(target));
      if (!u.pathGoal || Math.abs(u.pathGoal[0] - gx) + Math.abs(u.pathGoal[1] - gz) > 2 || !u.path) {
        this.setPath(u, gx, gz);
      }
      this.stepAlongPath(u, dt);
    }
  }

  /** Harvester ram attack: drive into the target, crushing it on contact. */
  private ramStep(u: Unit, target: Unit | Building, dt: number) {
    const tx = targetX(target), tz = targetZ(target);
    const pad = target instanceof Building ? target.radius : target.def.radius;
    const dist = Math.hypot(u.x - tx, u.z - tz);
    if (dist <= pad + u.def.radius + 0.4) {
      // In contact: crush. Infantry get run over hard, vehicles/buildings dented.
      this.faceToward(u, tx, tz, dt);
      u.cooldown = Math.max(0, u.cooldown - dt);
      if (u.cooldown <= 0) {
        u.cooldown = 0.5;
        const armor = target instanceof Building ? 'structure' : target.def.armor;
        const dmg = armor === 'light' ? 60 : armor === 'heavy' ? 22 : 14;
        this.applyDamage(target, { damage: dmg, damageType: 'explosive', range: 1, cooldown: 0.5, projectile: 'shell' }, u.team);
        this.effects.hitSpark(new THREE.Vector3(tx, this.map.groundHeight(tx, tz) + 0.5, tz));
      }
    } else {
      const [gx, gz] = this.map.worldToTile(tx, tz);
      if (!u.pathGoal || Math.abs(u.pathGoal[0] - gx) + Math.abs(u.pathGoal[1] - gz) > 2 || !u.path) {
        this.setPath(u, gx, gz);
      }
      this.stepAlongPath(u, dt);
    }
  }

  private gatherStep(u: Unit, o: { kind: 'gather'; node: CrystalNode | null }, dt: number) {
    const cap = u.def.capacity ?? 200;
    if (u.sub === 'gathering') {
      u.gatherTimer -= dt;
      if (u.gatherTimer <= 0 && o.node) {
        const take = Math.min(cap - u.cargo, o.node.amount, cap);
        u.cargo += take;
        o.node.amount -= take;
        this.updateCrystalVisual(o.node);
        u.sub = 'toDropoff';
        const drop = this.nearestDropoff(u.team, u.x, u.z);
        if (drop) {
          const t = this.freeTileNear(drop, u.isInfantry);
          if (t) this.setPath(u, t[0], t[1]);
        }
      }
      return;
    }
    if (u.sub === 'toDropoff') {
      const drop = this.nearestDropoff(u.team, u.x, u.z);
      if (!drop) { u.path = null; return; } // wait until a refinery exists
      if (this.nearBuilding(u, drop)) {
        // Faction gather-rate (Verdant hauls a touch more, Azure/Solar a touch less).
        const gatherMul = getEconomyModifiers(this.teams[u.team].faction.id as FactionId).resourceGatherRate;
        this.teams[u.team].credits += u.cargo * this.teams[u.team].incomeMul * gatherMul;
        u.cargo = 0;
        u.sub = 'toNode';
        if (!o.node || o.node.amount <= 0) o.node = this.nearestCrystal(u.x, u.z);
        if (!o.node) { this.stop(u); return; }
        const [wx, wz] = this.map.tileToWorld(o.node.tx, o.node.tz);
        this.setPath(u, ...this.map.worldToTile(wx, wz));
      } else if (!this.stepAlongPath(u, dt)) {
        const t = this.freeTileNear(drop, u.isInfantry);
        if (t) this.setPath(u, t[0], t[1]);
      }
      return;
    }
    // toNode
    if (!o.node || o.node.amount <= 0) {
      o.node = this.nearestCrystal(u.x, u.z);
      if (!o.node) { this.stop(u); return; }
      const [wx, wz] = this.map.tileToWorld(o.node.tx, o.node.tz);
      this.setPath(u, ...this.map.worldToTile(wx, wz));
    }
    const [wx, wz] = this.map.tileToWorld(o.node.tx, o.node.tz);
    if (Math.hypot(u.x - wx, u.z - wz) < TILE * 1.6) {
      u.path = null;
      this.faceToward(u, wx, wz, dt);
      u.sub = 'gathering';
      u.gatherTimer = u.def.gatherTime ?? 6;
    } else {
      this.stepAlongPath(u, dt);
    }
  }

  updateCrystalVisual(node: CrystalNode) {
    const g = this.crystalGroups.get(node.id);
    if (!g) return;
    const stage = getCrystalVisualStage(node.amount, node.max);
    const ud = g.userData as CrystalGroupUD;

    if (stage === 'depleted') {
      g.visible = false;
      this.map.flags[this.map.idx(node.tx, node.tz)] &= ~F_CRYSTAL;
      ud.stage = 'depleted';
      return;
    }

    g.visible = true; // a node only ever depletes in play, but stay correct if it refills
    // Discrete per-stage group scale (full 1.0 → reduced 0.82 → small 0.62),
    // applied together with the texture swap so the change reads as a deliberate
    // depletion step rather than a glitch.
    g.scale.setScalar(CRYSTAL_STAGE_SCALE[stage]);

    // Swap the sprite texture ONLY when the discrete stage actually changes —
    // textures are pre-loaded in terrain.ts, so this is a cheap pointer assign.
    if (ud.stage !== stage && ud.mat && ud.tex) {
      ud.mat.map = ud.tex[stage];
      ud.mat.needsUpdate = true;
      ud.stage = stage;
    }
  }

  /** Returns false when the path is finished (arrived) or missing. */
  private stepAlongPath(u: Unit, dt: number): boolean {
    if (!u.path || u.path.length === 0) return false;
    const [wtx, wtz] = u.path[0];
    const [wx, wz] = this.map.tileToWorld(wtx, wtz);
    const dx = wx - u.x, dz = wz - u.z;
    const d = Math.hypot(dx, dz);
    const step = u.def.speed * dt;
    if (d <= Math.max(step, 0.5)) {
      u.path.shift();
      if (u.path.length === 0) return false;
    } else {
      u.x += (dx / d) * step;
      u.z += (dz / d) * step;
      this.faceToward(u, u.x + dx, u.z + dz, dt);
    }
    // Stuck detection: if barely moving, repath.
    if (Math.hypot(u.x - u.lastX, u.z - u.lastZ) < step * 0.25) {
      u.stuckTimer += dt;
      if (u.stuckTimer > 1.2 && u.pathGoal) {
        this.setPath(u, u.pathGoal[0], u.pathGoal[1]);
        u.stuckTimer = 0;
      }
    } else {
      u.stuckTimer = 0;
    }
    u.lastX = u.x; u.lastZ = u.z;
    return true;
  }

  private faceToward(u: Unit, x: number, z: number, dt: number) {
    const want = Math.atan2(x - u.x, z - u.z);
    let diff = want - u.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    u.heading += diff * Math.min(1, dt * 10);
  }

  private updateBuilding(b: Building, dt: number) {
    // Autonomous construction: once a builder has reached the site, the
    // structure raises itself to completion without the builder staying put.
    if (!b.complete && b.started) {
      b.progress += dt;
      const def = b.def;
      const t = Math.min(1, b.progress / def.buildTime);
      b.hp = Math.min(def.hp, Math.round(def.hp * (0.1 + 0.9 * t)));
      b.group.scale.y = 0.15 + 0.85 * t;
      if (b.progress >= def.buildTime) {
        b.complete = true;
        b.hp = def.hp;
        b.group.scale.y = 1;
        if (b.pad) b.pad.material = foundationDoneMat; // warning rim -> subtle pad
        this.recomputePower(b.team);
      }
    }
    // Production queue. Power deficits slow production — faction-specific
    // (Solar grinds to a halt, Verdant barely notices).
    if (b.complete && b.queue.length) {
      const rate = this.powerOutage(b.team).productionSpeedMultiplier;
      const item = b.queue[0];
      item.remaining -= dt * rate;
      if (item.remaining <= 0) {
        const t = this.freeTileNear(b);
        if (t) {
          const [wx, wz] = this.map.tileToWorld(t[0], t[1]);
          const u = this.spawnUnit(b.team, item.defId, wx, wz);
          // Step away from the factory so the exit stays clear.
          const ang = Math.atan2(wx - b.cx, wz - b.cz);
          this.orderMove(u, wx + Math.sin(ang) * TILE * 2.5, wz + Math.cos(ang) * TILE * 2.5);
          b.queue.shift();
        } else {
          item.remaining = 0.5; // exit blocked, retry shortly
        }
      }
    }
    // Turrets. Under a power deficit, defensive systems lose efficiency — power-
    // dependent factions (Solar/Azure) go dark, resilient ones (Verdant) keep firing.
    const w = b.def.weapon;
    if (b.complete && w) {
      const turretEff = b.def.needsPower ? this.powerOutage(b.team).turretEfficiencyMultiplier : 1;
      const offline = turretEff < 0.75;
      b.cooldown = Math.max(0, b.cooldown - dt);
      b.scanTimer -= dt;
      if (!offline) {
        if (b.scanTimer <= 0) {
          b.scanTimer = 0.4;
          if (!b.target || !b.target.alive || !this.inRange(b, b.target, w)) {
            const cand = this.nearestEnemy(b.team, b.cx, b.cz, (w.range + 1) * TILE);
            b.target = cand && this.inRange(b, cand, w) ? cand : null;
          }
        }
        if (b.target && b.target.alive && b.cooldown <= 0 && this.inRange(b, b.target, w)) {
          b.cooldown = w.cooldown / Math.max(0.3, turretEff); // degraded turrets fire slower
          this.fireWeapon(b, b.target, w);
        }
      }
    }
  }

  /** Visual sync: positions, separation, rings, health bars, animation. Call after update(). */
  syncVisuals(camera: THREE.Camera, dt = 0.016) {
    camera.getWorldQuaternion(this.camQuat);
    pulseLights(this.time);
    // Soft separation between nearby units.
    for (const u of this.units) {
      for (const v of this.queryUnits(u.x, u.z, 2.2)) {
        if (v === u || v.id < u.id) continue;
        const dx = u.x - v.x, dz = u.z - v.z;
        const d = Math.hypot(dx, dz);
        const minD = u.def.radius + v.def.radius + 0.25;
        if (d > 0.001 && d < minD) {
          const push = (minD - d) * 0.4;
          const px = (dx / d) * push, pz = (dz / d) * push;
          this.tryNudge(u, px, pz);
          this.tryNudge(v, -px, -pz);
        }
      }
    }
    for (const u of this.units) {
      u.group.position.set(u.x, this.map.groundHeight(u.x, u.z), u.z);
      u.group.rotation.y = u.heading;
      u.ring.visible = u.selected;
      const hurt = u.hp < u.def.hp - 0.5;
      u.hb.group.visible = u.selected || hurt;
      if (u.hb.group.visible) {
        u.hb.set(u.hp / u.def.hp);
        u.hb.group.quaternion.copy(this.camQuat);
      }
      // Harvester crystal-load bar: visible when carrying or selected.
      if (u.cargoBar) {
        const cap = u.def.capacity ?? 0;
        const show = cap > 0 && (u.cargo > 0.01 || u.selected);
        u.cargoBar.group.visible = show;
        if (show) {
          u.cargoBar.set(cap > 0 ? u.cargo / cap : 0);
          u.cargoBar.group.quaternion.copy(this.camQuat);
        }
      }
      this.animateUnit(u, dt);
    }
    for (const b of this.buildings) {
      b.ring.visible = b.selected;
      if (!b.complete) {
        b.hb.group.visible = false;
        // Show the build-progress % only once construction has actually begun
        // (a builder has reached the site); before that the pad sits empty.
        if (b.started) {
          const pct = Math.round(100 * b.progress / Math.max(0.001, b.def.buildTime));
          b.pct.set(`${pct}%`);
          b.pct.sprite.visible = true;
          // Counter the building's animated Y-scale (0.15→1) so the label keeps
          // a constant world height and stays undistorted.
          const s = b.group.scale.y || 1;
          b.pct.sprite.position.y = ((b.group.userData.topY ?? 3) + 1.05) / s;
          b.pct.sprite.scale.set(b.pct.baseScaleX, b.pct.baseScaleY / s, 1);
        } else {
          b.pct.sprite.visible = false;
        }
      } else {
        b.pct.sprite.visible = false;
        const hurt = b.hp < b.def.hp - 0.5;
        b.hb.group.visible = b.selected || hurt;
        if (b.hb.group.visible) {
          b.hb.set(b.hp / b.def.hp);
          b.hb.group.quaternion.copy(this.camQuat);
        }
      }
      this.animateBuilding(b, dt);
    }
  }

  // ---------------- visual animation ----------------

  private aimYaw(current: number, desired: number, dt: number): number {
    let diff = desired - current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return current + diff * Math.min(1, dt * 7);
  }

  private animateUnit(u: Unit, dt: number) {
    const anim = u.group.userData.anim as Record<string, THREE.Group> | undefined;
    const inner = u.group.userData.inner as THREE.Group | undefined;
    // Vehicles pitch with the terrain slope they're driving on.
    if (inner && !u.isInfantry) {
      const s = Math.sin(u.heading), c = Math.cos(u.heading);
      const ahead = this.map.groundHeight(u.x + s * 0.9, u.z + c * 0.9);
      const behind = this.map.groundHeight(u.x - s * 0.9, u.z - c * 0.9);
      const want = Math.atan2(behind - ahead, 1.8);
      inner.rotation.x += (want - inner.rotation.x) * Math.min(1, dt * 8);
    }
    // Movement-style identity (visual only — gameplay speed is data-driven):
    // hover floats and banks into turns, mono-wheels lean hard, wheels jitter
    // softly, tracks stay planted. Profile comes from the faction variant.
    if (inner && !u.isInfantry && u.def.visual) {
      const prof = MOVEMENT_PROFILES[u.def.visual.movement as MovementType];
      if (prof) {
        let yawRate = (u.heading - u.visHeading) / Math.max(dt, 1e-4);
        if (yawRate > 8) yawRate = 8; else if (yawRate < -8) yawRate = -8;
        u.visHeading = u.heading;
        const wantRoll = Math.max(-0.32, Math.min(0.32, -yawRate * prof.bankFactor));
        u.visRoll += (wantRoll - u.visRoll) * Math.min(1, dt * 6);
        inner.rotation.z = u.visRoll;
        const bob = prof.bobAmp ? Math.sin(this.time * prof.bobFreq + u.id) * prof.bobAmp : 0;
        // Walkers bounce with their stride while actually moving.
        const moving = !!u.path && u.path.length > 0;
        const step = prof.stepBounce && moving
          ? Math.abs(Math.sin(this.time * 7 + u.id)) * prof.stepBounce : 0;
        inner.position.y = prof.rideHeight + bob + step;
      }
    }
    // GLB cannons can declare a barrel that spins about its bore and/or "pumps"
    // (contracts to (1-pump) of its length while thickening, then expands back).
    const barrel = u.group.userData.barrel as THREE.Object3D | undefined;
    const ba = u.group.userData.barrelAnim as { spin?: boolean; pump?: number } | undefined;
    if (barrel && ba) {
      if (ba.spin) barrel.rotation.z = this.time * 6;
      const pump = ba.pump ?? 0;
      if (pump > 0) {
        const ph = 0.5 - 0.5 * Math.cos(this.time * 3 + u.id); // 0..1 pulse
        barrel.scale.z = 1 - pump * ph;
        barrel.scale.x = barrel.scale.y = 1 + pump * ph * 0.8;
      }
    }
    if (!anim) return;
    if (anim.turret) {
      const target = (u.order.kind === 'attack' && u.order.target.alive) ? u.order.target
        : (u.engage && u.engage.alive ? u.engage : null);
      const desired = target
        ? Math.atan2(targetX(target) - u.x, targetZ(target) - u.z) - u.heading
        : 0;
      u.turretYaw = this.aimYaw(u.turretYaw, desired, dt);
      anim.turret.rotation.y = u.turretYaw;
    }
    if (anim.spin) anim.spin.rotation.y = this.time * 1.6 + u.id;
    if (anim.load) {
      const ratio = (u.def.capacity ?? 0) > 0 ? u.cargo / u.def.capacity! : 0;
      const gathering = u.sub === 'gathering';
      const pulse = gathering ? 0.15 * Math.sin(this.time * 9) : 0;
      const s = Math.max(0.06, ratio) + pulse * 0.2;
      anim.load.visible = ratio > 0.02 || gathering;
      anim.load.scale.y = Math.max(0.1, s);
      anim.load.position.y = -0.55 * (1 - Math.max(0.1, s)); // sink the load as it empties
    }
  }

  private animateBuilding(b: Building, dt: number) {
    const anim = b.group.userData.anim as Record<string, THREE.Group> | undefined;
    const beacon = b.group.userData.beacon as THREE.Mesh | undefined;
    if (beacon) {
      const ph = Math.sin(this.time * 2.6 + b.id * 1.7);
      beacon.visible = b.complete;
      beacon.scale.setScalar(0.75 + 0.45 * ph);
    }
    // Low-power: darken the consumer + pulse a lightning indicator.
    const offline = b.complete && b.def.power < 0 && this.teams[b.team].lowPower;
    if (b.darkOverlay) b.darkOverlay.visible = offline;
    if (b.powerIcon) {
      b.powerIcon.visible = offline;
      if (offline) {
        const p = 0.5 + 0.5 * Math.sin(this.time * 5 + b.id);
        (b.powerIcon.material as THREE.SpriteMaterial).opacity = 0.35 + 0.65 * p;
        b.powerIcon.scale.setScalar(1.0 + 0.2 * p);
      }
    }
    if (!anim || !b.complete) return;
    // Gentle emissive idle pulse for GLB buildings with baked glow materials
    // (HQs/powerplants). Touches only emissiveIntensity — no geometry, no
    // position/scale, so it can never affect footprint or gameplay.
    const pulseMats = (b.group.userData.anim as { pulseMats?: { mat: THREE.MeshStandardMaterial; base: number }[] }).pulseMats;
    if (pulseMats) {
      const k = 0.82 + 0.18 * Math.sin(this.time * 1.5 + b.id);
      for (const pm of pulseMats) pm.mat.emissiveIntensity = pm.base * k;
    }
    if (anim.turret) {
      const t = b.target;
      if (t && t.alive) {
        const desired = Math.atan2(targetX(t) - b.cx, targetZ(t) - b.cz);
        anim.turret.rotation.y = this.aimYaw(anim.turret.rotation.y, desired, dt);
      } else {
        anim.turret.rotation.y += dt * 0.3; // idle slow sweep
      }
    }
    if (anim.spin) {
      anim.spin.rotation.y = this.time * 0.9 + b.id;
      anim.spin.position.y = Math.sin(this.time * 1.4 + b.id) * 0.08;
    }
  }

  private tryNudge(u: Unit, dx: number, dz: number) {
    const nx = u.x + dx, nz = u.z + dz;
    const [ta, tb] = u.tile;
    const [na, nb] = this.map.worldToTile(nx, nz);
    if (na === ta && nb === tb) { u.x = nx; u.z = nz; return; }
    if (this.map.canStep(ta, tb, na, nb, u.isInfantry)) { u.x = nx; u.z = nz; }
  }
}

function targetX(t: Unit | Building) { return t instanceof Building ? t.cx : t.x; }
function targetZ(t: Unit | Building) { return t instanceof Building ? t.cz : t.z; }
