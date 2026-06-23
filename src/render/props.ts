// Static environment props: Y-locked (cylindrical) instanced vegetation
// billboards + a shared blob-shadow mesh, and (later) glTF rocks. Split out of
// terrain.ts so the prop systems stay focused and unit-testable. Placement rides
// the same horizontal warp as the terrain (terrainNoise), so props sit flush.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GameMap, TILE } from '../map/map';
import { hash2, warpXZ } from './terrainNoise';
// Re-export the gated GLB-vegetation builder so callers can pull both vegetation
// paths from props.ts. The heavy loader/instancer lives in vegetationGlb.ts.
export { buildVegetationGlbInstances as buildVegetationGlb, preloadVegetationGlbs } from './vegetationGlb';

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested)
// ---------------------------------------------------------------------------

/**
 * Yaw (radians, around world Y) so a +Z-facing quad turns to face the camera
 * horizontally — the cylindrical-billboard rotation. Y stays world-up, so the
 * plant never tips when the camera pitches.
 */
export function billboardYaw(camX: number, camZ: number, x: number, z: number): number {
  return Math.atan2(camX - x, camZ - z);
}

/**
 * Triplanar blend weights for a surface normal: |n| per axis, normalized to sum
 * 1. Used by the rock shader so world-projected textures don't stretch on
 * scaled instances. (Pure — kept here so it can be tested without a GL context.)
 */
export function triplanarWeights(nx: number, ny: number, nz: number): [number, number, number] {
  const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
  const sum = ax + ay + az || 1;
  return [ax / sum, ay / sum, az / sum];
}

// `tx,tz` = the un-warped SOURCE tile the instance was scattered from (the visual
// x,z are warped). Consumers that need the gameplay-grid tile (e.g. flagging tree
// tiles as unbuildable) must use tx,tz, not floor(x/TILE).
export interface VegPlacement { x: number; y: number; z: number; w: number; h: number; tex: number; tx: number; tz: number; }

export interface ScatterOpts {
  count: number; salt: number; valleyBias: boolean;
  hMin: number; hMax: number; wRatio: number; yOff: number; texCount: number;
}

/**
 * Deterministically scatter vegetation instances over the map's open tiles.
 * Pure function of (map, opts): same inputs -> same placements (hash2-based), so
 * it's safe to unit-test and reproducible across runs. Positions ride the warp.
 */
export function scatterVegInstances(map: GameMap, o: ScatterOpts): VegPlacement[] {
  const n = map.size;
  const walkable: [number, number][] = [];
  for (let tz = 1; tz < n - 1; tz++)
    for (let tx = 1; tx < n - 1; tx++)
      if (map.flags[map.idx(tx, tz)] === 0) walkable.push([tx, tz]);
  if (!walkable.length) return [];

  const out: VegPlacement[] = [];
  let guard = 0;
  while (out.length < o.count && guard++ < o.count * 16) {
    const [tx, tz] = walkable[(hash2(guard * 17 + o.salt, guard * 31 + o.salt) * walkable.length) | 0];
    const r1 = hash2(guard * 7 + o.salt, guard * 13), r2 = hash2(guard * 19, guard * 23 + o.salt);
    if (o.valleyBias && map.level[map.idx(tx, tz)] > 1 && r1 > 0.25) continue;
    const [wx, wz] = map.tileToWorld(tx, tz);
    const ox = wx + (r1 - 0.5) * TILE, oz = wz + (r2 - 0.5) * TILE;
    const y = map.groundHeight(ox, oz);
    const [x, z] = warpXZ(ox, oz);
    const h = o.hMin + (o.hMax - o.hMin) * r2;
    const tex = Math.min(o.texCount - 1, (hash2(tx * 3 + guard, tz * 7) * o.texCount) | 0);
    out.push({ x, y: y + o.yOff, z, w: h * o.wRatio, h, tex, tx, tz });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Vegetation build (billboards + blob shadows)
// ---------------------------------------------------------------------------

const vegLoader = new THREE.TextureLoader();
function loadVeg(name: string): THREE.Texture {
  const t = vegLoader.load(`/assets/vegetation/${name}.png`);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
// tree_03 came back as a full scene (not isolated) -> kept out; two clean trees
// plus two bushes give enough variety.
const TREE_TEX = ['tree_01', 'tree_02'];
const BUSH_TEX = ['bush_01', 'bush_02'];

/** Soft round blob-shadow texture (black, radial alpha). Built once at runtime. */
export function makeRadialAlphaTexture(size = 64): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.45)');
  g.addColorStop(0.6, 'rgba(0,0,0,0.22)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export interface VegetationBuild {
  group: THREE.Group;
  /** Per-frame: re-orient every billboard around Y toward the camera. */
  update: (camera: THREE.Camera) => void;
}

interface VegMesh { mesh: THREE.InstancedMesh; items: VegPlacement[]; }

/**
 * Build the vegetation: one InstancedMesh per texture (bottom-pivoted upright
 * quads, Y-locked toward the camera each frame) plus one shared blob-shadow
 * InstancedMesh for all plants (single draw call, matrices set once).
 */
export function buildVegetation(map: GameMap, countOverride?: number): VegetationBuild {
  const group = new THREE.Group();
  group.name = 'vegetation';

  // Bottom-pivot unit quad (y in [0,1]); orientation handled per-frame in update.
  const quad = new THREE.PlaneGeometry(1, 1);
  quad.translate(0, 0.5, 0);

  // Default counts (95 trees + 190 bushes ≈ 1:2). A `countOverride` (the gated
  // ?vegCount test param) splits the total in the same ratio — default unchanged.
  const treeN = countOverride == null ? 95 : Math.round(countOverride / 3);
  const bushN = countOverride == null ? 190 : countOverride - treeN;
  const trees = scatterVegInstances(map, { count: treeN, salt: 11, valleyBias: false, hMin: 2.1, hMax: 3.6, wRatio: 0.82, yOff: -0.05, texCount: TREE_TEX.length });
  const bushes = scatterVegInstances(map, { count: bushN, salt: 37, valleyBias: true, hMin: 0.7, hMax: 1.25, wRatio: 1.1, yOff: -0.05, texCount: BUSH_TEX.length });

  const vegMeshes: VegMesh[] = [];
  const build = (names: string[], placements: VegPlacement[]) => {
    for (let ti = 0; ti < names.length; ti++) {
      const items = placements.filter((p) => p.tex === ti);
      if (!items.length) continue;
      const mat = new THREE.MeshBasicMaterial({ map: loadVeg(names[ti]), transparent: true, alphaTest: 0.45, depthWrite: true, fog: true, side: THREE.DoubleSide });
      const mesh = new THREE.InstancedMesh(quad, mat, items.length);
      mesh.frustumCulled = false; // billboards span the map; per-frame reorient
      vegMeshes.push({ mesh, items });
      group.add(mesh);
    }
  };
  build(TREE_TEX, trees);
  build(BUSH_TEX, bushes);

  // Shared blob shadows: one disc per plant, sized to the plant footprint.
  const all = [...trees, ...bushes];
  const disc = new THREE.CircleGeometry(0.5, 16);
  disc.rotateX(-Math.PI / 2); // lie flat, normal up
  const shadowMat = new THREE.MeshBasicMaterial({
    map: makeRadialAlphaTexture(), transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const shadows = new THREE.InstancedMesh(disc, shadowMat, all.length);
  shadows.renderOrder = 1;
  const m = new THREE.Matrix4();
  for (let i = 0; i < all.length; i++) {
    const p = all[i];
    const r = Math.max(0.5, p.w * 0.8); // footprint-scaled radius
    m.compose(new THREE.Vector3(p.x, p.y + 0.04, p.z), new THREE.Quaternion(), new THREE.Vector3(r, 1, r));
    shadows.setMatrixAt(i, m);
  }
  shadows.instanceMatrix.needsUpdate = true;
  group.add(shadows);

  // Billboard reorientation (CPU; ~285 instances is negligible). yawAt lets the
  // initial build place quads with yaw 0 and the per-frame update face the camera.
  const tmpPos = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();
  const tmpScale = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const mat4 = new THREE.Matrix4();
  const orient = (yawAt: (p: VegPlacement) => number) => {
    for (const vm of vegMeshes) {
      for (let i = 0; i < vm.items.length; i++) {
        const p = vm.items[i];
        tmpQuat.setFromAxisAngle(up, yawAt(p));
        tmpPos.set(p.x, p.y, p.z);
        tmpScale.set(p.w, p.h, 1);
        mat4.compose(tmpPos, tmpQuat, tmpScale);
        vm.mesh.setMatrixAt(i, mat4);
      }
      vm.mesh.instanceMatrix.needsUpdate = true;
    }
  };
  orient(() => 0); // initial placement (no camera yet)

  const update = (camera: THREE.Camera) => {
    const cx = camera.position.x, cz = camera.position.z;
    orient((p) => billboardYaw(cx, cz, p.x, p.z));
  };

  return { group, update };
}

// ---------------------------------------------------------------------------
// Rocks (glTF geometry + vertex-AO, triplanar albedo, instanced)
// ---------------------------------------------------------------------------

const ROCK_GLBS = ['rock_01', 'rock_02', 'rock_03', 'rock_04', 'rock_05'];
const ROCK_ALBEDO = ['01', '02', '03', '04'];

const texLoader = new THREE.TextureLoader();
function loadRockTex(v: string): THREE.Texture {
  const t = texLoader.load(`/assets/terrain/rock/${v}.png`);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Load the Blender rock meshes; returns one BufferGeometry per variant (with COLOR_0 AO). */
export async function preloadRockGlbs(): Promise<THREE.BufferGeometry[]> {
  const loader = new GLTFLoader();
  const geos: THREE.BufferGeometry[] = [];
  for (const name of ROCK_GLBS) {
    const gltf = await loader.loadAsync(`/assets/terrain/rock/${name}.glb`);
    let geo: THREE.BufferGeometry | null = null;
    gltf.scene.traverse((o) => { if (!geo && (o as THREE.Mesh).isMesh) geo = (o as THREE.Mesh).geometry as THREE.BufferGeometry; });
    if (geo) geos.push(geo);
  }
  return geos;
}

/**
 * MeshStandardMaterial that samples its albedo triplanar in world space (no UVs)
 * so scaled instances don't stretch, multiplied by the mesh's vertex-color AO.
 * Matte (roughness 0.9, metalness 0). Albedo-only — normal mapping is a later
 * polish step (spec Task 6) with this as the safe fallback.
 */
export function makeTriplanarRockMaterial(map: THREE.Texture, scale = 0.5): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, vertexColors: true, color: 0xffffff });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.triMap = { value: map };
    shader.uniforms.triScale = { value: scale };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTriWPos;\nvarying vec3 vTriWNormal;')
      .replace('#include <project_vertex>', `#include <project_vertex>
      #ifdef USE_INSTANCING
        mat4 _tw = modelMatrix * instanceMatrix;
      #else
        mat4 _tw = modelMatrix;
      #endif
      vTriWPos = (_tw * vec4(transformed, 1.0)).xyz;
      vTriWNormal = mat3(_tw) * objectNormal;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D triMap;\nuniform float triScale;\nvarying vec3 vTriWPos;\nvarying vec3 vTriWNormal;')
      .replace('#include <map_fragment>', `
      vec3 _bw = abs(normalize(vTriWNormal));
      _bw = pow(_bw, vec3(4.0));
      _bw /= (_bw.x + _bw.y + _bw.z);
      vec4 _tx = texture2D(triMap, vTriWPos.zy * triScale);
      vec4 _ty = texture2D(triMap, vTriWPos.xz * triScale);
      vec4 _tz = texture2D(triMap, vTriWPos.xy * triScale);
      vec4 _tri = _tx * _bw.x + _ty * _bw.y + _tz * _bw.z;
      diffuseColor *= _tri;`);
  };
  return mat;
}

export interface RockBuild { group: THREE.Group; ready: Promise<void>; }

/**
 * Scatter instanced glTF rocks across the map (replacing procedural boulders).
 * One InstancedMesh per variant (own albedo). Loads async and fills the returned
 * group when ready; distribution mirrors the old boulder logic (clean valleys,
 * clumped at the climbs, dense on high ground), riding the same warp.
 */
export function buildRocks(map: GameMap): RockBuild {
  const group = new THREE.Group();
  group.name = 'rocks-instanced';

  const ready = preloadRockGlbs().then((geos) => {
    if (!geos.length) return;
    const n = map.size;
    const walkable: [number, number][] = [];
    for (let tz = 1; tz < n - 1; tz++)
      for (let tx = 1; tx < n - 1; tx++)
        if (map.flags[map.idx(tx, tz)] === 0) walkable.push([tx, tz]);

    const nearHigher = (tx: number, tz: number): boolean => {
      const l = map.level[map.idx(tx, tz)];
      return (
        (map.inBounds(tx + 1, tz) && map.level[map.idx(tx + 1, tz)] > l) ||
        (map.inBounds(tx - 1, tz) && map.level[map.idx(tx - 1, tz)] > l) ||
        (map.inBounds(tx, tz + 1) && map.level[map.idx(tx, tz + 1)] > l) ||
        (map.inBounds(tx, tz - 1) && map.level[map.idx(tx, tz - 1)] > l)
      );
    };

    const CAP = 200;
    const meshes = geos.map((geo, i) => {
      const m = new THREE.InstancedMesh(geo, makeTriplanarRockMaterial(loadRockTex(ROCK_ALBEDO[i % ROCK_ALBEDO.length])), CAP);
      m.castShadow = true; m.receiveShadow = true; m.count = 0;
      group.add(m);
      return m;
    });

    const dummy = new THREE.Object3D();
    let placed = 0, guard = 0;
    const target = 760;
    while (placed < target && guard++ < target * 14) {
      const [tx, tz] = walkable[(hash2(guard * 17, guard * 31) * walkable.length) | 0];
      const r1 = hash2(guard * 7, guard * 13), r2 = hash2(guard * 19, guard * 23);
      const lvl = map.level[map.idx(tx, tz)];
      const edge = nearHigher(tx, tz);
      if (lvl === 0) { if (r1 > 0.05) continue; }
      else if (lvl === 1) { if (!edge && r1 > 0.40) continue; }
      else { if (!edge && r1 > 0.80) continue; }
      const [wx, wz] = map.tileToWorld(tx, tz);
      const ox = wx + (r1 - 0.5) * TILE, oz = wz + (r2 - 0.5) * TILE;
      const y = map.groundHeight(ox, oz);
      const [x, z] = warpXZ(ox, oz);
      const big = r2 > 0.82;
      const s = big ? 1.0 + r1 * 0.9 : 0.32 + r2 * 0.6;
      const mi = Math.min(meshes.length - 1, (hash2(tx * 5 + guard, tz * 3) * meshes.length) | 0);
      const mesh = meshes[mi];
      if (mesh.count >= CAP) continue;
      dummy.position.set(x, y + 0.05 * s, z);
      dummy.rotation.set((r1 - 0.5) * 0.5, r2 * 6, (r2 - 0.5) * 0.5);
      dummy.scale.set(s * (0.85 + r1 * 0.4), s * (0.7 + r2 * 0.5), s * (0.85 + r2 * 0.4));
      dummy.updateMatrix();
      mesh.setMatrixAt(mesh.count, dummy.matrix); mesh.count++;
      placed++;
    }
    for (const m of meshes) m.instanceMatrix.needsUpdate = true;
  });

  return { group, ready };
}
