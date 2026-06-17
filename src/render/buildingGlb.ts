// Runtime GLB path for BUILDINGS (Asset/Foundation Phase 2). Mirrors the vehicle
// GLB loader: preload registered building GLBs once, then synchronously build a
// procedural-shaped group from the cache (userData.topY/inner/anim) — or return
// null so the caller falls back to the procedural renderer (src/render/models.ts).
//
// CONSERVATIVE SCOPE (Option B): only POWERPLANTS are active (static, no turret
// aim). Defense-tower GLBs are inventoried in buildingAssets.ts but NOT wired to
// cannon/lance here, so the existing turret-aim visuals never break.
//
// A missing/broken GLB must NEVER crash the game — every failure path returns null.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TILE } from '../map/map';
import { BUILDING_ASSETS, powerPlantAsset, hqAsset, type BuildingAssetDefinition } from '../data/buildingAssets';
import type { FactionId } from '../data/factionModifiers';

/** Roles whose GLBs are rendered this phase. Static buildings only (HQ +
 *  powerplants) — defense towers stay procedural so turret-aim isn't disturbed. */
export const ACTIVE_ASSET_ROLES = new Set<string>(['power', 'hq']);

const cache = new Map<string, THREE.Group>(); // assetKey -> loaded template scene
/** Which path each building visual actually used this session (debug). */
export const BUILDING_SOURCE: Record<string, 'glb' | 'procedural'> = {};

function activeAssets(): BuildingAssetDefinition[] {
  return BUILDING_ASSETS.filter((a) => ACTIVE_ASSET_ROLES.has(a.role));
}

export const hasBuildingGlb = (assetKey: string) => cache.has(assetKey);

/** Preload all ACTIVE building GLBs. Call before a match starts. Never throws. */
export async function preloadBuildingGlbs(): Promise<void> {
  const loader = new GLTFLoader();
  for (const a of activeAssets()) {
    if (cache.has(a.assetKey)) continue;
    try {
      const gltf = await loader.loadAsync(a.modelPath);
      cache.set(a.assetKey, gltf.scene);
    } catch (e) {
      if (import.meta.env.DEV) console.warn(`[bld] GLB-Load fehlgeschlagen ${a.assetKey} (${a.modelPath}) → prozedural`, e);
    }
  }
}

/** Test-only: seed the cache with a hand-built scene (avoids a real GLTF load). */
export function __setBuildingGlbForTest(assetKey: string, scene: THREE.Group | null) {
  if (scene) cache.set(assetKey, scene); else cache.delete(assetKey);
}

/**
 * The active, cached GLB asset for a (buildingId, faction), or null → fallback.
 * Only `spire` (Power Spire) maps to a powerplant GLB this phase, and only when
 * a faction asset exists AND is already loaded into the cache.
 */
export function activeBuildingAsset(buildingId: string, factionId: FactionId): BuildingAssetDefinition | null {
  const a = buildingId === 'spire' ? powerPlantAsset(factionId)
    : buildingId === 'nexus' ? hqAsset(factionId)
    : undefined;
  if (a && ACTIVE_ASSET_ROLES.has(a.role) && cache.has(a.assetKey)) return a;
  return null;
}

/**
 * Build a building visual from a cached GLB, shaped like makeEntityGroup's output
 * (userData.topY/inner/anim). Auto-fits the model to the footprint and grounds it
 * (base at y=0). Returns null if no GLB is cached.
 */
export function makeGlbBuildingGroup(
  asset: BuildingAssetDefinition, accentHex: string, footprintTiles: number,
): THREE.Group | null {
  const tmpl = cache.get(asset.assetKey);
  if (!tmpl) return null;

  const scene = tmpl.clone(true);
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const remap = (m: THREE.Material): THREE.Material => {
      const name = (m as unknown as { name?: string })?.name;
      if (name === 'mat_accent') {
        const c = (m as THREE.MeshStandardMaterial).clone();
        c.color.set(accentHex); c.emissive.set(accentHex); c.emissiveIntensity = 0.6;
        return c;
      }
      return m;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(remap) : remap(mesh.material);
  });

  // Auto-fit: scale the model so its horizontal extent ≈ footprint (× fill),
  // then ground it (bottom at y=0). Per-asset visualTransform fine-tunes.
  const box = new THREE.Box3().setFromObject(scene);
  const horiz = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) || 1;
  const vt = asset.visualTransform;
  const autoScale = (footprintTiles * TILE * 0.92) / horiz;
  const scale = autoScale * (vt?.scale ?? 1);

  const inner = new THREE.Group();
  inner.add(scene);
  inner.scale.setScalar(scale);
  if (vt?.rotationY) inner.rotation.y = vt.rotationY;
  inner.position.y = -box.min.y * scale + (vt?.yOffset ?? 0);
  if (vt?.positionOffset) {
    inner.position.x += vt.positionOffset[0];
    inner.position.y += vt.positionOffset[1];
    inner.position.z += vt.positionOffset[2];
  }

  const outer = new THREE.Group();
  outer.add(inner);
  outer.userData.inner = inner;
  outer.userData.anim = {}; // powerplants have no turret/spin/load animation
  outer.userData.topY = (box.max.y - box.min.y) * scale + (vt?.yOffset ?? 0);
  BUILDING_SOURCE[asset.assetKey] = 'glb';
  return outer;
}
