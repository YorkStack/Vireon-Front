// Runtime texture layer for shoot/beam VFX (VFX Phase 2). Loads the alpha-fixed
// sprites from shotVfxAssets.ts and hands the Effects module ready-to-use
// textures + additive material factories. EVERYTHING here is presentation-only:
// a missing/un-loaded texture simply yields null, and Effects falls back to its
// procedural meshes — combat timing, damage and lifecycles are never touched.
//
// Beam sprites are NOT tileable: they are full directional renders (flare → tip),
// so Effects stretches ONE quad along the shot line (no UV repeat).
import * as THREE from 'three';
import { SHOT_VFX_ASSETS, beamVfxFor, type ShotVfxAsset } from '../data/shotVfxAssets';
import type { FactionId } from '../data/factionModifiers';

const texCache = new Map<string, THREE.Texture>(); // assetKey -> texture (only successful loads)
let loaded = false;

/** Preload all shot-VFX textures once before a match. Never throws; partial
 *  failures just leave those keys absent (→ procedural fallback). */
export async function preloadShotVfx(): Promise<void> {
  if (loaded) return;
  const loader = new THREE.TextureLoader();
  await Promise.all(SHOT_VFX_ASSETS.map((a) => new Promise<void>((resolve) => {
    loader.load(
      a.imagePath,
      (tex) => { tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true; texCache.set(a.assetKey, tex); resolve(); },
      undefined,
      () => { if (import.meta.env.DEV) console.warn(`[vfx] shot sprite load failed: ${a.assetKey} (${a.imagePath}) → procedural`); resolve(); },
    );
  })));
  loaded = true;
}

/** Test-only: seed/clear a texture without a real load. */
export function __setShotTexForTest(assetKey: string, tex: THREE.Texture | null) {
  if (tex) texCache.set(assetKey, tex); else texCache.delete(assetKey);
}

function texForKey(assetKey: string): THREE.Texture | null {
  return texCache.get(assetKey) ?? null;
}
function assetTex(asset: ShotVfxAsset | null | undefined): THREE.Texture | null {
  return asset ? texForKey(asset.assetKey) : null;
}

/** The continuous beam texture for azure/verdant/solar; null for crimson (ballistic). */
export function beamTextureFor(factionId: FactionId): THREE.Texture | null {
  return assetTex(beamVfxFor(factionId));
}
/** Crimson muzzle-flash sprite; null for the beam factions (they keep a procedural flash). */
export function muzzleTextureFor(factionId: FactionId): THREE.Texture | null {
  return assetTex(SHOT_VFX_ASSETS.find((a) => a.factionId === factionId && a.kind === 'muzzleFlash'));
}
/** Crimson bullet/tracer sprite; null otherwise. */
export function bulletTextureFor(factionId: FactionId): THREE.Texture | null {
  return assetTex(SHOT_VFX_ASSETS.find((a) => a.factionId === factionId && a.kind === 'projectile'));
}

/** Additive glow material (beams, muzzle flash) — dark/transparent areas vanish. */
export function makeGlowMaterial(tex: THREE.Texture, opacity = 1): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    map: tex, transparent: true, opacity, depthWrite: false,
    blending: THREE.AdditiveBlending, toneMapped: false,
  });
}
/** Solid-ish material for the bullet (a metal object, not a pure glow → normal blend). */
export function makeBulletMaterial(tex: THREE.Texture, opacity = 1): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    map: tex, transparent: true, opacity, depthWrite: false,
    blending: THREE.NormalBlending, toneMapped: false,
  });
}
