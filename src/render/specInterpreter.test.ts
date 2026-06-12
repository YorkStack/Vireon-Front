// @vitest-environment happy-dom
// (models.ts loads textures via THREE.TextureLoader at import time, which needs
//  a DOM. happy-dom satisfies it; the async image load itself is irrelevant here.)
import { describe, it, expect } from 'vitest';
import { buildPartsFromSpec } from './specInterpreter';
import type { VehicleSpec } from '../vehicles/spec/vehicleSpec';

const spec: VehicleSpec = {
  schemaVersion: '1.0', faction: 'blue', vehicleClass: 'mediumTank',
  turretPivot: [0, 1, 0],
  footprint: { w: 2, h: 1.5, l: 2 },
  parts: [
    { prim: 'box', size: [1, 0.5, 2], slot: 'body', pos: [0, 0.5, 0] },
    { prim: 'cyl', size: [0.3, 0.3, 0.2], slot: 'dark', pos: [0.8, 0.3, 0], rot: [0, 0, 1.57] },
    { prim: 'box', size: [0.7, 0.3, 0.9], slot: 'body', pos: [0, 1, 0], anim: 'turret' },
  ],
};

describe('buildPartsFromSpec', () => {
  it('produces one Part per spec part with matching slots', () => {
    const { parts } = buildPartsFromSpec(spec);
    expect(parts).toHaveLength(3);
    expect(parts.map((p) => p.slot)).toEqual(['body', 'dark', 'body']);
    expect(parts.filter((p) => p.anim === 'turret')).toHaveLength(1);
  });
  it('returns the turret pivot', () => {
    expect(buildPartsFromSpec(spec).turretPivot).toEqual([0, 1, 0]);
  });
  it('throws on an invalid spec', () => {
    expect(() => buildPartsFromSpec({ ...spec, parts: [] } as VehicleSpec)).toThrow();
  });
});
