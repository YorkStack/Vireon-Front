// Guard for the component-factory coordinate & node contract (spec §2), checked
// against the de-risk mini-assembly GLB. If a Blender helper ever breaks the
// contract (forward axis, turret node, muzzle socket, canonical material names)
// this fails loudly. Parses the GLB JSON chunk directly (no GL/DOM needed).
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const GLB = join(process.cwd(), '../vireon-design-studio/tools/blender/out/minislice.glb');
const CANONICAL = ['mat_body', 'mat_dark', 'mat_accent', 'mat_light', 'mat_smooth', 'mat_roof'];

function readGlbJson(buf: Buffer): any {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  expect(dv.getUint32(0, true)).toBe(0x46546c67); // 'glTF'
  const chunkLen = dv.getUint32(12, true);
  expect(dv.getUint32(16, true)).toBe(0x4e4f534a); // 'JSON'
  return JSON.parse(new TextDecoder().decode(new Uint8Array(buf.buffer, buf.byteOffset + 20, chunkLen)));
}

describe('factory coordinate/node contract (mini-assembly)', () => {
  it('mini-assembly GLB exists', () => {
    expect(existsSync(GLB), 'run: blender --background --python tools/blender/_minislice.py (studio repo)').toBe(true);
  });

  const gltf = existsSync(GLB) ? readGlbJson(readFileSync(GLB)) : null;
  const node = (name: string) => (gltf?.nodes ?? []).find((n: any) => n.name === name);

  it('has a separate "turret" node', () => {
    const t = node('turret');
    expect(t, 'no node named turret').toBeDefined();
    // turret carries its own mesh (not merged into the chassis static mesh)
    expect(t.mesh !== undefined || (t.children?.length ?? 0) > 0).toBe(true);
  });

  it('has a "muzzle" socket pointing forward (+Z)', () => {
    const m = node('muzzle');
    expect(m, 'no node named muzzle').toBeDefined();
    const t = m.translation ?? [0, 0, 0];
    // forward is +Z and dominant; this proves the export axis contract.
    expect(t[2]).toBeGreaterThan(1.0);
    expect(Math.abs(t[2])).toBeGreaterThan(Math.abs(t[0]));
  });

  it('turret_ring sits up (+Y), not forward', () => {
    const r = node('turret_ring');
    expect(r, 'no node named turret_ring').toBeDefined();
    const t = r.translation ?? [0, 0, 0];
    expect(t[1]).toBeGreaterThan(0.5); // up = +Y
    expect(Math.abs(t[2])).toBeLessThan(0.3); // not forward
  });

  it('uses only canonical slot material names', () => {
    const names = (gltf?.materials ?? []).map((m: any) => m.name);
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) expect(CANONICAL, `non-canonical material ${n}`).toContain(n);
  });
});
