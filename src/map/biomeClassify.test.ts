// Slice B1: read-only biome classification. Deterministic, derived only from
// existing terrain signals (level / crystal proximity / moisture noise). It must
// never mutate the map and must be stable across re-constructed maps with the
// same seed.
import { describe, it, expect } from 'vitest';
import { GameMap } from './map';
import { classifyTileBiome, tileMoisture, type Biome } from './biomeClassify';

describe('tileMoisture', () => {
  it('is deterministic and in [0,1)', () => {
    for (const [x, z] of [[3, 4], [20, 31], [47, 0]]) {
      const m = tileMoisture(x, z);
      expect(m).toBeGreaterThanOrEqual(0);
      expect(m).toBeLessThan(1);
      expect(tileMoisture(x, z)).toBe(m); // pure
    }
  });
});

describe('classifyTileBiome', () => {
  it('classifies high ground (level ≥ 2) as highland', () => {
    const map = new GameMap(48, 12345);
    // Force a level-2 tile far from crystals/edges.
    const tx = 24, tz = 24;
    map.level[map.idx(tx, tz)] = 2;
    map.crystals = []; // remove crystal override for a clean level test
    expect(classifyTileBiome(map, tx, tz)).toBe('highland');
  });

  it('classifies dry low ground as desert and moist low ground as forest', () => {
    const map = new GameMap(48, 12345);
    map.crystals = [];
    // Find two level-0 tiles, one dry one moist, away from the crystal-less map.
    let dry: [number, number] | null = null, wet: [number, number] | null = null;
    for (let z = 4; z < 44 && (!dry || !wet); z++) {
      for (let x = 4; x < 44; x++) {
        map.level[map.idx(x, z)] = 0; // make it low ground for the test
        const m = tileMoisture(x, z);
        if (m < 0.45 && !dry) dry = [x, z];
        if (m >= 0.45 && !wet) wet = [x, z];
      }
    }
    expect(dry).not.toBeNull();
    expect(wet).not.toBeNull();
    expect(classifyTileBiome(map, dry![0], dry![1])).toBe('desert');
    expect(classifyTileBiome(map, wet![0], wet![1])).toBe('forest');
  });

  it('classifies tiles near a crystal node as crystal (overrides level)', () => {
    const map = new GameMap(48, 12345);
    expect(map.crystals.length).toBeGreaterThan(0);
    const c = map.crystals[0];
    expect(classifyTileBiome(map, c.tx, c.tz)).toBe('crystal');     // on the node
    expect(classifyTileBiome(map, c.tx + 1, c.tz)).toBe('crystal'); // within radius
  });

  it('returns a valid biome for out-of-bounds without throwing', () => {
    const map = new GameMap(48, 12345);
    const valid: Biome[] = ['desert', 'forest', 'highland', 'crystal'];
    expect(valid).toContain(classifyTileBiome(map, -1, -1));
    expect(valid).toContain(classifyTileBiome(map, 999, 999));
  });

  it('is deterministic across re-constructed maps with the same seed', () => {
    const a = new GameMap(48, 999);
    const b = new GameMap(48, 999);
    for (const [tx, tz] of [[10, 10], [20, 30], [33, 14], [5, 41]]) {
      expect(classifyTileBiome(a, tx, tz)).toBe(classifyTileBiome(b, tx, tz));
    }
  });

  it('never mutates the map', () => {
    const map = new GameMap(48, 4242);
    const flags0 = Uint8Array.from(map.flags);
    const level0 = Int8Array.from(map.level);
    for (let z = 0; z < map.size; z += 3)
      for (let x = 0; x < map.size; x += 3) classifyTileBiome(map, x, z);
    expect(map.flags).toEqual(flags0);
    expect(map.level).toEqual(level0);
  });
});
