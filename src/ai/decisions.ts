// Pure AI decision helpers — no Three.js, fully unit-testable. They translate a
// difficulty tier + a doctrine's personality into concrete numbers the enemy AI
// uses for wave timing, army readiness and how much it commits vs. holds back.
import type { DifficultyConfig } from '../data/difficulty';
import type { AttackTiming } from '../data/doctrines';

export type Phase = 'early' | 'mid' | 'late';

export interface AiProfile {
  name: string;
  firstWaveAt: number;
  waveInterval: number;
  waveGrowth: number;
  maxArmy: number;
  harvesters: number;
  rebuilds: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Coarse game phase from elapsed seconds. */
export function phaseOf(timeSec: number): Phase {
  return timeSec < 240 ? 'early' : timeSec < 600 ? 'mid' : 'late';
}

/** Doctrine attack-timing → a multiplier on the first-wave delay. */
export function attackTimingMul(t: AttackTiming): number {
  return t === 'early' ? 0.8 : t === 'late' ? 1.25 : 1.0;
}

/** Minimum idle army before a wave launches — aggressive doctrines strike with fewer. */
export function waveMinReady(attackAggression: number): number {
  return Math.max(3, Math.round(8 - attackAggression * 6)); // aggr 1.0→2→3, 0.4→6
}

/** Fraction of the idle army committed per wave — defensive doctrines hold more back. */
export function sendFraction(defensePriority: number): number {
  return clamp(0.9 - defensePriority * 0.4, 0.5, 0.9); // def 0.9→0.54, 0.15→0.84
}

/**
 * Compose a mission's base AI profile with a difficulty tier and the doctrine's
 * preferred attack timing into the effective numbers the AI runs on. Pure, so
 * the difficulty mapping is unit-testable. waveGrowth scales the part ABOVE 1
 * (so easier never makes waves shrink below the base population).
 */
export function effectiveProfile(base: AiProfile, diff: DifficultyConfig, timing: AttackTiming): AiProfile {
  const timingMul = attackTimingMul(timing);
  return {
    ...base,
    firstWaveAt: Math.round(base.firstWaveAt * diff.firstWaveMul * timingMul),
    waveInterval: Math.round(base.waveInterval * diff.waveIntervalMul),
    waveGrowth: 1 + (base.waveGrowth - 1) * diff.waveGrowthMul,
    maxArmy: Math.max(4, Math.round(base.maxArmy * diff.maxArmyMul)),
  };
}

/** Decision tick length in seconds (clumsier = slower) for a difficulty tier. */
export function tickInterval(diff: DifficultyConfig): number {
  return 1.0 * diff.cadenceMul;
}
