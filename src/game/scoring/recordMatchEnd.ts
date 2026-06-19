// Match-end → local score recording. Builds a MatchSummary, scores it via the
// pure calculateMatchScore foundation, stores a LocalScoreEntry, and updates the
// Commander Profile aggregates. Offline-only; no backend, no network. Stores +
// id/clock are injectable so it is fully deterministic in tests.
import { calculateMatchScore } from './calculateMatchScore';
import type { MatchSummary, ScoreDifficulty } from './types';
import type { MatchStats } from '../../sim/matchStats';
import { LocalStorageCommanderProfileStore, type CommanderProfileStore } from '../../platform/profile/CommanderProfileStore';
import { LocalStorageLeaderboardStore, type LocalLeaderboardStore } from '../../platform/leaderboard/LocalLeaderboardStore';
import { newId, nowIso } from '../../platform/storage/id';

export interface MatchEndInput {
  victory: boolean;
  commandCenterDestroyed: boolean;
  difficulty: ScoreDifficulty;
  playerFactionId: string;
  opponentFactionId?: string;
  campaignId?: string;
  missionId?: string;
  mapId?: string;
  durationSeconds: number;
  stats: MatchStats; // observational counters for team 0 (the local player)
}

export interface MatchEndDeps {
  profileStore?: CommanderProfileStore;
  leaderboardStore?: LocalLeaderboardStore;
  makeId?: () => string;
  now?: () => string;
}

export interface MatchEndResult {
  saved: boolean;
  score: number | null;
  reason?: 'no-profile';
}

/**
 * Score the finished match and persist it locally. No-op (saved:false) when no
 * Commander Profile exists — never throws, never blocks win/lose handling.
 */
export function recordMatchResult(input: MatchEndInput, deps: MatchEndDeps = {}): MatchEndResult {
  const profileStore = deps.profileStore ?? new LocalStorageCommanderProfileStore();
  const leaderboardStore = deps.leaderboardStore ?? new LocalStorageLeaderboardStore();
  const makeId = deps.makeId ?? (() => newId('score'));
  const now = deps.now ?? nowIso;

  const profile = profileStore.getProfile();
  if (!profile) return { saved: false, score: null, reason: 'no-profile' };

  const summary: MatchSummary = {
    playerId: profile.id,
    playerName: profile.displayName,
    factionId: input.playerFactionId,
    opponentFactionId: input.opponentFactionId,
    victory: input.victory,
    commandCenterDestroyed: input.commandCenterDestroyed,
    difficulty: input.difficulty,
    campaignId: input.campaignId,
    missionId: input.missionId,
    mapId: input.mapId,
    durationSeconds: input.durationSeconds,
    buildingsBuilt: input.stats.buildingsBuilt,
    unitsProduced: input.stats.unitsProduced,
    enemyUnitsDestroyed: input.stats.enemyUnitsDestroyed,
    enemyBuildingsDestroyed: input.stats.enemyBuildingsDestroyed,
    ownUnitsLost: input.stats.ownUnitsLost,
    ownBuildingsLost: input.stats.ownBuildingsLost,
    resourcesCollected: input.stats.resourcesCollected,
    resourcesSpent: input.stats.resourcesSpent,
  };

  const { score } = calculateMatchScore(summary);
  const createdAt = now();

  leaderboardStore.addScore({
    id: makeId(),
    playerId: profile.id,
    playerName: profile.displayName,
    score,
    victory: input.victory,
    factionId: input.playerFactionId,
    campaignId: input.campaignId,
    missionId: input.missionId,
    difficulty: input.difficulty,
    durationSeconds: input.durationSeconds,
    createdAt,
  });

  profileStore.updateProfile({
    ...profile,
    totalMatches: profile.totalMatches + 1,
    wins: profile.wins + (input.victory ? 1 : 0),
    losses: profile.losses + (input.victory ? 0 : 1),
    bestScore: Math.max(profile.bestScore, score),
    lastPlayedAt: createdAt,
  });

  return { saved: true, score };
}
