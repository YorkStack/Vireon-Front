// Slice 2D: warp-tolerant targeting for the pioneer Clear-Vegetation command.
// findClearTargetTile maps a clicked world point to the logical F_TREE tile the
// player meant — exact tile, or (fuzzy) the nearest tree in the 3×3 ring. This
// guards "click a tree → clears" and "click non-tree → no order" at the UI layer;
// the order/reward/range/time mechanics are the sim's (Slice 2B) and unchanged.
import { describe, it, expect } from 'vitest';
import { findClearTargetTile } from './clearTarget';
import { GameMap, F_TREE, TILE } from '../map/map';
import { UNIT_CLASS_TEMPLATES } from '../data/unitClasses';

function openTile(map: GameMap): [number, number] {
  for (let z = 6; z < map.size - 6; z++)
    for (let x = 6; x < map.size - 6; x++)
      if (map.flags[map.idx(x, z)] === 0) return [x, z];
  throw new Error('no open tile');
}

describe('findClearTargetTile', () => {
  it('returns the exact tile when the click lands on an F_TREE tile', () => {
    const map = new GameMap(48, 7);
    const [tx, tz] = openTile(map);
    map.flags[map.idx(tx, tz)] |= F_TREE;
    const [wx, wz] = map.tileToWorld(tx, tz);
    expect(findClearTargetTile(map, wx, wz, false)).toEqual([tx, tz]);
    expect(findClearTargetTile(map, wx, wz, true)).toEqual([tx, tz]);
  });

  it('returns null for a non-tree tile (no order is issued)', () => {
    const map = new GameMap(48, 7);
    const [tx, tz] = openTile(map);
    const [wx, wz] = map.tileToWorld(tx, tz); // no F_TREE here
    expect(findClearTargetTile(map, wx, wz, false)).toBeNull();
    expect(findClearTargetTile(map, wx, wz, true)).toBeNull();
  });

  it('fuzzy mode finds a tree on a neighbour tile (absorbs the ≈⅓-tile warp)', () => {
    const map = new GameMap(48, 7);
    const [tx, tz] = openTile(map);
    // Flag the right neighbour as the tree; click slightly toward it but still in
    // the centre tile -> exact misses, fuzzy snaps to the neighbour.
    map.flags[map.idx(tx + 1, tz)] |= F_TREE;
    const [cx, cz] = map.tileToWorld(tx, tz);
    const clickX = cx + TILE * 0.4; // nudged toward the neighbour, inside centre tile
    expect(findClearTargetTile(map, clickX, cz, false)).toBeNull();
    expect(findClearTargetTile(map, clickX, cz, true)).toEqual([tx + 1, tz]);
  });

  it('returns null when no tree is within the 3×3 ring', () => {
    const map = new GameMap(48, 7);
    const [tx, tz] = openTile(map);
    map.flags[map.idx(tx + 3, tz + 3)] |= F_TREE; // far away
    const [wx, wz] = map.tileToWorld(tx, tz);
    expect(findClearTargetTile(map, wx, wz, true)).toBeNull();
  });
});

describe('command does not change pioneer sim constants', () => {
  it('clear range stays 1.5 tiles and clear time stays 3s', () => {
    const cv = UNIT_CLASS_TEMPLATES.pioneer.clearVegetation;
    expect(cv).toEqual({ clearRange: 1.5, clearTime: 3 });
  });
});
