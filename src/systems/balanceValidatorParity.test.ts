import { describe, it, expect } from 'vitest';
import { validateBalance } from './balanceValidation';
import {
  factionHasPerkForField, VALIDATOR_PERK_MAP,
} from '../data/factionModifierValidationMap';
import { getModifierMetadata, type FactionId } from '../data/factionModifiers';

// Phase 4c.2: the validator (and these tests) read FACTION_MODIFIERS only —
// factions.json.modifiers is gone. The old "parity vs factions.json" comparison
// is replaced by registry-correctness assertions.

describe('Phase 4c — balance validator derives perk explanations from FACTION_MODIFIERS', () => {
  it('validate:balance reports zero unexplained violations (perks still recognised)', () => {
    const r = validateBalance();
    expect(r.violations, r.violations.join('\n')).toHaveLength(0);
    expect(r.intentional.length).toBeGreaterThan(0);
  });

  it('known per-faction perks are detected from the registry', () => {
    // cost: red vehicleCost 1.10, green infantryCost 0.85
    expect(factionHasPerkForField('red', 'cost')).toBe(true);
    expect(factionHasPerkForField('green', 'cost')).toBe(true);
    expect(factionHasPerkForField('yellow', 'cost')).toBe(false);
    // buildTime: blue 1.12
    expect(factionHasPerkForField('blue', 'buildTime')).toBe(true);
    expect(factionHasPerkForField('red', 'buildTime')).toBe(false);
    // speed: green infantrySpeed 1.15
    expect(factionHasPerkForField('green', 'speed')).toBe(true);
    expect(factionHasPerkForField('red', 'speed')).toBe(false);
    // maxHitPoints: blue hp 1.15, green unitHp 0.90
    expect(factionHasPerkForField('blue', 'maxHitPoints')).toBe(true);
    expect(factionHasPerkForField('green', 'maxHitPoints')).toBe(true);
    expect(factionHasPerkForField('red', 'maxHitPoints')).toBe(false);
    // damage: red vehicleDamage 1.15, yellow energyWeaponDamage 1.20
    expect(factionHasPerkForField('red', 'damage')).toBe(true);
    expect(factionHasPerkForField('yellow', 'damage')).toBe(true);
    expect(factionHasPerkForField('blue', 'damage')).toBe(false);
  });

  it('range is ADDITIVE (neutral 0): only yellow carries +1 turret-range', () => {
    expect(VALIDATOR_PERK_MAP.range.neutral).toBe(0);
    expect(factionHasPerkForField('yellow', 'range')).toBe(true);
    for (const id of ['red', 'blue', 'green'] as FactionId[]) {
      expect(factionHasPerkForField(id, 'range')).toBe(false);
    }
  });

  it('the perk map documents legacy keys, registry paths, formula and interpretation for all six fields', () => {
    for (const field of ['cost', 'buildTime', 'speed', 'maxHitPoints', 'damage', 'range']) {
      const e = VALIDATOR_PERK_MAP[field];
      expect(e, field).toBeDefined();
      expect(e.paths.length, field).toBeGreaterThan(0);
      expect(e.legacyKeys.length, field).toBeGreaterThan(0);
      expect(e.formula.length, field).toBeGreaterThan(0);
      expect(e.interpretation, field).toContain('higher =');
    }
  });

  it('unknown field returns no perk (defensive)', () => {
    expect(factionHasPerkForField('red', 'visionRange')).toBe(false);
    expect(factionHasPerkForField('red', 'nonsense')).toBe(false);
  });

  it('deprecated combat.unitSpeed is a read-only marker with no registry value/effect', () => {
    const dep = getModifierMetadata('combat.unitSpeed')!;
    expect(dep.adminEditable).toBe(false);
    expect(dep.runtimeSource).not.toBe('FACTION_MODIFIERS');
    // not part of any validator field mapping → never a perk source
    const allMappedPaths = Object.values(VALIDATOR_PERK_MAP).flatMap((e) => e.paths);
    expect(allMappedPaths).not.toContain('combat.unitSpeed');
  });
});
