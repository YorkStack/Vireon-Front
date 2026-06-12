// Loads data-driven definitions and applies faction modifiers.
//
// Units are no longer a JSON blob: they resolve through the layered system in
// src/data/unitClasses.ts (balance templates) + src/vehicles/* (faction visual
// variants) via src/systems/unitFactory.ts. UNIT_DEFS keeps its old shape
// (faction-neutral base defs) so HUD/AI code keeps working unchanged.
import buildingsJson from '../data/buildings.json';
import factionsJson from '../data/factions.json';
import type { UnitDef, BuildingDef, FactionDef } from './types';
import { UNIT_CLASS_TEMPLATES } from '../data/unitClasses';
import { templateToDef, resolveUnit } from '../systems/unitFactory';

export const UNIT_DEFS: Record<string, UnitDef> = {};
export const BUILDING_DEFS: Record<string, BuildingDef> = {};
export const FACTION_DEFS: Record<string, FactionDef> = {};

for (const t of Object.values(UNIT_CLASS_TEMPLATES)) UNIT_DEFS[t.id] = templateToDef(t);
for (const [id, d] of Object.entries(buildingsJson)) BUILDING_DEFS[id] = { id, ...(d as Omit<BuildingDef, 'id'>) };
for (const [id, d] of Object.entries(factionsJson)) FACTION_DEFS[id] = { id, ...(d as Omit<FactionDef, 'id'>) };

function mod(f: FactionDef, key: string, fallback = 1): number {
  return f.modifiers[key] ?? fallback;
}

/** Unit stats with faction variant + balance modifiers baked in. */
export function unitStats(defId: string, faction: FactionDef): UnitDef {
  return resolveUnit(defId, faction);
}

/** Building stats with the faction's balance modifiers baked in. */
export function buildingStats(defId: string, faction: FactionDef): BuildingDef {
  const base = BUILDING_DEFS[defId];
  let weapon = base.weapon;
  if (weapon) {
    let dmgMul = weapon.damageType === 'energy' ? mod(faction, 'energyDamage') : 1;
    weapon = {
      ...weapon,
      damage: Math.round(weapon.damage * dmgMul),
      range: weapon.range + (faction.modifiers['turretRange'] ?? 0),
    };
  }
  const power = base.power < 0 ? Math.round(base.power * mod(faction, 'powerUse')) : base.power;
  return {
    ...base,
    hp: Math.round(base.hp * mod(faction, 'hp')),
    buildTime: base.buildTime * mod(faction, 'buildTime'),
    power,
    weapon,
  };
}

/** Damage multiplier matrix: damage type vs armor type. */
export const DAMAGE_MATRIX: Record<string, Record<string, number>> = {
  ballistic: { light: 1.0, heavy: 0.65, structure: 0.55 },
  explosive: { light: 0.7, heavy: 1.2, structure: 1.1 },
  energy: { light: 1.0, heavy: 0.95, structure: 0.85 },
};
