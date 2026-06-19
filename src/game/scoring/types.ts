// Local, offline match-scoring types (MVP 1, Step 3a). Pure data — no gameplay,
// no storage, no network. Consumed later by match-end wiring + LocalLeaderboardStore.

export type ScoreDifficulty = 'leicht' | 'mittel' | 'schwer' | 'superschwer';

export interface MatchSummary {
  playerId: string;
  playerName: string;
  factionId: string;
  opponentFactionId?: string;

  victory: boolean;
  commandCenterDestroyed: boolean;

  difficulty: ScoreDifficulty;
  campaignId?: string;
  missionId?: string;
  mapId?: string;

  durationSeconds: number;

  buildingsBuilt: number;
  unitsProduced: number;

  enemyUnitsDestroyed: number;
  enemyBuildingsDestroyed: number;

  ownUnitsLost: number;
  ownBuildingsLost: number;

  resourcesCollected: number;
  resourcesSpent: number;
}

export interface ScoreBreakdown {
  buildingsBuiltPoints: number;
  unitsProducedPoints: number;
  enemyUnitsDestroyedPoints: number;
  enemyBuildingsDestroyedPoints: number;
  commandCenterBonus: number;

  efficiencyBonus: number;
  survivalBonus: number;
  timeBonus: number;

  ownLossPenalty: number;

  rawScore: number;
  outcomeMultiplier: number;
  difficultyMultiplier: number;
  campaignMultiplier: number;
  finalScore: number;
}

export interface ScoreResult {
  score: number;
  breakdown: ScoreBreakdown;
}

/** Optional knobs (campaign/map multipliers). Defaults keep behaviour neutral. */
export interface ScoreOptions {
  campaignMultiplier?: number; // default 1
}
