// Grid A* with a binary heap. Diagonals allowed only when both orthogonal
// neighbors are passable (no cutting cliff corners).
import { GameMap } from '../map/map';

class Heap {
  keys: number[] = [];
  costs: number[] = [];
  push(key: number, cost: number) {
    this.keys.push(key); this.costs.push(cost);
    let i = this.keys.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.costs[p] <= this.costs[i]) break;
      this.swap(i, p); i = p;
    }
  }
  pop(): number {
    const top = this.keys[0];
    const lastK = this.keys.pop()!, lastC = this.costs.pop()!;
    if (this.keys.length) {
      this.keys[0] = lastK; this.costs[0] = lastC;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < this.keys.length && this.costs[l] < this.costs[m]) m = l;
        if (r < this.keys.length && this.costs[r] < this.costs[m]) m = r;
        if (m === i) break;
        this.swap(i, m); i = m;
      }
    }
    return top;
  }
  swap(a: number, b: number) {
    [this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]];
    [this.costs[a], this.costs[b]] = [this.costs[b], this.costs[a]];
  }
  get size() { return this.keys.length; }
}

const MAX_EXPAND = 14000;

/**
 * Find a tile path from (sx,sz) to (gx,gz). Returns waypoints excluding start,
 * or null if unreachable. If the goal is blocked, walks to the nearest
 * reachable tile around it.
 */
export function findPath(
  map: GameMap, sx: number, sz: number, gx: number, gz: number, infantry: boolean,
): [number, number][] | null {
  const n = map.size;
  if (!map.inBounds(sx, sz)) return null;
  gx = Math.max(0, Math.min(n - 1, gx));
  gz = Math.max(0, Math.min(n - 1, gz));

  const gScore = new Float32Array(n * n).fill(Infinity);
  const came = new Int32Array(n * n).fill(-1);
  const closed = new Uint8Array(n * n);
  const start = sx + sz * n;
  gScore[start] = 0;
  const h = (x: number, z: number) => {
    const dx = Math.abs(x - gx), dz = Math.abs(z - gz);
    return Math.max(dx, dz) + 0.41421 * Math.min(dx, dz);
  };
  const open = new Heap();
  open.push(start, h(sx, sz));

  let best = start;
  let bestH = h(sx, sz);
  let expanded = 0;
  const goal = gx + gz * n;

  while (open.size && expanded < MAX_EXPAND) {
    const cur = open.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    expanded++;
    const cx = cur % n, cz = (cur / n) | 0;
    const hh = h(cx, cz);
    if (hh < bestH) { bestH = hh; best = cur; }
    if (cur === goal || hh < 0.01) { best = cur; break; }

    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cx + dx, nz = cz + dz;
        if (!map.inBounds(nx, nz)) continue;
        const ni = nx + nz * n;
        if (closed[ni]) continue;
        if (dx && dz) {
          if (!map.canStep(cx, cz, cx + dx, cz, infantry)) continue;
          if (!map.canStep(cx, cz, cx, cz + dz, infantry)) continue;
        }
        if (!map.canStep(cx, cz, nx, nz, infantry)) continue;
        const cost = gScore[cur] + (dx && dz ? 1.41421 : 1);
        if (cost < gScore[ni]) {
          gScore[ni] = cost;
          came[ni] = cur;
          open.push(ni, cost + h(nx, nz));
        }
      }
    }
  }

  // Reconstruct toward the closest reachable tile to the goal.
  if (best === start && bestH > 1.5) return null;
  const path: [number, number][] = [];
  let cur = best;
  while (cur !== start && cur >= 0) {
    path.push([cur % n, (cur / n) | 0]);
    cur = came[cur];
  }
  path.reverse();
  return path.length ? path : null;
}
