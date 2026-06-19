import { describe, it, expect } from 'vitest';
import { recordMatchResult, type MatchEndInput } from './recordMatchEnd';
import { LocalStorageCommanderProfileStore } from '../../platform/profile/CommanderProfileStore';
import { LocalStorageLeaderboardStore } from '../../platform/leaderboard/LocalLeaderboardStore';
import { createMemoryStorage } from '../../platform/storage/memoryStorage';
import { createMatchStats } from '../../sim/matchStats';

function setup() {
  const storage = createMemoryStorage();
  const profileStore = new LocalStorageCommanderProfileStore(storage);
  const leaderboardStore = new LocalStorageLeaderboardStore(storage);
  let n = 0;
  const deps = { profileStore, leaderboardStore, makeId: () => `score_${++n}`, now: () => '2026-06-19T10:00:00.000Z' };
  return { storage, profileStore, leaderboardStore, deps };
}

function input(p: Partial<MatchEndInput> = {}): MatchEndInput {
  return {
    victory: true, commandCenterDestroyed: true,
    difficulty: 'mittel', playerFactionId: 'red', opponentFactionId: 'blue',
    missionId: 'mission_01', mapId: '1337_96',
    durationSeconds: 600,
    stats: { ...createMatchStats(), buildingsBuilt: 6, unitsProduced: 20, enemyUnitsDestroyed: 15, enemyBuildingsDestroyed: 3, ownUnitsLost: 4, ownBuildingsLost: 1, resourcesCollected: 5000, resourcesSpent: 4000 },
    ...p,
  };
}

describe('recordMatchResult', () => {
  it('does nothing (no crash) when no Commander Profile exists', () => {
    const { deps, leaderboardStore } = setup();
    const r = recordMatchResult(input(), deps);
    expect(r.saved).toBe(false);
    expect(r.reason).toBe('no-profile');
    expect(leaderboardStore.getTopScores()).toEqual([]);
  });

  it('stores exactly one score entry with the expected fields', () => {
    const { deps, profileStore, leaderboardStore } = setup();
    profileStore.createProfile('York');
    const r = recordMatchResult(input(), deps);
    expect(r.saved).toBe(true);
    const scores = leaderboardStore.getTopScores();
    expect(scores).toHaveLength(1);
    expect(scores[0]).toMatchObject({
      score: r.score!, victory: true, factionId: 'red', missionId: 'mission_01',
      difficulty: 'mittel', durationSeconds: 600, playerName: 'York', createdAt: '2026-06-19T10:00:00.000Z',
    });
  });

  it('updates profile aggregates after a victory', () => {
    const { deps, profileStore } = setup();
    profileStore.createProfile('York');
    const r = recordMatchResult(input({ victory: true }), deps);
    const p = profileStore.getProfile()!;
    expect(p.totalMatches).toBe(1);
    expect(p.wins).toBe(1);
    expect(p.losses).toBe(0);
    expect(p.bestScore).toBe(r.score);
    expect(p.lastPlayedAt).toBe('2026-06-19T10:00:00.000Z');
  });

  it('updates profile aggregates after a defeat', () => {
    const { deps, profileStore } = setup();
    profileStore.createProfile('York');
    recordMatchResult(input({ victory: false, commandCenterDestroyed: false }), deps);
    const p = profileStore.getProfile()!;
    expect(p.totalMatches).toBe(1);
    expect(p.wins).toBe(0);
    expect(p.losses).toBe(1);
  });

  it('bestScore only increases (a worse later match does not lower it)', () => {
    const { deps, profileStore } = setup();
    profileStore.createProfile('York');
    const win = recordMatchResult(input({ victory: true }), deps);   // high
    const loss = recordMatchResult(input({ victory: false }), deps); // low
    expect(loss.score!).toBeLessThan(win.score!);
    expect(profileStore.getProfile()!.bestScore).toBe(win.score);
    expect(profileStore.getProfile()!.totalMatches).toBe(2);
  });

  it('two matches store two score entries (caller guards once-per-match)', () => {
    const { deps, profileStore, leaderboardStore } = setup();
    profileStore.createProfile('York');
    recordMatchResult(input(), deps);
    recordMatchResult(input({ victory: false }), deps);
    expect(leaderboardStore.getTopScores()).toHaveLength(2);
  });
});
