// Guard test for the Blender-generated rock assets. Verifies each rock_*.glb
// exists and carries BOTH a POSITION and a COLOR_0 vertex attribute — the latter
// is the baked AO the in-engine triplanar material multiplies in. If the Blender
// export flags ever drop vertex colors, this fails loudly instead of the rocks
// silently rendering flat. Parses the GLB JSON chunk directly (no GL/DOM needed).
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROCK_DIR = join(process.cwd(), 'public/assets/terrain/rock');
const ROCK_FILES = ['rock_01', 'rock_02', 'rock_03', 'rock_04', 'rock_05'].map((n) => `${n}.glb`);

/** Extract and parse the JSON chunk of a binary glTF (GLB) buffer. */
function readGlbJson(buf: Buffer): any {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  expect(dv.getUint32(0, true)).toBe(0x46546c67); // 'glTF' magic
  expect(dv.getUint32(4, true)).toBe(2); // version 2
  // First chunk after the 12-byte header must be the JSON chunk.
  const chunkLen = dv.getUint32(12, true);
  const chunkType = dv.getUint32(16, true);
  expect(chunkType).toBe(0x4e4f534a); // 'JSON'
  const json = new TextDecoder().decode(new Uint8Array(buf.buffer, buf.byteOffset + 20, chunkLen));
  return JSON.parse(json);
}

describe('rock GLB assets', () => {
  for (const file of ROCK_FILES) {
    it(`${file} exists and has POSITION + COLOR_0 attributes`, () => {
      const path = join(ROCK_DIR, file);
      expect(existsSync(path), `${file} missing — run: blender --background --python tools/blender/rocks.py`).toBe(true);
      const gltf = readGlbJson(readFileSync(path));
      expect(Array.isArray(gltf.meshes) && gltf.meshes.length).toBeTruthy();
      const prims = gltf.meshes.flatMap((m: any) => m.primitives ?? []);
      expect(prims.length).toBeGreaterThan(0);
      // Single material (InstancedMesh requirement): exactly one mesh, one primitive.
      expect(gltf.meshes.length).toBe(1);
      expect(prims.length).toBe(1);
      const attrs = prims[0].attributes ?? {};
      expect(attrs.POSITION, 'no POSITION attribute').toBeDefined();
      expect(attrs.COLOR_0, 'no COLOR_0 (baked vertex AO) attribute').toBeDefined();
    });
  }
});
