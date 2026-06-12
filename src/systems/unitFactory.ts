// Unit factory — resolves (classId | legacy id, faction) into the flat UnitDef
// the simulation consumes. Resolution order:
//
//   class template  (single balance source, equal across factions)
//   + faction variant      (visual identity + audited balanceOverrides)
//   + faction perk modifiers (factions.json — explicit, intentional)
//   = resolved UnitDef     (legacy-compatible: world.ts reads def.* unchanged)
//
// Legacy ids from campaign JSONs/saves keep working via LEGACY_ALIASES.

import type { FactionDef, UnitDef, WeaponDef } from '../core/types';
import { UNIT_CLASS_TEMPLATES, type UnitClassTemplate } from '../data/unitClasses';
import { WEAPONS, toLegacyWeapon } from '../data/weapons';
import { getVariant } from '../vehicles';
import type { VehicleVariant } from '../vehicles/types';

/** Old units.json ids → new class template ids (campaign compat). */
export const LEGACY_ALIASES: Record<string, string> = {
  fabricator: 'builder',
  dartcycle: 'scout',
  vanguard: 'mediumTank',
  earthshaker: 'heavyTank',
};

export function classIdOf(defId: string): string {
  return LEGACY_ALIASES[defId] ?? defId;
}

function mod(f: FactionDef, key: string, fallback = 1): number {
  return f.modifiers[key] ?? fallback;
}

/** Template → legacy-shaped base def (faction-neutral, for HUD lists etc.). */
export function templateToDef(t: UnitClassTemplate): UnitDef {
  const spec = t.primaryWeapon ? WEAPONS[t.primaryWeapon] : null;
  const weapon: WeaponDef | null = spec ? toLegacyWeapon(spec) : null;
  return {
    id: t.id,
    name: t.displayName,
    class: t.unitClass,
    role: t.role,
    cost: t.cost,
    buildTime: t.buildTime,
    hp: t.maxHitPoints,
    armor: t.armorClass,
    speed: t.speed,
    vision: t.visionRange,
    radius: t.collisionRadius,
    builtAt: t.builtAt,
    weapon,
    builder: t.building ? true : undefined,
    repairs: t.building?.canRepair ? true : undefined,
    harvester: t.harvesting ? true : undefined,
    capacity: t.harvesting?.cargoCapacity,
    gatherTime: t.harvesting?.gatherTime,
    description: t.description,
    classId: t.id,
    techTier: t.techTier,
    autoAcquireRange: t.autoAcquireRange,
    canAutoAttack: t.canAutoAttack,
    defaultStance: t.defaultStance,
    pursuitRange: t.pursuitRange,
    maxAutonomousDistance: t.maxAutonomousDistanceFromBase,
    patrolRadius: t.patrolRadius,
    guardRadius: t.guardRadius,
    targetPriority: t.targetPriority,
    intelligenceLevel: t.intelligenceLevel,
    supportAura: t.support
      ? { repairRange: t.support.repairAuraRange, repairAmount: t.support.repairAmount }
      : undefined,
    buildRange: t.building?.buildRange,
    repairRate: t.building?.repairRate,
  };
}

/** Applies a variant's explicit, audited balance overrides. */
function applyOverrides(def: UnitDef, variant: VehicleVariant): UnitDef {
  if (!variant.balanceOverrides?.length) return def;
  const out: UnitDef = { ...def, weapon: def.weapon ? { ...def.weapon } : null };
  for (const o of variant.balanceOverrides) {
    if (o.field.startsWith('weapon.') && out.weapon) {
      (out.weapon as unknown as Record<string, number>)[o.field.slice(7)] = o.value;
    } else {
      (out as unknown as Record<string, number>)[o.field] = o.value;
    }
  }
  return out;
}

/**
 * Full resolution: template + variant + faction perks → sim-ready UnitDef.
 * Replaces the old defs.unitStats() — faction perk math is identical.
 */
export function resolveUnit(defId: string, faction: FactionDef): UnitDef {
  const classId = classIdOf(defId);
  const template = UNIT_CLASS_TEMPLATES[classId];
  if (!template) throw new Error(`Unknown unit class: ${defId}`);
  let def = templateToDef(template);

  // Faction visual variant (vehicles only; infantry shares models for now).
  const variant = getVariant(faction.id, classId);
  if (variant) {
    def = applyOverrides(def, variant);
    def.visual = {
      factoryId: `${faction.id}:${classId}`,
      movement: variant.movementType,
      textureSetId: variant.textureSetId,
      artMetadataId: variant.artMetadataId,
      silhouetteScale: variant.silhouetteScale,
      selectionRingSize: variant.selectionRingSize,
      previewCamera: variant.previewCamera,
    };
    if (variant.displayName) def.name = variant.displayName;
  } else if (template.unitClass === 'vehicle') {
    // Custom (studio-authored) class with no per-faction variant file: still give
    // it a factoryId so the renderer picks up its imported spec geometry.
    def.visual = {
      factoryId: `${faction.id}:${classId}`,
      movement: template.defaultMovementType,
      silhouetteScale: 1,
    };
  }
  def.factionId = faction.id;

  // Faction perk modifiers — identical math to the old unitStats().
  const isInf = def.class === 'infantry';
  const isVeh = def.class === 'vehicle';
  const hpMul = mod(faction, 'hp') * mod(faction, 'unitHp');
  const costMul = (isInf ? mod(faction, 'infantryCost') : 1) * (isVeh ? mod(faction, 'vehicleCost') : 1);
  const speedMul = isInf ? mod(faction, 'infantrySpeed') : 1;
  let weapon: WeaponDef | null = def.weapon;
  if (weapon) {
    let dmgMul = 1;
    if (isVeh) dmgMul *= mod(faction, 'vehicleDamage');
    if (weapon.damageType === 'energy') dmgMul *= mod(faction, 'energyDamage');
    weapon = { ...weapon, damage: Math.round(weapon.damage * dmgMul) };
  }
  return {
    ...def,
    hp: Math.round(def.hp * hpMul),
    cost: Math.round(def.cost * costMul / 5) * 5,
    speed: def.speed * speedMul,
    buildTime: def.buildTime * mod(faction, 'buildTime'),
    weapon,
  };
}
