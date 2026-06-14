import { describe, it, expect } from 'vitest';
import { billboardYaw, triplanarWeights, scatterVegInstances } from './props';
import { GameMap } from '../map/map';

describe('billboardYaw', () => {
  it('faces +Z when the camera is on +Z, +X when on +X', () => {
    // Camera straight ahead in +Z -> yaw 0 (quad's +Z normal already points at it).
    expect(billboardYaw(0, 10, 0, 0)).toBeCloseTo(0, 6);
    // Camera on +X -> yaw +90deg.
    expect(billboardYaw(10, 0, 0, 0)).toBeCloseTo(Math.PI / 2, 6);
    // Behind (-Z) -> +/-180deg.
    expect(Math.abs(billboardYaw(0, -10, 0, 0))).toBeCloseTo(Math.PI, 6);
  });

  it('is relative to the instance position', () => {
    expect(billboardYaw(5, 5, 5, 0)).toBeCloseTo(0, 6); // camera directly +Z of plant
  });
});

describe('triplanarWeights', () => {
  it('weights sum to 1 and the dominant axis matches the largest normal component', () => {
    for (const n of [[1, 0, 0], [0, 1, 0], [0, 0, 1], [0.3, -0.9, 0.2], [-2, 1, 1]] as const) {
      const w = triplanarWeights(n[0], n[1], n[2]);
      expect(w[0] + w[1] + w[2]).toBeCloseTo(1, 6);
      const dom = w.indexOf(Math.max(...w));
      const absN = n.map(Math.abs);
      expect(dom).toBe(absN.indexOf(Math.max(...absN)));
    }
  });

  it('handles a zero normal without NaN', () => {
    const w = triplanarWeights(0, 0, 0);
    expect(w.every((x) => Number.isFinite(x))).toBe(true);
  });
});

describe('scatterVegInstances', () => {
  const map = new GameMap(48, 12345);
  const opts = { count: 60, salt: 11, valleyBias: false, hMin: 2, hMax: 3, wRatio: 0.8, yOff: 0, texCount: 2 };

  it('is deterministic for the same map + opts', () => {
    const a = scatterVegInstances(map, opts);
    const b = scatterVegInstances(map, opts);
    expect(a).toEqual(b);
  });

  it('a different salt yields a different layout', () => {
    const a = scatterVegInstances(map, opts);
    const b = scatterVegInstances(map, { ...opts, salt: 37 });
    expect(a).not.toEqual(b);
  });

  it('never exceeds the requested count and assigns valid texture indices', () => {
    const a = scatterVegInstances(map, opts);
    expect(a.length).toBeLessThanOrEqual(opts.count);
    expect(a.length).toBeGreaterThan(0);
    for (const p of a) {
      expect(p.tex).toBeGreaterThanOrEqual(0);
      expect(p.tex).toBeLessThan(opts.texCount);
      expect(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)).toBe(true);
      expect(p.h).toBeGreaterThanOrEqual(opts.hMin - 1e-9);
      expect(p.h).toBeLessThanOrEqual(opts.hMax + 1e-9);
    }
  });

  it('returns empty when there are no open tiles', () => {
    const blocked = new GameMap(24, 1);
    blocked.flags.fill(1); // mark everything non-walkable
    expect(scatterVegInstances(blocked, opts)).toEqual([]);
  });
});
