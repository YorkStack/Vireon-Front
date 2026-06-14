// Static environment props: Y-locked (cylindrical) instanced vegetation
// billboards + a shared blob-shadow mesh, and (later) glTF rocks. Split out of
// terrain.ts so the prop systems stay focused and unit-testable. Placement rides
// the same horizontal warp as the terrain (terrainNoise), so props sit flush.
import * as THREE from 'three';
import { GameMap, TILE } from '../map/map';
import { hash2, warpXZ } from './terrainNoise';

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

export interface VegPlacement { x: number; y: number; z: number; w: number; h: number; tex: number; }

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
    out.push({ x, y: y + o.yOff, z, w: h * o.wRatio, h, tex });
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
export function buildVegetation(map: GameMap): VegetationBuild {
  const group = new THREE.Group();
  group.name = 'vegetation';

  // Bottom-pivot unit quad (y in [0,1]); orientation handled per-frame in update.
  const quad = new THREE.PlaneGeometry(1, 1);
  quad.translate(0, 0.5, 0);

  const trees = scatterVegInstances(map, { count: 95, salt: 11, valleyBias: false, hMin: 2.1, hMax: 3.6, wRatio: 0.82, yOff: -0.05, texCount: TREE_TEX.length });
  const bushes = scatterVegInstances(map, { count: 190, salt: 37, valleyBias: true, hMin: 0.7, hMax: 1.25, wRatio: 1.1, yOff: -0.05, texCount: BUSH_TEX.length });

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
