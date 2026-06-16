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
  buildSpeed: number;
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
    production: { buildSpeed: 1.0, unitProductionSpeed: 1.0, vehicleProductionSpeed: 1.0, infantryProductionSpeed: 1.0, techUnlockSpeed: 1.0 },
    repair: { repairRate: 1.1, autoRepairEfficiency: 1.0 },
  },
  // Azure Concorde — shielded control: slower, durable, defensive.
  blue: {
    economy: { resourceGatherRate: 0.95, resourceEfficiency: 1.1, resourceConsumption: 0.95, unitCost: 1.05, infantryCost: 1.05, vehicleCost: 1.05, buildingCost: 1.05, techCost: 1.05, upkeepPressure: 0.95 },
    power: { powerUsage: 1.1, powerGeneration: 1.0, powerOutageSeverity: 1.15, powerGridVulnerability: 1.1, lowPowerProductionPenalty: 0.8, lowPowerDefensePenalty: 0.72, lowPowerRepairPenalty: 0.65, lowPowerWeaponPenalty: 0.85 },
    combat: { infantryDamage: 0.98, vehicleDamage: 1.0, energyWeaponDamage: 1.05, unitSpeed: 0.95, unitHull: 1.12, vehicleHull: 1.12, infantryHull: 1.08 },
    defense: { buildingHull: 1.15, turretDurability: 1.2, turretRangeBonus: 0, turretTurnSpeed: 0.9, staticDefensePower: 1.15, shieldStrength: 1.2 },
    production: { buildSpeed: 0.88, unitProductionSpeed: 0.92, vehicleProductionSpeed: 0.92, infantryProductionSpeed: 0.95, techUnlockSpeed: 0.95 },
    repair: { repairRate: 1.15, autoRepairEfficiency: 1.1, shieldRegenRate: 1.2 },
    special: { shieldNetworkEfficiency: 1.15 },
  },
  // Verdant Swarm — swarm consumption: fast, cheap, hungry, less power-dependent.
  green: {
    economy: { resourceGatherRate: 1.05, resourceEfficiency: 0.92, resourceConsumption: 1.18, unitCost: 0.9, infantryCost: 0.85, vehicleCost: 0.95, buildingCost: 0.95, techCost: 1.0, upkeepPressure: 1.15 },
    power: { powerUsage: 0.75, powerGeneration: 1.0, powerOutageSeverity: 0.45, powerGridVulnerability: 0.5, lowPowerProductionPenalty: 0.92, lowPowerDefensePenalty: 0.9, lowPowerRepairPenalty: 0.95, lowPowerWeaponPenalty: 0.95 },
    combat: { infantryDamage: 1.0, vehicleDamage: 0.98, energyWeaponDamage: 0.95, unitSpeed: 1.15, unitHull: 0.95, vehicleHull: 0.95, infantryHull: 0.92 },
    defense: { buildingHull: 0.9, turretDurability: 0.85, turretRangeBonus: 0, turretTurnSpeed: 1.05, staticDefensePower: 0.8 },
    production: { buildSpeed: 1.2, unitProductionSpeed: 1.25, vehicleProductionSpeed: 1.12, infantryProductionSpeed: 1.3, techUnlockSpeed: 0.9 },
    repair: { repairRate: 0.75, autoRepairEfficiency: 0.8 },
    special: { replacementBias: 1.25, biologicalResilience: 1.1 },
  },
  // Solar Dominion — radiant colony: power-intensive, zone control, late-game.
  yellow: {
    economy: { resourceGatherRate: 0.95, resourceEfficiency: 0.98, resourceConsumption: 1.05, unitCost: 1.05, infantryCost: 1.05, vehicleCost: 1.05, buildingCost: 1.05, techCost: 1.1, upkeepPressure: 1.05 },
    power: { powerUsage: 1.25, powerGeneration: 1.0, powerOutageSeverity: 1.35, powerGridVulnerability: 1.35, lowPowerProductionPenalty: 0.65, lowPowerDefensePenalty: 0.55, lowPowerRepairPenalty: 0.65, lowPowerWeaponPenalty: 0.5 },
    combat: { infantryDamage: 0.98, vehicleDamage: 1.0, energyWeaponDamage: 1.2, unitSpeed: 0.98, unitHull: 1.0, vehicleHull: 1.0, infantryHull: 1.0 },
    defense: { buildingHull: 1.05, turretDurability: 1.05, turretRangeBonus: 1, turretTurnSpeed: 0.95, staticDefensePower: 1.1 },
    production: { buildSpeed: 0.95, unitProductionSpeed: 0.95, vehicleProductionSpeed: 0.95, infantryProductionSpeed: 0.95, techUnlockSpeed: 1.05 },
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

// ── Gameplay modifier functions (use everywhere instead of scattered maths) ──
export function getModifiedUnitCost(baseCost: number, factionId: FactionId, unitKind: UnitKind = 'general'): number {
  const e = getEconomyModifiers(factionId);
  const kindMul = unitKind === 'infantry' ? e.infantryCost : unitKind === 'vehicle' ? e.vehicleCost : 1;
  return Math.round(baseCost * e.unitCost * kindMul);
}
export function getModifiedBuildingCost(baseCost: number, factionId: FactionId): number {
  return Math.round(baseCost * getEconomyModifiers(factionId).buildingCost);
}
export function getModifiedTechCost(baseCost: number, factionId: FactionId): number {
  return Math.round(baseCost * getEconomyModifiers(factionId).techCost);
}
export function getModifiedBuildDuration(baseDuration: number, factionId: FactionId): number {
  return baseDuration / getFactionModifiers(factionId).production.buildSpeed; // >1 buildSpeed = faster
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
