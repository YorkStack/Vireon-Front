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
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
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
  // common (weight 3) — the two canopy trees carry the forest read.
  { id: 'forest_canopy_tree', file: 'forest/forest_canopy_tree_v31.glb', target: 3.6, weight: 3 },
  { id: 'highland_canopy_tree', file: 'highland/highland_canopy_tree_v31.glb', target: 3.8, weight: 3 },
  // occasional (weight 2) — hiveshroom reduced from common so its amber cap no
  // longer dominates the scene at high density.
  { id: 'forest_hiveshroom', file: 'forest/forest_hiveshroom_v31.glb', target: 2.2, weight: 2 },
  { id: 'oasis_glowshroom', file: 'oasis/oasis_glowshroom_v31.glb', target: 2.4, weight: 2 },
  { id: 'coastal_coral_tree', file: 'coastal/coastal_coral_tree_v31.glb', target: 2.8, weight: 2 },
  // rare (weight 1) — the crystal cactus is the alien accent (kept, but its weight
  // is now diluted by the earthly desert set below); the fern is emissive.
  { id: 'desert_crystal_cactus', file: 'desert/desert_crystal_cactus_v31.glb', target: 3.0, weight: 1 },
  { id: 'highland_luminous_fern', file: 'highland/highland_luminous_fern_v31.glb', target: 1.1, weight: 1 },
  // Authored desert variant set (real low-poly GLBs, replaces the procedural
  // cactus-arm stopgap). Visual-only; scatter is still global, not biome-aware.
  { id: 'desert_saguaro', file: 'desert/desert_saguaro_v31.glb', target: 3.2, weight: 1 },
  { id: 'desert_barrel', file: 'desert/desert_barrel_v31.glb', target: 1.2, weight: 1 },
  { id: 'desert_opuntia', file: 'desert/desert_opuntia_v31.glb', target: 1.9, weight: 1 },
  { id: 'desert_palm', file: 'desert/desert_palm_v31.glb', target: 4.0, weight: 1 },
];

interface VegPrim { geo: THREE.BufferGeometry; mat: THREE.Material; nodeMat: THREE.Matrix4; }
// `variants` (trees only) holds per-silhouette augmentation prim sets (sparse/medium/
// dense). Base GLB prims live in `prims`; each placement is deterministically assigned
// one variant index at build time and that variant's branches/leaves are instanced too.
interface VegTemplate { def: VegAssetDef; prims: VegPrim[]; baseScale: number; tris: number; variants?: VegPrim[][]; }

const templates = new Map<string, VegTemplate>();
let loaded = false;

// ── Visual-only material readability pass ────────────────────────────────────
// The baked v3.1 albedo reads placeholder-ish at game zoom: trunks/stalks are
// near-black (not brown) and canopies/caps are flat single-colour blobs. We nudge
// the (white × texture) materials toward readable organic zones by material NAME:
//   1. a base `color` tint (+ small emissive floor for woody parts so near-black
//      bark survives night lighting), and
//   2. a lightweight object-space procedural-detail shader (bark grooves, leaf
//      tonal patches, cap rings, cactus ribs) injected via onBeforeCompile.
// Materials are shared per-template and touched once at preload: the shader
// compiles once, runs per-fragment only (no per-instance clone, no per-frame
// work, no extra draw calls). Stylised alien accents (emissive glow / crystal)
// are left exactly as authored so the sci-fi read survives.
export type VegZone = 'woody' | 'foliage' | 'cap' | 'node' | 'cactus' | null;
export function vegZoneOf(name: string): VegZone {
  const n = name.toLowerCase();
  if (/bark|trunk|stalk|stem/.test(n)) return 'woody';   // incl. palm_trunk
  if (/canopy|leaf|fan|frond/.test(n)) return 'foliage'; // incl. palm_frond
  if (/cap|under/.test(n)) return 'cap';
  if (/pod/.test(n)) return 'node';        // tree pods/fruit dots → subtle, not bright
  if (/body/.test(n)) return 'cactus';     // incl. authored cactus_body
  return null;
}

// Cheap value-noise (object space) shared by the per-zone detail snippets.
const VG_NOISE = `
float vgHash(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}
float vgNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
 return mix(mix(mix(vgHash(i),vgHash(i+vec3(1,0,0)),f.x),mix(vgHash(i+vec3(0,1,0)),vgHash(i+vec3(1,1,0)),f.x),f.y),
   mix(mix(vgHash(i+vec3(0,0,1)),vgHash(i+vec3(1,0,1)),f.x),mix(vgHash(i+vec3(0,1,1)),vgHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
`;
// Per-zone fragment body. Modulates diffuseColor (= map × tint) by object-space
// position `vVegPos`, so the pattern is stable on the mesh regardless of the
// instance's random yaw. Multiplicative → stays in a safe range.
const VG_DETAIL: Record<Exclude<VegZone, null>, string> = {
  woody: `
    vec3 P=vVegPos;
    float ang=atan(P.x,P.z);
    float ribs=0.5+0.5*sin(ang*11.0 + vgNoise(P*3.0)*1.8);             // primary angular bark ridges
    float ribs2=0.5+0.5*sin(ang*23.0);                                // finer secondary ridges
    float plates=0.5+0.5*sin(P.y*4.0 + vgNoise(P*1.6)*2.2);           // stacked bark plates / stem bands
    float streak=vgNoise(vec3(P.x*8.0,P.y*1.1,P.z*8.0));              // vertical brown/tan streaks
    float root=smoothstep(0.0,0.55,P.y);                              // darker base/roots
    // strong light/dark contour: deep grooves, vertical streaks, dark root.
    diffuseColor.rgb*= mix(0.40,1.16,ribs)*mix(0.84,1.07,ribs2)*mix(0.90,1.05,plates)*mix(0.66,1.30,streak)*mix(0.52,1.06,root);`,
  foliage: `
    vec3 P=vVegPos;
    float patch=vgNoise(P*1.8);                                       // big light/dark leaf masses
    float cluster=vgNoise(P*4.6);                                     // leaf-cluster facets
    float leaflet=vgNoise(P*11.0);                                    // fine leaflet break-up
    diffuseColor.rgb*= mix(0.58,1.22,patch)*mix(0.84,1.12,cluster)*mix(0.93,1.05,leaflet);
    diffuseColor.g*=1.05; diffuseColor.r*=mix(1.05,0.93,patch); diffuseColor.b*=0.95;`, // highs yellow-green, shadows blue-green
  cap: `
    vec3 P=vVegPos;
    float rad=length(P.xz);
    float rings=0.5+0.5*sin(rad*22.0);                                // tight concentric rings
    float bands=0.5+0.5*sin(rad*7.0);                                 // broad concentric bands
    float radial=0.5+0.5*sin(atan(P.x,P.z)*14.0);                     // radial grooves
    float spots=step(0.82,vgNoise(P*10.0));                           // darker speckles
    diffuseColor.rgb*= mix(0.72,1.12,rings)*mix(0.88,1.06,bands)*mix(0.92,1.05,radial)*mix(1.0,0.6,spots);`,
  node: ``,                                                           // pods hidden on normal trees (no detail injected)
  cactus: `
    vec3 P=vVegPos;
    float ribs=0.5+0.5*sin(atan(P.x,P.z)*10.0);                       // vertical succulent ribs
    float mottle=vgNoise(P*3.0);
    diffuseColor.rgb*= mix(0.72,1.06,ribs)*mix(0.9,1.08,mottle);`,
};

/** Inject the object-space procedural-detail shader for a zone (once). */
function addVegDetail(m: THREE.MeshStandardMaterial, zone: Exclude<VegZone, null>): void {
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = 'varying vec3 vVegPos;\n' + shader.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vVegPos = position;');
    shader.fragmentShader = 'varying vec3 vVegPos;\n' + VG_NOISE + shader.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>\n  {${VG_DETAIL[zone]}}`);
  };
}

/** Apply the readability tint + detail shader to one template material
 *  (idempotent-safe via a userData guard). Preserves the embedded map + any
 *  authored emissive glow. `assetId` lets us drop tree-only glow nodes. */
function enhanceVegMaterial(material: THREE.Material, assetId: string): void {
  const m = material as THREE.MeshStandardMaterial;
  if (!('color' in m) || m.userData.vegTinted) return;
  // Stylised emissive accents (glow/crystal/vein): preserved on glow-identity
  // plants (glowshroom, luminous fern, crystal cactus), but REMOVED from normal
  // trees — the pale glow nodes there read as distracting fruit dots.
  if (m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) > 0.001) {
    if (/tree/.test(assetId)) m.userData.vegHide = true;
    return;
  }
  const zone = vegZoneOf(m.name || '');
  if (!zone) return;
  // Tree pod dots (pod_f) read as distracting bright fruit → removed entirely, like
  // the emissive glow nodes above. The procedural leaf islands carry the green mass.
  if (zone === 'node') { m.userData.vegHide = true; m.userData.vegTinted = true; return; }
  m.userData.vegTinted = true;
  switch (zone) {
    case 'woody': // near-black bark → readable brown (tint + emissive floor)
      m.color.setHex(0x6b4a2c);
      m.emissive.setHex(0x3a2614); m.emissiveIntensity = 0.30;
      break;
    case 'foliage': // flat green → richer leaf green, keep brightness
      m.color.setHex(0x7ab85f);
      m.emissive.setHex(0x244d1c); m.emissiveIntensity = 0.10;
      break;
    case 'cap': // fungal caps stay warm amber; small floor lifts dark gills
      m.color.setHex(0xc79a52);
      m.emissive.setHex(0x3a2a12); m.emissiveIntensity = 0.12;
      break;
    case 'cactus': // desert succulent body → sage green
      m.color.setHex(0x7fa564);
      m.emissive.setHex(0x2c4a22); m.emissiveIntensity = 0.08;
      break;
  }
  addVegDetail(m, zone);
  m.needsUpdate = true;
}

// ── Procedural geometry augmentation (visual-only) ───────────────────────────
// The v3.1 tree GLBs are sparse; this adds a few deterministic branches + leaf
// islands (reusing the asset's own bark/foliage materials) and gives the single-
// column cactus saguaro arms. Built once per template in the GLB's local scene
// space and instanced like every other primitive — no per-frame work, no clones,
// just a couple more InstancedMeshes per augmented asset.
const _UP = new THREE.Vector3(0, 1, 0);
/** A tapered cylinder spanning a→b (cheap 6-sided), reusing as a branch/arm. */
function limbGeo(a: THREE.Vector3, b: THREE.Vector3, r: number): THREE.BufferGeometry {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = Math.max(1e-3, dir.length());
  const g = new THREE.CylinderGeometry(r * 0.7, r, len, 6, 1);
  const q = new THREE.Quaternion().setFromUnitVectors(_UP, dir.normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(
    new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
  return g;
}
/** A squashed low-poly icosphere as a leaf cluster centred at c. */
function leafIslandGeo(c: THREE.Vector3, r: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(r, 0);
  g.scale(1, 0.72, 1);
  g.translate(c.x, c.y, c.z);
  return g;
}
const _GOLDEN = 2.39996323; // radians — even angular spread without RNG

/** Build one branch+leaf augmentation set with `count` asymmetric branches.
 *  Layout is deterministic per (seed, branch) via hash2 — organic, non-mirrored. */
function buildBranchSet(bark: VegPrim, foliage: VegPrim, box: THREE.Box3, count: number, seed: number): VegPrim[] {
  const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
  const h = box.max.y - box.min.y;
  const rad = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 0.5;
  const branchGeos: THREE.BufferGeometry[] = [], leafGeos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < count; i++) {
    const j1 = hash2(seed * 13 + i * 7 + 1, seed * 5 + i * 3 + 2);
    const j2 = hash2(seed * 9 + i * 11 + 3, seed * 17 + i * 2 + 4);
    const j3 = hash2(seed * 3 + i * 5 + 5, seed * 19 + i * 13 + 6);
    const ang = i * _GOLDEN + seed * 1.7 + (j1 - 0.5) * 0.9;          // asymmetric, non-mirrored spread
    const t = count > 1 ? i / (count - 1) : 0;
    const baseY = box.min.y + h * (0.36 + 0.38 * t + (j2 - 0.5) * 0.06);
    const out = rad * (0.48 + 0.30 * j3);
    const tipUp = h * (0.10 + 0.10 * j1);
    const a = new THREE.Vector3(cx + Math.cos(ang) * rad * 0.05, baseY, cz + Math.sin(ang) * rad * 0.05);
    const b = new THREE.Vector3(cx + Math.cos(ang) * out, baseY + tipUp, cz + Math.sin(ang) * out);
    branchGeos.push(limbGeo(a, b, h * 0.018));
    leafGeos.push(leafIslandGeo(b, h * (0.10 + 0.03 * j2)));
  }
  return [
    { geo: mergeGeometries(branchGeos)!, mat: bark.mat, nodeMat: new THREE.Matrix4() },
    { geo: mergeGeometries(leafGeos)!, mat: foliage.mat, nodeMat: new THREE.Matrix4() },
  ];
}

/** Three deterministic tree silhouettes: sparse(~3) / medium(~5) / dense(~8) branches,
 *  each with branch-tip leaf islands. Returns [] if the asset lacks bark+foliage prims. */
function buildTreeVariants(prims: VegPrim[], box: THREE.Box3): VegPrim[][] {
  const bark = prims.find((p) => vegZoneOf((p.mat as THREE.Material).name || '') === 'woody');
  const foliage = prims.find((p) => vegZoneOf((p.mat as THREE.Material).name || '') === 'foliage');
  if (!bark || !foliage) return [];
  return [3, 5, 8].map((count, i) => buildBranchSet(bark, foliage, box, count, i + 1));
}

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
        for (const mat of mats) { enhanceVegMaterial(mat, def.id); prims.push({ geo, mat, nodeMat: mesh.matrixWorld.clone() }); }
        const idx = geo.getIndex();
        tris += (idx ? idx.count : geo.getAttribute('position').count) / 3;
        box.expandByObject(mesh);
      });
      // Procedural enrichment (visual-only): per-silhouette branch variants on
      // trees. (Cactus diversity now comes from the authored desert GLBs, so the
      // old procedural saguaro-arm stopgap has been retired.)
      let variants: VegPrim[][] | undefined;
      if (/tree/.test(def.id)) variants = buildTreeVariants(prims, box);
      const h = Math.max(0.001, box.max.y - box.min.y);
      templates.set(def.id, { def, prims, baseScale: def.target / h, tris, variants });
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

  // bucket placements per asset id (+ deterministic silhouette variant for trees)
  type Inst = { p: typeof placements[number]; s: number; yaw: number; variant: number };
  const byAsset = new Map<string, Inst[]>();
  for (let i = 0; i < placements.length; i++) {
    const r1 = hash2(i * 2 + 7, i * 5 + 11);
    const r2 = hash2(i * 3 + 13, i * 9 + 17);
    const r3 = hash2(i * 7 + 19, i * 4 + 23);
    const r4 = hash2(i * 11 + 3, i * 6 + 5);
    const id = pickAsset(r1);
    const s = 0.85 + r2 * 0.30;            // ±15% scale jitter
    const yaw = r3 * Math.PI * 2;          // full random Y rotation
    const variant = Math.min(2, (r4 * 3) | 0); // 0 sparse / 1 medium / 2 dense
    (byAsset.get(id) ?? byAsset.set(id, []).get(id)!).push({ p: placements[i], s, yaw, variant });
  }

  const up = new THREE.Vector3(0, 1, 0);
  const world = new THREE.Matrix4(), place = new THREE.Matrix4();
  const pos = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  // One InstancedMesh for `prim` over `entries` (matrices baked once, no per-frame work).
  const addMesh = (prim: VegPrim, entries: Inst[], baseScale: number, name: string) => {
    const im = new THREE.InstancedMesh(prim.geo, prim.mat, entries.length);
    im.castShadow = true; im.receiveShadow = true;
    im.name = name;
    for (let i = 0; i < entries.length; i++) {
      const { p, s, yaw } = entries[i];
      q.setFromAxisAngle(up, yaw);
      pos.set(p.x, p.y, p.z);
      sc.setScalar(baseScale * s);
      place.compose(pos, q, sc);
      world.multiplyMatrices(place, prim.nodeMat); // bake GLB-internal node xform
      im.setMatrixAt(i, world);
    }
    im.instanceMatrix.needsUpdate = true;
    group.add(im);
  };
  for (const [id, list] of byAsset) {
    const tmpl = templates.get(id);
    if (!tmpl || !list.length) continue;
    // base GLB prims — instanced over the whole asset bucket (hidden nodes/glow skipped)
    for (const prim of tmpl.prims) {
      if (prim.mat.userData.vegHide) continue;
      addMesh(prim, list, tmpl.baseScale, `veg-${id}`);
    }
    // per-silhouette-variant augmentation (trees): each variant over its sub-bucket
    if (tmpl.variants) {
      for (let v = 0; v < tmpl.variants.length; v++) {
        const sub = list.filter((e) => e.variant === v);
        if (!sub.length) continue;
        for (const prim of tmpl.variants[v]) addMesh(prim, sub, tmpl.baseScale, `veg-${id}-v${v}`);
      }
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
