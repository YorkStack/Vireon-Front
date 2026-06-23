// Rare decorative tumbleweed — a render-only ambient prop that occasionally rolls
// across open low ground to sell the desert mood. Strictly cosmetic: it reads the
// map (level/flags/groundHeight) but NEVER mutates it, has no collision, no
// gameplay, no economy, no pathfinding effect. At most TUMBLEWEED_MAX are alive at
// once (usually 0–1); a long randomized cooldown keeps it sparse.
//
// Pure spawn/heading/step/despawn logic is split out and rng-injectable so the
// cadence and placement rules are unit-testable without a renderer.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GameMap, TILE, F_BUILDING } from '../map/map';

export const TUMBLEWEED_MAX = 2;            // hard cap on simultaneous tumbleweeds
const START_CLEAR_R = 8;                    // tiles around each base kept tumbleweed-free
const EDGE_BAND = 3;                        // spawn within this many tiles of a border
const RADIUS = 0.5;                         // world-unit radius of the tangle ball

/** Mutable per-tumbleweed state (world XZ position, unit heading, age). */
export interface WeedState {
  x: number; z: number;
  dirX: number; dirZ: number;   // unit heading on the XZ plane
  speed: number;                // world units / second
  age: number;
  life: number;                 // max lifetime (s)
  level: number;                // terrain level it spawned on (cliff-step detector)
  phase: number;                // wobble phase offset
}

/** A tile is "open low ground" if it's in bounds, at the lowest level, unflagged. */
export function isOpenLowGround(map: GameMap, tx: number, tz: number): boolean {
  if (!map.inBounds(tx, tz)) return false;
  const i = map.idx(tx, tz);
  return map.level[i] === 0 && map.flags[i] === 0;
}

function nearStart(map: GameMap, tx: number, tz: number, r: number): boolean {
  return Math.hypot(tx - map.playerStart.tx, tz - map.playerStart.tz) <= r
      || Math.hypot(tx - map.enemyStart.tx, tz - map.enemyStart.tz) <= r;
}

/**
 * Pick an open-low-ground tile in an edge band, outside both base clear radii.
 * Tries `attempts` random edge tiles; returns null (no throw) if none qualifies —
 * e.g. a degenerate/fully-flagged map. Pure given `rng`.
 */
export function pickSpawnTile(map: GameMap, rng: () => number, attempts = 40): [number, number] | null {
  const n = map.size;
  for (let a = 0; a < attempts; a++) {
    const side = (rng() * 4) | 0;                 // 0=top 1=bottom 2=left 3=right
    const band = (rng() * EDGE_BAND) | 0;
    const along = 1 + ((rng() * (n - 2)) | 0);
    let tx: number, tz: number;
    if (side === 0) { tx = along; tz = band; }
    else if (side === 1) { tx = along; tz = n - 1 - band; }
    else if (side === 2) { tx = band; tz = along; }
    else { tx = n - 1 - band; tz = along; }
    if (isOpenLowGround(map, tx, tz) && !nearStart(map, tx, tz, START_CLEAR_R)) return [tx, tz];
  }
  return null;
}

/**
 * Heading from a spawn tile roughly toward the map centre, with a random angular
 * spread so it crosses the open ground rather than hugging the edge. Unit vector.
 */
export function chooseHeading(map: GameMap, tx: number, tz: number, rng: () => number): [number, number] {
  const c = map.size / 2;
  let dx = c - tx, dz = c - tz;
  const len = Math.hypot(dx, dz) || 1;
  dx /= len; dz /= len;
  const spread = (rng() - 0.5) * 1.2;             // ±0.6 rad
  const cos = Math.cos(spread), sin = Math.sin(spread);
  return [dx * cos - dz * sin, dx * sin + dz * cos];
}

/** Random spawn delay (seconds) in [min,max]. */
export function nextSpawnDelay(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Advance a tumbleweed in place along its heading. Pure (mutates `w`). */
export function stepWeed(w: WeedState, dt: number): void {
  w.x += w.dirX * w.speed * dt;
  w.z += w.dirZ * w.speed * dt;
  w.age += dt;
}

/**
 * Should this tumbleweed retire? True when it has left the map, outlived its
 * lifetime, reached a building tile, or hit a cliff/height-step (level changed
 * from where it spawned). Pure / read-only on the map.
 */
export function shouldDespawn(map: GameMap, w: WeedState): boolean {
  if (w.age >= w.life) return true;
  const tx = Math.floor(w.x / TILE), tz = Math.floor(w.z / TILE);
  if (!map.inBounds(tx, tz)) return true;
  const i = map.idx(tx, tz);
  if (map.level[i] !== w.level) return true;        // cliff / height-step
  if (map.flags[i] & F_BUILDING) return true;       // rolled onto a building
  return false;
}

interface ActiveWeed { mesh: THREE.Mesh; w: WeedState; axis: THREE.Vector3; }

const UP = new THREE.Vector3(0, 1, 0);
const TMP_AXIS = new THREE.Vector3();

export interface TumbleweedOpts {
  rng?: () => number;
  spawnMin?: number;   // min seconds between spawn attempts
  spawnMax?: number;   // max seconds between spawn attempts
  maxActive?: number;
}

/**
 * Owns a tiny pool of reusable tangle meshes, a spawn cooldown, and the active
 * tumbleweeds. `update(dt)` rolls/wobbles the active ones and occasionally spawns
 * a new one; `dispose()` tears everything down. Render-only.
 */
export class TumbleweedSystem {
  private scene: THREE.Scene;
  private map: GameMap;
  private geo: THREE.BufferGeometry;
  private mat: THREE.MeshStandardMaterial;
  private pool: THREE.Mesh[] = [];        // freed meshes ready for reuse
  private active: ActiveWeed[] = [];
  private cooldown: number;
  private created = 0;                     // total meshes ever built (capped at maxActive)
  private rng: () => number;
  private spawnMin: number;
  private spawnMax: number;
  private maxActive: number;

  constructor(scene: THREE.Scene, map: GameMap, opts: TumbleweedOpts = {}) {
    this.scene = scene; this.map = map;
    this.rng = opts.rng ?? Math.random;
    this.spawnMin = opts.spawnMin ?? 25;
    this.spawnMax = opts.spawnMax ?? 60;
    this.maxActive = opts.maxActive ?? TUMBLEWEED_MAX;
    this.geo = makeTumbleweedGeo();
    this.mat = new THREE.MeshStandardMaterial({ color: '#8a6a3f', roughness: 0.95, metalness: 0 });
    this.cooldown = nextSpawnDelay(this.rng, this.spawnMin, this.spawnMax);
  }

  /** Number of tumbleweeds currently rolling (for tests/smoke). */
  get activeCount(): number { return this.active.length; }

  update(dt: number): void {
    // Roll + wobble active tumbleweeds, retire the finished ones.
    for (let k = this.active.length - 1; k >= 0; k--) {
      const a = this.active[k];
      stepWeed(a.w, dt);
      const angle = (a.w.speed / RADIUS) * dt;             // rolling ∝ ground speed
      a.mesh.rotateOnWorldAxis(a.axis, angle);
      const bob = Math.sin(a.w.age * 6 + a.w.phase) * 0.05; // subtle hop
      a.mesh.position.set(a.w.x, this.map.groundHeight(a.w.x, a.w.z) + RADIUS + bob, a.w.z);
      if (shouldDespawn(this.map, a.w)) this.retire(k);
    }
    // Cadence: occasional spawn attempt, hard-capped at maxActive.
    this.cooldown -= dt;
    if (this.cooldown <= 0) {
      this.cooldown = nextSpawnDelay(this.rng, this.spawnMin, this.spawnMax);
      if (this.rng() > 0.3) this.spawnNow(); // ~70% of windows actually spawn (skip chance)
    }
  }

  /** Force a spawn (used by tests + the smoke hook). No-op at the active cap or
   *  when no open-low-ground edge tile is available. Returns true if it spawned. */
  spawnNow(): boolean {
    if (this.active.length >= this.maxActive) return false;
    const tile = pickSpawnTile(this.map, this.rng);
    if (!tile) return false;
    const [tx, tz] = tile;
    const [wx, wz] = this.map.tileToWorld(tx, tz);
    const [dirX, dirZ] = chooseHeading(this.map, tx, tz, this.rng);
    const w: WeedState = {
      x: wx, z: wz, dirX, dirZ,
      speed: 1.8 + this.rng() * 0.8,                 // ~1.8–2.6 u/s (≈1 tile/s, slow)
      age: 0, life: 12 + this.rng() * 6,              // 12–18 s
      level: 0, phase: this.rng() * Math.PI * 2,
    };
    const mesh = this.takeMesh();
    if (!mesh) return false;
    TMP_AXIS.set(-dirZ, 0, dirX).normalize();          // roll axis ⟂ heading, on the ground plane
    mesh.position.set(wx, this.map.groundHeight(wx, wz) + RADIUS, wz);
    mesh.visible = true;
    this.scene.add(mesh);
    this.active.push({ mesh, w, axis: TMP_AXIS.clone() });
    return true;
  }

  private takeMesh(): THREE.Mesh | null {
    const pooled = this.pool.pop();
    if (pooled) return pooled;
    if (this.created < this.maxActive) {
      this.created++;
      return new THREE.Mesh(this.geo, this.mat);
    }
    return null; // pool exhausted at the cap (shouldn't happen given the active check)
  }

  private retire(index: number): void {
    const a = this.active[index];
    this.scene.remove(a.mesh);
    a.mesh.visible = false;
    this.pool.push(a.mesh);
    this.active.splice(index, 1);
  }

  dispose(): void {
    for (const a of this.active) this.scene.remove(a.mesh);
    this.active = [];
    this.pool = [];
    this.geo.dispose();
    this.mat.dispose();
  }
}

/** Shared low-poly "twig ball": a handful of thin tori at varied orientations
 *  merged into one tangled geometry. Built once, reused by every tumbleweed. */
function makeTumbleweedGeo(): THREE.BufferGeometry {
  const rings: THREE.BufferGeometry[] = [];
  const oris: [number, number, number][] = [
    [0, 0, 0], [1.1, 0.3, 0], [0.4, 1.2, 0.2], [0, 0.6, 1.3], [1.4, 1.4, 0.5], [0.8, 0, 1.1],
  ];
  for (const [rx, ry, rz] of oris) {
    const t = new THREE.TorusGeometry(RADIUS * (0.82 + 0.18), 0.035, 5, 9);
    t.rotateX(rx); t.rotateY(ry); t.rotateZ(rz);
    rings.push(t);
  }
  return mergeGeometries(rings)!;
}
