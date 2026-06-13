import { describe, it, expect } from 'vitest';
import { validateSpec } from './validate';
import type { VehicleSpec } from './vehicleSpec';

const base: VehicleSpec = {
  schemaVersion: '1.0', faction: 'blue', vehicleClass: 'mediumTank',
  footprint: { w: 2, h: 1.9, l: 2.3 },
  parts: [{ prim: 'box', size: [1, 0.5, 2], slot: 'body', pos: [0, 0.5, 0] }],
};

describe('validateSpec', () => {
  it('accepts a minimal valid spec', () => {
    expect(validateSpec(base).ok).toBe(true);
  });
  it('accepts an optional non-uniform scale', () => {
    expect(validateSpec({ ...base, parts: [{ ...base.parts[0], scale: [1, 0.66, 1] }] }).ok).toBe(true);
  });
  it('rejects wrong arg arity', () => {
    const bad = { ...base, parts: [{ ...base.parts[0], size: [1, 2] }] };
    expect(validateSpec(bad as VehicleSpec).ok).toBe(false);
  });
  it('accepts a trap prim with 4 args and an optional texGroup', () => {
    const ok = { ...base, parts: [{ prim: 'trap' as const, size: [1.6, 2.0, 0.5, 0.4], slot: 'dark' as const, texGroup: 'track', pos: [0.8, 0.3, 0] as [number, number, number] }] };
    expect(validateSpec(ok).ok).toBe(true);
    const badArity = { ...base, parts: [{ ...ok.parts[0], size: [1, 2, 3] }] };
    expect(validateSpec(badArity as VehicleSpec).ok).toBe(false);
  });
  it('rejects an empty/blank texGroup', () => {
    expect(validateSpec({ ...base, parts: [{ ...base.parts[0], texGroup: '   ' }] } as VehicleSpec).ok).toBe(false);
  });
  it('rejects unknown slot/prim/faction', () => {
    expect(validateSpec({ ...base, faction: 'purple' as never }).ok).toBe(false);
    expect(validateSpec({ ...base, parts: [{ ...base.parts[0], slot: 'x' as never }] }).ok).toBe(false);
    expect(validateSpec({ ...base, parts: [{ ...base.parts[0], prim: 'blob' as never }] }).ok).toBe(false);
  });
  it('requires turretPivot when a turret part exists', () => {
    const t = { ...base, parts: [{ ...base.parts[0], anim: 'turret' as const }] };
    expect(validateSpec(t).ok).toBe(false);
    expect(validateSpec({ ...t, turretPivot: [0, 1, 0] as [number, number, number] }).ok).toBe(true);
  });
  it('rejects non-finite numbers', () => {
    const bad = { ...base, parts: [{ ...base.parts[0], pos: [0, NaN, 0] as [number, number, number] }] };
    expect(validateSpec(bad).ok).toBe(false);
  });
  it('flags a part center far outside the footprint (clamp guard)', () => {
    const bad = { ...base, parts: [{ ...base.parts[0], pos: [99, 0, 0] as [number, number, number] }] };
    expect(validateSpec(bad).ok).toBe(false);
  });
  it('rejects an empty parts array', () => {
    expect(validateSpec({ ...base, parts: [] }).ok).toBe(false);
  });
});
