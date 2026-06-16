import { describe, it, expect } from 'vitest';
import { FACTION_DEFS, buildingStats } from '../core/defs';
import { resolveUnit, templateToDef } from './unitFactory';
import { UNIT_CLASS_TEMPLATES } from '../data/unitClasses';
import buildingsJson from '../data/buildings.json';
import {
  FACTION_MODIFIERS, getAdminEditableFactionModifierPaths, getLegacyBackedModifierPaths,
  getModifierMetadata, getModifiedHull, type FactionId,
} from '../data/factionModifiers';

const IDS: FactionId[] = ['red', 'blue', 'green', 'yellow'];

// Phase 4c.2: expectations come from FACTION_MODIFIERS (via getModifiedHull and
// the registry's unitHull/buildingHull), never from factions.json.modifiers.

describe('Phase 4b.2a hull — runtime delegates to the central registry function', () => {
  it('1. unit HP == getModifiedHull (= base × combat.unitHull) for every class/faction', () => {
    for (const id of IDS) {
      for (const [classId, t] of Object.entries(UNIT_CLASS_TEMPLATES)) {
        const baseHp = templateToDef(t).hp; // faction-neutral base (no hp overrides exist)
        const kind = t.unitClass === 'infantry' ? 'infantry' : 'vehicle';
        expect(resolveUnit(classId, FACTION_DEFS[id]).hp, `${id}.${classId}.hp`)
          .toBe(getModifiedHull(baseHp, id, kind));
      }
    }
  });

  it('2. building HP == getModifiedHull (= base × defense.buildingHull)', () => {
    for (const id of IDS) {
      for (const bid of Object.keys(buildingsJson)) {
        const base = (buildingsJson as Record<string, { hp: number }>)[bid];
        expect(buildingStats(bid, FACTION_DEFS[id]).hp, `${id}.${bid}.hp`)
          .toBe(getModifiedHull(base.hp, id, 'building'));
      }
    }
  });

  it('3+4. blue ×1.15 units & buildings; green ×0.90 units / ×1.0 buildings', () => {
    const t = UNIT_CLASS_TEMPLATES['mediumTank'];
    const baseHp = templateToDef(t).hp;
    expect(resolveUnit('mediumTank', FACTION_DEFS.blue).hp).toBe(Math.round(baseHp * 1.15));
    expect(resolveUnit('mediumTank', FACTION_DEFS.green).hp).toBe(Math.round(baseHp * 0.90));
    const bid = Object.keys(buildingsJson)[0];
    const baseBHp = (buildingsJson as Record<string, { hp: number }>)[bid].hp;
    expect(buildingStats(bid, FACTION_DEFS.blue).hp).toBe(Math.round(baseBHp * 1.15));
    expect(buildingStats(bid, FACTION_DEFS.green).hp).toBe(Math.round(baseBHp * 1.0)); // green has NO building-hp perk
  });

  it('5+6. registry holds the canonical hull values (unitHull = hp×unitHp, buildingHull = hp)', () => {
    // blue +15% hull (units & buildings), green -10% unit hull only — others neutral.
    expect(FACTION_MODIFIERS.blue.combat.unitHull).toBe(1.15);
    expect(FACTION_MODIFIERS.green.combat.unitHull).toBe(0.90);
    expect(FACTION_MODIFIERS.blue.defense.buildingHull).toBe(1.15);
    expect(FACTION_MODIFIERS.green.defense.buildingHull).toBe(1.0);
    for (const id of ['red', 'yellow'] as FactionId[]) {
      expect(FACTION_MODIFIERS[id].combat.unitHull, `${id}.unitHull`).toBe(1.0);
      expect(FACTION_MODIFIERS[id].defense.buildingHull, `${id}.buildingHull`).toBe(1.0);
    }
  });

  it('7. vehicleHull and infantryHull stay neutral 1.0 (not separately migrated)', () => {
    for (const id of IDS) {
      expect(FACTION_MODIFIERS[id].combat.vehicleHull, `${id}.vehicleHull`).toBe(1.0);
      expect(FACTION_MODIFIERS[id].combat.infantryHull, `${id}.infantryHull`).toBe(1.0);
    }
  });

  it('8. metadata: unitHull + buildingHull live/editable; unitSpeed + turretDurability NOT migrated', () => {
    for (const p of ['combat.unitHull', 'defense.buildingHull']) {
      const meta = getModifierMetadata(p)!;
      expect(meta, p).toBeDefined();
      expect(meta.status, p).toBe('live');
      expect(meta.adminEditable, p).toBe(true);
      expect(meta.runtimeSource, p).toBe('FACTION_MODIFIERS');
    }
    const editable = getAdminEditableFactionModifierPaths().map((m) => m.path);
    expect(editable).toContain('combat.unitHull');
    expect(editable).toContain('defense.buildingHull');
    // NOT migrated this phase:
    const legacyPaths = getLegacyBackedModifierPaths().map((m) => m.path);
    expect(legacyPaths).toContain('combat.unitSpeed');
    expect(getModifierMetadata('defense.turretDurability')!.status).toBe('prepared');
    // vehicleHull/infantryHull are neutral and NOT exposed as editable
    expect(editable).not.toContain('combat.vehicleHull');
    expect(editable).not.toContain('combat.infantryHull');
    expect(editable).not.toContain('combat.unitSpeed');
    expect(editable).not.toContain('defense.turretDurability');
  });
});
