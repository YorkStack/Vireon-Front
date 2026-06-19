import { describe, it, expect } from 'vitest';
import { LocalStorageLeaderboardStore, MAX_STORED_SCORES } from './LocalLeaderboardStore';
import { STORAGE_KEYS } from '../storage/keys';
import { createMemoryStorage } from '../storage/memoryStorage';
import type { LocalScoreEntry } from './types';

function entry(p: Partial<LocalScoreEntry>): LocalScoreEntry {
  return {
    id: p.id ?? Math.random().toString(36).slice(2),
    playerId: p.playerId ?? 'pl',
    playerName: p.playerName ?? 'Vex',
    score: p.score ?? 100,
    victory: p.victory ?? true,
    factionId: p.factionId ?? 'red',
    campaignId: p.campaignId,
    missionId: p.missionId,
    difficulty: p.difficulty ?? 'mittel',
    durationSeconds: p.durationSeconds ?? 600,
    createdAt: p.createdAt ?? '2026-06-19T10:00:00.000Z',
  };
}

describe('LocalStorageLeaderboardStore', () => {
  it('sorts descending by score', () => {
    const s = new LocalStorageLeaderboardStore(createMemoryStorage());
    s.addScore(entry({ score: 100 }));
    s.addScore(entry({ score: 300 }));
    s.addScore(entry({ score: 200 }));
    expect(s.getTopScores().map((e) => e.score)).toEqual([300, 200, 100]);
  });

  it('breaks score ties by newest createdAt first', () => {
    const s = new LocalStorageLeaderboardStore(createMemoryStorage());
    s.addScore(entry({ id: 'old', score: 500, createdAt: '2026-06-19T09:00:00.000Z' }));
    s.addScore(entry({ id: 'new', score: 500, createdAt: '2026-06-19T11:00:00.000Z' }));
    expect(s.getTopScores().map((e) => e.id)).toEqual(['new', 'old']);
  });

  it('honours the limit argument', () => {
    const s = new LocalStorageLeaderboardStore(createMemoryStorage());
    for (let i = 0; i < 5; i++) s.addScore(entry({ score: i * 10 }));
    expect(s.getTopScores(2)).toHaveLength(2);
  });

  it('filters by campaign + mission', () => {
    const s = new LocalStorageLeaderboardStore(createMemoryStorage());
    s.addScore(entry({ score: 100, campaignId: 'desert', missionId: 'm1' }));
    s.addScore(entry({ score: 200, campaignId: 'desert', missionId: 'm2' }));
    s.addScore(entry({ score: 300, campaignId: 'jungle', missionId: 'm1' }));
    const r = s.getTopScoresForMission('desert', 'm1');
    expect(r).toHaveLength(1);
    expect(r[0].score).toBe(100);
  });

  it('getPlayerBestScore returns the max (0 when none)', () => {
    const s = new LocalStorageLeaderboardStore(createMemoryStorage());
    s.addScore(entry({ playerId: 'a', score: 120 }));
    s.addScore(entry({ playerId: 'a', score: 480 }));
    s.addScore(entry({ playerId: 'b', score: 999 }));
    expect(s.getPlayerBestScore('a')).toBe(480);
    expect(s.getPlayerBestScore('missing')).toBe(0);
  });

  it('caps stored entries to MAX_STORED_SCORES (keeps the highest)', () => {
    const storage = createMemoryStorage();
    const s = new LocalStorageLeaderboardStore(storage);
    for (let i = 0; i < MAX_STORED_SCORES + 25; i++) s.addScore(entry({ score: i }));
    const stored = JSON.parse(storage.getItem(STORAGE_KEYS.localScores)!) as LocalScoreEntry[];
    expect(stored).toHaveLength(MAX_STORED_SCORES);
    expect(stored[0].score).toBe(MAX_STORED_SCORES + 24); // highest survived
    expect(Math.min(...stored.map((e) => e.score))).toBe(25); // lowest 25 dropped
  });

  it('survives corrupted stored JSON (treats as empty)', () => {
    const storage = createMemoryStorage({ [STORAGE_KEYS.localScores]: 'not-an-array' });
    const s = new LocalStorageLeaderboardStore(storage);
    expect(s.getTopScores()).toEqual([]);
    expect(() => s.addScore(entry({ score: 50 }))).not.toThrow();
    expect(s.getTopScores().map((e) => e.score)).toEqual([50]);
  });

  it('clearScores deletes ONLY the scores key', () => {
    const storage = createMemoryStorage();
    storage.setItem(STORAGE_KEYS.commanderProfile, '{"id":"x","displayName":"V"}');
    const s = new LocalStorageLeaderboardStore(storage);
    s.addScore(entry({ score: 10 }));
    s.clearScores();
    expect(storage.getItem(STORAGE_KEYS.localScores)).toBeNull();
    expect(storage.getItem(STORAGE_KEYS.commanderProfile)).not.toBeNull();
  });
});
