import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { vegZoneOf, enhanceVegMaterial, vegAssetBlocks, blockedVegetationTiles, pickAssetForBiome, VEG_V31_ASSETS } from './vegetationGlb';
import { GameMap, F_TREE } from '../map/map';
import type { Biome } from '../map/biomeClassify';

// Guards the name-based vegetation material classification against the real
// v3.1 GLB material names (see VEG_V31_ASSETS).
describe('vegZoneOf — vegetation material zone classification', () => {
  it('classifies woody bark/trunk/stalk/stem materials', () => {
    for (const n of ['bark_f', 'bark_h', 'trunk_c', 'stem_gs', 'stalk_hs']) {
      expect(vegZoneOf(n), n).toBe('woody');
    }
  });
  it('classifies leafy canopy/leaf/fan/frond materials', () => {
    for (const n of ['canopy_f', 'canopy_h', 'leaf_lf', 'fan_c', 'palm_frond']) {
      expect(vegZoneOf(n), n).toBe('foliage');
    }
  });
  it('classifies the palm trunk as woody', () => {
    expect(vegZoneOf('palm_trunk')).toBe('woody');
  });
  it('classifies authored desert cactus bodies', () => {
    expect(vegZoneOf('cactus_body')).toBe('cactus');
  });
  it('leaves cactus spine/flower accents unclassified (authored colour preserved)', () => {
    expect(vegZoneOf('cactus_spine')).toBeNull();
    expect(vegZoneOf('cactus_flower')).toBeNull();
  });
  it('classifies fungal cap/under materials', () => {
    for (const n of ['cap_hs', 'cap_gs', 'under_hs']) {
      expect(vegZoneOf(n), n).toBe('cap');
    }
  });
  it('classifies tree pod/fruit nodes separately (toned-down highlights)', () => {
    expect(vegZoneOf('pod_f')).toBe('node');
  });
  it('classifies the cactus body material', () => {
    expect(vegZoneOf('body_dc')).toBe('cactus');
  });
  it('leaves stylised accents/glow/crystal unclassified (preserved)', () => {
    for (const n of ['glow_h', 'glow_gs', 'glow_dc', 'polyp_c', 'xtal_dc', 'vein_lf', '']) {
      expect(vegZoneOf(n), n).toBeNull();
    }
  });
  it('classifies conifer materials (bark_pine woody, needle_pine needles)', () => {
    expect(vegZoneOf('bark_pine')).toBe('woody');
    expect(vegZoneOf('needle_pine')).toBe('needles');
    // 'needles' is its own conifer-foliage zone, distinct from generic 'foliage'.
    expect(vegZoneOf('needle_pine')).not.toBe('foliage');
  });
  it('is case-insensitive', () => {
    expect(vegZoneOf('BARK_F')).toBe('woody');
    expect(vegZoneOf('Canopy_H')).toBe('foliage');
    expect(vegZoneOf('Needle_Pine')).toBe('needles');
  });
});

// Conifer needle materials must KEEP their per-variant authored green — the normal
// foliage path replaces the colour, which would flatten the four conifers into one.
describe('enhanceVegMaterial — conifer needle colour preservation', () => {
  it('preserves the authored needle_pine green (no unified foliage tint)', () => {
    const m = new THREE.MeshStandardMaterial({ name: 'needle_pine', color: 0x335e3c });
    enhanceVegMaterial(m, 'forest_conifer_tall');
    expect(m.color.getHex()).toBe(0x335e3c);   // unchanged
    expect(m.userData.vegTinted).toBe(true);    // still processed (detail shader attached)
    expect(typeof m.onBeforeCompile).toBe('function');
  });
  it('keeps two different conifer greens distinct after enhancement', () => {
    const a = new THREE.MeshStandardMaterial({ name: 'needle_pine', color: 0x58854a });
    const b = new THREE.MeshStandardMaterial({ name: 'needle_pine', color: 0x2d542f });
    enhanceVegMaterial(a, 'forest_conifer_small');
    enhanceVegMaterial(b, 'forest_conifer_broad');
    expect(a.color.getHex()).toBe(0x58854a);
    expect(b.color.getHex()).toBe(0x2d542f);
    expect(a.color.getHex()).not.toBe(b.color.getHex());
  });
  it('still replaces normal foliage colour (unchanged behaviour for non-conifers)', () => {
    const m = new THREE.MeshStandardMaterial({ name: 'canopy_f', color: 0xffffff });
    enhanceVegMaterial(m, 'forest_canopy_tree');
    expect(m.color.getHex()).toBe(0x7ab85f);
  });
  it('tints the pine trunk as woody brown', () => {
    const m = new THREE.MeshStandardMaterial({ name: 'bark_pine', color: 0x5f422a });
    enhanceVegMaterial(m, 'forest_conifer_medium');
    expect(m.color.getHex()).toBe(0x6b4a2c);   // standard woody brown
  });
});

// Large vegetation flags its gameplay tile F_TREE → unbuildable, but still walkable.
describe('vegetation build-blocking (F_TREE)', () => {
  it('classifies large plants as build-blocking, small ground cover as not', () => {
    for (const id of ['forest_canopy_tree', 'highland_canopy_tree', 'coastal_coral_tree',
      'desert_palm', 'desert_saguaro', 'desert_crystal_cactus',
      'forest_conifer_small', 'forest_conifer_tall', 'forest_conifer_broad']) {
      expect(vegAssetBlocks(id), id).toBe(true);
    }
    for (const id of ['forest_hiveshroom', 'oasis_glowshroom', 'highland_luminous_fern',
      'desert_barrel', 'desert_opuntia']) {
      expect(vegAssetBlocks(id), id).toBe(false);
    }
  });

  it('flags only tiles outside the start-clear radius, and leaves them walkable', () => {
    const map = new GameMap(48, 12345);
    const tiles = blockedVegetationTiles(map, 285);
    expect(tiles.length).toBeGreaterThan(0);
    const R = 7; // START_CLEAR_R
    for (const t of tiles) {
      const tx = t % map.size, tz = Math.floor(t / map.size);
      const dP = Math.hypot(tx - map.playerStart.tx, tz - map.playerStart.tz);
      const dE = Math.hypot(tx - map.enemyStart.tx, tz - map.enemyStart.tz);
      expect(dP, `tile ${tx},${tz} too close to player start`).toBeGreaterThan(R);
      expect(dE, `tile ${tx},${tz} too close to enemy start`).toBeGreaterThan(R);
    }
    // Flagging a tree tile keeps it WALKABLE (units drive through; only building blocked).
    const t0 = tiles[0]; const tx0 = t0 % map.size, tz0 = Math.floor(t0 / map.size);
    map.flags[t0] |= F_TREE;
    expect(map.isWalkable(tx0, tz0)).toBe(true);
  });

  it('is deterministic for a given (map seed, count)', () => {
    const a = blockedVegetationTiles(new GameMap(48, 999), 285);
    const b = blockedVegetationTiles(new GameMap(48, 999), 285);
    expect(a).toEqual(b);
  });
});

// Slice B2: biome-aware asset weighting. Each biome draws only from its own pool
// of EXISTING asset ids; the blocking set and total scatter count are unchanged.
describe('pickAssetForBiome — biome-weighted scatter', () => {
  const VALID_IDS = new Set(VEG_V31_ASSETS.map((a) => a.id));
  const BIOMES: Biome[] = ['desert', 'forest', 'highland', 'crystal'];

  it('only ever returns real, registered asset ids per biome', () => {
    for (const biome of BIOMES) {
      for (let k = 0; k < 200; k++) {
        const id = pickAssetForBiome(biome, k / 200);
        expect(VALID_IDS.has(id), `${biome} -> ${id}`).toBe(true);
      }
    }
  });

  it('routes biome-defining assets to the right biome (conifers→highland, cacti→desert)', () => {
    const sample = (biome: Biome) => new Set(
      Array.from({ length: 200 }, (_, k) => pickAssetForBiome(biome, k / 200)),
    );
    const highland = sample('highland');
    const desert = sample('desert');
    // Conifers appear in highland, never in desert.
    expect([...highland].some((id) => /conifer/.test(id))).toBe(true);
    expect([...desert].some((id) => /conifer/.test(id))).toBe(false);
    // Desert cacti/palm appear in desert, the big forest canopy never does.
    expect([...desert].some((id) => /saguaro|opuntia|barrel|_palm/.test(id))).toBe(true);
    expect(desert.has('forest_canopy_tree')).toBe(false);
  });

  it('is deterministic in r and falls back to a valid id for an unknown biome', () => {
    expect(pickAssetForBiome('forest', 0.3)).toBe(pickAssetForBiome('forest', 0.3));
    // Defensive global fallback path still yields a registered asset.
    const fallback = pickAssetForBiome('nope' as unknown as Biome, 0.5);
    expect(VALID_IDS.has(fallback)).toBe(true);
  });

  it('keeps F_TREE flagging deterministic and non-empty with biome-aware scatter', () => {
    const a = blockedVegetationTiles(new GameMap(48, 12345), 285);
    const b = blockedVegetationTiles(new GameMap(48, 12345), 285);
    expect(a).toEqual(b);              // still deterministic
    expect(a.length).toBeGreaterThan(0); // trees still block building somewhere
  });
});
