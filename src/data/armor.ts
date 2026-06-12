// Armor & damage type definitions.
//
// The simulation still runs on the three LEGACY damage types
// (ballistic | explosive | energy) and three armor classes
// (light | heavy | structure) — that combat math is verified and unchanged.
// This module adds the EXTENDED palette the new unit schema speaks
// (laser/electric/plasma/fire/corrosion + resistances) and maps it down to
// the legacy types so future weapons can use the rich set without a sim
// rewrite. When the sim later learns per-resistance math, it reads the
// resistance tables from here.

import type { DamageType } from '../core/types';

/** Extended damage palette for unit definitions and future weapons. */
export type ExtendedDamageType =
  | 'ballistic' | 'explosive'
  | 'laser' | 'electric' | 'plasma' | 'fire' | 'corrosion';

/** Resistance channels a unit can declare (0 = immune, 1 = full damage). */
export type ResistKey =
  | 'ballistic' | 'explosive' | 'laser' | 'electric' | 'plasma'
  | 'fire' | 'corrosion' | 'antiAir' | 'antiArmor';

export type ResistanceTable = Partial<Record<ResistKey, number>>;

/** Maps the extended palette onto the legacy sim damage types. */
export const LEGACY_DAMAGE_TYPE: Record<ExtendedDamageType, DamageType> = {
  ballistic: 'ballistic',
  explosive: 'explosive',
  laser: 'energy',
  electric: 'energy',
  plasma: 'energy',
  fire: 'explosive',
  corrosion: 'energy',
};

/** Armor class shorthands used by unit templates. */
export type ArmorClassId = 'light' | 'heavy' | 'structure';

/**
 * Default resistance tables per armor class. These mirror the legacy
 * DAMAGE_MATRIX so declaring them on units changes nothing today, but gives
 * per-unit override hooks for the future.
 */
export const ARMOR_CLASS_RESISTANCES: Record<ArmorClassId, ResistanceTable> = {
  light: { ballistic: 1.0, explosive: 0.7, laser: 1.0, electric: 1.0, plasma: 1.0 },
  heavy: { ballistic: 0.65, explosive: 1.2, laser: 0.95, electric: 0.95, plasma: 0.95 },
  structure: { ballistic: 0.55, explosive: 1.1, laser: 0.85, electric: 0.85, plasma: 0.85 },
};
