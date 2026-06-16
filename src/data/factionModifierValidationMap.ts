// ─────────────────────────────────────────────────────────────────────────
// Validator perk-source map (Phase 4c.1).
//
// The balance validator explains a per-faction stat deviation as a "faction
// perk" when the faction carries a non-neutral modifier for that stat. Until now
// that explanation read the legacy factions.json `modifiers`. This map lets the
// validator derive the SAME answer from FACTION_MODIFIERS (the runtime source of
// truth) instead — one canonical source, no second numbers file.
//
// `factionHasPerkForField` is faction-level (entity-kind-independent), mirroring
// the old PERK_FIELDS check ("does this faction HAVE such a perk?"), so the
// answer is byte-identical to the legacy logic while the registry mirrors
// factions.json (locked by the drift/migration tests).
// ─────────────────────────────────────────────────────────────────────────
import { FACTION_MODIFIERS, type FactionId } from './factionModifiers';

export type ValidatorPerkInterpretation =
  | 'higher = more expensive'
  | 'higher = slower'
  | 'higher = faster infantry'
  | 'higher = more HP'
  | 'higher = more damage'
  | 'higher = more range';

export interface ValidatorPerkMapEntry {
  /** Validator CRITICAL_FIELD key (see balanceValidation.ts). */
  field: string;
  /** Legacy factions.json keys this field used to read (documentation only). */
  legacyKeys: string[];
  /** Registry dot-paths whose non-neutral value indicates a faction perk. */
  paths: string[];
  /** Neutral value: 1.0 for multipliers, 0 for the additive turret-range bonus. */
  neutral: number;
  /** Human-readable effective formula. */
  formula: string;
  interpretation: ValidatorPerkInterpretation;
}

export const VALIDATOR_PERK_MAP: Record<string, ValidatorPerkMapEntry> = {
  cost: {
    field: 'cost',
    legacyKeys: ['vehicleCost', 'infantryCost'],
    paths: ['economy.unitCost', 'economy.vehicleCost', 'economy.infantryCost'],
    neutral: 1.0,
    formula: 'vehicle cost = baseCost × unitCost × vehicleCost · infantry cost = baseCost × unitCost × infantryCost',
    interpretation: 'higher = more expensive',
  },
  buildTime: {
    field: 'buildTime',
    legacyKeys: ['buildTime'],
    paths: ['production.buildTimeMultiplier'],
    neutral: 1.0,
    formula: 'effectiveBuildTime = baseBuildTime × buildTimeMultiplier',
    interpretation: 'higher = slower',
  },
  speed: {
    field: 'speed',
    legacyKeys: ['infantrySpeed'],
    paths: ['combat.infantrySpeed'],
    neutral: 1.0,
    formula: 'infantry speed = baseSpeed × infantrySpeed · vehicle speed = baseSpeed (unaffected)',
    interpretation: 'higher = faster infantry',
  },
  maxHitPoints: {
    field: 'maxHitPoints',
    legacyKeys: ['hp', 'unitHp'],
    paths: ['combat.unitHull', 'defense.buildingHull'],
    neutral: 1.0,
    formula: 'unit HP = baseHP × combat.unitHull · building HP = baseHP × defense.buildingHull',
    interpretation: 'higher = more HP',
  },
  damage: {
    field: 'damage',
    legacyKeys: ['vehicleDamage', 'energyDamage'],
    paths: ['combat.vehicleDamage', 'combat.energyWeaponDamage'],
    neutral: 1.0,
    formula: 'vehicle damage = baseDamage × vehicleDamage · energy damage = baseDamage × energyWeaponDamage · vehicle-energy = × both',
    interpretation: 'higher = more damage',
  },
  range: {
    field: 'range',
    legacyKeys: ['turretRange'],
    paths: ['defense.turretRangeBonus'],
    neutral: 0,
    formula: 'effectiveRange = baseRange + turretRangeBonus (additive)',
    interpretation: 'higher = more range',
  },
};

/** Read a 2-level dot-path off a FactionModifiers object. */
function readPath(factionId: FactionId, path: string): number | undefined {
  const [group, key] = path.split('.');
  const g = (FACTION_MODIFIERS[factionId] as unknown as Record<string, Record<string, number>>)[group];
  return g ? g[key] : undefined;
}

/**
 * Does this faction carry a non-neutral registry modifier for this validator
 * field? Faction-level (entity-kind-independent) — the registry replacement for
 * the legacy `f.modifiers[k] !== 1` check.
 */
export function factionHasPerkForField(factionId: FactionId, field: string): boolean {
  const entry = VALIDATOR_PERK_MAP[field];
  if (!entry) return false;
  return entry.paths.some((p) => {
    const v = readPath(factionId, p);
    return v !== undefined && v !== entry.neutral;
  });
}
