// GATED, VISUAL-ONLY GLB vegetation path (approved Vegetation v3.1 assets).
//
// This is an OPT-IN integration test path selected by the `?veg=glb` query
// parameter (see vegMode below). It NEVER replaces the shipping sprite
// vegetation by default. It adds no collision, no selection, no health, no
// pathfinding, no placement blocking and changes no gameplay/balance/terrain.
//
// Rendering strategy (mirrors the rock instancing in props.ts):
//   * preload the 7 v3.1 GLB templates once (cached)
//   * extract each template's primitives (geometry + material + baked node xform)
//   * scatter deterministically with the existing scatterVegInstances()
//   * emit ONE InstancedMesh per (asset, primitive) — all matrices baked once,
//     no per-frame rebuild, no per-instance material recompile
//   * graceful fallback: any load failure leaves the group empty (the caller
//     keeps the procedural/sprite world intact)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GameMap } from '../map/map';
import { hash2 } from './terrainNoise';
import { scatterVegInstances } from './props';

export type VegMode = 'default' | 'sprite' | 'glb' | 'none';

/** Approved Vegetation v3.1 asset registry. `target` = desired world height (so
 *  per-asset scale = target / bboxHeight); `weight` = scatter frequency tier. */
interface VegAssetDef { id: string; file: string; target: number; weight: number; }
// Assets are served under per-biome subfolders mirroring the approved source set.
const VEG_DIR = '/assets/vegetation/glb_v31';
export const VEG_V31_ASSETS: VegAssetDef[] = [
  // common (weight 3)
  { id: 'forest_canopy_tree', file: 'forest/forest_canopy_tree_v31.glb', target: 3.6, weight: 3 },
  { id: 'highland_canopy_tree', file: 'highland/highland_canopy_tree_v31.glb', target: 3.8, weight: 3 },
  { id: 'forest_hiveshroom', file: 'forest/forest_hiveshroom_v31.glb', target: 2.2, weight: 3 },
  // occasional (weight 2)
  { id: 'oasis_glowshroom', file: 'oasis/oasis_glowshroom_v31.glb', target: 2.4, weight: 2 },
  { id: 'coastal_coral_tree', file: 'coastal/coastal_coral_tree_v31.glb', target: 2.8, weight: 2 },
  // rare (weight 1) — cactus is the most distinctive + near-highest tris; the
  // fern is emissive and should not dominate the scene.
  { id: 'desert_crystal_cactus', file: 'desert/desert_crystal_cactus_v31.glb', target: 3.0, weight: 1 },
  { id: 'highland_luminous_fern', file: 'highland/highland_luminous_fern_v31.glb', target: 1.1, weight: 1 },
];

interface VegPrim { geo: THREE.BufferGeometry; mat: THREE.Material; nodeMat: THREE.Matrix4; }
interface VegTemplate { def: VegAssetDef; prims: VegPrim[]; baseScale: number; tris: number; }

const templates = new Map<string, VegTemplate>();
let loaded = false;

/** Preload + cache the v3.1 GLB templates. Never throws (logs + skips in DEV). */
export async function preloadVegetationGlbs(): Promise<void> {
  if (loaded) return;
  const loader = new GLTFLoader();
  for (const def of VEG_V31_ASSETS) {
    if (templates.has(def.id)) continue;
    try {
      const gltf = await loader.loadAsync(`${VEG_DIR}/${def.file}`);
      gltf.scene.updateMatrixWorld(true);
      const prims: VegPrim[] = [];
      let tris = 0;
      const box = new THREE.Box3();
      gltf.scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const geo = mesh.geometry as THREE.BufferGeometry;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) prims.push({ geo, mat, nodeMat: mesh.matrixWorld.clone() });
        const idx = geo.getIndex();
        tris += (idx ? idx.count : geo.getAttribute('position').count) / 3;
        box.expandByObject(mesh);
      });
      const h = Math.max(0.001, box.max.y - box.min.y);
      templates.set(def.id, { def, prims, baseScale: def.target / h, tris });
    } catch (e) {
      if (import.meta.env.DEV) console.warn(`[veg-glb] load failed ${def.id} → skipped`, e);
    }
  }
  loaded = true;
}

/** Deterministic weighted asset pick from a [0,1) random. */
const WEIGHTED: string[] = VEG_V31_ASSETS.flatMap((a) => Array(a.weight).fill(a.id));
function pickAsset(r: number): string { return WEIGHTED[Math.min(WEIGHTED.length - 1, (r * WEIGHTED.length) | 0)]; }

/**
 * Build the v3.1 GLB vegetation as instanced meshes. Deterministic for a given
 * (map, count). Returns a Group ready to drop into the terrain props group.
 * Visual-only: no collision / selection / health / pathfinding / blocking.
 */
export function buildVegetationGlbInstances(map: GameMap, count: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'vegetation-glb-v31';
  if (!templates.size || count <= 0) return group;

  // Reuse the shipping scatter for grounded, warp-aligned positions (same logic
  // as the sprite path) — we only override the per-asset choice/scale/rotation.
  const placements = scatterVegInstances(map, {
    count, salt: 101, valleyBias: false, hMin: 1, hMax: 1, wRatio: 1, yOff: -0.03, texCount: 1,
  });

  // bucket placements per asset id
  const byAsset = new Map<string, { p: typeof placements[number]; s: number; yaw: number }[]>();
  for (let i = 0; i < placements.length; i++) {
    const r1 = hash2(i * 2 + 7, i * 5 + 11);
    const r2 = hash2(i * 3 + 13, i * 9 + 17);
    const r3 = hash2(i * 7 + 19, i * 4 + 23);
    const id = pickAsset(r1);
    const s = 0.85 + r2 * 0.30;            // ±15% scale jitter
    const yaw = r3 * Math.PI * 2;          // full random Y rotation
    (byAsset.get(id) ?? byAsset.set(id, []).get(id)!).push({ p: placements[i], s, yaw });
  }

  const up = new THREE.Vector3(0, 1, 0);
  const world = new THREE.Matrix4(), place = new THREE.Matrix4();
  const pos = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  for (const [id, list] of byAsset) {
    const tmpl = templates.get(id);
    if (!tmpl || !list.length) continue;
    for (const prim of tmpl.prims) {
      const im = new THREE.InstancedMesh(prim.geo, prim.mat, list.length);
      im.castShadow = true; im.receiveShadow = true;
      im.name = `veg-${id}`;
      for (let i = 0; i < list.length; i++) {
        const { p, s, yaw } = list[i];
        q.setFromAxisAngle(up, yaw);
        pos.set(p.x, p.y, p.z);
        sc.setScalar(tmpl.baseScale * s);
        place.compose(pos, q, sc);
        world.multiplyMatrices(place, prim.nodeMat); // bake GLB-internal node xform
        im.setMatrixAt(i, world);
      }
      im.instanceMatrix.needsUpdate = true;
      group.add(im);
    }
  }
  return group;
}

/**
 * Resolve the gated vegetation mode + optional count from the URL query.
 * SSR/test-safe (no `window` → defaults). `default` keeps today's behavior.
 */
export function vegModeFromQuery(): { mode: VegMode; count: number | null } {
  if (typeof window === 'undefined') return { mode: 'default', count: null };
  const q = new URLSearchParams(window.location.search);
  const raw = (q.get('veg') || '').toLowerCase();
  const mode: VegMode = raw === 'sprite' || raw === 'glb' || raw === 'none' ? raw : 'default';
  const cRaw = q.get('vegCount');
  const count = cRaw != null && /^\d+$/.test(cRaw) ? Math.max(0, Math.min(2000, parseInt(cRaw, 10))) : null;
  return { mode, count };
}
