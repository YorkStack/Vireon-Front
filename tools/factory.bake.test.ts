// Guard for the baked runtime vehicle GLB (spec §5 post-bake invariants). Ensures
// the optimize/merge step keeps the turret as its own node, the muzzle socket as
// a child of the turret, canonical material names, and the tri budget. If a bake
// regression breaks any of these, the in-game GLB path would silently misbehave.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(process.cwd(), '../vireon-design-studio/exports/red_mediumTank');
const GLB = join(DIR, 'red_mediumTank_final.glb');
const META = join(DIR, 'metadata.json');
const CANONICAL = ['mat_body', 'mat_dark', 'mat_accent', 'mat_light', 'mat_smooth', 'mat_roof'];
const TRI_BUDGET = 4000;

function readGlbJson(buf: Buffer): any {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  expect(dv.getUint32(0, true)).toBe(0x46546c67);
  const len = dv.getUint32(12, true);
  expect(dv.getUint32(16, true)).toBe(0x4e4f534a);
  return JSON.parse(new TextDecoder().decode(new Uint8Array(buf.buffer, buf.byteOffset + 20, len)));
}

describe('baked red_mediumTank runtime GLB', () => {
  it('exists', () => {
    expect(existsSync(GLB), 'run: blender --background --python tools/blender/build_vehicle.py -- tools/blender/assemblies/red_mediumTank.json').toBe(true);
  });

  const gltf = existsSync(GLB) ? readGlbJson(readFileSync(GLB)) : null;
  const nodes = gltf?.nodes ?? [];
  const byName = (n: string) => nodes.find((x: any) => x.name === n);

  it('keeps "turret" as its own mesh node, separate from the static hull', () => {
    const turret = byName('turret');
    expect(turret, 'no turret node').toBeDefined();
    expect(turret.mesh, 'turret has no mesh').toBeDefined();
    const hull = byName('hull_static');
    expect(hull, 'no hull_static node').toBeDefined();
    expect(hull.mesh).toBeDefined();
    expect(turret.mesh).not.toBe(hull.mesh);
  });

  it('keeps the muzzle socket as a child of the turret', () => {
    const turret = byName('turret');
    const muzzleIdx = nodes.findIndex((x: any) => x.name === 'muzzle');
    expect(muzzleIdx, 'no muzzle node').toBeGreaterThanOrEqual(0);
    expect(turret.children ?? [], 'muzzle is not a child of turret').toContain(muzzleIdx);
  });

  it('uses only canonical slot material names', () => {
    const names = (gltf?.materials ?? []).map((m: any) => m.name);
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) expect(CANONICAL, `non-canonical ${n}`).toContain(n);
  });

  it('metadata reports turret+muzzle nodes and stays within the tri budget', () => {
    expect(existsSync(META)).toBe(true);
    const meta = JSON.parse(readFileSync(META, 'utf8'));
    expect(meta.nodes).toEqual(expect.arrayContaining(['turret', 'muzzle']));
    expect(meta.tris).toBeLessThanOrEqual(TRI_BUDGET);
  });
});
