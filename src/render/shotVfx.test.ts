import { describe, it, expect, afterEach } from 'vitest';
import * as THREE from 'three';
import {
  beamTextureFor, muzzleTextureFor, bulletTextureFor,
  makeGlowMaterial, makeBulletMaterial, __setShotTexForTest,
} from './shotVfx';

const KEYS = ['azure.water_beam', 'verdant.bio_wave', 'solar.chain_lightning', 'crimson.muzzle_flash', 'crimson.bullet_tracer'];
afterEach(() => { for (const k of KEYS) __setShotTexForTest(k, null); });

const fakeTex = () => new THREE.Texture();

describe('shotVfx faction texture mapping', () => {
  it('beam textures resolve for azure/verdant/solar, null for crimson (ballistic)', () => {
    __setShotTexForTest('azure.water_beam', fakeTex());
    __setShotTexForTest('verdant.bio_wave', fakeTex());
    __setShotTexForTest('solar.chain_lightning', fakeTex());
    expect(beamTextureFor('blue')).not.toBeNull();
    expect(beamTextureFor('green')).not.toBeNull();
    expect(beamTextureFor('yellow')).not.toBeNull();
    expect(beamTextureFor('red'), 'crimson has no beam').toBeNull();
  });

  it('crimson gets muzzle + bullet sprites; beam factions do not', () => {
    __setShotTexForTest('crimson.muzzle_flash', fakeTex());
    __setShotTexForTest('crimson.bullet_tracer', fakeTex());
    expect(muzzleTextureFor('red')).not.toBeNull();
    expect(bulletTextureFor('red')).not.toBeNull();
    expect(muzzleTextureFor('blue')).toBeNull();
    expect(bulletTextureFor('green')).toBeNull();
  });

  it('FALLBACK: every lookup returns null when no texture is loaded', () => {
    // nothing seeded this test
    expect(beamTextureFor('blue')).toBeNull();
    expect(muzzleTextureFor('red')).toBeNull();
    expect(bulletTextureFor('red')).toBeNull();
  });
});

describe('shotVfx material helpers', () => {
  it('glow material is additive, transparent, no depth-write, not tone-mapped', () => {
    const m = makeGlowMaterial(fakeTex());
    expect(m.transparent).toBe(true);
    expect(m.depthWrite).toBe(false);
    expect(m.blending).toBe(THREE.AdditiveBlending);
    expect(m.toneMapped).toBe(false);
    expect(m.map).not.toBeNull();
  });

  it('bullet material is normal-blended (a solid object, not a pure glow)', () => {
    const m = makeBulletMaterial(fakeTex());
    expect(m.transparent).toBe(true);
    expect(m.depthWrite).toBe(false);
    expect(m.blending).toBe(THREE.NormalBlending);
    expect(m.toneMapped).toBe(false);
  });
});
