// Faction vehicle variant — VISUAL identity + (optional) audited balance overrides.
//
// One file per faction+class lives in src/vehicles/<faction>/<class>.ts so a
// single vehicle can be extracted and reworked in isolation: its silhouette
// parameters, movement style, texture set and art metadata all live in that
// one file. Balance comes from the class template (src/data/unitClasses.ts);
// a variant may only deviate via an explicit balanceOverrides entry with a
// reason — the balance validator reports those as intentional.

import type { MovementType } from '../data/movementProfiles';

/** Chassis = running gear + base hull proportions (procedural model input). */
export interface ChassisSpec {
  style: 'tracked' | 'wheeled' | 'hover' | 'monoWheel' | 'walker' | 'halfTrack';
  /** Hull half-width / length / hull top height — tune the silhouette here. */
  halfW: number;
  len: number;
  hullH: number;
  /** Optional flavor knobs (defaults applied by the model factory). */
  wheelCount?: number;      // wheeled: wheels per side
  skirtGlow?: boolean;      // hover: emissive underside strip
  wheelRadius?: number;     // monoWheel: central wheel size
  legCount?: 4 | 6;         // walker: number of legs
}

export interface BalanceOverride {
  field: string;            // template field, e.g. 'speed'
  value: number;
  reason: string;           // REQUIRED — keeps deviations auditable
}

export interface VehicleVariant {
  classId: string;          // key into UNIT_CLASS_TEMPLATES
  factionId: string;        // 'red' | 'blue' | 'green' | 'yellow'
  /** Optional faction flavor name shown in HUD/codex (template name if unset). */
  displayName?: string;
  movementType: MovementType;
  chassis: ChassisSpec;
  /** Role-kit tuning consumed by the model factory (sizes, mount heights …). */
  kit?: Record<string, number | boolean>;
  /** Texture set under public/assets/vehicles/<textureSetId>/ */
  textureSetId: string;
  artMetadataId: string;
  silhouetteScale?: number;
  selectionRingSize?: number;
  uiIconId?: string;
  previewCamera?: { distance: number; height: number };
  balanceOverrides?: BalanceOverride[];
}
