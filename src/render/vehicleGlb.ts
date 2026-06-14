// Runtime GLB vehicle path (component-factory output). Loads optimized vehicle
// GLBs (turret node + muzzle socket + canonical mat_<slot> materials), clones an
// instance shaped like makeEntityGroup's output (userData.anim.turret, topY,
// inner, muzzle), tints mat_accent to the faction colour. GLB is preferred when
// present; callers fall back to the procedural path otherwise (with a dev warning).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Keep in sync with models.ts UNIT_VISUAL_SCALE.
const UNIT_VISUAL_SCALE = 1.28;

// Vehicles that have a baked runtime GLB (faction:classId -> asset url).
const REGISTRY: Record<string, string> = {
  'red:mediumTank': '/assets/vehicles/red_mediumTank.glb',
};

const cache = new Map<string, THREE.Group>(); // key -> loaded template scene
/** Which path each vehicle visual actually used this session (debug). */
export const VEH_SOURCE: Record<string, 'glb' | 'procedural'> = {};

export const vehicleGlbKey = (faction: string, classId: string) => `${faction}:${classId}`;
export const hasVehicleGlb = (faction: string, classId: string) => cache.has(vehicleGlbKey(faction, classId));
/** True if this vehicle is REGISTERED to have a GLB (so a missing one is an error, not normal). */
export const expectedVehicleGlb = (faction: string, classId: string) => vehicleGlbKey(faction, classId) in REGISTRY;

/** Preload all registered vehicle GLBs. Call before a match starts. */
export async function preloadVehicleGlbs(): Promise<void> {
  const loader = new GLTFLoader();
  for (const [key, url] of Object.entries(REGISTRY)) {
    if (cache.has(key)) continue;
    try {
      const gltf = await loader.loadAsync(url);
      cache.set(key, gltf.scene);
    } catch (e) {
      if (import.meta.env.DEV) console.warn(`[veh] GLB-Load fehlgeschlagen ${key} (${url}) → prozedural`, e);
    }
  }
}

/** Test-only: seed the cache with a hand-built scene (avoids a real GLTF load). */
export function __setGlbForTest(faction: string, classId: string, scene: THREE.Group | null) {
  const key = vehicleGlbKey(faction, classId);
  if (scene) cache.set(key, scene); else cache.delete(key);
}

/**
 * Build a vehicle visual from a cached GLB, shaped like makeEntityGroup's output.
 * Returns null if no GLB is cached for this vehicle.
 */
export function makeGlbEntityGroup(
  faction: string, classId: string, accentHex: string, silhouetteScale = 1,
): THREE.Group | null {
  const key = vehicleGlbKey(faction, classId);
  const tmpl = cache.get(key);
  if (!tmpl) return null;

  const scene = tmpl.clone(true);
  let turret: THREE.Object3D | undefined;
  let muzzle: THREE.Object3D | undefined;
  scene.traverse((o) => {
    if (o.name === 'turret') turret = o;
    if (o.name === 'muzzle') muzzle = o;
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    // Clone + tint the accent material so per-faction colour doesn't leak across instances.
    const tint = (m: THREE.Material): THREE.Material => {
      if ((m as any)?.name === 'mat_accent') {
        const c = (m as THREE.MeshStandardMaterial).clone();
        c.color.set(accentHex);
        c.emissive.set(accentHex);
        c.emissiveIntensity = 0.6;
        return c;
      }
      return m;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(tint) : tint(mesh.material);
  });

  const inner = new THREE.Group();
  inner.add(scene);
  const scale = UNIT_VISUAL_SCALE * silhouetteScale;
  inner.scale.setScalar(scale);

  const outer = new THREE.Group();
  outer.add(inner);
  const box = new THREE.Box3().setFromObject(scene);
  outer.userData.inner = inner;
  outer.userData.anim = turret ? { turret } : {};
  outer.userData.topY = (isFinite(box.max.y) ? box.max.y : 2) * scale;
  if (muzzle) outer.userData.muzzle = muzzle;
  VEH_SOURCE[key] = 'glb';
  return outer;
}
