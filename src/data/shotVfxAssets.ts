// Shoot / beam VFX sprite registry (VFX Phase 1 — inventory + alpha-verified
// assets only). This module DEFINES the per-faction weapon-effect sprites and
// their metadata. It is NOT yet imported by the runtime: the live combat VFX
// ([effects.ts](../render/effects.ts)) still uses procedural meshes. Phase 2 will
// wire these textures into textured beam/projectile rendering.
//
// ⚠️ Alpha note: the source PNGs (from the AI asset pipeline) shipped with a
// FAKE dark-checkerboard background baked opaque into RGB (alpha = 255 every-
// where) — the same trap as the crystal PNGs. All sprites here were re-keyed to
// REAL alpha (luminance/chroma key of the achromatic checker, soft edges) before
// landing under public/assets/vfx/shots/. `alphaVerified` records that pass.

import type { FactionId } from './factionModifiers';

export type ShotVfxKind =
  | 'projectile'   // a travelling bullet/tracer sprite
  | 'muzzleFlash'  // a brief flash at the barrel
  | 'beamFull'     // a complete directional beam render (origin flare → tip): STRETCH along the shot line
  | 'beamTile'     // a seamless repeatable beam segment (none yet — assets are beamFull)
  | 'beamStart'
  | 'beamEnd'
  | 'impact';

export type ShotVfxStyle =
  | 'ballistic'      // crimson — projectile + muzzle flash, no continuous beam
  | 'waterBeam'      // azure
  | 'bioWave'        // verdant
  | 'chainLightning'; // solar

export interface ShotVfxAsset {
  assetKey: string;
  factionId: FactionId;
  style: ShotVfxStyle;
  kind: ShotVfxKind;
  imagePath: string;
  /** True only for seamless repeatable segments. The current beams are full
   *  directional renders → false (Phase 2 stretches one quad, does NOT UV-tile). */
  tileable: boolean;
  /** These glows read best with additive blending (dark areas add nothing). */
  additiveBlending: boolean;
  transparent: boolean;
  /** The PNG was re-keyed from the baked checkerboard to a real alpha channel. */
  alphaVerified: boolean;
  widthPx: number;
  heightPx: number;
  notes?: string;
}

/** Canonical faction folder names. */
export const VFX_FACTION_DIR: Record<FactionId, string> = {
  red: 'crimson', blue: 'azure', green: 'verdant', yellow: 'solar',
};

const BASE = '/assets/vfx/shots';

export const SHOT_VFX_ASSETS: ShotVfxAsset[] = [
  // --- Crimson Pact (red) — ballistic: muzzle flash + bullet tracer ---
  {
    assetKey: 'crimson.muzzle_flash', factionId: 'red', style: 'ballistic', kind: 'muzzleFlash',
    imagePath: `${BASE}/crimson/muzzle_flash.png`, tileable: false, additiveBlending: true,
    transparent: true, alphaVerified: true, widthPx: 512, heightPx: 506,
    notes: 'Orange flash + ejected shell. Show briefly at the barrel tip.',
  },
  {
    assetKey: 'crimson.bullet_tracer', factionId: 'red', style: 'ballistic', kind: 'projectile',
    imagePath: `${BASE}/crimson/bullet_tracer.png`, tileable: false, additiveBlending: true,
    transparent: true, alphaVerified: true, widthPx: 768, heightPx: 805,
    notes: 'Gold bullet + tracer streak. Orient along the flight direction.',
  },
  // --- Azure Concorde (blue) — high-pressure water beam ---
  {
    assetKey: 'azure.water_beam', factionId: 'blue', style: 'waterBeam', kind: 'beamFull',
    imagePath: `${BASE}/azure/water_beam.png`, tileable: false, additiveBlending: true,
    transparent: true, alphaVerified: true, widthPx: 1024, heightPx: 410,
    notes: 'Directional render: swirl origin (left) → tapering jet (right). Stretch along the shot line.',
  },
  // --- Verdant Swarm (green) — bio-magnetic wave ---
  {
    assetKey: 'verdant.bio_wave', factionId: 'green', style: 'bioWave', kind: 'beamFull',
    imagePath: `${BASE}/verdant/bio_wave.png`, tileable: false, additiveBlending: true,
    transparent: true, alphaVerified: true, widthPx: 1024, heightPx: 540,
    notes: 'Green/purple organic strands. Directional, stretch along the shot line.',
  },
  // --- Solar Dominion (yellow) — chain-lightning beam ---
  {
    assetKey: 'solar.chain_lightning', factionId: 'yellow', style: 'chainLightning', kind: 'beamFull',
    imagePath: `${BASE}/solar/chain_lightning.png`, tileable: false, additiveBlending: true,
    transparent: true, alphaVerified: true, widthPx: 1024, heightPx: 566,
    notes: 'Yellow/white core + magenta sparks. Directional, stretch along the shot line.',
  },
];

/** Lookup helpers (used by Phase-2 wiring, not the live runtime yet). */
export function shotVfxFor(factionId: FactionId): ShotVfxAsset[] {
  return SHOT_VFX_ASSETS.filter((a) => a.factionId === factionId);
}
export function shotVfxByKey(assetKey: string): ShotVfxAsset | undefined {
  return SHOT_VFX_ASSETS.find((a) => a.assetKey === assetKey);
}
/** A faction's continuous beam sprite (azure/verdant/solar), or null (crimson is ballistic). */
export function beamVfxFor(factionId: FactionId): ShotVfxAsset | null {
  return SHOT_VFX_ASSETS.find((a) => a.factionId === factionId && a.kind === 'beamFull') ?? null;
}

/**
 * Assets that could NOT be cleanly mapped/extracted. Empty: all four faction
 * source montages were keyed + split successfully. The `all shoots.png` overview
 * sheet in the source folder is deliberately ignored (it is a contact sheet, not
 * a game asset).
 */
export const UNMAPPED_SHOT_ASSETS: ReadonlyArray<{ source: string; reason: string }> = [];

/**
 * Effects the source set does NOT (yet) provide — tracked for Phase 2 so coverage
 * gaps are explicit rather than silently missing.
 */
export const MISSING_SHOT_ASSETS: ReadonlyArray<{ factionId: FactionId; kind: ShotVfxKind; reason: string }> = [
  { factionId: 'blue', kind: 'impact', reason: 'No dedicated water-impact sprite — reuse procedural hitSpark for now.' },
  { factionId: 'green', kind: 'impact', reason: 'No dedicated bio-impact sprite — reuse procedural explosion for now.' },
  { factionId: 'yellow', kind: 'impact', reason: 'No dedicated lightning-impact sprite — reuse procedural spark for now.' },
];
