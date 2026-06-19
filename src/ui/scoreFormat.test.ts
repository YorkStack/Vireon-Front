import { describe, it, expect } from 'vitest';
import {
  formatScore, formatDuration, formatSigned, factionLabel, difficultyLabel, formatDate,
  breakdownRows, leaderboardRows,
} from './scoreFormat';
import type { ScoreBreakdown } from '../game/scoring/types';
import type { LocalScoreEntry } from '../platform/leaderboard/types';

describe('score formatting helpers', () => {
  it('formats scores with thousands separators', () => {
    expect(formatScore(3600)).toBe('3,600');
    expect(formatScore(0)).toBe('0');
    expect(formatScore(1234567)).toBe('1,234,567');
    expect(formatScore(NaN)).toBe('0'); // sanitized
  });

  it('formats durations as m:ss', () => {
    expect(formatDuration(754)).toBe('12:34');
    expect(formatDuration(0.2)).toBe('0:00');
    expect(formatDuration(60)).toBe('1:00');
    expect(formatDuration(-5)).toBe('0:00');
  });

  it('formats signed breakdown values', () => {
    expect(formatSigned(2500)).toBe('+2,500');
    expect(formatSigned(-120)).toBe('−120');
    expect(formatSigned(0)).toBe('0');
  });

  it('labels factions and difficulties', () => {
    expect(factionLabel('red')).toBe('Crimson');
    expect(factionLabel('yellow')).toBe('Solar');
    expect(factionLabel('unknown')).toBe('Unknown');
    expect(difficultyLabel('mittel')).toBe('Mittel');
  });

  it('formats ISO dates to YYYY-MM-DD', () => {
    expect(formatDate('2026-06-19T16:13:44.993Z')).toBe('2026-06-19');
    expect(formatDate('')).toBe('');
  });
});

function bd(p: Partial<ScoreBreakdown> = {}): ScoreBreakdown {
  return {
    buildingsBuiltPoints: 0, unitsProducedPoints: 0, enemyUnitsDestroyedPoints: 0, enemyBuildingsDestroyedPoints: 0,
    commandCenterBonus: 0, efficiencyBonus: 0, survivalBonus: 0, timeBonus: 0, ownLossPenalty: 0,
    rawScore: 0, outcomeMultiplier: 1, difficultyMultiplier: 1, campaignMultiplier: 1, finalScore: 0, ...p,
  };
}

describe('breakdownRows', () => {
  it('omits zero rows and signs the loss penalty negative', () => {
    const rows = breakdownRows(bd({ commandCenterBonus: 2500, survivalBonus: 500, timeBonus: 600, ownLossPenalty: 120 }));
    const map = Object.fromEntries(rows.map((r) => [r.label, r.value]));
    expect(map['Command Center Bonus']).toBe(2500);
    expect(map['Survival Bonus']).toBe(500);
    expect(map['Loss Penalty']).toBe(-120);
    expect(map['Efficiency Bonus']).toBeUndefined(); // zero → omitted
  });

  it('aggregates the four base point fields into one Base row', () => {
    const rows = breakdownRows(bd({ buildingsBuiltPoints: 100, enemyUnitsDestroyedPoints: 50 }));
    expect(rows.find((r) => r.label === 'Base')?.value).toBe(150);
  });
});

function entry(p: Partial<LocalScoreEntry>): LocalScoreEntry {
  return {
    id: p.id ?? 'x', playerId: 'pl', playerName: 'York', score: p.score ?? 100, victory: p.victory ?? true,
    factionId: p.factionId ?? 'red', campaignId: p.campaignId, missionId: p.missionId,
    difficulty: p.difficulty ?? 'mittel', durationSeconds: p.durationSeconds ?? 600,
    createdAt: p.createdAt ?? '2026-06-19T10:00:00.000Z',
  };
}

describe('leaderboardRows', () => {
  it('returns an empty list for no scores', () => {
    expect(leaderboardRows([])).toEqual([]);
  });

  it('maps entries into ranked display rows (caps at limit)', () => {
    const entries = Array.from({ length: 15 }, (_, i) => entry({ score: i, id: String(i) }));
    const rows = leaderboardRows(entries, 10);
    expect(rows).toHaveLength(10);
    expect(rows[0]).toMatchObject({ rank: 1, outcome: 'Victory', faction: 'Crimson', difficulty: 'Mittel', duration: '10:00', date: '2026-06-19' });
  });

  it('renders defeat outcome', () => {
    expect(leaderboardRows([entry({ victory: false })])[0].outcome).toBe('Defeat');
  });
});
