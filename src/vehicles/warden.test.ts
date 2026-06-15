// P8: the factory-built Verdant-Warden is a real, playable in-game unit.
// Verifies the cross-cutting wiring — class template, per-faction variants,
// and the green:warden runtime GLB registration — so a regression that drops
// any one link (and silently falls the unit back to procedural / unbuildable)
// is caught.
import { describe, it, expect } from 'vitest';
import { UNIT_CLASS_TEMPLATES, VEHICLE_CLASS_IDS } from '../data/unitClasses';
import { UNIT_DEFS } from '../core/defs';
import { getVariant } from './index';
import { expectedVehicleGlb } from '../render/vehicleGlb';

const FACTIONS = ['red', 'blue', 'green', 'yellow'] as const;

describe('warden (factory-built playable unit)', () => {
  it('is a registered vehicle class buildable at the foundry', () => {
    expect(VEHICLE_CLASS_IDS).toContain('warden');
    const t = UNIT_CLASS_TEMPLATES.warden;
    expect(t).toBeDefined();
    expect(t.unitClass).toBe('vehicle');
    expect(t.builtAt).toBe('foundry');
    expect(t.defaultMovementType).toBe('walker');
    expect(t.primaryWeapon).toBe('tankCannon');
    // Reaches the assembled unit defs (so it shows up in the foundry menu).
    expect(UNIT_DEFS.warden).toBeDefined();
  });

  it('has a walker visual variant for every faction', () => {
    for (const f of FACTIONS) {
      const v = getVariant(f, 'warden');
      expect(v, `${f}:warden variant missing`).toBeDefined();
      expect(v!.movementType).toBe('walker');
      expect(v!.chassis.style).toBe('walker');
      expect(v!.chassis.legCount).toBe(6);
    }
  });

  it('renders the green warden from its baked runtime GLB', () => {
    expect(expectedVehicleGlb('green', 'warden')).toBe(true);
    // Other factions render procedurally (no GLB registered yet).
    expect(expectedVehicleGlb('red', 'warden')).toBe(false);
  });
});
