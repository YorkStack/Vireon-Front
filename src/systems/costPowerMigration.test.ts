import { describe, it, expect } from 'vitest';
import { FACTION_DEFS, buildingStats } from '../core/defs';
import { resolveUnit } from './unitFactory';
import { UNIT_CLASS_TEMPLATES } from '../data/unitClasses';
import buildingsJson from '../data/buildings.json';
import {
  FACTION_MODIFIERS, getAdminEditableFactionModifierPaths, getLegacyBackedModifierPaths,
  getModifierMetadata, type FactionId,
} from '../data/factionModifiers';

const IDS: FactionId[] = ['red', 'blue', 'green', 'yellow'];
// The legacy source-of-truth: factions.json perk modifiers (1 when absent).
const legacy = (id: FactionId, key: string): number => (FACTION_DEFS[id].modifiers[key] ?? 1);

describe('Phase 4a cost/power migration — NO balance change', () => {
  it('unit cost equals the legacy factions.json formula (5-credit rounding) for every class', () => {
    for (const id of IDS) {
      for (const [classId, t] of Object.entries(UNIT_CLASS_TEMPLATES)) {
        const resolved = resolveUnit(classId, FACTION_DEFS[id]);
        const kindMul = t.unitClass === 'infantry' ? legacy(id, 'infantryCost')
          : t.unitClass === 'vehicle' ? legacy(id, 'vehicleCost') : 1;
        const expected = Math.round(t.cost * kindMul / 5) * 5; // identical to old resolveUnit
        expect(resolved.cost, `${id}.${classId}.cost`).toBe(expected);
      }
    }
  });

  it('building cost is unchanged and power usage mirrors legacy powerUse', () => {
    for (const id of IDS) {
      for (const bid of Object.keys(buildingsJson)) {
        const b = buildingStats(bid, FACTION_DEFS[id]);
        const base = (buildingsJson as Record<string, { cost: number; power: number }>)[bid];
        // no legacy buildingCost perk exists → building cost must be untouched
        expect(b.cost, `${id}.${bid}.cost`).toBe(base.cost);
        // power consumers (negative power) scale by powerUse; producers untouched
        const expectedPower = base.power < 0 ? Math.round(base.power * legacy(id, 'powerUse')) : base.power;
        expect(b.power, `${id}.${bid}.power`).toBe(expectedPower);
      }
    }
  });

  it('no double application: registry mirrors the legacy effective values exactly', () => {
    for (const id of IDS) {
      const m = FACTION_MODIFIERS[id];
      expect(m.economy.vehicleCost, `${id}.vehicleCost`).toBe(legacy(id, 'vehicleCost'));
      expect(m.economy.infantryCost, `${id}.infantryCost`).toBe(legacy(id, 'infantryCost'));
      expect(m.economy.unitCost, `${id}.unitCost`).toBe(1);     // no legacy unitCost → neutral
      expect(m.economy.buildingCost, `${id}.buildingCost`).toBe(1); // no legacy buildingCost → neutral
      expect(m.power.powerUsage, `${id}.powerUsage`).toBe(legacy(id, 'powerUse'));
    }
  });

  it('only red vehicles and green infantry actually shift price (the live perks)', () => {
    // Spot-check that the migration kept exactly the two real perks and nothing else.
    expect(FACTION_MODIFIERS.red.economy.vehicleCost).toBe(1.10);
    expect(FACTION_MODIFIERS.green.economy.infantryCost).toBe(0.85);
    expect(FACTION_MODIFIERS.yellow.power.powerUsage).toBe(1.25);
    for (const id of ['blue'] as FactionId[]) {
      expect(FACTION_MODIFIERS[id].economy.vehicleCost).toBe(1);
      expect(FACTION_MODIFIERS[id].economy.infantryCost).toBe(1);
      expect(FACTION_MODIFIERS[id].power.powerUsage).toBe(1);
    }
  });
});

describe('Phase 4a migration — runtime metadata', () => {
  it('migrated dimensions are now live & admin-editable from FACTION_MODIFIERS', () => {
    for (const p of ['economy.vehicleCost', 'economy.infantryCost', 'economy.unitCost', 'economy.buildingCost', 'power.powerUsage']) {
      const meta = getModifierMetadata(p)!;
      expect(meta, p).toBeDefined();
      expect(meta.status, p).toBe('live');
      expect(meta.adminEditable, p).toBe(true);
      expect(meta.runtimeSource, p).toBe('FACTION_MODIFIERS');
      expect(meta.migrationNeeded ?? false, p).toBe(false);
    }
    const editable = getAdminEditableFactionModifierPaths().map((m) => m.path);
    for (const p of ['economy.vehicleCost', 'economy.infantryCost', 'power.powerUsage']) {
      expect(editable).toContain(p);
    }
  });

  it('buildSpeed is intentionally deferred (still legacy-backed, read-only)', () => {
    const bs = getModifierMetadata('production.buildSpeed')!;
    expect(bs.status).toBe('legacy_backed');
    expect(bs.adminEditable).toBe(false);
    expect(bs.migrationNeeded).toBe(true);
    expect(bs.migrationDeferred).toBe(true);
  });

  it('non-migrated legacy combat dims remain read-only and out of the editable set', () => {
    const legacyPaths = getLegacyBackedModifierPaths().map((m) => m.path);
    expect(legacyPaths).toContain('combat.vehicleDamage');
    expect(legacyPaths).toContain('production.buildSpeed');
    expect(legacyPaths).not.toContain('economy.vehicleCost'); // migrated out
    const editable = getAdminEditableFactionModifierPaths().map((m) => m.path);
    expect(editable).not.toContain('combat.vehicleDamage');
    expect(editable).not.toContain('production.buildSpeed');
  });
});
