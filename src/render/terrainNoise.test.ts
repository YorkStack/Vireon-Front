import { describe, it, expect } from 'vitest';
import { hash2, vnoise, warpXZ, WARP_AMP } from './terrainNoise';

describe('terrainNoise', () => {
  it('hash2 is deterministic and in [0,1)', () => {
    expect(hash2(3, 7)).toBe(hash2(3, 7));
    for (const [x, z] of [[0, 0], [3, 7], [-12.4, 88.1], [1000, -1000]]) {
      const h = hash2(x, z);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
    }
    // Different inputs generally differ.
    expect(hash2(3, 7)).not.toBe(hash2(7, 3));
  });

  it('vnoise stays in [0,1) and is deterministic', () => {
    expect(vnoise(2.5, 4.5)).toBe(vnoise(2.5, 4.5));
    for (let i = 0; i < 50; i++) {
      const v = vnoise(i * 1.37, i * 0.53);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('warpXZ is deterministic and bounded by the warp amplitude', () => {
    expect(warpXZ(10, 20)).toEqual(warpXZ(10, 20));
    // Max displacement: (0.5 + 0.5*0.45) per axis * WARP_AMP*2.
    const maxDisp = (0.5 + 0.5 * 0.45) * WARP_AMP * 2 + 1e-6;
    for (let i = 0; i < 100; i++) {
      const x = i * 2.1, z = i * -1.7;
      const [wx, wz] = warpXZ(x, z);
      expect(Math.abs(wx - x)).toBeLessThanOrEqual(maxDisp);
      expect(Math.abs(wz - z)).toBeLessThanOrEqual(maxDisp);
    }
  });
});
