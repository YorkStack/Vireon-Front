// Map generation: layered plateaus, cliffs, carved ramps, rock spires, crystal fields.
// All terrain data lives in flat typed arrays indexed by tx + tz * size.

export const TILE = 2; // world units per tile
export const LEVEL_H = 1.6; // world height per terrain level

export const F_ROCK = 1;
export const F_BUILDING = 2;
export const F_RAMP = 4;
export const F_NARROW = 8; // infantry-only ramp
export const F_CRYSTAL = 16;
// Tile carries blocking (large) vegetation: NOT buildable (canPlace rejects any
// non-zero flag), but still walkable — deliberately excluded from the isWalkable
// mask so units drive through trees. Set by the vegetation layer at build time.
export const F_TREE = 32;

export interface CrystalNode {
  id: number;
  tx: number;
  tz: number;
  amount: number;
  max: number;

  // World Phase 1b — PREPARED resource metadata. All optional with safe defaults
  // so existing nodes and saved maps stay compatible and balance is unchanged.
  // Today every spawned node is an implicit 'default' (×1) node; these fields are
  // not yet read by the live harvest/visual loop. See sim/resources.ts.
  resourceType?: import('../data/crystalAssets').CrystalResourceType;
  yieldMultiplier?: number;
  visualSize?: import('../data/crystalAssets').CrystalVisualSize;
  visualStage?: import('../sim/resources').CrystalVisualStage;
}

export interface StartZone {
  tx: number;
  tz: number;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class GameMap {
  size: number;
  level: Int8Array;
  flags: Uint8Array;
  walkHeight: Float32Array; // tiles: level, ramps: level + 0.5
  rampDir: Int8Array; // 0 none, 1 +x, 2 -x, 3 +z, 4 -z (toward higher side)
  crystals: CrystalNode[] = [];
  playerStart!: StartZone;
  enemyStart!: StartZone;
  rng: () => number;

  constructor(size: number, seed: number) {
    this.size = size;
    this.level = new Int8Array(size * size);
    this.flags = new Uint8Array(size * size);
    this.walkHeight = new Float32Array(size * size);
    this.rampDir = new Int8Array(size * size);
    this.rng = mulberry32(seed);
    this.generate();
  }

  idx(tx: number, tz: number) { return tx + tz * this.size; }
  inBounds(tx: number, tz: number) { return tx >= 0 && tz >= 0 && tx < this.size && tz < this.size; }

  /** World position of a tile center. */
  tileToWorld(tx: number, tz: number): [number, number] {
    return [(tx + 0.5) * TILE, (tz + 0.5) * TILE];
  }
  worldToTile(x: number, z: number): [number, number] {
    return [Math.floor(x / TILE), Math.floor(z / TILE)];
  }

  /** World-space ground height at a continuous position (respects ramp slopes). */
  groundHeight(x: number, z: number): number {
    const tx = Math.floor(x / TILE), tz = Math.floor(z / TILE);
    if (!this.inBounds(tx, tz)) return 0;
    const i = this.idx(tx, tz);
    const lvl = this.level[i];
    if (!(this.flags[i] & F_RAMP)) return lvl * LEVEL_H;
    // Ramp: interpolate from low edge to high edge.
    const fx = x / TILE - tx, fz = z / TILE - tz;
    const d = this.rampDir[i];
    let t = 0.5;
    if (d === 1) t = fx; else if (d === 2) t = 1 - fx; else if (d === 3) t = fz; else if (d === 4) t = 1 - fz;
    return (lvl + t) * LEVEL_H;
  }

  isWalkable(tx: number, tz: number): boolean {
    if (!this.inBounds(tx, tz)) return false;
    return (this.flags[this.idx(tx, tz)] & (F_ROCK | F_BUILDING | F_CRYSTAL)) === 0;
  }

  /** Can a unit step between two adjacent tiles? Cliffs (full level diff) block. */
  canStep(ax: number, az: number, bx: number, bz: number, infantry: boolean): boolean {
    if (!this.isWalkable(bx, bz)) return false;
    const ia = this.idx(ax, az), ib = this.idx(bx, bz);
    if (!infantry && (this.flags[ib] & F_NARROW)) return false;
    if (!infantry && (this.flags[ia] & F_NARROW)) {
      // vehicles never stand on narrow ramps anyway
      return false;
    }
    return Math.abs(this.walkHeight[ia] - this.walkHeight[ib]) <= 0.55;
  }

  // ---------------- generation ----------------

  private generate() {
    const n = this.size;
    const rng = this.rng;

    // Value-noise fbm over a coarse lattice.
    const lat = 13;
    const lattice = new Float32Array((lat + 1) * (lat + 1));
    for (let i = 0; i < lattice.length; i++) lattice[i] = rng();
    const latticeAt = (u: number, v: number) => {
      const x0 = Math.floor(u), z0 = Math.floor(v);
      const fx = u - x0, fz = v - z0;
      const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
      // Wrap lattice indices so any octave frequency stays continuous.
      const g = (x: number, z: number) =>
        lattice[(((x % (lat + 1)) + lat + 1) % (lat + 1)) + (((z % (lat + 1)) + lat + 1) % (lat + 1)) * (lat + 1)];
      const a = g(x0, z0) * (1 - sx) + g(x0 + 1, z0) * sx;
      const b = g(x0, z0 + 1) * (1 - sx) + g(x0 + 1, z0 + 1) * sx;
      return a * (1 - sz) + b * sz;
    };

    for (let tz = 0; tz < n; tz++) {
      for (let tx = 0; tx < n; tx++) {
        const u = (tx / n) * (lat - 1), v = (tz / n) * (lat - 1);
        let h = latticeAt(u, v) * 0.78 + latticeAt(u * 2.13 + 31, v * 2.13 + 17) * 0.22;
        // Gentle bowl: map edges trend higher for a "rim" feel.
        const ex = Math.min(tx, n - 1 - tx) / n, ez = Math.min(tz, n - 1 - tz) / n;
        h += Math.max(0, 0.18 - Math.min(ex, ez)) * 0.9;
        const lvl = h < 0.42 ? 0 : h < 0.62 ? 1 : 2;
        this.level[this.idx(tx, tz)] = lvl;
      }
    }

    // Majority smoothing to remove single-tile specks.
    for (let pass = 0; pass < 3; pass++) {
      const next = new Int8Array(this.level);
      for (let tz = 1; tz < n - 1; tz++) {
        for (let tx = 1; tx < n - 1; tx++) {
          const counts = [0, 0, 0];
          for (let dz = -1; dz <= 1; dz++)
            for (let dx = -1; dx <= 1; dx++) counts[this.level[this.idx(tx + dx, tz + dz)]]++;
          let best = 0;
          for (let l = 1; l < 3; l++) if (counts[l] > counts[best]) best = l;
          if (counts[best] >= 6) next[this.idx(tx, tz)] = best;
        }
      }
      this.level = next;
    }

    // Start zones in opposite corners, flattened.
    this.playerStart = this.flattenStart(16, n - 17);
    this.enemyStart = this.flattenStart(n - 17, 16);

    // Carve ramps along cliff edges until the map is well connected.
    this.carveRamps();

    // Rock spires (impassable obstacles), away from the start zones.
    const rocks = Math.floor(n * n * 0.006);
    for (let i = 0; i < rocks; i++) {
      const tx = 2 + Math.floor(rng() * (n - 4));
      const tz = 2 + Math.floor(rng() * (n - 4));
      if (this.distToStarts(tx, tz) < 14) continue;
      const j = this.idx(tx, tz);
      if (this.flags[j] & (F_RAMP | F_CRYSTAL)) continue;
      this.flags[j] |= F_ROCK;
    }
    // Drop rocks that broke connectivity.
    this.repairConnectivity();

    // Crystal fields: one near each base, plus contested mid-map fields.
    let cid = 0;
    const placeField = (cx: number, cz: number, count: number, rich: number) => {
      let placed = 0, tries = 0;
      while (placed < count && tries++ < 400) {
        const a = rng() * Math.PI * 2, r = 1 + rng() * 3.5;
        const tx = Math.round(cx + Math.cos(a) * r), tz = Math.round(cz + Math.sin(a) * r);
        if (!this.inBounds(tx, tz)) continue;
        const j = this.idx(tx, tz);
        if (this.flags[j] !== 0) continue;
        if (!this.hasWalkableNeighbor(tx, tz)) continue;
        this.flags[j] |= F_CRYSTAL;
        this.crystals.push({ id: cid++, tx, tz, amount: rich, max: rich });
        placed++;
      }
    };
    const ps = this.playerStart, es = this.enemyStart;
    placeField(ps.tx + 9, ps.tz - 9, 7, 4000);
    placeField(es.tx - 9, es.tz + 9, 7, 4000);
    placeField(Math.floor(n / 2), Math.floor(n / 2), 9, 6000);
    placeField(Math.floor(n * 0.2), Math.floor(n * 0.2), 6, 5000);
    placeField(Math.floor(n * 0.8), Math.floor(n * 0.8), 6, 5000);

    this.recomputeWalkHeights();
    this.repairConnectivity();
  }

  private distToStarts(tx: number, tz: number) {
    const d1 = Math.hypot(tx - this.playerStart.tx, tz - this.playerStart.tz);
    const d2 = Math.hypot(tx - this.enemyStart.tx, tz - this.enemyStart.tz);
    return Math.min(d1, d2);
  }

  private hasWalkableNeighbor(tx: number, tz: number) {
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++)
        if ((dx || dz) && this.isWalkable(tx + dx, tz + dz)) return true;
    return false;
  }

  private flattenStart(tx: number, tz: number): StartZone {
    const lvl = this.level[this.idx(tx, tz)];
    const R = 11;
    for (let dz = -R; dz <= R; dz++) {
      for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dz * dz > R * R) continue;
        const x = tx + dx, z = tz + dz;
        if (!this.inBounds(x, z)) continue;
        const j = this.idx(x, z);
        this.level[j] = lvl;
        this.flags[j] = 0;
        this.rampDir[j] = 0;
      }
    }
    return { tx, tz };
  }

  private recomputeWalkHeights() {
    for (let i = 0; i < this.level.length; i++) {
      this.walkHeight[i] = this.level[i] + ((this.flags[i] & F_RAMP) ? 0.5 : 0);
    }
  }

  /** Find cliff edges (level diff exactly 1) and convert some tiles into ramps. */
  private carveRamps() {
    const n = this.size;
    const rng = this.rng;
    const dirs: [number, number, number][] = [[1, 0, 1], [-1, 0, 2], [0, 1, 3], [0, -1, 4]];
    // Collect candidates: lower tile adjacent to exactly-one-higher tile.
    const candidates: { tx: number; tz: number; dir: number }[] = [];
    for (let tz = 2; tz < n - 2; tz++) {
      for (let tx = 2; tx < n - 2; tx++) {
        const j = this.idx(tx, tz);
        if (this.flags[j] !== 0) continue;
        const l = this.level[j];
        for (const [dx, dz, d] of dirs) {
          const k = this.idx(tx + dx, tz + dz);
          if (this.level[k] === l + 1 && this.flags[k] === 0) {
            candidates.push({ tx, tz, dir: d });
            break;
          }
        }
      }
    }
    // Shuffle and carve spaced-out ramps; most are wide (2 tiles, vehicle-capable).
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    const minSpacing = 7;
    const placed: { tx: number; tz: number }[] = [];
    for (const c of candidates) {
      if (placed.some(p => Math.hypot(p.tx - c.tx, p.tz - c.tz) < minSpacing)) continue;
      const wide = rng() > 0.25;
      if (this.tryPlaceRamp(c.tx, c.tz, c.dir, wide)) placed.push(c);
    }
    this.recomputeWalkHeights();
  }

  private tryPlaceRamp(tx: number, tz: number, dir: number, wide: boolean): boolean {
    const j = this.idx(tx, tz);
    const l = this.level[j];
    const [hx, hz] = dir === 1 ? [1, 0] : dir === 2 ? [-1, 0] : dir === 3 ? [0, 1] : [0, -1];
    // Validate: higher side is l+1, lower side (behind) is l.
    const hi = this.idx(tx + hx, tz + hz);
    const lo = this.inBounds(tx - hx, tz - hz) ? this.idx(tx - hx, tz - hz) : -1;
    if (this.level[hi] !== l + 1 || this.flags[hi] !== 0) return false;
    if (lo < 0 || this.level[lo] !== l || this.flags[lo] !== 0) return false;
    const mark = (x: number, z: number) => {
      const k = this.idx(x, z);
      this.flags[k] |= F_RAMP;
      if (!wide) this.flags[k] |= F_NARROW;
      this.rampDir[k] = dir;
    };
    mark(tx, tz);
    if (wide) {
      // Second parallel tile (perpendicular to ramp direction).
      const [px, pz] = hx !== 0 ? [0, 1] : [1, 0];
      const sx = tx + px, sz = tz + pz;
      if (this.inBounds(sx, sz)) {
        const sj = this.idx(sx, sz);
        const shi = this.idx(sx + hx, sz + hz);
        if (this.level[sj] === l && this.flags[sj] === 0 && this.level[shi] === l + 1 && this.flags[shi] === 0) {
          mark(sx, sz);
        }
      }
    }
    return true;
  }

  /** BFS from player start; if enemy start is unreachable, carve more ramps / clear rocks. */
  private repairConnectivity() {
    for (let attempt = 0; attempt < 12; attempt++) {
      const reach = this.reachableFrom(this.playerStart.tx, this.playerStart.tz, false);
      if (reach[this.idx(this.enemyStart.tx, this.enemyStart.tz)]) return;
      // Carve a ramp on a cliff edge between reached and unreached walkable space,
      // preferring edges roughly on the line between the two starts.
      let carved = false;
      const n = this.size;
      const dirs: [number, number, number][] = [[1, 0, 1], [-1, 0, 2], [0, 1, 3], [0, -1, 4]];
      outer: for (let tz = 2; tz < n - 2; tz++) {
        for (let tx = 2; tx < n - 2; tx++) {
          const j = this.idx(tx, tz);
          if (!reach[j] || this.flags[j] !== 0) continue;
          const l = this.level[j];
          for (const [dx, dz, d] of dirs) {
            const k = this.idx(tx + dx, tz + dz);
            if (this.level[k] === l + 1 && this.flags[k] === 0 && !reach[k]) {
              if (this.tryPlaceRamp(tx, tz, d, true)) { carved = true; break outer; }
            }
          }
          // Rock blocking the way? Clear it.
          for (const [dx, dz] of dirs) {
            const k = this.idx(tx + dx, tz + dz);
            if ((this.flags[k] & F_ROCK) && this.level[k] === l) {
              this.flags[k] &= ~F_ROCK; carved = true; break outer;
            }
          }
        }
      }
      this.recomputeWalkHeights();
      if (!carved) {
        // Last resort: flatten a corridor between the starts.
        this.flattenCorridor();
        this.recomputeWalkHeights();
        return;
      }
    }
  }

  private flattenCorridor() {
    const a = this.playerStart, b = this.enemyStart;
    const steps = Math.ceil(Math.hypot(b.tx - a.tx, b.tz - a.tz));
    let lvl = this.level[this.idx(a.tx, a.tz)];
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const tx = Math.round(a.tx + (b.tx - a.tx) * t);
      const tz = Math.round(a.tz + (b.tz - a.tz) * t);
      const targetLvl = this.level[this.idx(b.tx, b.tz)];
      if (s > steps * 0.7) lvl = targetLvl;
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!this.inBounds(tx + dx, tz + dz)) continue;
          const j = this.idx(tx + dx, tz + dz);
          if (this.flags[j] & F_CRYSTAL) continue;
          this.level[j] = lvl;
          this.flags[j] &= ~(F_ROCK | F_RAMP | F_NARROW);
          this.rampDir[j] = 0;
        }
      }
    }
  }

  reachableFrom(tx: number, tz: number, infantry: boolean): Uint8Array {
    this.recomputeWalkHeights();
    const n = this.size;
    const seen = new Uint8Array(n * n);
    const q = [tx + tz * n];
    seen[q[0]] = 1;
    while (q.length) {
      const cur = q.pop()!;
      const cx = cur % n, cz = Math.floor(cur / n);
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dz) continue;
          const nx = cx + dx, nz = cz + dz;
          if (!this.inBounds(nx, nz)) continue;
          const ni = nx + nz * n;
          if (seen[ni]) continue;
          if (dx && dz) continue; // orthogonal only for connectivity check
          if (!this.canStep(cx, cz, nx, nz, infantry)) continue;
          seen[ni] = 1;
          q.push(ni);
        }
      }
    }
    return seen;
  }
}
