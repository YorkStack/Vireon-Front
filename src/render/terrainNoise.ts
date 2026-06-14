// Pure noise / hash helpers shared by terrain and prop placement. No Three.js
// dependency, fully deterministic — safe to unit-test and to reuse from props.ts
// so terrain features and props ride the exact same horizontal warp field.

/** Deterministic 2D hash in [0,1). Stable across runs (sin-based). */
export function hash2(x: number, z: number): number {
  const h = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return h - Math.floor(h);
}

/** Smooth value noise (lattice + smoothstep) in [0,1). */
export function vnoise(x: number, z: number): number {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

export const WARP_AMP = 0.45;

// Horizontal domain warp: nudges a world XZ position along a smooth noise field
// so the grid-aligned plateau outlines and cliff edges meander organically
// instead of reading as hard rectangles. Pure function of (x,z), so any shared
// vertex/feature is displaced identically -> the mesh stays watertight and props
// stay glued to the ground. Heights are untouched (logical pathfinding intact).
export function warpXZ(x: number, z: number): [number, number] {
  let dx = vnoise(x * 0.15, z * 0.15) - 0.5;
  let dz = vnoise(x * 0.15 + 5.2, z * 0.15 + 1.3) - 0.5;
  dx += (vnoise(x * 0.42 + 9, z * 0.42) - 0.5) * 0.45;
  dz += (vnoise(x * 0.42, z * 0.42 + 7) - 0.5) * 0.45;
  return [x + dx * WARP_AMP * 2, z + dz * WARP_AMP * 2];
}
