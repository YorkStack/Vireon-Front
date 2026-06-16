import { describe, it, expect } from 'vitest';
import { FACTION_DEFS, buildingStats } from '../core/defs';
import { resolveUnit, templateToDef } from './unitFactory';
import { UNIT_CLASS_TEMPLATES } from '../data/unitClasses';
import buildingsJson from '../data/buildings.json';
import {
  FACTION_MODIFIERS, getAdminEditableFactionModifierPaths, getLegacyBackedModifierPaths,
  getModifierMetadata, type FactionId,
} from '../data/factionModifiers';

const IDS: FactionId[] = ['red', 'blue', 'green', 'yellow'];
const legacy = (id: FactionId, key: string): number => (FACTION_DEFS[id].modifiers[key] ?? 1);
// turretRange is ADDITIVE → absent means +0, not ×1.
const legacyAdd = (id: FactionId, key: string): number => (FACTION_DEFS[id].modifiers[key] ?? 0);

type W = { damage: number; damageType: string; range: number };

describe('Phase 4b.1 damage/range migration — NO balance change', () => {
  it('1+2. effective unit weapon damage is identical (vehicle × energy composition)', () => {
    for (const id of IDS) {
      for (const [classId, t] of Object.entries(UNIT_CLASS_TEMPLATES)) {
        const baseW = templateToDef(t).weapon; // faction-neutral base (no cost/damage overrides exist)
        if (!baseW) continue;
        const resolved = resolveUnit(classId, FACTION_DEFS[id]).weapon!;
        const isVeh = t.unitClass === 'vehicle';
        let mul = 1;
        if (isVeh) mul *= legacy(id, 'vehicleDamage');
        if (baseW.damageType === 'energy') mul *= legacy(id, 'energyDamage');
        expect(resolved.damage, `${id}.${classId}.damage`).toBe(Math.round(baseW.damage * mul));
      }
    }
  });

  it('3. energy damage applies to BOTH units and turrets; ballistic is untouched', () => {
    // Solar (yellow) has the only energy perk (1.20).
    for (const id of IDS) {
      for (const bid of Object.keys(buildingsJson)) {
        const base = (buildingsJson as Record<string, { weapon?: W }>)[bid];
        if (!base.weapon) continue;
        const b = buildingStats(bid, FACTION_DEFS[id]).weapon!;
        const mul = base.weapon.damageType === 'energy' ? legacy(id, 'energyDamage') : 1;
        expect(b.damage, `${id}.${bid}.damage`).toBe(Math.round(base.weapon.damage * mul));
      }
    }
    // explicit unit-side check: a vehicle energy weapon would get ×1.20 under yellow
    // (sanity that the unit path also reads energyWeaponDamage)
    expect(FACTION_MODIFIERS.yellow.combat.energyWeaponDamage).toBe(1.20);
  });

  it('4+5. turret range is identical and treated ADDITIVELY (range + bonus)', () => {
    for (const id of IDS) {
      for (const bid of Object.keys(buildingsJson)) {
        const base = (buildingsJson as Record<string, { weapon?: W }>)[bid];
        if (!base.weapon) continue;
        const b = buildingStats(bid, FACTION_DEFS[id]).weapon!;
        expect(b.range, `${id}.${bid}.range`).toBe(base.weapon.range + legacyAdd(id, 'turretRange'));
      }
    }
    // additive, not multiplicative: yellow +1 on a 10.5 range turret → 11.5, never 10.5×1
    expect(FACTION_MODIFIERS.yellow.defense.turretRangeBonus).toBe(1);
  });

  it('6+7. registry mirrors legacy exactly (no double application, no aspirational live values)', () => {
    for (const id of IDS) {
      const m = FACTION_MODIFIERS[id];
      expect(m.combat.vehicleDamage, `${id}.vehicleDamage`).toBe(legacy(id, 'vehicleDamage'));
      expect(m.combat.energyWeaponDamage, `${id}.energyWeaponDamage`).toBe(legacy(id, 'energyDamage'));
      expect(m.defense.turretRangeBonus, `${id}.turretRangeBonus`).toBe(legacyAdd(id, 'turretRange'));
    }
    // the two real perks survive; the never-live aspirational ones are now 1.0
    expect(FACTION_MODIFIERS.red.combat.vehicleDamage).toBe(1.15);
    expect(FACTION_MODIFIERS.green.combat.vehicleDamage).toBe(1.0);     // was aspirational 0.98
    expect(FACTION_MODIFIERS.yellow.combat.energyWeaponDamage).toBe(1.20);
    expect(FACTION_MODIFIERS.blue.combat.energyWeaponDamage).toBe(1.0); // was aspirational 1.05
    expect(FACTION_MODIFIERS.green.combat.energyWeaponDamage).toBe(1.0);// was aspirational 0.95
    expect(FACTION_MODIFIERS.yellow.defense.turretRangeBonus).toBe(1);
  });
});

describe('Phase 4b.1 migration — runtime metadata', () => {
  it('8. migrated paths are live & admin-editable; unitHull/unitSpeed/turretDurability stay non-migrated', () => {
    for (const p of ['combat.vehicleDamage', 'combat.energyWeaponDamage', 'defense.turretRangeBonus']) {
      const meta = getModifierMetadata(p)!;
      expect(meta, p).toBeDefined();
      expect(meta.status, p).toBe('live');
      expect(meta.adminEditable, p).toBe(true);
      expect(meta.runtimeSource, p).toBe('FACTION_MODIFIERS');
    }
    const editable = getAdminEditableFactionModifierPaths().map((m) => m.path);
    for (const p of ['combat.vehicleDamage', 'combat.energyWeaponDamage', 'defense.turretRangeBonus']) {
      expect(editable).toContain(p);
    }
    // NOT migrated this phase:
    const legacyPaths = getLegacyBackedModifierPaths().map((m) => m.path);
    expect(legacyPaths).toContain('combat.unitHull');
    expect(legacyPaths).toContain('combat.unitSpeed');
    expect(getModifierMetadata('defense.turretDurability')!.status).toBe('prepared');
    for (const p of ['combat.unitHull', 'combat.unitSpeed', 'defense.turretDurability']) {
      expect(editable).not.toContain(p);
    }
  });
});
