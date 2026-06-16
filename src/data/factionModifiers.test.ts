import { describe, it, expect } from 'vitest';
import {
  FACTION_MODIFIERS, getFactionModifiers, getModifiedUnitCost, getModifiedBuildingCost,
  getModifiedBuildDuration, getModifiedProductionDuration, getModifiedDamage, getModifiedHull,
  getModifiedTurretRange, getModifiedRepairRate, getPowerRatio, isLowPower, getPowerOutageEffects,
  applyPowerStateModifier, calculateFactionPowerScore, type FactionId, type FactionModifiers,
  MODIFIER_RUNTIME_METADATA, getAdminEditableFactionModifierPaths, getPreparedButNotLiveModifierPaths,
  getLegacyBackedModifierPaths,
} from './factionModifiers';

const IDS: FactionId[] = ['red', 'blue', 'green', 'yellow'];

function allNumbers(o: unknown, out: number[] = []): number[] {
  if (typeof o === 'number') out.push(o);
  else if (o && typeof o === 'object') for (const v of Object.values(o)) allNumbers(v, out);
  return out;
}

describe('FACTION_MODIFIERS registry', () => {
  it('1. exists for all four factions with all sub-sections', () => {
    for (const id of IDS) {
      const m = FACTION_MODIFIERS[id];
      expect(m).toBeDefined();
      for (const k of ['economy', 'power', 'combat', 'defense', 'production', 'repair'] as (keyof FactionModifiers)[]) {
        expect(m[k], `${id}.${k}`).toBeDefined();
      }
    }
  });

  it('2. every modifier is a finite, non-negative number (additive bonuses may be 0)', () => {
    for (const id of IDS) {
      for (const n of allNumbers(FACTION_MODIFIERS[id])) {
        expect(Number.isFinite(n)).toBe(true);
        expect(n).toBeGreaterThanOrEqual(0);
      }
      // every MULTIPLIER (everything except the additive turretRangeBonus) is > 0
      const m = FACTION_MODIFIERS[id];
      expect(m.economy.resourceGatherRate).toBeGreaterThan(0);
      expect(m.production.buildSpeed).toBeGreaterThan(0);
      expect(m.power.powerUsage).toBeGreaterThan(0);
    }
  });

  it('3. Crimson Pact sits near reference (≈1.0)', () => {
    const r = FACTION_MODIFIERS.red;
    expect(r.production.buildSpeed).toBe(1.0);
    expect(r.power.powerUsage).toBe(1.0);
    expect(r.power.powerOutageSeverity).toBe(1.0);
    expect(r.economy.resourceGatherRate).toBe(1.0);
  });

  it('4. Azure builds slower but is more durable/defensive', () => {
    const b = FACTION_MODIFIERS.blue, r = FACTION_MODIFIERS.red;
    expect(b.production.buildSpeed).toBeLessThan(r.production.buildSpeed);
    expect(b.production.unitProductionSpeed).toBeLessThan(r.production.unitProductionSpeed);
    expect(b.combat.unitHull).toBeGreaterThan(r.combat.unitHull);
    expect(b.defense.buildingHull).toBeGreaterThan(r.defense.buildingHull);
  });

  it('5. Verdant produces faster, cheaper, consumes more resources', () => {
    const g = FACTION_MODIFIERS.green, r = FACTION_MODIFIERS.red;
    expect(g.production.unitProductionSpeed).toBeGreaterThan(r.production.unitProductionSpeed);
    expect(g.economy.infantryCost).toBeLessThan(r.economy.infantryCost);
    expect(g.economy.resourceConsumption).toBeGreaterThan(r.economy.resourceConsumption);
  });

  it('6. Verdant has the LOWEST power-outage severity', () => {
    const sev = (id: FactionId) => FACTION_MODIFIERS[id].power.powerOutageSeverity;
    expect(Math.min(...IDS.map(sev))).toBe(sev('green'));
  });

  it('7. Solar has the HIGHEST power-outage severity', () => {
    const sev = (id: FactionId) => FACTION_MODIFIERS[id].power.powerOutageSeverity;
    expect(Math.max(...IDS.map(sev))).toBe(sev('yellow'));
  });

  it('8. Solar energy weapons get a damage bonus', () => {
    expect(FACTION_MODIFIERS.yellow.combat.energyWeaponDamage).toBeGreaterThan(1);
    expect(getModifiedDamage(100, 'yellow', 'energy')).toBeGreaterThan(100);
  });

  it('9. Solar turrets get a range bonus', () => {
    expect(FACTION_MODIFIERS.yellow.defense.turretRangeBonus).toBeGreaterThan(0);
    expect(getModifiedTurretRange(7, 'yellow')).toBe(8);
  });

  it('10. Azure shield + repair exceed reference', () => {
    expect((FACTION_MODIFIERS.blue.defense.shieldStrength ?? 1)).toBeGreaterThan(1);
    expect(FACTION_MODIFIERS.blue.repair.repairRate).toBeGreaterThan(FACTION_MODIFIERS.red.repair.repairRate - 0.001);
    expect(getModifiedRepairRate(10, 'blue')).toBeGreaterThan(getModifiedRepairRate(10, 'green'));
  });
});

describe('power-outage logic', () => {
  it('11. effects differ per faction at the same powerRatio', () => {
    const r = 0.5;
    const solar = getPowerOutageEffects('yellow', r).weaponEfficiencyMultiplier;
    const verdant = getPowerOutageEffects('green', r).weaponEfficiencyMultiplier;
    const crimson = getPowerOutageEffects('red', r).weaponEfficiencyMultiplier;
    expect(solar).not.toBeCloseTo(verdant, 2);
    expect(crimson).not.toBeCloseTo(verdant, 2);
  });

  it('12. powerRatio >= 1 means no penalties', () => {
    for (const id of IDS) {
      const e = getPowerOutageEffects(id, 1);
      expect(e.severity).toBe(0);
      expect(e.productionSpeedMultiplier).toBe(1);
      expect(e.weaponEfficiencyMultiplier).toBe(1);
      expect(e.turretEfficiencyMultiplier).toBe(1);
    }
    expect(isLowPower({ powerProduced: 10, powerUsed: 8 })).toBe(false);
    expect(getPowerRatio({ powerProduced: 5, powerUsed: 0 })).toBe(1); // no consumers
  });

  it('13. under a deficit Solar is hit harder than Crimson and Verdant', () => {
    const r = 0.5;
    const solar = getPowerOutageEffects('yellow', r);
    const crimson = getPowerOutageEffects('red', r);
    const verdant = getPowerOutageEffects('green', r);
    // lower multiplier = harder hit
    expect(solar.weaponEfficiencyMultiplier).toBeLessThan(crimson.weaponEfficiencyMultiplier);
    expect(solar.productionSpeedMultiplier).toBeLessThan(verdant.productionSpeedMultiplier);
    expect(verdant.weaponEfficiencyMultiplier).toBeGreaterThan(crimson.weaponEfficiencyMultiplier);
    expect(isLowPower({ powerProduced: 4, powerUsed: 8 })).toBe(true);
    expect(applyPowerStateModifier(100, 'yellow', r, 'weapon')).toBeLessThan(applyPowerStateModifier(100, 'green', r, 'weapon'));
  });
});

describe('modifier functions', () => {
  it('14. cost/build/damage/hull return expected values', () => {
    // Verdant infantry cheaper than reference; Crimson vehicles pricier.
    expect(getModifiedUnitCost(100, 'green', 'infantry')).toBeLessThan(100);
    expect(getModifiedUnitCost(100, 'red', 'vehicle')).toBeGreaterThan(100);
    expect(getModifiedBuildingCost(100, 'red')).toBe(100);
    // Azure builds slower (longer duration), Verdant faster (shorter).
    expect(getModifiedBuildDuration(10, 'blue')).toBeGreaterThan(10);
    expect(getModifiedProductionDuration(10, 'green', 'infantry')).toBeLessThan(10);
    // Azure tougher hull, Verdant weaker.
    expect(getModifiedHull(100, 'blue', 'building')).toBeGreaterThan(100);
    expect(getModifiedHull(100, 'green', 'vehicle')).toBeLessThan(100);
  });
});

describe('runtime-status metadata (admin readiness)', () => {
  it('1. metadata exists and covers the central modifier groups', () => {
    expect(MODIFIER_RUNTIME_METADATA.length).toBeGreaterThan(0);
    const groups = new Set(MODIFIER_RUNTIME_METADATA.map((m) => m.path.split('.')[0]));
    for (const g of ['economy', 'power', 'combat', 'defense', 'production', 'repair', 'special']) {
      expect(groups.has(g), `group ${g} represented`).toBe(true);
    }
    // every entry is internally consistent
    for (const m of MODIFIER_RUNTIME_METADATA) {
      expect(typeof m.path).toBe('string');
      expect(m.description.length).toBeGreaterThan(0);
    }
  });

  it('2. live modifiers are admin-editable and sourced from FACTION_MODIFIERS', () => {
    const live = MODIFIER_RUNTIME_METADATA.filter((m) => m.status === 'live');
    expect(live.length).toBeGreaterThan(0);
    for (const m of live) {
      expect(m.adminEditable, m.path).toBe(true);
      expect(m.runtimeSource, m.path).toBe('FACTION_MODIFIERS');
    }
    // the genuinely-wired ones are present
    expect(live.map((m) => m.path)).toEqual(
      expect.arrayContaining(['power.powerOutageSeverity', 'economy.resourceGatherRate', 'repair.repairRate']),
    );
  });

  it('3. prepared-only modifiers are NOT admin-editable', () => {
    for (const m of getPreparedButNotLiveModifierPaths()) {
      expect(m.adminEditable, m.path).toBe(false);
      expect(m.runtimeSource, m.path).toBe('not_yet_integrated');
    }
  });

  it('4. legacy-backed modifiers are flagged migrationNeeded and not editable', () => {
    const legacy = getLegacyBackedModifierPaths();
    expect(legacy.length).toBeGreaterThan(0);
    for (const m of legacy) {
      expect(m.migrationNeeded, m.path).toBe(true);
      expect(m.adminEditable, m.path).toBe(false);
      expect(m.runtimeSource).not.toBe('FACTION_MODIFIERS');
    }
  });

  it('5. getAdminEditableFactionModifierPaths() contains no prepared-only values', () => {
    const editable = getAdminEditableFactionModifierPaths();
    expect(editable.length).toBeGreaterThan(0);
    for (const m of editable) {
      expect(m.status).not.toBe('prepared');
      expect(m.status).not.toBe('legacy_backed');
      expect(m.adminEditable).toBe(true);
    }
  });

  it('6. prepared list includes colony aura and upkeep (not yet live)', () => {
    const prepared = getPreparedButNotLiveModifierPaths().map((m) => m.path);
    expect(prepared).toContain('special.colonyAuraStrength');
    expect(prepared.some((p) => p.startsWith('economy.upkeep'))).toBe(true);
  });
});

describe('faction power score', () => {
  it('15. computes for all factions and yields finite scores', () => {
    for (const id of IDS) {
      const s = calculateFactionPowerScore(id);
      expect(s.factionId).toBe(id);
      expect(Number.isFinite(s.overallPowerScore)).toBe(true);
      expect(Array.isArray(s.warnings)).toBe(true);
      expect(Number.isFinite(s.earlyGamePower)).toBe(true);
      expect(Number.isFinite(s.lateGamePower)).toBe(true);
    }
    // Solar carries the biggest energy + vulnerability penalties.
    const solar = calculateFactionPowerScore('yellow');
    expect(solar.energyPenalty).toBeGreaterThan(calculateFactionPowerScore('green').energyPenalty);
    expect(solar.vulnerabilityPenalty).toBeGreaterThan(0);
  });
});
