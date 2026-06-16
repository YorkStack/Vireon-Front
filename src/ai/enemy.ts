// Enemy AI: builds a base in a sensible order, keeps its economy running,
// produces a mixed army, defends its base, and launches escalating attack
// waves. Rebuilds key structures when they are destroyed.
import { TILE } from '../map/map';
import { buildingStats, unitStats, UNIT_DEFS } from '../core/defs';
import type { MissionDef } from '../core/types';
import type { World, Unit, Building } from '../sim/world';
import { DIFFICULTIES, type DifficultyConfig } from '../data/difficulty';
import { defaultDoctrineFor, type Doctrine } from '../data/doctrines';
import { effectiveProfile, tickInterval, waveMinReady, sendFraction } from './decisions';

const CORE_PLAN = ['nexus', 'refinery', 'spire', 'barracks', 'foundry', 'spire'];
const DEFENSE_PLAN = ['cannon', 'cannon', 'lance', 'wall', 'wall', 'cannon', 'lance'];
// Army composition by ROLE — resolved against the data-driven unit classes, so
// the AI automatically picks up new faction variants and renamed classes.
const ARMY_ROLE_MIX: [string, number][] = [
  ['rifle', 0.27], ['rocket', 0.18], ['energy', 0.08],
  ['scout', 0.07], ['attackVehicle', 0.08], ['tank', 0.20],
  ['siege', 0.08], ['antiAir', 0.04],
];

export class EnemyAI {
  private world: World;
  private profile: MissionDef['aiProfile'];
  private team = 1 as const;
  private startTx: number;
  private startTz: number;
  private tick = 0;
  private planIndex = 0;
  private defenseIndex = 0;
  private nextWaveAt: number;
  private waveSize: number;
  private wavesSent = 0;
  // Difficulty + faction doctrine shape the effective behaviour.
  private doctrine: Doctrine;
  private tickIntervalSec: number;
  private corePlan: string[];
  private defensePlan: string[];
  private armyMix: [string, number][];

  constructor(
    world: World, profile: MissionDef['aiProfile'], startTx: number, startTz: number,
    difficulty: DifficultyConfig = DIFFICULTIES.schwer, doctrine?: Doctrine,
  ) {
    this.world = world;
    this.startTx = startTx;
    this.startTz = startTz;
    this.doctrine = doctrine ?? defaultDoctrineFor(world.teams[1].faction.id);
    // Compose mission base × difficulty × doctrine timing into the live profile.
    this.profile = effectiveProfile(profile, difficulty, this.doctrine.preferredAttackTiming);
    this.tickIntervalSec = tickInterval(difficulty);
    this.corePlan = this.doctrine.buildOrder ?? CORE_PLAN;
    this.defensePlan = this.doctrine.defenseOrder ?? DEFENSE_PLAN;
    this.armyMix = this.doctrine.armyMix ?? ARMY_ROLE_MIX;
    this.nextWaveAt = this.profile.firstWaveAt;
    this.waveSize = 5;
  }

  update(dt: number) {
    this.tick -= dt;
    if (this.tick > 0) return;
    this.tick = this.tickIntervalSec; // decision cadence (difficulty-scaled)

    this.runConstruction();
    this.runEconomy();
    this.runProduction();
    this.runDefense();
    this.runWaves();
  }

  // ---------- helpers ----------

  private get fabricator(): Unit | undefined {
    return this.world.units.find(u => u.team === this.team && u.def.builder && u.alive);
  }
  private myBuildings(defId?: string): Building[] {
    return this.world.buildings.filter(b => b.team === this.team && b.alive && (!defId || b.def.id === defId));
  }
  private myArmy(): Unit[] {
    return this.world.units.filter(u =>
      u.team === this.team && u.alive && u.def.weapon && !u.def.harvester && !u.def.builder);
  }
  private get credits() { return this.world.teams[this.team].credits; }

  /** Spiral-search a valid placement around the AI base. */
  private findSpot(defId: string, biasTx = this.startTx, biasTz = this.startTz): [number, number] | null {
    for (let r = 2; r <= 16; r++) {
      for (let attempt = 0; attempt < 14; attempt++) {
        const a = Math.random() * Math.PI * 2;
        const tx = Math.round(biasTx + Math.cos(a) * r);
        const tz = Math.round(biasTz + Math.sin(a) * r);
        if (this.world.canPlace(this.team, defId, tx, tz)) return [tx, tz];
      }
    }
    return null;
  }

  // ---------- behaviors ----------

  private runConstruction() {
    const fab = this.fabricator;
    if (!fab) return;
    if (fab.order.kind === 'build') return; // busy

    // Resume any unfinished site first.
    const site = this.myBuildings().find(b => !b.complete);
    if (site) { this.world.orderBuild(fab, site); return; }

    // Rebuild destroyed core structures.
    let next: string | null = null;
    if (this.profile.rebuilds) {
      for (const core of ['nexus', 'refinery', 'spire', 'barracks', 'foundry']) {
        const have = this.myBuildings(core).length;
        const planned = this.corePlan.slice(0, this.planIndex).filter(p => p === core).length;
        if (planned > 0 && have === 0) { next = core; break; }
      }
    }
    if (!next && this.planIndex < this.corePlan.length) next = this.corePlan[this.planIndex];
    if (!next) {
      // Core done: alternate defenses and power as funds allow.
      if (this.world.teams[this.team].lowPower) next = 'spire';
      else if (this.defenseIndex < this.defensePlan.length) next = this.defensePlan[this.defenseIndex];
      else if (this.myBuildings('spire').length < 5 && Math.random() < 0.3) next = 'spire';
      if (!next) return;
    }

    const stats = buildingStats(next, this.world.teams[this.team].faction);
    // Reserve funds for a harvester when the economy isn't running yet.
    const harvesters = this.world.units.filter(u => u.team === this.team && u.alive && u.def.harvester).length;
    const needEco = harvesters === 0 && this.myBuildings('foundry').some(b => b.complete);
    if (this.credits < stats.cost + (needEco ? 700 : 100)) return;

    // Defenses go toward the player; refineries toward crystal; core near base.
    let bias: [number, number] = [this.startTx, this.startTz];
    if (next === 'cannon' || next === 'lance' || next === 'wall') {
      const p = this.world.map.playerStart;
      const dx = p.tx - this.startTx, dz = p.tz - this.startTz;
      const d = Math.hypot(dx, dz);
      bias = [Math.round(this.startTx + (dx / d) * 9), Math.round(this.startTz + (dz / d) * 9)];
    } else if (next === 'refinery') {
      const node = this.world.nearestCrystal(...this.world.map.tileToWorld(this.startTx, this.startTz));
      if (node) bias = [Math.round((node.tx + this.startTx) / 2), Math.round((node.tz + this.startTz) / 2)];
    }
    const spot = this.findSpot(next, bias[0], bias[1]);
    if (!spot) return;
    const b = this.world.placeBuilding(this.team, next, spot[0], spot[1]);
    if (b) {
      b.group.userData.building = b;
      this.world.orderBuild(fab, b);
      if (this.planIndex < this.corePlan.length && next === this.corePlan[this.planIndex]) this.planIndex++;
      else if (this.defensePlan[this.defenseIndex] === next) this.defenseIndex++;
    }
  }

  private runEconomy() {
    const harvesters = this.world.units.filter(u => u.team === this.team && u.alive && u.def.harvester);
    const foundry = this.myBuildings('foundry').find(b => b.complete);
    const refinery = this.myBuildings('refinery').find(b => b.complete);
    if (foundry && refinery && harvesters.length < this.profile.harvesters) {
      if (!foundry.queue.some(q => q.defId === 'harvester')) this.world.enqueue(foundry, 'harvester');
    }
    // Idle harvesters get back to work.
    for (const h of harvesters) {
      if (h.order.kind === 'idle' && refinery) {
        const node = this.world.nearestCrystal(h.x, h.z);
        if (node) this.world.orderGather(h, node);
      }
    }
    // Replace a lost fabricator so the AI can keep building.
    if (!this.fabricator && foundry && !foundry.queue.some(q => q.defId === 'builder')) {
      this.world.enqueue(foundry, 'builder');
    }
  }

  private runProduction() {
    if (this.myArmy().length >= this.profile.maxArmy) return;
    // Economy first: don't burn the harvester budget on troops.
    const harvesters = this.world.units.filter(u => u.team === this.team && u.alive && u.def.harvester).length;
    if (harvesters === 0 && this.myBuildings('refinery').length > 0) return;
    const barracks = this.myBuildings('barracks').filter(b => b.complete);
    const foundries = this.myBuildings('foundry').filter(b => b.complete);
    // Role -> class id lookup from the data-driven templates.
    const byRole = (role: string) =>
      Object.values(UNIT_DEFS).find(d => d.role === role && !d.harvester && !d.builder)?.id ?? 'lancer';
    const pick = () => {
      let r = Math.random(), acc = 0;
      for (const [role, w] of this.armyMix) { acc += w; if (r <= acc) return byRole(role); }
      return 'lancer';
    };
    for (const prod of [...barracks, ...foundries]) {
      if (prod.queue.length >= 2) continue;
      let defId = pick();
      // Match the unit to the right production building.
      const wantInfantry = prod.def.id === 'barracks';
      for (let i = 0; i < 6; i++) {
        const def = unitStats(defId, this.world.teams[this.team].faction);
        if ((def.class === 'infantry') === wantInfantry && !def.harvester && !def.builder) break;
        defId = pick();
      }
      const def = unitStats(defId, this.world.teams[this.team].faction);
      if ((def.class === 'infantry') !== wantInfantry || def.harvester || def.builder) continue;
      if (this.credits > def.cost + 300) this.world.enqueue(prod, defId);
    }
  }

  private runDefense() {
    // If hostiles are near the base, rally idle defenders to meet them.
    const nexus = this.myBuildings('nexus')[0] ?? this.myBuildings()[0];
    if (!nexus) return;
    const threat = this.world.nearestEnemy(this.team, nexus.cx, nexus.cz, 20 * TILE);
    if (!threat) return;
    const tx = threat instanceof Object && 'cx' in threat ? (threat as Building).cx : (threat as Unit).x;
    const tz = 'cz' in threat ? (threat as Building).cz : (threat as Unit).z;
    for (const u of this.myArmy()) {
      if (u.order.kind === 'idle' && Math.hypot(u.x - nexus.cx, u.z - nexus.cz) < 30 * TILE) {
        this.world.orderMove(u, tx, tz, true);
      }
    }
  }

  private runWaves() {
    if (this.world.time < this.nextWaveAt) return;
    const army = this.myArmy().filter(u => u.order.kind === 'idle');
    // Aggressive doctrines strike with fewer ready units; defensive ones wait.
    const minReady = waveMinReady(this.doctrine.personality.attackAggression);
    if (army.length < Math.min(this.waveSize, minReady)) {
      this.nextWaveAt = this.world.time + 20; // not ready, check again soon
      return;
    }
    // Commit a doctrine-dependent share of the idle army (defensive = hold more back).
    const frac = sendFraction(this.doctrine.personality.defensePriority);
    const send = army.slice(0, Math.max(minReady, Math.floor(army.length * frac)));
    const target = this.world.buildings.find(b => b.team === 0 && b.def.id === 'nexus')
      ?? this.world.buildings.find(b => b.team === 0);
    const [px, pz] = target
      ? [target.cx, target.cz]
      : this.world.map.tileToWorld(this.world.map.playerStart.tx, this.world.map.playerStart.tz);
    for (const u of send) this.world.orderMove(u, px, pz, true);
    this.wavesSent++;
    this.waveSize = Math.ceil(this.waveSize * this.profile.waveGrowth);
    this.nextWaveAt = this.world.time + this.profile.waveInterval;
  }
}
