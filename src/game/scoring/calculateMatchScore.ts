// Deterministic, balancable, offline match-score calculation. Pure function — no
// side effects, no storage, no clock/random → fully unit-testable and reusable.
import type { MatchSummary, ScoreBreakdown, ScoreDifficulty, ScoreOptions, ScoreResult } from './types';

// ── Tunables (caps + multipliers) ───────────────────────────────────────────
export const CAPS = { buildingsBuilt: 40, unitsProduced: 160, enemyUnitsDestroyed: 220, enemyBuildingsDestroyed: 80 } as const;
export const POINTS = { buildingsBuilt: 25, unitsProduced: 6, enemyUnitsDestroyed: 18, enemyBuildingsDestroyed: 70 } as const;
export const COMMAND_CENTER_BONUS = 2500;
export const TARGET_SECONDS = 30 * 60; // time-bonus fades to 0 at the 30-min target
export const DIFFICULTY_MULTIPLIER: Record<ScoreDifficulty, number> = {
  leicht: 0.8, mittel: 1.0, schwer: 1.25, superschwer: 1.6,
};
const DEFAULT_DIFFICULTY_MULTIPLIER = DIFFICULTY_MULTIPLIER.mittel;

// ── Sanitizers (defensive: never NaN, never negative) ───────────────────────
const finite = (x: number): number => (Number.isFinite(x) ? x : 0);
const intNonNeg = (x: number): number => Math.max(0, Math.floor(finite(x)));
const numNonNeg = (x: number): number => Math.max(0, finite(x));
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/**
 * Compute a match score from a (possibly noisy) summary.
 *
 * Design: victory dominates (outcome ×1 vs ×0.25), destroying the enemy command
 * centre is strongly rewarded, farming is capped, efficiency + low losses are
 * rewarded, and time only ever ADDS a fading bonus on victory (longer ≠ higher).
 * Difficulty + an optional campaign multiplier scale the final score. All point
 * fields are integers; final score is a non-negative integer.
 */
export function calculateMatchScore(summary: MatchSummary, options: ScoreOptions = {}): ScoreResult {
  const victory = summary.victory === true;

  // Base points (each input sanitized + capped → no farming).
  const cBuild = Math.min(intNonNeg(summary.buildingsBuilt), CAPS.buildingsBuilt);
  const cUnits = Math.min(intNonNeg(summary.unitsProduced), CAPS.unitsProduced);
  const cEUnits = Math.min(intNonNeg(summary.enemyUnitsDestroyed), CAPS.enemyUnitsDestroyed);
  const cEBld = Math.min(intNonNeg(summary.enemyBuildingsDestroyed), CAPS.enemyBuildingsDestroyed);

  const buildingsBuiltPoints = cBuild * POINTS.buildingsBuilt;
  const unitsProducedPoints = cUnits * POINTS.unitsProduced;
  const enemyUnitsDestroyedPoints = cEUnits * POINTS.enemyUnitsDestroyed;
  const enemyBuildingsDestroyedPoints = cEBld * POINTS.enemyBuildingsDestroyed;
  const base = buildingsBuiltPoints + unitsProducedPoints + enemyUnitsDestroyedPoints + enemyBuildingsDestroyedPoints;

  const commandCenterBonus = summary.commandCenterDestroyed === true ? COMMAND_CENTER_BONUS : 0;

  // Efficiency: value out vs resources spent (no spend → no efficiency, no NaN).
  const spent = numNonNeg(summary.resourcesSpent);
  const collected = numNonNeg(summary.resourcesCollected);
  const resourceEfficiency = spent > 0 ? clamp(collected / spent, 0, 1.5) : 0;
  const efficiencyBonus = Math.round(400 * resourceEfficiency);

  // Losses: penalty + (on victory) a fading survival bonus.
  const ownUnitsLost = intNonNeg(summary.ownUnitsLost);
  const ownBuildingsLost = intNonNeg(summary.ownBuildingsLost);
  const ownLossPenalty = ownUnitsLost * 10 + ownBuildingsLost * 60;
  const survivalBonus = victory ? Math.max(0, 500 - ownLossPenalty) : 0;

  // Time: only a fading bonus for fast victories. Longer NEVER adds; never penalizes.
  const duration = Math.max(1, Math.floor(finite(summary.durationSeconds)));
  const timeRatio = clamp((TARGET_SECONDS - duration) / TARGET_SECONDS, 0, 1);
  const timeBonus = victory ? Math.round(600 * timeRatio) : 0;

  const outcomeMultiplier = victory ? 1.0 : 0.25;
  const difficultyMultiplier = DIFFICULTY_MULTIPLIER[summary.difficulty] ?? DEFAULT_DIFFICULTY_MULTIPLIER;
  const campaignMultiplier = (() => {
    const m = finite(options.campaignMultiplier ?? 1);
    return m > 0 ? m : 1; // guard 0/negative/NaN → neutral
  })();

  const rawScore = base + commandCenterBonus + efficiencyBonus + survivalBonus + timeBonus - ownLossPenalty;
  const finalScore = Math.max(0, Math.round(rawScore * outcomeMultiplier * difficultyMultiplier * campaignMultiplier));

  const breakdown: ScoreBreakdown = {
    buildingsBuiltPoints,
    unitsProducedPoints,
    enemyUnitsDestroyedPoints,
    enemyBuildingsDestroyedPoints,
    commandCenterBonus,
    efficiencyBonus,
    survivalBonus,
    timeBonus,
    ownLossPenalty,
    rawScore,
    outcomeMultiplier,
    difficultyMultiplier,
    campaignMultiplier,
    finalScore,
  };

  return { score: finalScore, breakdown };
}
