import { describe, it, expect } from 'vitest';
import { calculateMatchScore, CAPS } from './calculateMatchScore';
import type { MatchSummary } from './types';

function summary(p: Partial<MatchSummary> = {}): MatchSummary {
  return {
    playerId: 'pl', playerName: 'York', factionId: 'red',
    victory: true, commandCenterDestroyed: false,
    difficulty: 'mittel',
    durationSeconds: 900,
    buildingsBuilt: 8, unitsProduced: 30,
    enemyUnitsDestroyed: 20, enemyBuildingsDestroyed: 4,
    ownUnitsLost: 5, ownBuildingsLost: 1,
    resourcesCollected: 5000, resourcesSpent: 5000,
    ...p,
  };
}

describe('calculateMatchScore', () => {
  it('victory + command centre destroyed scores far higher than a defeat', () => {
    const win = calculateMatchScore(summary({ victory: true, commandCenterDestroyed: true }));
    const loss = calculateMatchScore(summary({ victory: false, commandCenterDestroyed: false }));
    expect(win.score).toBeGreaterThan(loss.score * 3);
    expect(win.breakdown.commandCenterBonus).toBe(2500);
    expect(loss.breakdown.outcomeMultiplier).toBe(0.25);
  });

  it('superschwer multiplier beats mittel for the same summary', () => {
    const base = summary();
    const mittel = calculateMatchScore({ ...base, difficulty: 'mittel' });
    const superschwer = calculateMatchScore({ ...base, difficulty: 'superschwer' });
    expect(superschwer.score).toBeGreaterThan(mittel.score);
    expect(superschwer.breakdown.difficultyMultiplier).toBe(1.6);
    expect(mittel.breakdown.difficultyMultiplier).toBe(1.0);
  });

  it('longer games do NOT earn more (time bonus only fades down)', () => {
    const fast = calculateMatchScore(summary({ durationSeconds: 300 }));
    const slow = calculateMatchScore(summary({ durationSeconds: 3000 }));
    expect(fast.breakdown.timeBonus).toBeGreaterThan(slow.breakdown.timeBonus);
    expect(slow.breakdown.timeBonus).toBe(0); // past the 30-min target → 0, never negative
    expect(fast.score).toBeGreaterThan(slow.score);
  });

  it('faster victories get a time bonus; defeats never do', () => {
    const fastWin = calculateMatchScore(summary({ victory: true, durationSeconds: 300 }));
    const fastLoss = calculateMatchScore(summary({ victory: false, durationSeconds: 300 }));
    expect(fastWin.breakdown.timeBonus).toBeGreaterThan(0);
    expect(fastLoss.breakdown.timeBonus).toBe(0);
  });

  it('farming is capped (huge counts saturate at the cap value)', () => {
    const huge = calculateMatchScore(summary({ buildingsBuilt: 10_000, unitsProduced: 10_000, enemyUnitsDestroyed: 10_000, enemyBuildingsDestroyed: 10_000 }));
    expect(huge.breakdown.buildingsBuiltPoints).toBe(CAPS.buildingsBuilt * 25);
    expect(huge.breakdown.unitsProducedPoints).toBe(CAPS.unitsProduced * 6);
    expect(huge.breakdown.enemyUnitsDestroyedPoints).toBe(CAPS.enemyUnitsDestroyed * 18);
    expect(huge.breakdown.enemyBuildingsDestroyedPoints).toBe(CAPS.enemyBuildingsDestroyed * 70);
  });

  it('losses reduce the score (more losses → lower)', () => {
    const few = calculateMatchScore(summary({ ownUnitsLost: 0, ownBuildingsLost: 0 }));
    const many = calculateMatchScore(summary({ ownUnitsLost: 40, ownBuildingsLost: 6 }));
    expect(many.score).toBeLessThan(few.score);
    expect(many.breakdown.ownLossPenalty).toBe(40 * 10 + 6 * 60);
  });

  it('sanitizes negative inputs to 0', () => {
    const r = calculateMatchScore(summary({ buildingsBuilt: -50, unitsProduced: -50, enemyUnitsDestroyed: -50, enemyBuildingsDestroyed: -50, ownUnitsLost: -10, ownBuildingsLost: -10 }));
    expect(r.breakdown.buildingsBuiltPoints).toBe(0);
    expect(r.breakdown.enemyUnitsDestroyedPoints).toBe(0);
    expect(r.breakdown.ownLossPenalty).toBe(0);
    expect(r.score).toBeGreaterThanOrEqual(0);
  });

  it('zero / NaN resources do not crash and never produce NaN', () => {
    const zero = calculateMatchScore(summary({ resourcesCollected: 0, resourcesSpent: 0 }));
    expect(zero.breakdown.efficiencyBonus).toBe(0);
    expect(Number.isNaN(zero.score)).toBe(false);
    const nan = calculateMatchScore(summary({ resourcesCollected: NaN, resourcesSpent: NaN, durationSeconds: NaN }));
    expect(Number.isFinite(nan.score)).toBe(true);
  });

  it('final score is always a non-negative integer', () => {
    const cases = [
      summary({ victory: false, ownUnitsLost: 999, ownBuildingsLost: 999 }),
      summary({ victory: true, difficulty: 'leicht' }),
      summary({ resourcesSpent: 1, resourcesCollected: 9_999_999 }),
    ];
    for (const c of cases) {
      const r = calculateMatchScore(c);
      expect(Number.isInteger(r.score)).toBe(true);
      expect(r.score).toBeGreaterThanOrEqual(0);
    }
  });

  it('breakdown is explainable and stable (rawScore = sum of parts; final = round(raw·muls))', () => {
    const r = calculateMatchScore(summary({ victory: true, commandCenterDestroyed: true, difficulty: 'schwer' }));
    const b = r.breakdown;
    const expectedRaw = b.buildingsBuiltPoints + b.unitsProducedPoints + b.enemyUnitsDestroyedPoints +
      b.enemyBuildingsDestroyedPoints + b.commandCenterBonus + b.efficiencyBonus + b.survivalBonus +
      b.timeBonus - b.ownLossPenalty;
    expect(b.rawScore).toBe(expectedRaw);
    expect(b.finalScore).toBe(Math.max(0, Math.round(b.rawScore * b.outcomeMultiplier * b.difficultyMultiplier * b.campaignMultiplier)));
    expect(r.score).toBe(b.finalScore);
    // deterministic: same input → same output
    expect(calculateMatchScore(summary({ victory: true, commandCenterDestroyed: true, difficulty: 'schwer' })).score).toBe(r.score);
  });

  it('campaign multiplier defaults to 1 and applies when given (invalid → neutral)', () => {
    const def = calculateMatchScore(summary());
    expect(def.breakdown.campaignMultiplier).toBe(1);
    const boosted = calculateMatchScore(summary(), { campaignMultiplier: 1.2 });
    expect(boosted.breakdown.campaignMultiplier).toBe(1.2);
    expect(boosted.score).toBeGreaterThan(def.score);
    const bad = calculateMatchScore(summary(), { campaignMultiplier: 0 });
    expect(bad.breakdown.campaignMultiplier).toBe(1); // 0 → neutral
  });
});
