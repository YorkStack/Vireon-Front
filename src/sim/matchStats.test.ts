import { describe, it, expect } from 'vitest';
import { createMatchStats } from './matchStats';

describe('createMatchStats', () => {
  it('initializes all counters to zero', () => {
    expect(createMatchStats()).toEqual({
      buildingsBuilt: 0, unitsProduced: 0,
      enemyUnitsDestroyed: 0, enemyBuildingsDestroyed: 0,
      ownUnitsLost: 0, ownBuildingsLost: 0,
      resourcesCollected: 0, resourcesSpent: 0,
    });
  });

  it('returns an independent object each call (no shared reference)', () => {
    const a = createMatchStats();
    const b = createMatchStats();
    a.buildingsBuilt = 5;
    expect(b.buildingsBuilt).toBe(0);
    expect(a).not.toBe(b);
  });
});
