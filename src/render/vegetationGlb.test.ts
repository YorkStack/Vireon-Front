import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { vegZoneOf, enhanceVegMaterial } from './vegetationGlb';

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
