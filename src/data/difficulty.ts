// Difficulty tiers for the enemy AI. The CURRENT (pre-difficulty) behaviour is
// anchored as "Schwer" (all multipliers 1.0); "Mittel"/"Leicht" are clearly
// gentler and "Superschwer" is harder. Multipliers compose on top of the
// mission `aiProfile` (see ai/decisions.ts → effectiveProfile) plus the AI
// income lever (TeamState.incomeMul).
//
// Meaning of each knob (relative to Schwer = 1.0):
//   firstWaveMul    > 1 = first attack later (easier)
//   waveIntervalMul > 1 = more time between waves (easier)
//   waveGrowthMul   scales the growth ABOVE 1 (e.g. 1.35 → 1+0.35*mul); <1 = waves escalate slower
//   maxArmyMul      AI army ceiling
//   aiIncomeMul     ore-yield handicap for the AI economy (how fast it can afford things)
//   cadenceMul      > 1 = AI thinks/acts less often (clumsier, easier)
export type DifficultyId = 'leicht' | 'mittel' | 'schwer' | 'superschwer';

export interface DifficultyConfig {
  id: DifficultyId;
  uiName: string;
  blurb: string;
  firstWaveMul: number;
  waveIntervalMul: number;
  waveGrowthMul: number;
  maxArmyMul: number;
  aiIncomeMul: number;
  cadenceMul: number;
}

export const DIFFICULTIES: Record<DifficultyId, DifficultyConfig> = {
  leicht: {
    id: 'leicht', uiName: 'Leicht', blurb: 'Späte, kleine Angriffe — zum Reinkommen.',
    firstWaveMul: 1.8, waveIntervalMul: 1.6, waveGrowthMul: 0.7, maxArmyMul: 0.55, aiIncomeMul: 0.65, cadenceMul: 1.7,
  },
  mittel: {
    id: 'mittel', uiName: 'Mittel', blurb: 'Fordernd, aber fair.',
    firstWaveMul: 1.4, waveIntervalMul: 1.3, waveGrowthMul: 0.85, maxArmyMul: 0.75, aiIncomeMul: 0.85, cadenceMul: 1.3,
  },
  schwer: {
    id: 'schwer', uiName: 'Schwer', blurb: 'Das bisherige Verhalten — zügiger Aufbau, harte Wellen.',
    firstWaveMul: 1.0, waveIntervalMul: 1.0, waveGrowthMul: 1.0, maxArmyMul: 1.0, aiIncomeMul: 1.0, cadenceMul: 1.0,
  },
  superschwer: {
    id: 'superschwer', uiName: 'Superschwer', blurb: 'Früher Druck, große Wellen, Ressourcen-Bonus.',
    firstWaveMul: 0.7, waveIntervalMul: 0.7, waveGrowthMul: 1.2, maxArmyMul: 1.4, aiIncomeMul: 1.45, cadenceMul: 0.7,
  },
};

export const DEFAULT_DIFFICULTY: DifficultyId = 'mittel';
export const DIFFICULTY_ORDER: DifficultyId[] = ['leicht', 'mittel', 'schwer', 'superschwer'];
