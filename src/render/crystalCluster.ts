// Deterministic layout for a crystal resource CLUSTER (visual-only).
//
// A resource field should read as a small cluster — one large crystal, a few
// mediums, and several small shards — not a single billboard. This module is the
// pure, DOM-free layout: given a stable seed (the node id) it returns the size
// class + offset/scale/rotation of each piece. terrain.ts turns each piece into a
// sprite. No gameplay, economy, harvest or resource data is touched here.
import type { CrystalVisualSize } from '../data/crystalAssets';

export interface CrystalPiece {
  size: CrystalVisualSize;   // small | medium | large → picks the sprite texture
  dx: number;                // x offset from the node centre (cluster-radius units)
  dz: number;                // z offset from the node centre
  dy: number;                // tiny vertical stagger
  scale: number;             // size multiplier (large≈1, medium≈0.6, small≈0.33)
  rot: number;               // small rotation variance (radians)
}

/** Tiny deterministic PRNG (mulberry32) — same seed → same sequence, stable across reloads. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  if (a === 0) a = 0x9e3779b9; // avoid the all-zero fixed point
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build a deterministic cluster layout for one node seed:
 *   1 large centre + 2–3 mediums + 3–5 small shards  → 6–9 pieces,
 * with asymmetric placement and slight scale/rotation variance. Offsets are in
 * "cluster-radius" units (≈ -1..1); the caller scales them to world space.
 */
export function crystalClusterLayout(seed: number): CrystalPiece[] {
  const r = mulberry32(seed);
  const jitter = (amt: number) => (r() * 2 - 1) * amt;
  const pieces: CrystalPiece[] = [];

  // One large central crystal (slightly off-centre so it isn't perfectly stamped).
  pieces.push({ size: 'large', dx: jitter(0.12), dz: jitter(0.12), dy: 0, scale: 1.0 + jitter(0.08), rot: jitter(0.25) });

  // 2–3 medium crystals ringed around the centre.
  const medCount = 2 + Math.floor(r() * 2); // 2 or 3
  for (let i = 0; i < medCount; i++) {
    const ang = r() * Math.PI * 2;
    const rad = 0.34 + r() * 0.26;
    pieces.push({ size: 'medium', dx: Math.cos(ang) * rad, dz: Math.sin(ang) * rad, dy: jitter(0.02), scale: 0.6 + jitter(0.1), rot: jitter(0.4) });
  }

  // 3–5 small shards near the edges.
  const smallCount = 3 + Math.floor(r() * 3); // 3..5
  for (let i = 0; i < smallCount; i++) {
    const ang = r() * Math.PI * 2;
    const rad = 0.5 + r() * 0.45;
    pieces.push({ size: 'small', dx: Math.cos(ang) * rad, dz: Math.sin(ang) * rad, dy: jitter(0.015), scale: 0.33 + jitter(0.08), rot: jitter(0.6) });
  }

  return pieces;
}
