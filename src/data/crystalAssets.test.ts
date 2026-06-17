import { describe, it, expect } from 'vitest';
import {
  CRYSTAL_RESOURCE_META,
  CRYSTAL_VISUAL_ASSETS,
  UNMAPPED_CRYSTAL_ASSETS,
  getCrystalYieldMultiplier,
  isEventOnlyCrystal,
  crystalVisualAsset,
  crystalStageImagePath,
  type CrystalResourceType,
} from './crystalAssets';

describe('crystal resource metadata', () => {
  it('default yields ×1 (baseline income, no balance change)', () => {
    expect(getCrystalYieldMultiplier('default')).toBe(1);
    expect(CRYSTAL_RESOURCE_META.default.eventOnly).toBe(false);
  });

  it('blaze-of-the-sun yields ×2 and spawns by rule (not event-only)', () => {
    expect(getCrystalYieldMultiplier('blazeOfTheSun')).toBe(2);
    expect(isEventOnlyCrystal('blazeOfTheSun')).toBe(false);
  });

  it('plasma-filament is event-only', () => {
    expect(isEventOnlyCrystal('plasmaFilament')).toBe(true);
  });

  it('every resource type has consistent meta', () => {
    for (const t of Object.keys(CRYSTAL_RESOURCE_META) as CrystalResourceType[]) {
      expect(CRYSTAL_RESOURCE_META[t].resourceType).toBe(t);
      expect(typeof CRYSTAL_RESOURCE_META[t].yieldMultiplier).toBe('number');
    }
  });
});

describe('crystal visual asset registry', () => {
  it('asset keys are unique', () => {
    const keys = CRYSTAL_VISUAL_ASSETS.map(a => a.assetKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every imagePath ends in .png', () => {
    for (const a of CRYSTAL_VISUAL_ASSETS) {
      expect(a.imagePath.endsWith('.png')).toBe(true);
    }
  });

  it('every asset has a valid resource type', () => {
    const valid: CrystalResourceType[] = ['default', 'blazeOfTheSun', 'plasmaFilament'];
    for (const a of CRYSTAL_VISUAL_ASSETS) {
      expect(valid).toContain(a.resourceType);
    }
  });

  it("asset yieldMultiplier matches its type's meta", () => {
    for (const a of CRYSTAL_VISUAL_ASSETS) {
      expect(a.yieldMultiplier).toBe(getCrystalYieldMultiplier(a.resourceType));
    }
  });

  it('lookup returns exact match for blaze large', () => {
    const a = crystalVisualAsset('blazeOfTheSun', 'large');
    expect(a?.assetKey).toBe('blaze_large');
  });

  it('default large falls back gracefully (no large in source) and is reported', () => {
    // default ships no large asset...
    const reported = UNMAPPED_CRYSTAL_ASSETS.some(u => u.resourceType === 'default' && u.size === 'large');
    expect(reported).toBe(true);
    // ...but lookup still resolves to an existing default sprite, never null.
    const a = crystalVisualAsset('default', 'large');
    expect(a).not.toBeNull();
    expect(a?.resourceType).toBe('default');
  });
});

describe('crystalStageImagePath (depletion stage → sprite)', () => {
  const types: CrystalResourceType[] = ['default', 'blazeOfTheSun', 'plasmaFilament'];

  it('returns a distinct existing .png for each visible stage', () => {
    for (const t of types) {
      const paths = (['full', 'reduced', 'small'] as const).map(s => crystalStageImagePath(t, s));
      // all resolved, all .png, all distinct (a real 3-step shrink)
      expect(paths.every(p => typeof p === 'string' && p!.endsWith('.png'))).toBe(true);
      expect(new Set(paths).size).toBe(3);
      // every path corresponds to a real registry asset of that type
      for (const p of paths) {
        expect(CRYSTAL_VISUAL_ASSETS.some(a => a.imagePath === p && a.resourceType === t)).toBe(true);
      }
    }
  });

  it('depleted stage has no sprite (hidden, not drawn)', () => {
    for (const t of types) expect(crystalStageImagePath(t, 'depleted')).toBeNull();
  });

  it('default full uses the medium sprite (no large in source)', () => {
    expect(crystalStageImagePath('default', 'full')).toContain('/default/medium.png');
  });
});
