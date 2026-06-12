// Movement profiles — VISUAL identity only.
//
// A profile describes how a vehicle *looks* while moving (hover bob, banking,
// wheel roll, walker step). It must never change gameplay-effective values:
// speed, pathing and collision all come from the unit template. That is what
// keeps faction variants balance-equal while moving completely differently.

export type MovementType =
  | 'tracked' | 'wheeled' | 'hover' | 'walker' | 'monoWheel'
  | 'aircraft' | 'naval' | 'missile'; // prepared for future unit types

export interface MovementProfile {
  id: MovementType;
  /** Resting height offset of the hull above the ground. */
  rideHeight: number;
  /** Idle/travel bob amplitude + frequency (hover/walker life). */
  bobAmp: number;
  bobFreq: number;
  /** Roll into turns (rad per rad/s of yaw change). Hover banks hard. */
  bankFactor: number;
  /** Nose-down pitch when accelerating (visual weight). */
  pitchFactor: number;
  /** Walker-style step bounce tied to travel speed (0 = none). */
  stepBounce: number;
  /** Hint for the effect system (dust, glow trail …). */
  movementEffectId: string;
  /** Pathing category — all current types share ground rules. */
  pathingCategory: 'ground' | 'air' | 'water';
}

export const MOVEMENT_PROFILES: Record<MovementType, MovementProfile> = {
  tracked: {
    id: 'tracked', rideHeight: 0, bobAmp: 0, bobFreq: 0,
    bankFactor: 0.0, pitchFactor: 0.06, stepBounce: 0,
    movementEffectId: 'dustHeavy', pathingCategory: 'ground',
  },
  wheeled: {
    id: 'wheeled', rideHeight: 0.06, bobAmp: 0.015, bobFreq: 6,
    bankFactor: 0.05, pitchFactor: 0.1, stepBounce: 0,
    movementEffectId: 'dustLight', pathingCategory: 'ground',
  },
  hover: {
    id: 'hover', rideHeight: 0.26, bobAmp: 0.06, bobFreq: 2.1,
    bankFactor: 0.16, pitchFactor: 0.12, stepBounce: 0,
    movementEffectId: 'hoverGlow', pathingCategory: 'ground',
  },
  walker: {
    id: 'walker', rideHeight: 0.04, bobAmp: 0.02, bobFreq: 3,
    bankFactor: 0.02, pitchFactor: 0.04, stepBounce: 0.07,
    movementEffectId: 'dustLight', pathingCategory: 'ground',
  },
  monoWheel: {
    id: 'monoWheel', rideHeight: 0.05, bobAmp: 0.025, bobFreq: 3.4,
    bankFactor: 0.22, pitchFactor: 0.16, stepBounce: 0,
    movementEffectId: 'sparkTrail', pathingCategory: 'ground',
  },
  // Future categories — data ready, sim support comes with the unit types.
  aircraft: {
    id: 'aircraft', rideHeight: 4.5, bobAmp: 0.12, bobFreq: 1.4,
    bankFactor: 0.45, pitchFactor: 0.2, stepBounce: 0,
    movementEffectId: 'contrail', pathingCategory: 'air',
  },
  naval: {
    id: 'naval', rideHeight: 0, bobAmp: 0.05, bobFreq: 0.8,
    bankFactor: 0.08, pitchFactor: 0.05, stepBounce: 0,
    movementEffectId: 'wake', pathingCategory: 'water',
  },
  missile: {
    id: 'missile', rideHeight: 1.2, bobAmp: 0, bobFreq: 0,
    bankFactor: 0.6, pitchFactor: 0.3, stepBounce: 0,
    movementEffectId: 'exhaustTrail', pathingCategory: 'air',
  },
};
