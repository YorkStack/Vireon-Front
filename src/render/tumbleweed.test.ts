// Rare decorative tumbleweed — render-only. Tests the pure spawn/heading/step/
// despawn rules (rng-injectable) and the system lifecycle (spawn → roll → retire
// → dispose, pool reuse, hard cap). Critically: the system must NEVER mutate the
// map — it only reads level/flags/groundHeight.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { GameMap, TILE, F_BUILDING } from '../map/map';
import {
  TumbleweedSystem, TUMBLEWEED_MAX,
  pickSpawnTile, chooseHeading, nextSpawnDelay, stepWeed, shouldDespawn, isOpenLowGround,
  type WeedState,
} from './tumbleweed';

/** Deterministic LCG so spawn placement/cadence is reproducible in tests. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
}

function weed(over: Partial<WeedState> = {}): WeedState {
  return { x: 10, z: 10, dirX: 1, dirZ: 0, speed: 2, age: 0, life: 15, level: 0, phase: 0, ...over };
}

describe('pickSpawnTile (open-low-ground heuristic)', () => {
  it('returns an in-bounds level-0, flags-0 tile outside the start radius', () => {
    const map = new GameMap(48, 4242);
    const t = pickSpawnTile(map, lcg(7));
    expect(t).not.toBeNull();
    const [tx, tz] = t!;
    expect(map.inBounds(tx, tz)).toBe(true);
    expect(map.level[map.idx(tx, tz)]).toBe(0);
    expect(map.flags[map.idx(tx, tz)]).toBe(0);
    expect(isOpenLowGround(map, tx, tz)).toBe(true);
    const R = 8;
    expect(Math.hypot(tx - map.playerStart.tx, tz - map.playerStart.tz)).toBeGreaterThan(R);
    expect(Math.hypot(tx - map.enemyStart.tx, tz - map.enemyStart.tz)).toBeGreaterThan(R);
  });

  it('returns null (no throw) on a degenerate fully-blocked map', () => {
    const map = new GameMap(48, 1);
    map.level.fill(2); // nothing at level 0 anywhere → no open low ground
    expect(pickSpawnTile(map, lcg(3))).toBeNull();
  });
});

describe('chooseHeading / nextSpawnDelay', () => {
  it('produces a unit-length heading', () => {
    const map = new GameMap(48, 9);
    const [dx, dz] = chooseHeading(map, 2, 2, lcg(5));
    expect(Math.hypot(dx, dz)).toBeCloseTo(1, 5);
  });
  it('returns a delay within [min,max]', () => {
    const d = nextSpawnDelay(lcg(2), 25, 60);
    expect(d).toBeGreaterThanOrEqual(25);
    expect(d).toBeLessThanOrEqual(60);
  });
});

describe('stepWeed / shouldDespawn', () => {
  it('advances along the heading and ages', () => {
    const w = weed({ x: 10, z: 10, dirX: 1, dirZ: 0, speed: 2 });
    stepWeed(w, 0.5);
    expect(w.x).toBeCloseTo(11);   // 2 u/s * 0.5 s
    expect(w.z).toBeCloseTo(10);
    expect(w.age).toBeCloseTo(0.5);
  });
  it('despawns after its lifetime', () => {
    const map = new GameMap(48, 9);
    expect(shouldDespawn(map, weed({ age: 16, life: 15 }))).toBe(true);
  });
  it('despawns off-map', () => {
    const map = new GameMap(48, 9);
    expect(shouldDespawn(map, weed({ x: -5, z: -5 }))).toBe(true);
  });
  it('despawns on a building tile', () => {
    const map = new GameMap(48, 9);
    const tx = 20, tz = 20; map.level[map.idx(tx, tz)] = 0; map.flags[map.idx(tx, tz)] = F_BUILDING;
    expect(shouldDespawn(map, weed({ x: (tx + 0.5) * TILE, z: (tz + 0.5) * TILE, level: 0 }))).toBe(true);
  });
  it('despawns at a cliff / height-step (level changed from spawn level)', () => {
    const map = new GameMap(48, 9);
    const tx = 21, tz = 21; map.level[map.idx(tx, tz)] = 1; map.flags[map.idx(tx, tz)] = 0;
    expect(shouldDespawn(map, weed({ x: (tx + 0.5) * TILE, z: (tz + 0.5) * TILE, level: 0 }))).toBe(true);
  });
});

describe('TumbleweedSystem lifecycle', () => {
  it('spawns into the scene, never exceeds the cap, and retires off-map', () => {
    const map = new GameMap(48, 4242);
    const scene = new THREE.Scene();
    const sys = new TumbleweedSystem(scene, map, { rng: lcg(11), spawnMin: 0.01, spawnMax: 0.02 });
    // Drive many short frames → spawns occur, but never more than the cap at once.
    let maxSeen = 0;
    for (let i = 0; i < 400; i++) {
      sys.update(0.1);
      maxSeen = Math.max(maxSeen, sys.activeCount);
      expect(sys.activeCount).toBeLessThanOrEqual(TUMBLEWEED_MAX);
    }
    expect(maxSeen).toBeGreaterThan(0);                 // at least one rolled
    const meshGroups = scene.children.filter(c => c.type === 'Mesh').length;
    expect(meshGroups).toBeLessThanOrEqual(TUMBLEWEED_MAX); // pool never grows past the cap
  });

  it('forced spawn places a mesh and dispose tears everything down', () => {
    const map = new GameMap(48, 4242);
    const scene = new THREE.Scene();
    const sys = new TumbleweedSystem(scene, map, { rng: lcg(1) });
    expect(sys.spawnNow()).toBe(true);
    expect(sys.activeCount).toBe(1);
    expect(scene.children.filter(c => c.type === 'Mesh').length).toBe(1);
    sys.dispose();
    expect(scene.children.filter(c => c.type === 'Mesh').length).toBe(0);
    expect(sys.activeCount).toBe(0);
  });

  it('never mutates the map (flags + level snapshots unchanged)', () => {
    const map = new GameMap(48, 4242);
    const flags0 = Uint8Array.from(map.flags);
    const level0 = Int8Array.from(map.level);
    const sys = new TumbleweedSystem(new THREE.Scene(), map, { rng: lcg(99), spawnMin: 0.01, spawnMax: 0.02 });
    for (let i = 0; i < 300; i++) sys.update(0.1);
    sys.dispose();
    expect(map.flags).toEqual(flags0);
    expect(map.level).toEqual(level0);
  });

  it('reuses pooled meshes across repeated spawn/despawn cycles (no unbounded growth)', () => {
    const map = new GameMap(48, 4242);
    const scene = new THREE.Scene();
    const sys = new TumbleweedSystem(scene, map, { rng: lcg(5), spawnMin: 0.01, spawnMax: 0.02 });
    for (let i = 0; i < 2000; i++) sys.update(0.1); // many spawn+despawn cycles
    // Total meshes ever attached can never exceed the cap thanks to pooling.
    expect(scene.children.filter(c => c.type === 'Mesh').length).toBeLessThanOrEqual(TUMBLEWEED_MAX);
  });
});
