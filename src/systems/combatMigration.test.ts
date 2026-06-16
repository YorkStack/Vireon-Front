import { describe, it, expect } from 'vitest';
import { FACTION_DEFS, buildingStats } from '../core/defs';
import { resolveUnit, templateToDef } from './unitFactory';
import { UNIT_CLASS_TEMPLATES } from '../data/unitClasses';
import buildingsJson from '../data/buildings.json';
import {
  FACTION_MODIFIERS, getAdminEditableFactionModifierPaths, getLegacyBackedModifierPaths,
  getModifierMetadata, getCombatModifiers, getModifiedDamage, getModifiedTurretRange,
  type FactionId,
} from '../data/factionModifiers';

const IDS: FactionId[] = ['red', 'blue', 'green', 'yellow'];

type W = { damage: number; damageType: string; range: number };

// Phase 4c.2: expectations come from FACTION_MODIFIERS (via getCombat/getModified*),
// never from factions.json.modifiers.

describe('Phase 4b.1 damage/range — runtime delegates to the central registry functions', () => {
  it('unit weapon damage == registry composition (vehicle × energy)', () => {
    for (const id of IDS) {
      const cm = getCombatModifiers(id);
      for (const [classId, t] of Object.entries(UNIT_CLASS_TEMPLATES)) {
        const baseW = templateToDef(t).weapon; // faction-neutral base (no weapon.damage overrides)
        if (!baseW) continue;
        let mul = 1;
        if (t.unitClass === 'vehicle') mul *= cm.vehicleDamage;
        if (baseW.damageType === 'energy') mul *= cm.energyWeaponDamage;
        const resolved = resolveUnit(classId, FACTION_DEFS[id]).weapon!;
        expect(resolved.damage, `${id}.${classId}.damage`).toBe(Math.round(baseW.damage * mul));
      }
    }
  });

  it('turret/building weapon damage == getModifiedDamage; ballistic untouched', () => {
    for (const id of IDS) {
      for (const bid of Object.keys(buildingsJson)) {
        const base = (buildingsJson as Record<string, { weapon?: W }>)[bid];
        if (!base.weapon) continue;
        const kind = base.weapon.damageType === 'energy' ? 'energy' : 'general';
        const b = buildingStats(bid, FACTION_DEFS[id]).weapon!;
        expect(b.damage, `${id}.${bid}.damage`).toBe(getModifiedDamage(base.weapon.damage, id, kind));
      }
    }
    expect(FACTION_MODIFIERS.yellow.combat.energyWeaponDamage).toBe(1.20);
  });

  it('turret range == getModifiedTurretRange (ADDITIVE: range + bonus)', () => {
    for (const id of IDS) {
      for (const bid of Object.keys(buildingsJson)) {
        const base = (buildingsJson as Record<string, { weapon?: W }>)[bid];
        if (!base.weapon) continue;
        const b = buildingStats(bid, FACTION_DEFS[id]).weapon!;
        expect(b.range, `${id}.${bid}.range`).toBe(getModifiedTurretRange(base.weapon.range, id));
      }
    }
    // additive, not multiplicative: yellow +1 on a 10.5 range turret → 11.5, never 10.5×1
    expect(FACTION_MODIFIERS.yellow.defense.turretRangeBonus).toBe(1);
  });

  it('registry holds the canonical damage/range values (only the real perks are non-neutral)', () => {
    expect(FACTION_MODIFIERS.red.combat.vehicleDamage).toBe(1.15);
    expect(FACTION_MODIFIERS.yellow.combat.energyWeaponDamage).toBe(1.20);
    expect(FACTION_MODIFIERS.yellow.defense.turretRangeBonus).toBe(1);
    for (const id of ['blue', 'green', 'yellow'] as FactionId[]) {
      expect(FACTION_MODIFIERS[id].combat.vehicleDamage, `${id}.vehicleDamage`).toBe(1.0);
    }
    for (const id of ['red', 'blue', 'green'] as FactionId[]) {
      expect(FACTION_MODIFIERS[id].combat.energyWeaponDamage, `${id}.energyWeaponDamage`).toBe(1.0);
      expect(FACTION_MODIFIERS[id].defense.turretRangeBonus, `${id}.turretRangeBonus`).toBe(0);
    }
  });
});

describe('Phase 4b.1 migration — runtime metadata', () => {
  it('migrated paths are live & admin-editable; unitSpeed/turretDurability stay non-migrated', () => {
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
    const legacyPaths = getLegacyBackedModifierPaths().map((m) => m.path);
    expect(legacyPaths).toContain('combat.unitSpeed');
    expect(getModifierMetadata('defense.turretDurability')!.status).toBe('prepared');
    for (const p of ['combat.unitSpeed', 'defense.turretDurability']) {
      expect(editable).not.toContain(p);
    }
  });
});
