import { describe, it, expect } from 'vitest';
import { crystalClusterLayout } from './crystalCluster';
import { crystalClusterImagePath } from '../data/crystalAssets';

describe('crystalClusterLayout', () => {
  it('builds a multi-crystal cluster (more than one piece)', () => {
    const pieces = crystalClusterLayout(42);
    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.length).toBeGreaterThanOrEqual(6);
    expect(pieces.length).toBeLessThanOrEqual(9);
  });

  it('contains all three size classes (small + medium + large)', () => {
    const sizes = new Set(crystalClusterLayout(7).map((p) => p.size));
    expect(sizes.has('small')).toBe(true);
    expect(sizes.has('medium')).toBe(true);
    expect(sizes.has('large')).toBe(true);
  });

  it('has exactly one large centre, then mediums and smalls', () => {
    const p = crystalClusterLayout(123);
    const large = p.filter((x) => x.size === 'large');
    const medium = p.filter((x) => x.size === 'medium');
    const small = p.filter((x) => x.size === 'small');
    expect(large.length).toBe(1);
    expect(medium.length).toBeGreaterThanOrEqual(2);
    expect(small.length).toBeGreaterThanOrEqual(3);
    // large is biggest, smalls are smallest
    expect(large[0].scale).toBeGreaterThan(medium[0].scale);
    expect(medium[0].scale).toBeGreaterThan(small[0].scale);
  });

  it('is deterministic — same seed yields an identical layout', () => {
    expect(crystalClusterLayout(99)).toEqual(crystalClusterLayout(99));
  });

  it('varies between seeds (not stamped)', () => {
    const a = JSON.stringify(crystalClusterLayout(1));
    const b = JSON.stringify(crystalClusterLayout(2));
    expect(a).not.toBe(b);
  });
});

describe('crystalClusterImagePath', () => {
  it('resolves a distinct .png for each default size class', () => {
    const s = crystalClusterImagePath('default', 'small');
    const m = crystalClusterImagePath('default', 'medium');
    const l = crystalClusterImagePath('default', 'large');
    for (const p of [s, m, l]) expect(p).toMatch(/\.png$/);
    expect(new Set([s, m, l]).size).toBe(3); // three different assets
  });
});
