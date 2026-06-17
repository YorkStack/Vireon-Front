// Crystal resource VISUAL registry + resource-type metadata.
//
// World Phase 1b — Foundation only. This module DEFINES the data model for the
// three crystal resource types and their visual assets. It does NOT yet spawn
// special crystals, drive depletion-stage swaps, or change any harvest balance.
// The live runtime (terrain.ts sprites, world.ts harvest) is untouched; only
// `default` crystals exist in play today.
//
// Assets were normalised (downscaled to 768px) from the source PNGs and live
// under public/assets/resources/crystals/{default,blaze_of_the_sun,plasma_filament}/.

/** The three crystal resource families. Only `default` is live in play today. */
export type CrystalResourceType = 'default' | 'blazeOfTheSun' | 'plasmaFilament';

/** Intrinsic size class of a crystal node — picks the asset family + harvest budget. */
export type CrystalVisualSize = 'small' | 'medium' | 'large';

/** Per-resource-type balance + spawn metadata (single source of truth). */
export interface CrystalResourceMeta {
  resourceType: CrystalResourceType;
  /** Credit multiplier vs. a default harvest. default = 1 (unchanged balance). */
  yieldMultiplier: number;
  /** When true the type only appears via a scripted event — never random map spawn. */
  eventOnly: boolean;
  notes?: string;
}

export const CRYSTAL_RESOURCE_META: Record<CrystalResourceType, CrystalResourceMeta> = {
  default: {
    resourceType: 'default',
    yieldMultiplier: 1, // baseline income — must stay 1 (no balance change)
    eventOnly: false,
    notes: 'Standard income crystal. The only type spawned in play today.',
  },
  blazeOfTheSun: {
    resourceType: 'blazeOfTheSun',
    yieldMultiplier: 2, // double payout — PREPARED, not yet spawned anywhere
    eventOnly: false,
    notes: 'Rare, evenly distributed, same harvest time, double payout. Spawn rule prepared but disabled.',
  },
  plasmaFilament: {
    resourceType: 'plasmaFilament',
    yieldMultiplier: 2, // PREPARED; inert because eventOnly + never spawned
    eventOnly: true,
    notes: 'Very rare, event-bound (e.g. volcano eruption / mission script). No event logic yet.',
  },
};

export function getCrystalYieldMultiplier(type: CrystalResourceType): number {
  return CRYSTAL_RESOURCE_META[type].yieldMultiplier;
}

export function isEventOnlyCrystal(type: CrystalResourceType): boolean {
  return CRYSTAL_RESOURCE_META[type].eventOnly;
}

/** A single crystal visual asset (one PNG sprite for a type+size). */
export interface CrystalVisualAsset {
  assetKey: string;
  resourceType: CrystalResourceType;
  size: CrystalVisualSize;
  imagePath: string;
  yieldMultiplier: number;
  notes?: string;
}

const BASE = '/assets/resources/crystals';

/**
 * Normalised crystal sprites. Keys are unique; every imagePath ends in `.png`.
 * NOTE: the `default` family ships no `large` asset in the source set — its
 * largest visual is `medium`. Tracked in UNMAPPED-equivalent reporting below.
 */
export const CRYSTAL_VISUAL_ASSETS: CrystalVisualAsset[] = [
  // --- Default (live family) ---
  { assetKey: 'default_small',        resourceType: 'default',        size: 'small',  imagePath: `${BASE}/default/small.png`,        yieldMultiplier: 1, notes: 'primary small' },
  { assetKey: 'default_small_alt',    resourceType: 'default',        size: 'small',  imagePath: `${BASE}/default/small-b.png`,      yieldMultiplier: 1, notes: 'second small variant (was small-2)' },
  { assetKey: 'default_medium_small', resourceType: 'default',        size: 'medium', imagePath: `${BASE}/default/medium-small.png`, yieldMultiplier: 1, notes: 'smaller medium variant' },
  { assetKey: 'default_medium',       resourceType: 'default',        size: 'medium', imagePath: `${BASE}/default/medium.png`,       yieldMultiplier: 1, notes: 'largest default asset (no big/large in source)' },
  // --- Blaze of the Sun (prepared, not spawned) ---
  { assetKey: 'blaze_small',          resourceType: 'blazeOfTheSun',  size: 'small',  imagePath: `${BASE}/blaze_of_the_sun/small.png`,  yieldMultiplier: 2 },
  { assetKey: 'blaze_medium',         resourceType: 'blazeOfTheSun',  size: 'medium', imagePath: `${BASE}/blaze_of_the_sun/medium.png`, yieldMultiplier: 2 },
  { assetKey: 'blaze_large',          resourceType: 'blazeOfTheSun',  size: 'large',  imagePath: `${BASE}/blaze_of_the_sun/large.png`,  yieldMultiplier: 2 },
  // --- Plasma Filament (prepared, event-only) ---
  { assetKey: 'plasma_small',         resourceType: 'plasmaFilament', size: 'small',  imagePath: `${BASE}/plasma_filament/small.png`,  yieldMultiplier: 2 },
  { assetKey: 'plasma_medium',        resourceType: 'plasmaFilament', size: 'medium', imagePath: `${BASE}/plasma_filament/medium.png`, yieldMultiplier: 2 },
  { assetKey: 'plasma_large',         resourceType: 'plasmaFilament', size: 'large',  imagePath: `${BASE}/plasma_filament/large.png`,  yieldMultiplier: 2 },
];

/**
 * Known gaps in the source asset set — analogous to UNMAPPED_BUILDING_ASSETS.
 * Reported, never guessed.
 */
export const UNMAPPED_CRYSTAL_ASSETS: ReadonlyArray<{ resourceType: CrystalResourceType; size: CrystalVisualSize; reason: string }> = [
  { resourceType: 'default', size: 'large', reason: 'No big/large PNG in source "Default Cristalls" set — falls back to default_medium.' },
];

/** Lookup a sprite by type + size. Falls back to the largest available for that type. */
export function crystalVisualAsset(type: CrystalResourceType, size: CrystalVisualSize): CrystalVisualAsset | null {
  const exact = CRYSTAL_VISUAL_ASSETS.find(a => a.resourceType === type && a.size === size);
  if (exact) return exact;
  // Graceful fallback: prefer a smaller size that does exist (e.g. default has no large).
  const order: CrystalVisualSize[] = ['large', 'medium', 'small'];
  for (const s of order) {
    const a = CRYSTAL_VISUAL_ASSETS.find(x => x.resourceType === type && x.size === s);
    if (a) return a;
  }
  return null;
}
