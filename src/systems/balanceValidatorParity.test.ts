import { describe, it, expect } from 'vitest';
import { FACTION_DEFS } from '../core/defs';
import { validateBalance } from './balanceValidation';
import {
  factionHasPerkForField, VALIDATOR_PERK_MAP,
} from '../data/factionModifierValidationMap';
import type { FactionId } from '../data/factionModifiers';

const IDS: FactionId[] = ['red', 'blue', 'green', 'yellow'];

// The OLD factions.json-based logic, reconstructed verbatim from the validator
// before Phase 4c.1 — kept here only to prove parity with the registry version.
const OLD_PERK_FIELDS: Record<string, string[]> = {
  cost: ['vehicleCost', 'infantryCost'],
  buildTime: ['buildTime'],
  speed: ['infantrySpeed'],
  maxHitPoints: ['hp', 'unitHp'],
  damage: ['vehicleDamage', 'energyDamage'],
};
const oldViaPerks = (id: FactionId, field: string): boolean => {
  const keys = OLD_PERK_FIELDS[field] ?? [];
  const mods = FACTION_DEFS[id].modifiers;
  return keys.some((k) => (mods[k] ?? 1) !== 1 && mods[k] !== undefined);
};

describe('Phase 4c.1 — registry-derived perk explanation is at parity with factions.json', () => {
  it('factionHasPerkForField === legacy factions.json check for every faction & validator-active field', () => {
    for (const id of IDS) {
      for (const field of Object.keys(OLD_PERK_FIELDS)) {
        expect(factionHasPerkForField(id, field), `${id}.${field}`).toBe(oldViaPerks(id, field));
      }
    }
  });

  it('validate:balance still reports zero unexplained violations', () => {
    const r = validateBalance();
    expect(r.violations, r.violations.join('\n')).toHaveLength(0);
    expect(r.intentional.length).toBeGreaterThan(0); // perks are still recognised, not flagged
  });
});

describe('Phase 4c.1 — perk map covers all six stats incl. composite/additive cases', () => {
  it('the real per-faction perks resolve as expected', () => {
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
    // maxHitPoints: blue hp 1.15 (unitHull+buildingHull), green unitHp 0.90 (unitHull)
    expect(factionHasPerkForField('blue', 'maxHitPoints')).toBe(true);
    expect(factionHasPerkForField('green', 'maxHitPoints')).toBe(true);
    expect(factionHasPerkForField('red', 'maxHitPoints')).toBe(false);
    // damage: red vehicleDamage 1.15, yellow energyWeaponDamage 1.20
    expect(factionHasPerkForField('red', 'damage')).toBe(true);
    expect(factionHasPerkForField('yellow', 'damage')).toBe(true);
    expect(factionHasPerkForField('blue', 'damage')).toBe(false);
  });

  it('range is ADDITIVE (neutral 0): only yellow carries +1 turret-range', () => {
    // NB: the validator only checks vehicle classes, whose weapon range is never
    // shifted by turretRange (buildings-only) — so range never produces a real
    // diff today. The mapping is still tested here for correctness/future use.
    expect(VALIDATOR_PERK_MAP.range.neutral).toBe(0);
    expect(factionHasPerkForField('yellow', 'range')).toBe(true);
    for (const id of ['red', 'blue', 'green'] as FactionId[]) {
      expect(factionHasPerkForField(id, 'range')).toBe(false);
    }
  });

  it('map documents legacy keys, registry paths, formula and interpretation for all six fields', () => {
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
});
