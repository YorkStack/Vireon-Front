import { describe, it, expect } from 'vitest';
import { vegZoneOf } from './vegetationGlb';

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
  it('is case-insensitive', () => {
    expect(vegZoneOf('BARK_F')).toBe('woody');
    expect(vegZoneOf('Canopy_H')).toBe('foliage');
  });
});
