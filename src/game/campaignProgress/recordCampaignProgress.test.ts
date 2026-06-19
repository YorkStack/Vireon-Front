import { describe, it, expect } from 'vitest';
import { recordCampaignMissionResult, type CampaignMissionResultInput } from './recordCampaignProgress';
import { LocalStorageCampaignProgressStore } from '../../platform/profile/CampaignProgressStore';
import { createMemoryStorage } from '../../platform/storage/memoryStorage';

const ORDER = ['mission_01', 'mission_02', 'mission_03'];

function setup() {
  const storage = createMemoryStorage();
  const store = new LocalStorageCampaignProgressStore(storage);
  return { storage, store };
}

function input(p: Partial<CampaignMissionResultInput> = {}): CampaignMissionResultInput {
  return {
    playerId: 'pl1', campaignId: 'campaign_01', missionId: 'mission_01', victory: true,
    score: 1000, difficulty: 'mittel', completedAt: '2026-06-19T12:00:00.000Z', missionOrder: ORDER, ...p,
  };
}

describe('recordCampaignMissionResult', () => {
  it('marks the mission completed on victory', () => {
    const { store } = setup();
    const r = recordCampaignMissionResult(input(), { store });
    expect(r.missionCompleted).toBe(true);
    const e = store.getProgress('pl1').campaigns['campaign_01'];
    expect(e.completedMissionIds).toContain('mission_01');
    expect(e.unlockedMissionIds).toContain('mission_01');
  });

  it('does NOT mark completed on defeat (no write)', () => {
    const { store } = setup();
    const r = recordCampaignMissionResult(input({ victory: false }), { store });
    expect(r).toEqual({ changed: false, missionCompleted: false, nextMissionUnlocked: null });
    expect(store.getProgress('pl1').campaigns['campaign_01']).toBeUndefined();
  });

  it('unlocks the next mission on victory', () => {
    const { store } = setup();
    const r = recordCampaignMissionResult(input({ missionId: 'mission_01' }), { store });
    expect(r.nextMissionUnlocked).toBe('mission_02');
    expect(store.getProgress('pl1').campaigns['campaign_01'].unlockedMissionIds).toContain('mission_02');
  });

  it('does not unlock a non-existent mission after the last one', () => {
    const { store } = setup();
    const r = recordCampaignMissionResult(input({ missionId: 'mission_03' }), { store });
    expect(r.nextMissionUnlocked).toBeNull();
    const e = store.getProgress('pl1').campaigns['campaign_01'];
    expect(e.completedMissionIds).toContain('mission_03');
    expect(e.unlockedMissionIds).toEqual(['mission_03']); // only itself, no phantom next
  });

  it('preserves existing completed/unlocked missions', () => {
    const { store } = setup();
    store.saveProgress({
      playerId: 'pl1',
      campaigns: { campaign_01: { unlockedMissionIds: ['mission_01', 'mission_02'], completedMissionIds: ['mission_01'], bestScoresByMission: { mission_01: 500 }, bestDifficultyByMission: { mission_01: 'schwer' }, updatedAt: 'x' } },
    });
    recordCampaignMissionResult(input({ missionId: 'mission_02', score: 2000, difficulty: 'leicht' }), { store });
    const e = store.getProgress('pl1').campaigns['campaign_01'];
    expect(e.completedMissionIds).toEqual(expect.arrayContaining(['mission_01', 'mission_02']));
    expect(e.unlockedMissionIds).toEqual(expect.arrayContaining(['mission_01', 'mission_02', 'mission_03']));
    expect(e.bestScoresByMission['mission_01']).toBe(500); // untouched
    expect(e.bestDifficultyByMission['mission_01']).toBe('schwer'); // untouched
  });

  it('best score only increases', () => {
    const { store } = setup();
    recordCampaignMissionResult(input({ score: 1500 }), { store });
    recordCampaignMissionResult(input({ score: 800 }), { store });  // lower → ignored
    expect(store.getProgress('pl1').campaigns['campaign_01'].bestScoresByMission['mission_01']).toBe(1500);
    recordCampaignMissionResult(input({ score: 3000 }), { store });  // higher → replaces
    expect(store.getProgress('pl1').campaigns['campaign_01'].bestScoresByMission['mission_01']).toBe(3000);
  });

  it('best difficulty only increases per leicht<mittel<schwer<superschwer', () => {
    const { store } = setup();
    recordCampaignMissionResult(input({ difficulty: 'mittel' }), { store });
    recordCampaignMissionResult(input({ difficulty: 'leicht' }), { store });   // lower → ignored
    expect(store.getProgress('pl1').campaigns['campaign_01'].bestDifficultyByMission['mission_01']).toBe('mittel');
    recordCampaignMissionResult(input({ difficulty: 'superschwer' }), { store }); // higher → replaces
    expect(store.getProgress('pl1').campaigns['campaign_01'].bestDifficultyByMission['mission_01']).toBe('superschwer');
  });

  it('does nothing (no crash) when campaignId or missionId is missing', () => {
    const { store } = setup();
    expect(recordCampaignMissionResult(input({ campaignId: '' }), { store }).changed).toBe(false);
    expect(recordCampaignMissionResult(input({ missionId: '' }), { store }).changed).toBe(false);
    expect(store.getProgress('pl1').campaigns).toEqual({});
  });

  it('keeps multiple campaigns isolated', () => {
    const { store } = setup();
    recordCampaignMissionResult(input({ campaignId: 'campaign_01', missionId: 'mission_01' }), { store });
    recordCampaignMissionResult(input({ campaignId: 'campaign_02', missionId: 'mission_01', missionOrder: ['mission_01'] }), { store });
    const all = store.getProgress('pl1').campaigns;
    expect(Object.keys(all).sort()).toEqual(['campaign_01', 'campaign_02']);
    expect(all['campaign_01'].unlockedMissionIds).toContain('mission_02'); // campaign_01 still has its next
    expect(all['campaign_02'].completedMissionIds).toEqual(['mission_01']);
    expect(all['campaign_02'].unlockedMissionIds).toEqual(['mission_01']); // single-mission campaign: no phantom next
  });
});
