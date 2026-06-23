// Slice 2B: the pioneer clearVegetation order — headless sim behaviour.
// Covers gating, the work loop, the flat +30 reward, the no-double-pay guard,
// rejection of invalid targets, and the walkability/buildability invariants.
// NO visual removal exists yet (Slice 2C) — only the F_TREE flag is cleared.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { World } from './world';
import { Effects } from '../render/effects';
import { GameMap, F_TREE, TILE } from '../map/map';
import { FACTION_DEFS } from '../core/defs';

const cam = new THREE.PerspectiveCamera();

function makeWorld() {
  const map = new GameMap(48, 4242);
  const scene = new THREE.Scene();
  const factions = Object.values(FACTION_DEFS);
  const world = new World(map, scene, new Effects(scene), factions[0], factions[1], new Map());
  return { world, map };
}

/** First interior tile with no flags set (so adding F_TREE is the only blocker). */
function openTile(map: GameMap): [number, number] {
  for (let z = 6; z < map.size - 6; z++) {
    for (let x = 6; x < map.size - 6; x++) {
      if (map.flags[map.idx(x, z)] === 0 && map.isWalkable(x, z)) return [x, z];
    }
  }
  throw new Error('no open tile found');
}

function spawnAtTile(world: World, defId: string, tx: number, tz: number, map: GameMap) {
  const [wx, wz] = map.tileToWorld(tx, tz);
  return world.spawnUnit(0, defId, wx, wz);
}

/** Tick `seconds` of sim in small steps so the work timer advances naturally. */
function run(world: World, seconds: number, step = 0.2) {
  for (let t = 0; t < seconds; t += step) world.update(step, cam);
}

describe('pioneer clearVegetation order (Slice 2B — headless sim)', () => {
  it('rejects the order for a non-pioneer unit', () => {
    const { world, map } = makeWorld();
    const [tx, tz] = openTile(map);
    map.flags[map.idx(tx, tz)] |= F_TREE;
    const harv = spawnAtTile(world, 'harvester', tx, tz, map);
    expect(world.orderClearVegetation(harv, tx, tz)).toBe(false);
    expect(harv.order.kind).toBe('idle');
  });

  it('accepts the order for a pioneer on an F_TREE tile', () => {
    const { world, map } = makeWorld();
    const [tx, tz] = openTile(map);
    map.flags[map.idx(tx, tz)] |= F_TREE;
    const pio = spawnAtTile(world, 'pioneer', tx, tz, map);
    expect(world.orderClearVegetation(pio, tx, tz)).toBe(true);
    expect(pio.order.kind).toBe('clearVegetation');
  });

  it('rejects a tile that has no F_TREE, and an out-of-bounds tile', () => {
    const { world, map } = makeWorld();
    const [tx, tz] = openTile(map);
    const pio = spawnAtTile(world, 'pioneer', tx, tz, map);
    // No F_TREE on this tile.
    expect(world.orderClearVegetation(pio, tx, tz)).toBe(false);
    // Out of bounds.
    expect(world.orderClearVegetation(pio, -1, -1)).toBe(false);
    expect(world.orderClearVegetation(pio, map.size + 5, tz)).toBe(false);
    expect(pio.order.kind).toBe('idle');
  });

  it('clears F_TREE and grants exactly +30 credits on completion', () => {
    const { world, map } = makeWorld();
    const [tx, tz] = openTile(map);
    const idx = map.idx(tx, tz);
    map.flags[idx] |= F_TREE;
    const pio = spawnAtTile(world, 'pioneer', tx, tz, map);
    world.orderClearVegetation(pio, tx, tz);
    expect(world.teams[0].credits).toBe(0);
    run(world, 4); // clearTime is 3s
    expect(map.flags[idx] & F_TREE).toBe(0); // F_TREE removed
    expect(world.teams[0].credits).toBe(30); // flat reward, no multipliers
    expect(pio.order.kind).toBe('idle'); // unit freed
  });

  it('does not pay twice if the tile was already cleared mid-work', () => {
    const { world, map } = makeWorld();
    const [tx, tz] = openTile(map);
    const idx = map.idx(tx, tz);
    map.flags[idx] |= F_TREE;
    const pio = spawnAtTile(world, 'pioneer', tx, tz, map);
    world.orderClearVegetation(pio, tx, tz);
    run(world, 1); // partial work, not yet complete
    expect(world.teams[0].credits).toBe(0);
    // Another actor clears the tile first (simulate a second pioneer finishing).
    map.flags[idx] &= ~F_TREE;
    run(world, 4); // let the order run to where it would have completed
    expect(world.teams[0].credits).toBe(0); // no duplicate reward
    expect(pio.order.kind).toBe('idle'); // order ended safely
  });

  it('keeps a tree tile walkable, and makes it buildable once cleared', () => {
    const { world, map } = makeWorld();
    const [tx, tz] = openTile(map);
    const idx = map.idx(tx, tz);
    map.flags[idx] |= F_TREE;
    // Units can still drive through a tree tile (F_TREE excluded from walk mask).
    expect(map.isWalkable(tx, tz)).toBe(true);
    const pio = spawnAtTile(world, 'pioneer', tx, tz, map);
    world.orderClearVegetation(pio, tx, tz);
    run(world, 4);
    // Cleared tile carries no flags -> buildable (canPlace rejects only flags !== 0)...
    expect(map.flags[idx]).toBe(0);
    // ...and is still walkable.
    expect(map.isWalkable(tx, tz)).toBe(true);
  });

  it('exposes the tuned clear range and time on the resolved pioneer def', () => {
    const { world, map } = makeWorld();
    const [tx, tz] = openTile(map);
    const pio = spawnAtTile(world, 'pioneer', tx, tz, map);
    expect(pio.def.clears).toBe(true);
    expect(pio.def.clearRange).toBe(1.5); // tiles -> 3.0 world units (TILE=2)
    expect(pio.def.clearTime).toBe(3);
    expect(TILE).toBe(2);
  });
});
