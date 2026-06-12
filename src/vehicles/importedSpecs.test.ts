import { describe, it, expect } from 'vitest';
import { chooseImportedSpec } from './importedSpecs';
import type { VehicleSpec } from './spec/vehicleSpec';

const spec = { faction: 'blue', vehicleClass: 'mediumTank' } as VehicleSpec;
const map = { './specs/blue/mediumTank.json': spec, './specs/red/scout.json': {} as VehicleSpec };

describe('chooseImportedSpec', () => {
  it('returns the matching imported spec', () => {
    expect(chooseImportedSpec(map, 'blue', 'mediumTank', 'generated')).toBe(spec);
  });
  it('returns null when no spec is imported for that vehicle', () => {
    expect(chooseImportedSpec(map, 'green', 'harvester', 'generated')).toBeNull();
  });
  it('suppresses the spec when status is needsRevision (revert hatch)', () => {
    expect(chooseImportedSpec(map, 'blue', 'mediumTank', 'needsRevision')).toBeNull();
  });
  it('prefers the spec when status is undefined (geometry independent of texture status)', () => {
    expect(chooseImportedSpec(map, 'blue', 'mediumTank', undefined)).toBe(spec);
  });
});
