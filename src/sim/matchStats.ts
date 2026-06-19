// Observational per-team match statistics (MVP 1, Step 3b). Counters only — they
// never influence simulation, economy, power, combat or balance. Read at match
// end to build a MatchSummary for the local scoring foundation.
export interface MatchStats {
  buildingsBuilt: number;
  unitsProduced: number;

  enemyUnitsDestroyed: number;
  enemyBuildingsDestroyed: number;

  ownUnitsLost: number;
  ownBuildingsLost: number;

  resourcesCollected: number;
  resourcesSpent: number;
}

/** A fresh, all-zero MatchStats. One independent object per call. */
export function createMatchStats(): MatchStats {
  return {
    buildingsBuilt: 0,
    unitsProduced: 0,
    enemyUnitsDestroyed: 0,
    enemyBuildingsDestroyed: 0,
    ownUnitsLost: 0,
    ownBuildingsLost: 0,
    resourcesCollected: 0,
    resourcesSpent: 0,
  };
}
