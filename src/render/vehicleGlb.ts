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
  'red:scout': '/assets/vehicles/red_scout.glb',
};

interface VehMeta {
  slotTextures?: Record<string, string>; // group -> png filename (new) or base64 (legacy)
  barrelAnim?: { spin?: boolean; pump?: number } | null;
}
const cache = new Map<string, THREE.Group>(); // key -> loaded template scene
const metaCache = new Map<string, VehMeta>(); // key -> companion metadata
const baseUrl = new Map<string, string>(); // key -> directory the GLB was loaded from
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
      baseUrl.set(key, url.replace(/\/[^/]+$/, '')); // dir for companion texture pngs
      // Companion metadata (per-texGroup library textures), if present.
      try {
        const m = await fetch(url.replace(/\.glb$/, '.json')).then((r) => (r.ok ? r.json() : null));
        if (m) metaCache.set(key, m);
      } catch { /* no metadata is fine */ }
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

/** Test-only: seed companion metadata (barrelAnim / slotTextures) for a vehicle. */
export function __setMetaForTest(faction: string, classId: string, meta: VehMeta | null) {
  const key = vehicleGlbKey(faction, classId);
  if (meta) metaCache.set(key, meta); else metaCache.delete(key);
}

/**
 * Build a vehicle visual from a cached GLB, shaped like makeEntityGroup's output.
 * Returns null if no GLB is cached for this vehicle.
 */
/** Maps a canonical slot ('body'/'dark'/'accent'/…) to a game material, or null to keep the GLB's. */
export type SlotMaterialFn = (slot: string) => THREE.Material | null | undefined;

export function makeGlbEntityGroup(
  faction: string, classId: string, accentHex: string, silhouetteScale = 1,
  materialForSlot?: SlotMaterialFn,
): THREE.Group | null {
  const key = vehicleGlbKey(faction, classId);
  const tmpl = cache.get(key);
  if (!tmpl) return null;

  const scene = tmpl.clone(true);
  let turret: THREE.Object3D | undefined;
  let barrel: THREE.Object3D | undefined;
  let muzzle: THREE.Object3D | undefined;
  scene.traverse((o) => {
    if (o.name === 'turret') turret = o;
    if (o.name === 'barrel') barrel = o;
    if (o.name === 'muzzle') muzzle = o;
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    // Swap each `mat_<slot>` for the game's matching vehicle material so the GLB
    // tank reads like the procedural units. Fall back to tinting only the accent.
    const remap = (m: THREE.Material): THREE.Material => {
      const name = (m as any)?.name as string | undefined;
      const slot = name?.startsWith('mat_') ? name.slice(4) : undefined;
      if (slot) {
        const repl = materialForSlot?.(slot);
        if (repl) return repl;
      }
      if (name === 'mat_accent') {
        const c = (m as THREE.MeshStandardMaterial).clone();
        c.color.set(accentHex);
        c.emissive.set(accentHex);
        c.emissiveIntensity = 0.6;
        return c;
      }
      return m;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(remap) : remap(mesh.material);
  });

  // Apply per-group library textures from metadata. A group maps to either a
  // dedicated `tex_<group>` node (static parts) or a runtime node sharing the
  // group name (`turret`/`barrel`). slotTextures values are PNG filenames
  // (loaded from the GLB's directory) or, for legacy assets, base64.
  const slotTex = metaCache.get(key)?.slotTextures;
  if (slotTex) {
    const texLoader = new THREE.TextureLoader();
    const dir = baseUrl.get(key) ?? '';
    const RUNTIME = new Set(['turret', 'barrel']);
    for (const [group, ref] of Object.entries(slotTex)) {
      if (!ref) continue;
      const src = /\.png$/i.test(ref) ? `${dir}/${ref}` : `data:image/png;base64,${ref}`;
      const tex = texLoader.load(src);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(2, 2);
      const apply = (m: THREE.Material): THREE.Material => {
        const c = (m as THREE.MeshStandardMaterial).clone();
        c.map = tex; c.color.set(0xffffff); c.needsUpdate = true;
        return c;
      };
      // Find the target node, then texture its own + descendant meshes — but do
      // NOT descend into a nested runtime node (so a turret texture never bleeds
      // onto the barrel that hangs under it).
      let target: THREE.Object3D | undefined;
      scene.traverse((n) => { if (!target && (n.name === `tex_${group}` || n.name === group)) target = n; });
      if (!target) continue;
      const paint = (o: THREE.Object3D, isRoot: boolean) => {
        if (!isRoot && RUNTIME.has(o.name)) return; // that node owns its own texture
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) mesh.material = Array.isArray(mesh.material) ? mesh.material.map(apply) : apply(mesh.material);
        for (const ch of o.children) paint(ch, false);
      };
      paint(target, true);
    }
  }

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
  // Barrel motion (spin/pump) — the game animates this node per frame.
  const ba = metaCache.get(key)?.barrelAnim;
  if (barrel && ba && (ba.spin || (ba.pump ?? 0) > 0)) {
    outer.userData.barrel = barrel;
    outer.userData.barrelAnim = ba;
  }
  VEH_SOURCE[key] = 'glb';
  return outer;
}
