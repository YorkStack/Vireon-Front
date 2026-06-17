import { describe, it, expect } from 'vitest';
import {
  getCrystalVisualStage,
  isCrystalDepleted,
  crystalNodeYieldMultiplier,
  createDefaultCrystalNode,
  updateCrystalAfterHarvest,
  crystalSizeFromMax,
} from './resources';

describe('crystal visual stage (deterministic from amount/max)', () => {
  it('full at >= 50% remaining', () => {
    expect(getCrystalVisualStage(100, 100)).toBe('full');
    expect(getCrystalVisualStage(50, 100)).toBe('full');
  });
  it('reduced between 0 and 50%', () => {
    expect(getCrystalVisualStage(49, 100)).toBe('reduced');
    expect(getCrystalVisualStage(1, 100)).toBe('reduced');
  });
  it('depleted at zero or negative', () => {
    expect(getCrystalVisualStage(0, 100)).toBe('depleted');
    expect(getCrystalVisualStage(-5, 100)).toBe('depleted');
  });
  it('is a pure function — same input, same output', () => {
    expect(getCrystalVisualStage(30, 100)).toBe(getCrystalVisualStage(30, 100));
  });
});

describe('depletion detection', () => {
  it('detects a depleted node', () => {
    expect(isCrystalDepleted({ amount: 0 })).toBe(true);
    expect(isCrystalDepleted({ amount: -1 })).toBe(true);
  });
  it('a node with stock is not depleted', () => {
    expect(isCrystalDepleted({ amount: 1 })).toBe(false);
  });
});

describe('node yield multiplier', () => {
  it('defaults to ×1 when unset (default family)', () => {
    expect(crystalNodeYieldMultiplier({})).toBe(1);
    expect(crystalNodeYieldMultiplier({ resourceType: 'default' })).toBe(1);
  });
  it('blaze node yields ×2', () => {
    expect(crystalNodeYieldMultiplier({ resourceType: 'blazeOfTheSun' })).toBe(2);
  });
  it('explicit yieldMultiplier overrides type default', () => {
    expect(crystalNodeYieldMultiplier({ resourceType: 'default', yieldMultiplier: 3 })).toBe(3);
  });
});

describe('createDefaultCrystalNode', () => {
  it('mirrors the legacy node shape and fills safe defaults', () => {
    const n = createDefaultCrystalNode({ id: 7, tx: 3, tz: 4, amount: 4000 });
    expect(n.id).toBe(7);
    expect(n.tx).toBe(3);
    expect(n.tz).toBe(4);
    expect(n.amount).toBe(4000);
    expect(n.max).toBe(4000); // max defaults to amount (full node)
    expect(n.resourceType).toBe('default');
    expect(n.yieldMultiplier).toBe(1);
    expect(n.visualStage).toBe('full');
  });
  it('a default node keeps income unchanged (×1)', () => {
    const n = createDefaultCrystalNode({ id: 1, tx: 0, tz: 0, amount: 5000 });
    expect(crystalNodeYieldMultiplier(n)).toBe(1);
  });
});

describe('size + post-harvest helpers', () => {
  it('maps capacity to a size bucket', () => {
    expect(crystalSizeFromMax(6000)).toBe('large');
    expect(crystalSizeFromMax(3000)).toBe('medium');
    expect(crystalSizeFromMax(1000)).toBe('small');
  });
  it('reports stage + depleted after a harvest', () => {
    const n = createDefaultCrystalNode({ id: 1, tx: 0, tz: 0, amount: 100, max: 100 });
    n.amount = 0;
    const r = updateCrystalAfterHarvest(n);
    expect(r.visualStage).toBe('depleted');
    expect(r.depleted).toBe(true);
  });
});
