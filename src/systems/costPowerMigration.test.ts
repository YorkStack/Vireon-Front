import { describe, it, expect } from 'vitest';
import { FACTION_DEFS, buildingStats } from '../core/defs';
import { resolveUnit } from './unitFactory';
import { UNIT_CLASS_TEMPLATES } from '../data/unitClasses';
import buildingsJson from '../data/buildings.json';
import {
  FACTION_MODIFIERS, getAdminEditableFactionModifierPaths, getLegacyBackedModifierPaths,
  getModifierMetadata, getModifiedUnitCost, getModifiedBuildingCost, getModifiedPowerUsage,
  getModifiedBuildDuration, type FactionId,
} from '../data/factionModifiers';

const IDS: FactionId[] = ['red', 'blue', 'green', 'yellow'];

// Phase 4c.2: tests no longer read factions.json.modifiers — FACTION_MODIFIERS is
// the single source of truth. Each test asserts the runtime delegates to the
// central getModified* function (i.e. applies the registry value exactly once →
// no double application).

describe('Phase 4a cost/power — runtime delegates to the central registry functions', () => {
  it('unit cost == getModifiedUnitCost (5-credit rounding) for every class', () => {
    for (const id of IDS) {
      for (const [classId, t] of Object.entries(UNIT_CLASS_TEMPLATES)) {
        const kind = t.unitClass === 'infantry' ? 'infantry' : t.unitClass === 'vehicle' ? 'vehicle' : 'general';
        const expected = getModifiedUnitCost(t.cost, id, kind);
        expect(resolveUnit(classId, FACTION_DEFS[id]).cost, `${id}.${classId}.cost`).toBe(expected);
      }
    }
  });

  it('building cost == getModifiedBuildingCost; power == getModifiedPowerUsage (consumers only)', () => {
    for (const id of IDS) {
      for (const bid of Object.keys(buildingsJson)) {
        const b = buildingStats(bid, FACTION_DEFS[id]);
        const base = (buildingsJson as Record<string, { cost: number; power: number }>)[bid];
        expect(b.cost, `${id}.${bid}.cost`).toBe(getModifiedBuildingCost(base.cost, id));
        const expectedPower = base.power < 0 ? Math.round(getModifiedPowerUsage(base.power, id)) : base.power;
        expect(b.power, `${id}.${bid}.power`).toBe(expectedPower);
      }
    }
  });

  it('build time == getModifiedBuildDuration for every unit class and building', () => {
    for (const id of IDS) {
      for (const [classId, t] of Object.entries(UNIT_CLASS_TEMPLATES)) {
        expect(resolveUnit(classId, FACTION_DEFS[id]).buildTime, `${id}.${classId}.buildTime`)
          .toBe(getModifiedBuildDuration(t.buildTime, id));
      }
      for (const bid of Object.keys(buildingsJson)) {
        const base = (buildingsJson as Record<string, { buildTime: number }>)[bid];
        expect(buildingStats(bid, FACTION_DEFS[id]).buildTime, `${id}.${bid}.buildTime`)
          .toBe(getModifiedBuildDuration(base.buildTime, id));
      }
    }
  });

  it('registry holds the canonical economy/power values (cost/power neutral except the real perks)', () => {
    // red vehicles +10%, green infantry -15%, yellow buildings +25% power — everything else neutral.
    expect(FACTION_MODIFIERS.red.economy.vehicleCost).toBe(1.10);
    expect(FACTION_MODIFIERS.green.economy.infantryCost).toBe(0.85);
    expect(FACTION_MODIFIERS.yellow.power.powerUsage).toBe(1.25);
    expect(FACTION_MODIFIERS.blue.production.buildTimeMultiplier).toBe(1.12);
    for (const id of IDS) {
      const m = FACTION_MODIFIERS[id];
      expect(m.economy.unitCost, `${id}.unitCost`).toBe(1);
      expect(m.economy.buildingCost, `${id}.buildingCost`).toBe(1);
    }
    for (const id of ['blue', 'yellow'] as FactionId[]) {
      expect(FACTION_MODIFIERS[id].economy.vehicleCost, `${id}.vehicleCost`).toBe(1);
    }
    for (const id of ['red', 'blue', 'yellow'] as FactionId[]) {
      expect(FACTION_MODIFIERS[id].economy.infantryCost, `${id}.infantryCost`).toBe(1);
    }
    for (const id of ['red', 'blue', 'green'] as FactionId[]) { // yellow is the +25% power perk
      expect(FACTION_MODIFIERS[id].power.powerUsage, `${id}.powerUsage`).toBe(1);
    }
    for (const id of ['red', 'green', 'yellow'] as FactionId[]) {
      expect(FACTION_MODIFIERS[id].production.buildTimeMultiplier, `${id}.btm`).toBe(1);
    }
  });
});

describe('Phase 4a migration — runtime metadata', () => {
  it('migrated dimensions are now live & admin-editable from FACTION_MODIFIERS', () => {
    for (const p of ['economy.vehicleCost', 'economy.infantryCost', 'economy.unitCost', 'economy.buildingCost', 'power.powerUsage', 'production.buildTimeMultiplier']) {
      const meta = getModifierMetadata(p)!;
      expect(meta, p).toBeDefined();
      expect(meta.status, p).toBe('live');
      expect(meta.adminEditable, p).toBe(true);
      expect(meta.runtimeSource, p).toBe('FACTION_MODIFIERS');
      expect(meta.migrationNeeded ?? false, p).toBe(false);
    }
    const editable = getAdminEditableFactionModifierPaths().map((m) => m.path);
    for (const p of ['economy.vehicleCost', 'economy.infantryCost', 'power.powerUsage', 'production.buildTimeMultiplier']) {
      expect(editable).toContain(p);
    }
  });

  it('buildTimeMultiplier is now LIVE (Phase 4a.2 — no longer deferred)', () => {
    expect(getModifierMetadata('production.buildSpeed')).toBeUndefined();
    const bt = getModifierMetadata('production.buildTimeMultiplier')!;
    expect(bt.status).toBe('live');
    expect(bt.adminEditable).toBe(true);
    expect(bt.migrationDeferred ?? false).toBe(false);
  });

  it('non-migrated legacy combat dims remain read-only and out of the editable set', () => {
    const legacyPaths = getLegacyBackedModifierPaths().map((m) => m.path);
    expect(legacyPaths).toContain('combat.unitSpeed');                   // deprecated marker
    expect(legacyPaths).not.toContain('economy.vehicleCost');            // migrated out (4a)
    expect(legacyPaths).not.toContain('production.buildTimeMultiplier'); // migrated out (4a.2)
    expect(legacyPaths).not.toContain('combat.vehicleDamage');           // migrated out (4b.1)
    const editable = getAdminEditableFactionModifierPaths().map((m) => m.path);
    expect(editable).not.toContain('combat.unitSpeed');
  });
});
