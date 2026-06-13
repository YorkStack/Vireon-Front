// @vitest-environment happy-dom
// (models.ts loads textures via THREE.TextureLoader at import time, which needs
//  a DOM. happy-dom satisfies it; the async image load itself is irrelevant here.)
import { describe, it, expect } from 'vitest';
import type * as THREE from 'three';
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

  it('defaults texGroup to the slot, and carries an explicit normalized texGroup', () => {
    const s: VehicleSpec = {
      ...spec, parts: [
        { prim: 'box', size: [1, 0.5, 2], slot: 'body', pos: [0, 0.5, 0] },                            // group defaults to 'body'
        { prim: 'trap', size: [1.6, 2.0, 0.5, 0.4], slot: 'dark', texGroup: ' Track ', pos: [0.8, 0.3, 0] }, // -> 'track'
        { prim: 'cyl', size: [0.1, 0.1, 1.4], slot: 'dark', texGroup: 'barrel', pos: [0, 1, 0.8], anim: 'turret' },
      ],
    };
    const { parts } = buildPartsFromSpec(s);
    expect(parts.map((p) => p.group)).toEqual(['body', 'track', 'barrel']);
  });

  it('builds a trap (trapezoid prism) part', () => {
    const s: VehicleSpec = { ...spec, parts: [{ prim: 'trap', size: [1.6, 2.0, 0.5, 0.4], slot: 'dark', pos: [0, 0.3, 0] }] };
    const { parts } = buildPartsFromSpec(s);
    expect(parts).toHaveLength(1);
    expect((parts[0].geo.getAttribute('position') as { count: number }).count).toBeGreaterThan(0);
  });

  it('round-trips a real procedural variant: valid, same parts/slots, bbox within tolerance', async () => {
    const THREE = await import('three');
    const { getVariant } = await import('../vehicles');
    const { buildVehicleParts, variantToSpec } = await import('./vehicleModels');
    const { validateSpec } = await import('../vehicles/spec/validate');

    const bbox = (parts: { geo: THREE.BufferGeometry }[]) => {
      const b = new THREE.Box3();
      for (const p of parts) { p.geo.computeBoundingBox(); b.union(p.geo.boundingBox!); }
      return b;
    };

    for (const [faction, classId] of [['blue', 'mediumTank'], ['yellow', 'heavyTank'], ['green', 'harvester']] as const) {
      const v = getVariant(faction, classId)!;
      const orig = buildVehicleParts(v);
      const ob = bbox(orig.parts);
      const size = ob.getSize(new THREE.Vector3());
      const spec2 = variantToSpec(v, { w: size.x, h: size.y, l: size.z });
      expect(validateSpec(spec2).ok, `${faction}:${classId} spec invalid`).toBe(true);
      const rebuilt = buildPartsFromSpec(spec2);
      expect(rebuilt.parts).toHaveLength(orig.parts.length);
      expect(rebuilt.parts.map((p) => p.slot)).toEqual(orig.parts.map((p) => p.slot));
      const rb = bbox(rebuilt.parts);
      // Tolerance covers the spec's 3-decimal rounding (~2cm on a ~2.5m hull).
      for (const k of ['x', 'y', 'z'] as const) {
        expect(Math.abs(rb.min[k] - ob.min[k]), `${faction}:${classId} min.${k}`).toBeLessThan(0.02);
        expect(Math.abs(rb.max[k] - ob.max[k]), `${faction}:${classId} max.${k}`).toBeLessThan(0.02);
      }
    }
  });
});
