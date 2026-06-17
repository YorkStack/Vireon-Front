import { describe, it, expect } from 'vitest';
import {
  CRYSTAL_RESOURCE_META,
  CRYSTAL_VISUAL_ASSETS,
  UNMAPPED_CRYSTAL_ASSETS,
  getCrystalYieldMultiplier,
  isEventOnlyCrystal,
  crystalVisualAsset,
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
