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
import {
  GENERATED_GAMEPLAY_ASSETS, ACTIVE_GENERATED_BUILDING_IDS, generatedGameplayAsset,
  type BuildingAssetDefinition,
} from '../data/buildingAssets';
import type { FactionId } from '../data/factionModifiers';

/** Building ids whose generated GLB renders in gameplay. Static buildings only
 *  (nexus/spire/refinery/barracks/foundry/wall) — cannon/lance stay procedural so
 *  turret-aim isn't disturbed (the generated turrets have no ATTACH pivot). */
export const ACTIVE_BUILDING_IDS = ACTIVE_GENERATED_BUILDING_IDS;

/** A baked emissive material registered for the gentle idle glow-pulse. */
export interface BuildingPulseMat { mat: THREE.MeshStandardMaterial; base: number; }

function isEmissiveStd(m: THREE.Material): m is THREE.MeshStandardMaterial {
  const e = (m as THREE.MeshStandardMaterial).emissive;
  return !!e && typeof e.r === 'number' && (e.r + e.g + e.b) > 0.01;
}

/**
 * Fidelity pass over a cloned GLB material. The building GLBs carry NO textures
 * and bake the faction colour + emissive strength (KHR_materials_emissive_strength,
 * already applied by GLTFLoader) straight into named PBR materials (Aqua_Glow,
 * Status_Glow, Crimson_Accent, …). So we deliberately PRESERVE every material and
 * its baked look — we only clone the emissive ones per-instance (so the idle pulse
 * can modulate them without leaking to the cached template or sibling buildings)
 * and register the clone for the pulse at its baked intensity. A literal
 * `mat_accent` (none today, future-proof) still gets the faction tint. Transparent
 * (alphaMode BLEND) materials keep their transparency untouched.
 */
function fidelityRemap(m: THREE.Material, accentHex: string, pulse: BuildingPulseMat[]): THREE.Material {
  const name = (m as unknown as { name?: string })?.name;
  if (name === 'mat_accent') {
    const c = (m as THREE.MeshStandardMaterial).clone();
    c.color.set(accentHex); c.emissive.set(accentHex); c.emissiveIntensity = 0.8;
    pulse.push({ mat: c, base: 0.8 });
    return c;
  }
  if (isEmissiveStd(m)) {
    const c = m.clone();                       // per-instance clone: pulse never leaks
    const base = m.emissiveIntensity ?? 1;     // PRESERVE the artist-baked strength
    c.emissiveIntensity = base;
    pulse.push({ mat: c, base });
    return c;
  }
  return m; // preserve all other PBR materials exactly (unmutated → safe to share)
}

// ── Surface-detail pass ──────────────────────────────────────────────────────
// The generated building GLBs are textureless (flat PBR colours), so big faces
// read monotone. We inject — at the SHADER level, once per cached template (no
// per-instance recompile) — a subtle world-space grain + a normal-based fake AO
// (tops brighter, undersides darker) so flat surfaces gain micro-variation and
// form. Plus a modest emissive boost so the faction glow accents pop. Purely
// visual; no geometry/scale/gameplay change. Meshes carry NORMAL (+UVs).
const DETAIL_GLSL = `
  float bHash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float bNoise(vec3 q){
    vec3 i = floor(q), f = fract(q); f = f * f * (3.0 - 2.0 * f);
    float z0 = i.z * 7.0, z1 = (i.z + 1.0) * 7.0;
    float a = mix(mix(bHash(i.xy + z0), bHash(i.xy + vec2(1.0,0.0) + z0), f.x),
                  mix(bHash(i.xy + vec2(0.0,1.0) + z0), bHash(i.xy + vec2(1.0,1.0) + z0), f.x), f.y);
    float b = mix(mix(bHash(i.xy + z1), bHash(i.xy + vec2(1.0,0.0) + z1), f.x),
                  mix(bHash(i.xy + vec2(0.0,1.0) + z1), bHash(i.xy + vec2(1.0,1.0) + z1), f.x), f.y);
    return mix(a, b, f.z);
  }
`;
const EMISSIVE_BOOST = 1.7;

/** Inject the surface-detail shader into a MeshStandardMaterial (idempotent-ish). */
function addSurfaceDetail(m: THREE.MeshStandardMaterial) {
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = 'varying vec3 vBWPos;\nvarying vec3 vBNrm;\n' + shader.vertexShader
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n  vBNrm = normalize(mat3(modelMatrix) * objectNormal);')
      .replace('#include <project_vertex>', '#include <project_vertex>\n  vBWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = 'varying vec3 vBWPos;\nvarying vec3 vBNrm;\n' + DETAIL_GLSL + shader.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        // Adaptive: full grain+AO on DARK materials (Crimson concrete), almost
        // none on BRIGHT ones (Azure ceramic) so clean whites stay clean.
        float bLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        float bDark = 1.0 - smoothstep(0.35, 0.80, bLum);              // 1 dark → 0 bright
        float bGrain = bNoise(vBWPos * 1.8) + 0.5 * bNoise(vBWPos * 5.0); // ~0..1.5
        diffuseColor.rgb *= 0.975 + 0.04 * bGrain;                     // subtle mottle for ALL (avg ~1.0)
        float bUp = clamp(vBNrm.y * 0.5 + 0.5, 0.0, 1.0);
        diffuseColor.rgb *= mix(1.0, mix(0.86, 1.05, bUp), bDark);     // fake AO only where dark
      `);
  };
  m.needsUpdate = true;
}

/** Enhance a cached template's materials once: surface detail + emissive boost. */
function enhanceTemplate(scene: THREE.Object3D) {
  const seen = new Set<THREE.Material>();
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat || seen.has(mat)) continue;
      seen.add(mat);
      const std = mat as THREE.MeshStandardMaterial;
      if (std.isMaterial && 'metalness' in std) addSurfaceDetail(std);
      if (isEmissiveStd(std)) std.emissiveIntensity = (std.emissiveIntensity ?? 1) * EMISSIVE_BOOST;
    }
  });
}

const cache = new Map<string, THREE.Group>(); // assetKey -> loaded template scene
/** Which path each building visual actually used this session (debug). */
export const BUILDING_SOURCE: Record<string, 'glb' | 'procedural'> = {};

function activeAssets(): BuildingAssetDefinition[] {
  return GENERATED_GAMEPLAY_ASSETS;
}

export const hasBuildingGlb = (assetKey: string) => cache.has(assetKey);

/** Preload all ACTIVE building GLBs. Call before a match starts. Never throws. */
export async function preloadBuildingGlbs(): Promise<void> {
  const loader = new GLTFLoader();
  for (const a of activeAssets()) {
    if (cache.has(a.assetKey)) continue;
    try {
      const gltf = await loader.loadAsync(a.modelPath);
      enhanceTemplate(gltf.scene); // surface detail + emissive boost (once per template)
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
  if (!ACTIVE_BUILDING_IDS.has(buildingId)) return null; // cannon/lance → procedural
  const a = generatedGameplayAsset(factionId, buildingId);
  return a && cache.has(a.assetKey) ? a : null;
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
  const pulseMats: BuildingPulseMat[] = [];
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const remap = (m: THREE.Material): THREE.Material => fidelityRemap(m, accentHex, pulseMats);
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
  // No turret/spin/load animation; only a gentle emissive idle pulse when the
  // GLB carries baked emissive materials (world.ts animateBuilding drives it).
  outer.userData.anim = pulseMats.length ? { pulseMats } : {};
  outer.userData.topY = (box.max.y - box.min.y) * scale + (vt?.yOffset ?? 0);
  BUILDING_SOURCE[asset.assetKey] = 'glb';
  return outer;
}
