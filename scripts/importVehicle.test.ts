import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { planImport, applyImport } from './importVehicle';

let bundle: string;

const spec = {
  schemaVersion: '1.0', faction: 'blue', vehicleClass: 'mediumTank',
  footprint: { w: 2, h: 1.9, l: 2.3 },
  parts: [{ prim: 'box', size: [1, 0.5, 2], slot: 'body', pos: [0, 0.5, 0] }],
};

beforeAll(() => {
  bundle = mkdtempSync(join(tmpdir(), 'veh-bundle-'));
  writeFileSync(join(bundle, 'geometry.json'), JSON.stringify(spec));
  writeFileSync(join(bundle, 'baseColor.png'), 'PNG-STUB');
  writeFileSync(join(bundle, 'meta.json'), '{}');
});
afterAll(() => rmSync(bundle, { recursive: true, force: true }));

describe('planImport', () => {
  it('plans correct destinations for a valid bundle', () => {
    const p = planImport(bundle);
    expect(p.ok).toBe(true);
    expect(p.statusId).toBe('blue_mediumTank');
    const dests = p.actions.copy.map((c) => c.to);
    expect(dests).toContain('src/vehicles/specs/blue/mediumTank.json');
    expect(dests).toContain('public/assets/vehicles/blue/medium_tank/baseColor.png');
    expect(p.actions.statusFlip).toEqual({ id: 'blue_mediumTank', to: 'generated' });
  });
  it('rejects a bundle whose geometry.json is an invalid spec', () => {
    const bad = mkdtempSync(join(tmpdir(), 'veh-bad-'));
    writeFileSync(join(bad, 'geometry.json'), JSON.stringify({ ...spec, parts: [] }));
    const p = planImport(bad);
    expect(p.ok).toBe(false);
    expect(p.errors.length).toBeGreaterThan(0);
    rmSync(bad, { recursive: true, force: true });
  });
  it('rejects a missing geometry.json', () => {
    expect(planImport(tmpdir()).ok).toBe(false);
  });

  it('carries a custom class definition from meta.classDef', () => {
    const b = mkdtempSync(join(tmpdir(), 'veh-custom-'));
    const classDef = { id: 'frigate', displayName: 'Frigate', role: 'ship', tilesWide: 4 };
    writeFileSync(join(b, 'geometry.json'), JSON.stringify({ ...spec, vehicleClass: 'frigate' }));
    writeFileSync(join(b, 'meta.json'), JSON.stringify({ classDef }));
    const p = planImport(b);
    expect(p.ok).toBe(true);
    expect(p.classDef).toEqual(classDef);
    rmSync(b, { recursive: true, force: true });
  });

  it('does not attach a classDef for a built-in class', () => {
    expect(planImport(bundle).classDef).toBeUndefined();
  });

  it('registers a custom class into customClasses.json on apply (idempotent)', () => {
    const repo = mkdtempSync(join(tmpdir(), 'veh-repo-'));
    const b = mkdtempSync(join(tmpdir(), 'veh-apply-'));
    const classDef = { id: 'frigate', displayName: 'Frigate', role: 'ship', tilesWide: 4 };
    writeFileSync(join(b, 'geometry.json'), JSON.stringify({ ...spec, vehicleClass: 'frigate' }));
    writeFileSync(join(b, 'meta.json'), JSON.stringify({ classDef }));
    const p = planImport(b);
    applyImport(p, repo);
    applyImport(p, repo);  // second apply must not duplicate
    const list = JSON.parse(readFileSync(join(repo, 'src/data/customClasses.json'), 'utf8'));
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual(classDef);
    expect(existsSync(join(repo, 'src/vehicles/specs/blue/frigate.json'))).toBe(true);
    rmSync(repo, { recursive: true, force: true }); rmSync(b, { recursive: true, force: true });
  });
});
