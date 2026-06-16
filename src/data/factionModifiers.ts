// ─────────────────────────────────────────────────────────────────────────
// Faction MECHANICS registry — the single, data-driven source of fixed faction
// gameplay properties. This is the faction IDENTITY layer:
//   Faction modifiers = ALWAYS active for the faction (economy/power/combat/…).
//   Doctrine          = AI strategy weighting WITHIN that faction (see doctrines.ts).
// Doctrine may later lightly modulate these (Doctrine.optionalModifierBias) but
// must never replace them.
//
// Keyed by the live faction ids (red/blue/green/yellow). Canonical names:
//   red = Crimson Pact · blue = Azure Concorde · green = Verdant Swarm · yellow = Solar Dominion
//
// IMPORTANT (no double-application): cost / damage / hull / build-time /
// turret-range / building-power-usage are ALREADY applied by the existing
// layered system (factions.json modifiers via src/core/defs.ts +
// unitFactory). This registry centralises those values AND adds the new
// dimensions (power-outage behaviour, gather rate, repair, production, defense,
// special). Only the NEW, non-overlapping dimensions are wired into live
// gameplay here; see README/HANDOFF for what is mirrored vs. live.
// ─────────────────────────────────────────────────────────────────────────

export type FactionId = 'red' | 'blue' | 'green' | 'yellow';
export type UnitKind = 'infantry' | 'vehicle' | 'general';
export type EntityKind = 'infantry' | 'vehicle' | 'building';
export type WeaponKind = 'ballistic' | 'energy' | 'explosive' | 'vehicle' | 'infantry' | 'general';
export type PowerEffectType = 'production' | 'turret' | 'shield' | 'repair' | 'weapon' | 'colonyAura';

export interface FactionEconomyModifiers {
  resourceGatherRate: number;
  resourceEfficiency: number;
  resourceConsumption: number;
  unitCost: number;
  infantryCost: number;
  vehicleCost: number;
  buildingCost: number;
  techCost: number;
  upkeepPressure?: number;
  storageMultiplier?: number;
}

export interface FactionPowerModifiers {
  powerUsage: number;
  powerGeneration?: number;
  powerOutageSeverity: number;
  powerGridVulnerability: number;
  lowPowerProductionPenalty: number;
  lowPowerDefensePenalty: number;
  lowPowerRepairPenalty: number;
  lowPowerWeaponPenalty: number;
}

export interface FactionCombatModifiers {
  infantryDamage: number;
  vehicleDamage: number;
  energyWeaponDamage: number;
  buildingDamage?: number;
  unitSpeed: number;
  unitHull: number;
  vehicleHull: number;
  infantryHull: number;
}

export interface FactionDefenseModifiers {
  buildingHull: number;
  turretDurability: number;
  turretRangeBonus: number;
  turretTurnSpeed: number;
  staticDefensePower: number;
  shieldStrength?: number;
}

export interface FactionProductionModifiers {
  /** Build-time MULTIPLIER for foundations/units — higher = SLOWER (mirrors the
   *  legacy factions.json `buildTime`). effectiveDuration = baseDuration × this. */
  buildTimeMultiplier: number;
  unitProductionSpeed: number;
  vehicleProductionSpeed: number;
  infantryProductionSpeed: number;
  techUnlockSpeed: number;
}

export interface FactionRepairModifiers {
  repairRate: number;
  autoRepairEfficiency?: number;
  shieldRegenRate?: number;
}

export interface FactionSpecialModifiers {
  colonyAuraEnabled?: boolean;
  colonyAuraStrength?: number;
  replacementBias?: number;
  biologicalResilience?: number;
  shieldNetworkEfficiency?: number;
}

export interface FactionModifiers {
  economy: FactionEconomyModifiers;
  power: FactionPowerModifiers;
  combat: FactionCombatModifiers;
  defense: FactionDefenseModifiers;
  production: FactionProductionModifiers;
  repair: FactionRepairModifiers;
  special?: FactionSpecialModifiers;
}

// ── Initial, moderate values (noticeable but not extreme) ────────────────────
export const FACTION_MODIFIERS: Record<FactionId, FactionModifiers> = {
  // Crimson Pact — balanced military reference (values near 1.0).
  red: {
    economy: { resourceGatherRate: 1.0, resourceEfficiency: 1.0, resourceConsumption: 1.0, unitCost: 1.0, infantryCost: 1.0, vehicleCost: 1.1, buildingCost: 1.0, techCost: 1.0, upkeepPressure: 1.0 },
    power: { powerUsage: 1.0, powerGeneration: 1.0, powerOutageSeverity: 1.0, powerGridVulnerability: 1.0, lowPowerProductionPenalty: 0.85, lowPowerDefensePenalty: 0.85, lowPowerRepairPenalty: 0.85, lowPowerWeaponPenalty: 0.9 },
    combat: { infantryDamage: 1.0, vehicleDamage: 1.15, energyWeaponDamage: 1.0, unitSpeed: 1.0, unitHull: 1.0, vehicleHull: 1.0, infantryHull: 1.0 },
    defense: { buildingHull: 1.0, turretDurability: 1.0, turretRangeBonus: 0, turretTurnSpeed: 1.0, staticDefensePower: 1.0 },
    production: { buildTimeMultiplier: 1.0, unitProductionSpeed: 1.0, vehicleProductionSpeed: 1.0, infantryProductionSpeed: 1.0, techUnlockSpeed: 1.0 },
    repair: { repairRate: 1.1, autoRepairEfficiency: 1.0 },
  },
  // Azure Concorde — shielded control: slower, durable, defensive.
  // NOTE (Phase 4a migration): cost/powerUsage MIRROR the live legacy values
  // (factions.json has no blue cost/powerUse perk → all 1.0). The previously
  // aspirational 1.05/1.1 numbers were never live; setting them to 1.0 keeps the
  // game identical. Re-introducing a blue economy identity is a future balance
  // decision (now editable via F8), not part of this no-balance-change migration.
  blue: {
    economy: { resourceGatherRate: 0.95, resourceEfficiency: 1.1, resourceConsumption: 0.95, unitCost: 1.0, infantryCost: 1.0, vehicleCost: 1.0, buildingCost: 1.0, techCost: 1.05, upkeepPressure: 0.95 },
    power: { powerUsage: 1.0, powerGeneration: 1.0, powerOutageSeverity: 1.15, powerGridVulnerability: 1.1, lowPowerProductionPenalty: 0.8, lowPowerDefensePenalty: 0.72, lowPowerRepairPenalty: 0.65, lowPowerWeaponPenalty: 0.85 },
    // NOTE (Phase 4b.1): energyWeaponDamage mirrors the live legacy value (blue
    // has no energyDamage perk → 1.0). The 1.05 was aspirational/never-live.
    combat: { infantryDamage: 0.98, vehicleDamage: 1.0, energyWeaponDamage: 1.0, unitSpeed: 0.95, unitHull: 1.12, vehicleHull: 1.12, infantryHull: 1.08 },
    defense: { buildingHull: 1.15, turretDurability: 1.2, turretRangeBonus: 0, turretTurnSpeed: 0.9, staticDefensePower: 1.15, shieldStrength: 1.2 },
    production: { buildTimeMultiplier: 1.12, unitProductionSpeed: 0.92, vehicleProductionSpeed: 0.92, infantryProductionSpeed: 0.95, techUnlockSpeed: 0.95 },
    repair: { repairRate: 1.15, autoRepairEfficiency: 1.1, shieldRegenRate: 1.2 },
    special: { shieldNetworkEfficiency: 1.15 },
  },
  // Verdant Swarm — swarm consumption: fast, cheap, hungry, less power-dependent.
  // NOTE (Phase 4a migration): only infantryCost (0.85) is a live legacy perk.
  // unitCost/vehicleCost/buildingCost/powerUsage are mirrored to their live 1.0
  // values (factions.json has no green vehicleCost/powerUse) — no balance change.
  green: {
    economy: { resourceGatherRate: 1.05, resourceEfficiency: 0.92, resourceConsumption: 1.18, unitCost: 1.0, infantryCost: 0.85, vehicleCost: 1.0, buildingCost: 1.0, techCost: 1.0, upkeepPressure: 1.15 },
    power: { powerUsage: 1.0, powerGeneration: 1.0, powerOutageSeverity: 0.45, powerGridVulnerability: 0.5, lowPowerProductionPenalty: 0.92, lowPowerDefensePenalty: 0.9, lowPowerRepairPenalty: 0.95, lowPowerWeaponPenalty: 0.95 },
    // NOTE (Phase 4b.1): vehicleDamage + energyWeaponDamage mirror live legacy
    // (green has neither perk → 1.0). The 0.98/0.95 were aspirational/never-live.
    combat: { infantryDamage: 1.0, vehicleDamage: 1.0, energyWeaponDamage: 1.0, unitSpeed: 1.15, unitHull: 0.95, vehicleHull: 0.95, infantryHull: 0.92 },
    defense: { buildingHull: 0.9, turretDurability: 0.85, turretRangeBonus: 0, turretTurnSpeed: 1.05, staticDefensePower: 0.8 },
    production: { buildTimeMultiplier: 1.0, unitProductionSpeed: 1.25, vehicleProductionSpeed: 1.12, infantryProductionSpeed: 1.3, techUnlockSpeed: 0.9 },
    repair: { repairRate: 0.75, autoRepairEfficiency: 0.8 },
    special: { replacementBias: 1.25, biologicalResilience: 1.1 },
  },
  // Solar Dominion — radiant colony: power-intensive, zone control, late-game.
  // NOTE (Phase 4a migration): only powerUsage (1.25) is a live legacy perk.
  // Cost modifiers mirror their live 1.0 values (factions.json has no solar cost
  // perk) — no balance change.
  yellow: {
    economy: { resourceGatherRate: 0.95, resourceEfficiency: 0.98, resourceConsumption: 1.05, unitCost: 1.0, infantryCost: 1.0, vehicleCost: 1.0, buildingCost: 1.0, techCost: 1.1, upkeepPressure: 1.05 },
    power: { powerUsage: 1.25, powerGeneration: 1.0, powerOutageSeverity: 1.35, powerGridVulnerability: 1.35, lowPowerProductionPenalty: 0.65, lowPowerDefensePenalty: 0.55, lowPowerRepairPenalty: 0.65, lowPowerWeaponPenalty: 0.5 },
    combat: { infantryDamage: 0.98, vehicleDamage: 1.0, energyWeaponDamage: 1.2, unitSpeed: 0.98, unitHull: 1.0, vehicleHull: 1.0, infantryHull: 1.0 },
    defense: { buildingHull: 1.05, turretDurability: 1.05, turretRangeBonus: 1, turretTurnSpeed: 0.95, staticDefensePower: 1.1 },
    production: { buildTimeMultiplier: 1.0, unitProductionSpeed: 0.95, vehicleProductionSpeed: 0.95, infantryProductionSpeed: 0.95, techUnlockSpeed: 1.05 },
    repair: { repairRate: 0.95, autoRepairEfficiency: 1.0 },
    special: { colonyAuraEnabled: true, colonyAuraStrength: 1.15 },
  },
};

// ── Admin-tuning hook: layer override values on top (Phase 3 F8 panel) ───────
let _overrides: Partial<Record<FactionId, Partial<FactionModifiers>>> = {};
/** Apply (or clear with {}) admin override modifiers — deep-merged at read time. */
export function setFactionModifierOverrides(o: Partial<Record<FactionId, Partial<FactionModifiers>>>) { _overrides = o || {}; }

function deepMerge<T>(base: T, over: Partial<T> | undefined): T {
  if (!over) return base;
  const out: any = Array.isArray(base) ? [...(base as any)] : { ...base };
  for (const k of Object.keys(over)) {
    const ov = (over as any)[k];
    out[k] = ov && typeof ov === 'object' && !Array.isArray(ov) ? deepMerge((base as any)[k] ?? {}, ov) : ov;
  }
  return out;
}

// ── Central getters ──────────────────────────────────────────────────────────
export function getFactionModifiers(factionId: FactionId): FactionModifiers {
  return deepMerge(FACTION_MODIFIERS[factionId] ?? FACTION_MODIFIERS.red, _overrides[factionId]);
}
export function getEconomyModifiers(factionId: FactionId): FactionEconomyModifiers { return getFactionModifiers(factionId).economy; }
export function getPowerModifiers(factionId: FactionId): FactionPowerModifiers { return getFactionModifiers(factionId).power; }
export function getCombatModifiers(factionId: FactionId): FactionCombatModifiers { return getFactionModifiers(factionId).combat; }
export function getDefenseModifiers(factionId: FactionId): FactionDefenseModifiers { return getFactionModifiers(factionId).defense; }

// ── Gameplay modifier functions (use everywhere instead of scattered maths) ──
export function getModifiedUnitCost(baseCost: number, factionId: FactionId, unitKind: UnitKind = 'general'): number {
  const e = getEconomyModifiers(factionId);
  const kindMul = unitKind === 'infantry' ? e.infantryCost : unitKind === 'vehicle' ? e.vehicleCost : 1;
  // 5-credit granularity — identical to the legacy resolveUnit rounding so the
  // Phase 4a cost migration does not shift any unit price.
  return Math.round(baseCost * e.unitCost * kindMul / 5) * 5;
}
export function getModifiedBuildingCost(baseCost: number, factionId: FactionId): number {
  return Math.round(baseCost * getEconomyModifiers(factionId).buildingCost);
}
export function getModifiedTechCost(baseCost: number, factionId: FactionId): number {
  return Math.round(baseCost * getEconomyModifiers(factionId).techCost);
}
export function getModifiedBuildDuration(baseDuration: number, factionId: FactionId): number {
  return baseDuration * getFactionModifiers(factionId).production.buildTimeMultiplier; // higher = slower (mirrors legacy buildTime)
}
export function getModifiedProductionDuration(baseDuration: number, factionId: FactionId, unitKind: UnitKind = 'general'): number {
  const p = getFactionModifiers(factionId).production;
  const speed = unitKind === 'infantry' ? p.infantryProductionSpeed : unitKind === 'vehicle' ? p.vehicleProductionSpeed : p.unitProductionSpeed;
  return baseDuration / speed;
}
export function getModifiedPowerUsage(basePowerUsage: number, factionId: FactionId): number {
  return basePowerUsage * getPowerModifiers(factionId).powerUsage;
}
export function getModifiedPowerGeneration(basePowerGeneration: number, factionId: FactionId): number {
  return basePowerGeneration * (getPowerModifiers(factionId).powerGeneration ?? 1);
}
export function getModifiedHull(baseHull: number, factionId: FactionId, entityKind: EntityKind): number {
  const c = getFactionModifiers(factionId).combat;
  const d = getFactionModifiers(factionId).defense;
  const mul = entityKind === 'building' ? d.buildingHull
    : entityKind === 'vehicle' ? c.unitHull * c.vehicleHull
    : c.unitHull * c.infantryHull;
  return Math.round(baseHull * mul);
}
export function getModifiedDamage(baseDamage: number, factionId: FactionId, weaponKind: WeaponKind = 'general'): number {
  const c = getFactionModifiers(factionId).combat;
  const mul = weaponKind === 'energy' ? c.energyWeaponDamage
    : weaponKind === 'vehicle' ? c.vehicleDamage
    : weaponKind === 'infantry' ? c.infantryDamage : 1;
  return Math.round(baseDamage * mul);
}
export function getModifiedUnitSpeed(baseSpeed: number, factionId: FactionId): number {
  return baseSpeed * getFactionModifiers(factionId).combat.unitSpeed;
}
export function getModifiedTurretRange(baseRange: number, factionId: FactionId): number {
  return baseRange + getFactionModifiers(factionId).defense.turretRangeBonus;
}
export function getModifiedRepairRate(baseRepair: number, factionId: FactionId): number {
  return baseRepair * getFactionModifiers(factionId).repair.repairRate;
}
/** Prepared (no live upkeep system yet): scaled consumption/upkeep for utilities. */
export function getModifiedUpkeep(baseUpkeep: number, factionId: FactionId): number {
  const e = getEconomyModifiers(factionId);
  return baseUpkeep * e.resourceConsumption * (e.upkeepPressure ?? 1);
}

// ── Power state ──────────────────────────────────────────────────────────────
export interface PowerState { powerProduced: number; powerUsed: number; }

/** powerRatio = availablePower / requiredPower. No consumers ⇒ 1 (no penalty). */
export function getPowerRatio(state: PowerState): number {
  return state.powerUsed <= 0 ? 1 : state.powerProduced / state.powerUsed;
}
export function isLowPower(state: PowerState): boolean {
  return getPowerRatio(state) < 1 - 1e-9;
}

export interface PowerOutageEffects {
  factionId: FactionId;
  powerRatio: number;
  severity: number;                    // 0 (fine) .. ~1 (fully out, scaled by faction)
  productionSpeedMultiplier: number;
  turretEfficiencyMultiplier: number;
  shieldEfficiencyMultiplier: number;
  repairEfficiencyMultiplier: number;
  weaponEfficiencyMultiplier: number;
  colonyAuraMultiplier: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * Faction-specific consequences of a power deficit. At ratio>=1 there is no
 * penalty. Below 1, the deficit is scaled by the faction's powerOutageSeverity
 * and interpolated toward each per-faction low-power penalty floor — so Solar
 * collapses while Verdant barely notices.
 */
export function getPowerOutageEffects(factionId: FactionId, powerRatio: number): PowerOutageEffects {
  const p = getPowerModifiers(factionId);
  const none: PowerOutageEffects = {
    factionId, powerRatio, severity: 0,
    productionSpeedMultiplier: 1, turretEfficiencyMultiplier: 1, shieldEfficiencyMultiplier: 1,
    repairEfficiencyMultiplier: 1, weaponEfficiencyMultiplier: 1, colonyAuraMultiplier: 1,
  };
  if (powerRatio >= 1) return none;
  const effDeficit = clamp01((1 - clamp01(powerRatio)) * p.powerOutageSeverity);
  const toward = (floor: number) => 1 - effDeficit * (1 - floor);
  return {
    factionId, powerRatio, severity: effDeficit,
    productionSpeedMultiplier: toward(p.lowPowerProductionPenalty),
    turretEfficiencyMultiplier: toward(p.lowPowerDefensePenalty),
    shieldEfficiencyMultiplier: toward(p.lowPowerDefensePenalty),
    repairEfficiencyMultiplier: toward(p.lowPowerRepairPenalty),
    weaponEfficiencyMultiplier: toward(p.lowPowerWeaponPenalty),
    colonyAuraMultiplier: clamp01(1 - effDeficit), // aura fades fast under outage
  };
}

/** Apply the relevant power-outage multiplier to a value for a given effect. */
export function applyPowerStateModifier(value: number, factionId: FactionId, powerRatio: number, effectType: PowerEffectType): number {
  const e = getPowerOutageEffects(factionId, powerRatio);
  const m = effectType === 'production' ? e.productionSpeedMultiplier
    : effectType === 'turret' ? e.turretEfficiencyMultiplier
    : effectType === 'shield' ? e.shieldEfficiencyMultiplier
    : effectType === 'repair' ? e.repairEfficiencyMultiplier
    : effectType === 'weapon' ? e.weaponEfficiencyMultiplier
    : e.colonyAuraMultiplier;
  return value * m;
}

// ── Colony aura (Solar) — prepared utility + TODO hook ───────────────────────
export interface ColonyAuraResult { enabled: boolean; strength: number; }
/**
 * Colony aura strength for a faction at a given power ratio. Solar only; fades
 * with power. NOTE: not yet applied to live entities — TODO: have Solar energy
 * structures emit this aura and buff nearby buildings/units (Phase 3).
 */
export function getColonyAura(factionId: FactionId, powerRatio = 1): ColonyAuraResult {
  const s = getFactionModifiers(factionId).special;
  if (!s?.colonyAuraEnabled) return { enabled: false, strength: 0 };
  const base = s.colonyAuraStrength ?? 1;
  return { enabled: true, strength: base * getPowerOutageEffects(factionId, powerRatio).colonyAuraMultiplier };
}

// ── Balancing power score (orientation/warning tool only — no gameplay effect) ─
export interface FactionPowerScore {
  factionId: FactionId;
  earlyGamePower: number;
  midGamePower: number;
  lateGamePower: number;
  economyPower: number;
  attackPower: number;
  defensePower: number;
  techPower: number;
  resourcePenalty: number;
  energyPenalty: number;
  vulnerabilityPenalty: number;
  overallPowerScore: number;
  warnings: string[];
}

// ── Runtime-status metadata (Admin-readiness) ────────────────────────────────
// Honest map of WHERE each modifier actually takes effect today, so the future
// F8 admin panel only exposes editable sliders for values that genuinely wire
// through this registry (and would respond to setFactionModifierOverrides).
export type ModifierRuntimeStatus =
  | 'live'           // runtime-effective via FACTION_MODIFIERS (override-responsive)
  | 'prepared'       // in the registry but not yet applied anywhere
  | 'legacy_backed'  // dimension IS live, but via factions.json/unitStats/buildingStats — editing the registry does nothing yet
  | 'admin_ready'    // live + intended as a primary admin slider
  | 'read_only';     // displayed only, never editable

export interface ModifierRuntimeMetadata {
  path: string;
  status: ModifierRuntimeStatus;
  description: string;
  runtimeSource: 'FACTION_MODIFIERS' | 'factions.json' | 'unitStats' | 'buildingStats' | 'mixed' | 'not_yet_integrated';
  adminEditable: boolean;
  migrationNeeded?: boolean;
  /** True when a value is intentionally left legacy-backed this phase (risk-managed). */
  migrationDeferred?: boolean;
}

/**
 * Status of the modifier paths the admin panel cares about. Only the LIVE rows
 * change gameplay through this registry today (world.ts reads them every frame
 * via getPowerOutageEffects / getEconomyModifiers / getModifiedRepairRate, so an
 * override takes effect immediately). Legacy-backed rows are live in-game but
 * computed from the old factions.json path — editing the registry is a no-op
 * until migrated. Prepared rows have no effect at all yet.
 */
export const MODIFIER_RUNTIME_METADATA: ModifierRuntimeMetadata[] = [
  // ---- LIVE via FACTION_MODIFIERS (admin-editable) ----
  { path: 'power.powerOutageSeverity', status: 'live', runtimeSource: 'FACTION_MODIFIERS', adminEditable: true, description: 'Skaliert die Schärfe aller Strommangel-Strafen (Produktion/Turm/Reparatur).' },
  { path: 'power.lowPowerProductionPenalty', status: 'live', runtimeSource: 'FACTION_MODIFIERS', adminEditable: true, description: 'Produktions-Tempo der Queue bei vollem Stromausfall.' },
  { path: 'power.lowPowerDefensePenalty', status: 'live', runtimeSource: 'FACTION_MODIFIERS', adminEditable: true, description: 'Turm-Effizienz/Offline-Schwelle bei Stromausfall.' },
  { path: 'power.lowPowerRepairPenalty', status: 'live', runtimeSource: 'FACTION_MODIFIERS', adminEditable: true, description: 'Reparatur-Tempo bei Stromausfall.' },
  { path: 'economy.resourceGatherRate', status: 'live', runtimeSource: 'FACTION_MODIFIERS', adminEditable: true, description: 'Erz-Ertrag pro Harvester-Abladung.' },
  { path: 'repair.repairRate', status: 'live', runtimeSource: 'FACTION_MODIFIERS', adminEditable: true, description: 'Reparatur-Tempo der Fabricator an Gebäuden.' },

  // ---- MIGRATED in Phase 4a → now LIVE via FACTION_MODIFIERS (admin-editable) ----
  { path: 'economy.unitCost', status: 'live', runtimeSource: 'FACTION_MODIFIERS', adminEditable: true, migrationNeeded: false, description: 'Globaler Einheiten-Kostenfaktor (×kind). Migriert: resolveUnit liest getModifiedUnitCost.' },
  { path: 'economy.infantryCost', status: 'live', runtimeSource: 'FACTION_MODIFIERS', adminEditable: true, migrationNeeded: false, description: 'Infanterie-Kostenfaktor. Migriert: resolveUnit liest getModifiedUnitCost (spiegelt factions.json).' },
  { path: 'economy.vehicleCost', status: 'live', runtimeSource: 'FACTION_MODIFIERS', adminEditable: true, migrationNeeded: false, description: 'Fahrzeug-Kostenfaktor. Migriert: resolveUnit liest getModifiedUnitCost (spiegelt factions.json).' },
  { path: 'economy.buildingCost', status: 'live', runtimeSource: 'FACTION_MODIFIERS', adminEditable: true, migrationNeeded: false, description: 'Gebäude-Kostenfaktor. Migriert: buildingStats liest getModifiedBuildingCost.' },
  { path: 'power.powerUsage', status: 'live', runtimeSource: 'FACTION_MODIFIERS', adminEditable: true, migrationNeeded: false, description: 'Gebäude-Stromverbrauch. Migriert: buildingStats liest getModifiedPowerUsage (spiegelt factions.json powerUse).' },
  { path: 'production.buildTimeMultiplier', status: 'live', runtimeSource: 'FACTION_MODIFIERS', adminEditable: true, migrationNeeded: false, description: 'Bauzeit-MULTIPLIKATOR (höher = langsamer). Migriert (4a.2): resolveUnit + buildingStats lesen getModifiedBuildDuration = baseDuration × multiplier (spiegelt factions.json buildTime, keine Inversion).' },

  // ---- MIGRATED in Phase 4b.1 → now LIVE via FACTION_MODIFIERS (admin-editable) ----
  { path: 'combat.vehicleDamage', status: 'live', runtimeSource: 'FACTION_MODIFIERS', adminEditable: true, migrationNeeded: false, description: 'Fahrzeug-Waffenschaden ×. Migriert: resolveUnit liest getCombatModifiers (spiegelt factions.json vehicleDamage).' },
  { path: 'combat.energyWeaponDamage', status: 'live', runtimeSource: 'FACTION_MODIFIERS', adminEditable: true, migrationNeeded: false, description: 'Energiewaffen-Schaden ×. Migriert: resolveUnit (Units) + buildingStats (Türme) lesen getCombatModifiers/getModifiedDamage (spiegelt factions.json energyDamage).' },
  { path: 'defense.turretRangeBonus', status: 'live', runtimeSource: 'FACTION_MODIFIERS', adminEditable: true, migrationNeeded: false, description: 'ADDITIVER Turm-Reichweiten-Bonus (range + bonus). Migriert: buildingStats liest getModifiedTurretRange (spiegelt factions.json turretRange).' },

  // ---- LEGACY-BACKED (live in-game, but via the old path → migration needed) ----
  { path: 'combat.unitHull', status: 'legacy_backed', runtimeSource: 'unitStats', adminEditable: false, migrationNeeded: true, description: 'Aktiv via factions.json (hp/unitHp) in unitStats.' },
  { path: 'combat.unitSpeed', status: 'legacy_backed', runtimeSource: 'unitStats', adminEditable: false, migrationNeeded: true, description: 'Aktiv via factions.json (infantrySpeed) in unitStats — Scope: nur Infanterie.' },

  // ---- PREPARED only (no effect yet) ----
  { path: 'special.colonyAuraEnabled', status: 'prepared', runtimeSource: 'not_yet_integrated', adminEditable: false, description: 'Colony-Aura-Flag; getColonyAura vorbereitet, nicht auf Entities angewandt.' },
  { path: 'special.colonyAuraStrength', status: 'prepared', runtimeSource: 'not_yet_integrated', adminEditable: false, description: 'Colony-Aura-Stärke; TODO Vollintegration.' },
  { path: 'economy.upkeepPressure', status: 'prepared', runtimeSource: 'not_yet_integrated', adminEditable: false, description: 'Upkeep-Druck; getModifiedUpkeep-Utility, kein Live-Upkeep-System.' },
  { path: 'economy.resourceConsumption', status: 'prepared', runtimeSource: 'not_yet_integrated', adminEditable: false, description: 'Laufender Verbrauch; vorbereitet, nicht live.' },
  { path: 'power.lowPowerWeaponPenalty', status: 'prepared', runtimeSource: 'not_yet_integrated', adminEditable: false, description: 'Waffen-Effizienz bei Stromausfall berechnet, aber nicht auf Einheiten-Waffen angewandt.' },
  { path: 'power.powerGridVulnerability', status: 'prepared', runtimeSource: 'not_yet_integrated', adminEditable: false, description: 'Nur im Power-Score, keine Gameplay-Wirkung.' },
  { path: 'production.unitProductionSpeed', status: 'prepared', runtimeSource: 'not_yet_integrated', adminEditable: false, description: 'Granulares Produktions-Tempo; Queue nutzt buildTime (legacy).' },
  { path: 'defense.turretDurability', status: 'prepared', runtimeSource: 'not_yet_integrated', adminEditable: false, description: 'Turm-Haltbarkeit; nicht im Kampf angewandt.' },
  { path: 'defense.shieldStrength', status: 'prepared', runtimeSource: 'not_yet_integrated', adminEditable: false, description: 'Schild-Stärke; kein Schild-System live.' },
  { path: 'repair.shieldRegenRate', status: 'prepared', runtimeSource: 'not_yet_integrated', adminEditable: false, description: 'Schild-Regeneration; kein Schild-System live.' },
];

/** Paths the F8 admin panel may expose as EDITABLE live sliders. */
export function getAdminEditableFactionModifierPaths(): ModifierRuntimeMetadata[] {
  return MODIFIER_RUNTIME_METADATA.filter((m) => m.adminEditable);
}
/** Registry values prepared but not yet wired into gameplay (display-only). */
export function getPreparedButNotLiveModifierPaths(): ModifierRuntimeMetadata[] {
  return MODIFIER_RUNTIME_METADATA.filter((m) => m.status === 'prepared');
}
/** Dimensions that ARE live in-game but via the legacy path (need migration before editing here helps). */
export function getLegacyBackedModifierPaths(): ModifierRuntimeMetadata[] {
  return MODIFIER_RUNTIME_METADATA.filter((m) => m.status === 'legacy_backed');
}
/** Look up the runtime metadata for a single modifier path. */
export function getModifierMetadata(path: string): ModifierRuntimeMetadata | undefined {
  return MODIFIER_RUNTIME_METADATA.find((m) => m.path === path);
}

const avg = (...xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

/** Rough heuristic score (reference ≈ 1.0). Warns if a faction drifts far. */
export function calculateFactionPowerScore(factionId: FactionId): FactionPowerScore {
  const m = getFactionModifiers(factionId);
  const cheapness = 2 - avg(m.economy.unitCost, m.economy.infantryCost, m.economy.vehicleCost);
  const economyPower = avg(m.economy.resourceGatherRate, m.economy.resourceEfficiency, cheapness);
  const attackPower = avg(m.combat.infantryDamage, m.combat.vehicleDamage, m.combat.energyWeaponDamage, m.combat.unitSpeed);
  const defensePower = avg(m.defense.buildingHull, m.defense.turretDurability, m.defense.staticDefensePower, m.combat.unitHull, m.defense.shieldStrength ?? 1);
  const techPower = avg(m.production.techUnlockSpeed, m.combat.energyWeaponDamage, (m.special?.colonyAuraStrength ?? 1));
  const earlyGamePower = avg(m.production.unitProductionSpeed, m.production.infantryProductionSpeed, cheapness);
  const midGamePower = avg(attackPower, defensePower, economyPower);
  const lateGamePower = avg(techPower, defensePower, m.combat.energyWeaponDamage);

  const resourcePenalty = Math.max(0, (m.economy.resourceConsumption - 1)) + Math.max(0, (m.economy.upkeepPressure ?? 1) - 1);
  const energyPenalty = Math.max(0, m.power.powerUsage - 1) * 0.5 + Math.max(0, m.power.powerOutageSeverity - 1) * 0.4;
  const vulnerabilityPenalty = Math.max(0, m.power.powerGridVulnerability - 1) * 0.5;

  const overallPowerScore =
    earlyGamePower * 0.18 + midGamePower * 0.22 + lateGamePower * 0.18 +
    economyPower * 0.16 + attackPower * 0.14 + defensePower * 0.12
    - resourcePenalty * 0.3 - energyPenalty * 0.3 - vulnerabilityPenalty * 0.2;

  const warnings: string[] = [];
  if (overallPowerScore > 1.12) warnings.push(`${factionId}: möglicherweise zu stark (Score ${overallPowerScore.toFixed(2)})`);
  if (overallPowerScore < 0.82) warnings.push(`${factionId}: möglicherweise zu schwach (Score ${overallPowerScore.toFixed(2)})`);

  return {
    factionId, earlyGamePower, midGamePower, lateGamePower, economyPower, attackPower, defensePower, techPower,
    resourcePenalty, energyPenalty, vulnerabilityPenalty, overallPowerScore, warnings,
  };
}
