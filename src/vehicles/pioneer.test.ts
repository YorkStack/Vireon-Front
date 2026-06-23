// Slice 2A: the faction Pioneer / Forestry vehicle is a registered, buildable
// utility class with one cosmetic variant per faction. This guards the data
// groundwork — class template, registry membership, and the four per-faction
// variants — so a regression that drops any link is caught. NO clearing
// behaviour exists yet (that is Slice 2B).
import { describe, it, expect } from 'vitest';
import { UNIT_CLASS_TEMPLATES, VEHICLE_CLASS_IDS } from '../data/unitClasses';
import { UNIT_DEFS } from '../core/defs';
import { getVariant } from './index';

const FACTIONS = ['red', 'blue', 'green', 'yellow'] as const;

// Faction flavour names — display/visual only, stats are identical.
const PIONEER_NAMES: Record<string, string> = {
  red: 'Pact Landcleaver',
  blue: 'Hydro-Shear Pioneer',
  green: 'Swarm Root-Eater',
  yellow: 'Lumen Grader',
};

describe('pioneer (faction forestry/utility vehicle — data groundwork)', () => {
  it('is a registered vehicle class buildable at the foundry', () => {
    expect(VEHICLE_CLASS_IDS).toContain('pioneer');
    const t = UNIT_CLASS_TEMPLATES.pioneer;
    expect(t).toBeDefined();
    expect(t.unitClass).toBe('vehicle');
    expect(t.builtAt).toBe('foundry');
    // Utility vehicle: unarmed, modest mid-low cost, moderate HP, no harvesting/building.
    expect(t.primaryWeapon).toBeNull();
    expect(t.secondaryWeapon).toBeNull();
    expect(t.harvesting).toBeUndefined();
    expect(t.building).toBeUndefined();
    expect(t.cost).toBe(700);
    expect(t.buildTime).toBe(16);
    expect(t.maxHitPoints).toBe(360);
    // Less durable than a medium combat tank (520).
    expect(t.maxHitPoints).toBeLessThan(UNIT_CLASS_TEMPLATES.mediumTank.maxHitPoints);
    // Inert AI role — not part of any doctrine armyMix, so the AI never mass-produces it.
    expect(t.role).toBe('engineer');
    // Reaches the assembled unit defs (so it shows up in the foundry menu).
    expect(UNIT_DEFS.pioneer).toBeDefined();
  });

  it('has a cosmetic visual variant for every faction with its flavour name', () => {
    for (const f of FACTIONS) {
      const v = getVariant(f, 'pioneer');
      expect(v, `${f}:pioneer variant missing`).toBeDefined();
      expect(v!.classId).toBe('pioneer');
      expect(v!.factionId).toBe(f);
      expect(v!.displayName).toBe(PIONEER_NAMES[f]);
      // Variants carry no balance overrides — divergence is display/visual only.
      expect(v!.balanceOverrides ?? []).toEqual([]);
    }
  });
});
