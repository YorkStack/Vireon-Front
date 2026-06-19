// Local campaign-progress recording at match end (MVP 1, Step 5). Offline-only;
// writes through the existing CampaignProgressStore (key `vireon.campaignProgress`).
// Pure + deterministic: store, mission order and timestamp are all inputs, so the
// helper is fully unit-testable and never reaches into the running game/render.
//
// Achievement semantics: progress only advances on a VICTORY. Defeat is a no-op.
// Nothing here touches score formula, counters, balance, or any gameplay system.
import { LocalStorageCampaignProgressStore, type CampaignProgressStore } from '../../platform/profile/CampaignProgressStore';
import type { CampaignProgressEntry } from '../../platform/profile/types';
import { DIFFICULTY_ORDER, type DifficultyId } from '../../data/difficulty';

export interface CampaignMissionResultInput {
  playerId: string;
  campaignId: string;
  missionId: string;
  victory: boolean;
  score: number;
  difficulty: string;          // DifficultyId; unknown values rank lowest
  completedAt: string;         // ISO timestamp (injected → deterministic)
  /** Ordered mission ids of the campaign (CampaignDef.missions order). */
  missionOrder: string[];
}

export interface CampaignProgressDeps {
  store?: CampaignProgressStore;
}

export interface RecordCampaignResult {
  changed: boolean;
  missionCompleted: boolean;
  nextMissionUnlocked: string | null;
}

const NO_CHANGE: RecordCampaignResult = { changed: false, missionCompleted: false, nextMissionUnlocked: null };

/** Rank of a difficulty id; -1 (lowest) for unknown strings. */
function difficultyRank(d: string): number {
  return DIFFICULTY_ORDER.indexOf(d as DifficultyId);
}

function emptyEntry(): CampaignProgressEntry {
  return { unlockedMissionIds: [], completedMissionIds: [], bestScoresByMission: {}, bestDifficultyByMission: {}, updatedAt: '' };
}

/**
 * Record the outcome of a campaign mission into local progress.
 *
 * On VICTORY: marks the mission unlocked + completed, unlocks the next mission in
 * order (if any), and stores best-score (only if higher) and best-difficulty (only
 * if higher per `leicht < mittel < schwer < superschwer`). Existing completed/
 * unlocked missions and OTHER campaigns are preserved untouched. On defeat, or with
 * a missing campaignId/missionId, it does nothing (no write) and never throws.
 */
export function recordCampaignMissionResult(
  input: CampaignMissionResultInput,
  deps: CampaignProgressDeps = {},
): RecordCampaignResult {
  if (!input.victory) return NO_CHANGE;
  if (!input.campaignId || !input.missionId || !input.playerId) return NO_CHANGE;

  const store = deps.store ?? new LocalStorageCampaignProgressStore();
  const progress = store.getProgress(input.playerId); // { playerId, campaigns: {...} }
  const prev = progress.campaigns[input.campaignId] ?? emptyEntry();

  // Copy collections so untouched fields/campaigns survive verbatim.
  const unlocked = new Set(prev.unlockedMissionIds);
  const completed = new Set(prev.completedMissionIds);
  unlocked.add(input.missionId);   // current mission is at least unlocked…
  completed.add(input.missionId);  // …and, on victory, completed

  // Unlock the next mission in campaign order, if one exists.
  let nextMissionUnlocked: string | null = null;
  const idx = input.missionOrder.indexOf(input.missionId);
  if (idx >= 0 && idx + 1 < input.missionOrder.length) {
    nextMissionUnlocked = input.missionOrder[idx + 1];
    unlocked.add(nextMissionUnlocked);
  }

  // Best score per mission — only replace with a higher value.
  const bestScoresByMission = { ...prev.bestScoresByMission };
  const prevScore = bestScoresByMission[input.missionId];
  if (prevScore == null || input.score > prevScore) bestScoresByMission[input.missionId] = input.score;

  // Best difficulty per mission — only replace with a higher tier.
  const bestDifficultyByMission = { ...prev.bestDifficultyByMission };
  const prevDiff = bestDifficultyByMission[input.missionId];
  if (prevDiff == null || difficultyRank(input.difficulty) > difficultyRank(prevDiff)) {
    bestDifficultyByMission[input.missionId] = input.difficulty;
  }

  progress.campaigns[input.campaignId] = {
    unlockedMissionIds: [...unlocked],
    completedMissionIds: [...completed],
    bestScoresByMission,
    bestDifficultyByMission,
    updatedAt: input.completedAt,
  };
  store.saveProgress(progress);

  return { changed: true, missionCompleted: true, nextMissionUnlocked };
}
