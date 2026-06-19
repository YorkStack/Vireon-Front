// Cross-store isolation + campaign progress + settings behaviour. Proves each
// reset/delete touches only its own key.
import { describe, it, expect } from 'vitest';
import { LocalStorageCommanderProfileStore } from './CommanderProfileStore';
import { LocalStorageCampaignProgressStore } from './CampaignProgressStore';
import { LocalStorageSettingsStore, DEFAULT_SETTINGS } from './LocalGameSettingsStore';
import { LocalStorageLeaderboardStore } from '../leaderboard/LocalLeaderboardStore';
import { STORAGE_KEYS } from '../storage/keys';
import { createMemoryStorage } from '../storage/memoryStorage';
import type { CampaignProgress } from './types';

describe('CampaignProgressStore', () => {
  it('returns empty progress for a player with no data', () => {
    const s = new LocalStorageCampaignProgressStore(createMemoryStorage());
    expect(s.getProgress('p1')).toEqual({ playerId: 'p1', campaigns: {} });
  });

  it('returns empty progress when stored data belongs to a different player', () => {
    const storage = createMemoryStorage();
    const s = new LocalStorageCampaignProgressStore(storage);
    s.saveProgress({ playerId: 'p1', campaigns: { desert: mkEntry() } });
    expect(s.getProgress('OTHER')).toEqual({ playerId: 'OTHER', campaigns: {} });
  });

  it('saves + reads progress round-trip', () => {
    const s = new LocalStorageCampaignProgressStore(createMemoryStorage());
    const prog: CampaignProgress = { playerId: 'p1', campaigns: { desert: mkEntry(['d1'], ['d1']) } };
    s.saveProgress(prog);
    expect(s.getProgress('p1').campaigns.desert.completedMissionIds).toEqual(['d1']);
  });

  it('handles corrupted JSON safely', () => {
    const storage = createMemoryStorage({ [STORAGE_KEYS.campaignProgress]: '{broken' });
    const s = new LocalStorageCampaignProgressStore(storage);
    expect(s.getProgress('p1')).toEqual({ playerId: 'p1', campaigns: {} });
  });
});

describe('LocalGameSettingsStore', () => {
  it('returns defaults when nothing stored', () => {
    const s = new LocalStorageSettingsStore(createMemoryStorage());
    expect(s.getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('merges partial stored settings over defaults', () => {
    const storage = createMemoryStorage({ [STORAGE_KEYS.settings]: JSON.stringify({ soundEnabled: false }) });
    const s = new LocalStorageSettingsStore(storage);
    expect(s.getSettings()).toEqual({ ...DEFAULT_SETTINGS, soundEnabled: false });
  });

  it('resetSettings deletes only the settings key', () => {
    const storage = createMemoryStorage();
    storage.setItem(STORAGE_KEYS.commanderProfile, '{"id":"x","displayName":"V"}');
    const s = new LocalStorageSettingsStore(storage);
    s.saveSettings({ ...DEFAULT_SETTINGS, cameraSpeed: 2 });
    s.resetSettings();
    expect(storage.getItem(STORAGE_KEYS.settings)).toBeNull();
    expect(storage.getItem(STORAGE_KEYS.commanderProfile)).not.toBeNull();
  });
});

describe('store isolation (shared storage)', () => {
  it('reset/clear/delete each touch only their own key', () => {
    const storage = createMemoryStorage();
    const profile = new LocalStorageCommanderProfileStore(storage);
    const progress = new LocalStorageCampaignProgressStore(storage);
    const scores = new LocalStorageLeaderboardStore(storage);

    const p = profile.createProfile('Vex');
    progress.saveProgress({ playerId: p.id, campaigns: { desert: mkEntry(['d1']) } });
    scores.addScore({
      id: 's1', playerId: p.id, playerName: 'Vex', score: 500, victory: true,
      factionId: 'red', difficulty: 'mittel', durationSeconds: 600, createdAt: '2026-06-19T10:00:00.000Z',
    });

    // Reset campaign progress → profile + scores remain
    progress.resetProgress(p.id);
    expect(profile.getProfile()).not.toBeNull();
    expect(scores.getTopScores()).toHaveLength(1);
    expect(progress.getProgress(p.id).campaigns).toEqual({});

    // Clear scores → profile remains
    scores.clearScores();
    expect(scores.getTopScores()).toEqual([]);
    expect(profile.getProfile()).not.toBeNull();

    // Delete profile → does not resurrect/delete the others' keys
    storage.setItem(STORAGE_KEYS.localScores, '[]');
    profile.deleteProfile();
    expect(profile.getProfile()).toBeNull();
    expect(storage.getItem(STORAGE_KEYS.localScores)).not.toBeNull();
  });
});

function mkEntry(unlocked: string[] = [], completed: string[] = []) {
  return {
    unlockedMissionIds: unlocked,
    completedMissionIds: completed,
    bestScoresByMission: {},
    bestDifficultyByMission: {},
    updatedAt: '2026-06-19T10:00:00.000Z',
  };
}
