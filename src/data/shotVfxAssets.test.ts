import { describe, it, expect } from 'vitest';
import {
  SHOT_VFX_ASSETS,
  UNMAPPED_SHOT_ASSETS,
  MISSING_SHOT_ASSETS,
  shotVfxFor,
  beamVfxFor,
  VFX_FACTION_DIR,
  type ShotVfxAsset,
} from './shotVfxAssets';
import type { FactionId } from './factionModifiers';

const FACTIONS: FactionId[] = ['red', 'blue', 'green', 'yellow'];

describe('shot VFX registry — integrity', () => {
  it('asset keys are unique', () => {
    const keys = SHOT_VFX_ASSETS.map((a) => a.assetKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every imagePath ends in .png and sits under the faction folder', () => {
    for (const a of SHOT_VFX_ASSETS) {
      expect(a.imagePath.endsWith('.png')).toBe(true);
      expect(a.imagePath).toContain(`/${VFX_FACTION_DIR[a.factionId]}/`);
    }
  });

  it('every faction id is valid', () => {
    for (const a of SHOT_VFX_ASSETS) expect(FACTIONS).toContain(a.factionId);
  });

  it('every asset is transparent and alpha-verified (the checkerboard trap was fixed)', () => {
    for (const a of SHOT_VFX_ASSETS) {
      expect(a.transparent, a.assetKey).toBe(true);
      expect(a.alphaVerified, a.assetKey).toBe(true);
    }
  });

  it('records sensible pixel dimensions', () => {
    for (const a of SHOT_VFX_ASSETS) {
      expect(a.widthPx).toBeGreaterThan(0);
      expect(a.heightPx).toBeGreaterThan(0);
    }
  });
});

describe('shot VFX registry — per-faction coverage', () => {
  it('crimson is ballistic: has a projectile and a muzzle flash, no beam', () => {
    const c = shotVfxFor('red');
    expect(c.some((a) => a.kind === 'projectile')).toBe(true);
    expect(c.some((a) => a.kind === 'muzzleFlash')).toBe(true);
    expect(c.every((a) => a.style === 'ballistic')).toBe(true);
    expect(beamVfxFor('red')).toBeNull();
  });

  it('azure / verdant / solar each have a continuous beam sprite', () => {
    for (const f of ['blue', 'green', 'yellow'] as FactionId[]) {
      const beam = beamVfxFor(f);
      expect(beam, `beam for ${f}`).not.toBeNull();
      expect(beam!.kind).toBe('beamFull');
    }
  });

  it('beam styles match their faction', () => {
    expect(beamVfxFor('blue')!.style).toBe('waterBeam');
    expect(beamVfxFor('green')!.style).toBe('bioWave');
    expect(beamVfxFor('yellow')!.style).toBe('chainLightning');
  });

  it('beams are flagged NOT tileable (directional full renders, not seamless tiles)', () => {
    for (const a of SHOT_VFX_ASSETS.filter((x) => x.kind === 'beamFull')) {
      expect(a.tileable, a.assetKey).toBe(false);
    }
  });

  it('all glow sprites use additive blending', () => {
    for (const a of SHOT_VFX_ASSETS) expect(a.additiveBlending, a.assetKey).toBe(true);
  });
});

describe('shot VFX registry — gaps are documented, not silent', () => {
  it('UNMAPPED is empty (all four montages were keyed + split)', () => {
    expect(UNMAPPED_SHOT_ASSETS.length).toBe(0);
  });

  it('MISSING records the absent impact sprites for Phase 2', () => {
    expect(MISSING_SHOT_ASSETS.length).toBeGreaterThan(0);
    for (const m of MISSING_SHOT_ASSETS) expect(FACTIONS).toContain(m.factionId);
  });

  it('the registry carries no gameplay numbers (pure presentation metadata)', () => {
    const allowed = new Set([
      'assetKey', 'factionId', 'style', 'kind', 'imagePath', 'tileable',
      'additiveBlending', 'transparent', 'alphaVerified', 'widthPx', 'heightPx', 'notes',
    ]);
    for (const a of SHOT_VFX_ASSETS) {
      for (const k of Object.keys(a as unknown as Record<string, unknown>)) expect(allowed.has(k), k).toBe(true);
    }
    // no damage/range/cooldown/speed keys leaked in
    const forbidden = ['damage', 'range', 'cooldown', 'speed', 'fireRate'];
    for (const a of SHOT_VFX_ASSETS as unknown as ReadonlyArray<Record<string, unknown>>) {
      for (const f of forbidden) expect(f in a).toBe(false);
    }
  });
});
