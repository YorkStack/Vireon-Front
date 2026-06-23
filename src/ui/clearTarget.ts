// Pure targeting helper for the pioneer Clear-Vegetation command (Slice 2D).
// Maps a clicked world point to the logical F_TREE tile the player meant. Kept
// DOM-free so it is unit-testable without a renderer/canvas.
import { GameMap, F_TREE } from '../map/map';

/**
 * Resolve the F_TREE tile a click is targeting. The vegetation VISUAL rides the
 * terrain warp (≈⅓ tile off its logical tile), so an exact click can land on a
 * neighbour; with `fuzzy` we also scan the 3×3 ring and pick the nearest tree
 * tile to the click. Returns the logical [tx,tz], or null if none is in range.
 */
export function findClearTargetTile(
  map: GameMap, x: number, z: number, fuzzy: boolean,
): [number, number] | null {
  const [tx, tz] = map.worldToTile(x, z);
  const isTree = (a: number, b: number) =>
    map.inBounds(a, b) && (map.flags[map.idx(a, b)] & F_TREE) !== 0;
  if (isTree(tx, tz)) return [tx, tz];
  if (!fuzzy) return null;
  let best: [number, number] | null = null;
  let bestD = Infinity;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const a = tx + dx, b = tz + dz;
      if (!isTree(a, b)) continue;
      const [cx, cz] = map.tileToWorld(a, b);
      const d = Math.hypot(cx - x, cz - z);
      if (d < bestD) { bestD = d; best = [a, b]; }
    }
  }
  return best;
}
