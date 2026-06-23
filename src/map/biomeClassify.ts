// Read-only biome classification for intra-map vegetation zoning (Slice B1).
//
// The map has NO authored biome data — it is a single procedural map. This
// derives a vegetation biome PER TILE purely from existing terrain signals
// (level, crystal proximity, and a deterministic moisture-noise axis). It is
// strictly read-only: it never mutates the map, has no gameplay effect, and is
// deterministic for a given (map seed, tile). Slice B2 (vegetationGlb) uses it to
// pick biome-appropriate vegetation; a future mission-level biome theme can layer
// on top without changing this.
import type { GameMap } from './map';
import { vnoise } from '../render/terrainNoise';

export type Biome = 'desert' | 'forest' | 'highland' | 'crystal';

/** Tiles within this many tiles of a crystal node read as the alien-crystal zone. */
const CRYSTAL_R = 3;
/** Level-0 tiles drier than this moisture read as desert/open scrub; wetter = forest. */
const MOISTURE_DESERT_MAX = 0.45;

/**
 * Deterministic "moisture/climate" field in [0,1) from the existing value noise.
 * Coarse so biomes form readable patches rather than per-tile speckle. Pure.
 */
export function tileMoisture(tx: number, tz: number): number {
  // two octaves of the shared vnoise, offset so it doesn't align with the terrain warp
  const a = vnoise(tx * 0.16 + 11.3, tz * 0.16 + 7.1);
  const b = vnoise(tx * 0.41 + 3.7, tz * 0.41 + 19.2);
  return a * 0.7 + b * 0.3;
}

/** True if (tx,tz) is within CRYSTAL_R tiles of any crystal node. */
function nearCrystal(map: GameMap, tx: number, tz: number): boolean {
  for (const c of map.crystals) {
    if (Math.hypot(tx - c.tx, tz - c.tz) <= CRYSTAL_R) return true;
  }
  return false;
}

/**
 * Classify a tile into a vegetation biome from terrain signals only. Read-only and
 * deterministic. Out-of-bounds tiles fall back to 'desert' (open) rather than
 * throwing — callers scatter on in-bounds tiles, this is just a safety net.
 *
 *   near a crystal field        → 'crystal'  (alien/fungal accents)
 *   high ground (level ≥ 2)     → 'highland' (conifers, alpine canopy/fern)
 *   low ground (level 0), dry   → 'desert'   (cacti, palm, open scrub)
 *   everything else (lush)      → 'forest'   (canopy, coral, mushrooms)
 */
export function classifyTileBiome(map: GameMap, tx: number, tz: number): Biome {
  if (!map.inBounds(tx, tz)) return 'desert';
  if (nearCrystal(map, tx, tz)) return 'crystal';
  const level = map.level[map.idx(tx, tz)];
  if (level >= 2) return 'highland';
  if (level === 0 && tileMoisture(tx, tz) < MOISTURE_DESERT_MAX) return 'desert';
  return 'forest';
}
