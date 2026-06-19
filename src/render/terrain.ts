// Terrain rendering: subdivided tile tops with fine color mottling, a
// generated grain texture, ambient occlusion at cliff bases, strata-banded
// cliff walls, paved ramps, plus dense instanced environment props
// (pebbles, alien grass, spore lamps, crystal shards, glow pools).
import * as THREE from 'three';
import { GameMap, TILE, LEVEL_H, F_RAMP, F_NARROW, F_ROCK, F_CRYSTAL } from '../map/map';
import { hash2, vnoise, warpXZ } from './terrainNoise';
import { buildVegetation, buildRocks, type VegetationBuild } from './props';
import { buildVegetationGlbInstances, vegModeFromQuery } from './vegetationGlb';
import { crystalStageImagePath } from '../data/crystalAssets';

// Palette is pre-brightened ~20% because the grain texture multiplies it down.
const LEVEL_COLORS = [
  new THREE.Color('#46425f'), // valley floor: dark indigo
  new THREE.Color('#5e5a7d'), // mid plateau: violet grey
  new THREE.Color('#7b769c'), // high plateau: pale violet
];
const LEVEL_TINTS = [
  new THREE.Color('#3c5a62'), // teal mottling in valleys
  new THREE.Color('#6a5570'), // mauve mottling on mid ground
  new THREE.Color('#8a87a8'), // cool grey on high ground
];
const RAMP_COLOR = new THREE.Color('#98a4c2');
const RAMP_EDGE = new THREE.Color('#c2cce4');
const NARROW_RAMP_COLOR = new THREE.Color('#a8bb9a');
const CLIFF_HI = new THREE.Color('#4e4868');
const CLIFF_MID = new THREE.Color('#2c2742');
const CLIFF_LO = new THREE.Color('#14111f');
// Sloped cliff faces blend rock (top) -> mossy grass-green (foot) by vertex
// colour, so the new angled transitions melt naturally into the valley grass.
const SLOPE_FOOT = new THREE.Color('#436b4c');

export interface TerrainBuild {
  terrain: THREE.Mesh;
  rocks: THREE.Mesh;
  props: THREE.Group;
  crystalGroups: Map<number, THREE.Group>;
  /** Per-frame: re-orients Y-locked vegetation billboards toward the camera. */
  updateProps: (camera: THREE.Camera) => void;
}

// Per-height-level ground textures (generated natural rock). Loaded once.
const groundLoader = new THREE.TextureLoader();
function loadGround(url: string): THREE.Texture {
  const t = groundLoader.load(url);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
// Per-height-level ground textures. Each level has several seamless variants
// that the terrain material BLENDS SMOOTHLY via a world-space noise mask, so
// there are no hard tile seams and the variants melt into one another. Genuine
// tonal differences between variants are fine - the blend hides the joins.
const GROUND_TEX: THREE.Texture[][] = [
  ['valley/01', 'valley/02', 'valley/03', 'valley/04'].map((v) => loadGround(`/assets/terrain/ground/${v}.png`)),
  ['mid/01', 'mid/02', 'mid/03'].map((v) => loadGround(`/assets/terrain/ground/${v}.png`)),
  ['high/01', 'high/02', 'high/03'].map((v) => loadGround(`/assets/terrain/ground/${v}.png`)),
];
// Faint cool tint per level: keeps the Vireon mood and stops the high plateau
// from blowing out while the natural textures still read true.
const GROUND_TINT = ['#dfe6df', '#d4d4dc', '#c6c6ce'];

/**
 * MeshStandardMaterial whose diffuse map is N seamless variants blended by a
 * large-scale world-space noise mask. Each variant owns soft organic patches;
 * patch edges cross-fade, so the ground never reads as one repeating tile and
 * different textures flow into each other. Keeps full PBR lighting + shadows +
 * vertex colours (AO/grain) by patching MeshStandard via onBeforeCompile.
 */
function makeBlendGroundMaterial(texs: THREE.Texture[], tint: string): THREE.MeshStandardMaterial {
  const n = Math.max(1, texs.length);
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, map: texs[0], color: tint, roughness: 0.96, metalness: 0.03,
  });
  mat.onBeforeCompile = (shader) => {
    let decls = '';
    for (let i = 1; i < n; i++) {
      shader.uniforms['uTex' + i] = { value: texs[i] };
      decls += `uniform sampler2D uTex${i};\n`;
    }
    // One noise field per variant -> pow() to sharpen into patches -> normalise.
    let body = '';
    for (let i = 0; i < n; i++) {
      const ox = (i * 11.7 + 3.1).toFixed(2), oz = (i * 7.3 + 5.9).toFixed(2);
      body += `float pw${i} = pow(fbm(wp + vec2(${ox}, ${oz})), 2.5);\n`;
    }
    const sumTerms = Array.from({ length: n }, (_, i) => `pw${i}`).join(' + ');
    let blend = `vec4 sampledDiffuseColor = texture2D(map, vMapUv) * (pw0 / wsum)`;
    for (let i = 1; i < n; i++) blend += ` + texture2D(uTex${i}, vMapUv) * (pw${i} / wsum)`;
    blend += `;\n`;
    const customMap = `
      vec2 wp = vWPos.xz * 0.05;
      ${body}
      float wsum = ${sumTerms} + 1e-4;
      ${blend}
      diffuseColor *= sampledDiffuseColor;
    `;
    const noiseGLSL = `
      varying vec3 vWPos;
      float vhash(vec2 p){ p = fract(p * vec2(123.34, 345.45)); p += dot(p, p + 34.345); return fract(p.x * p.y); }
      float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        float a = vhash(i), b = vhash(i + vec2(1.0, 0.0)), c = vhash(i + vec2(0.0, 1.0)), d = vhash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y); }
      float fbm(vec2 p){ return vnoise(p) * 0.6 + vnoise(p * 2.1 + 5.0) * 0.3 + vnoise(p * 4.3 + 9.0) * 0.1; }
    `;
    shader.fragmentShader = noiseGLSL + decls + shader.fragmentShader.replace('#include <map_fragment>', customMap);
    shader.vertexShader = 'varying vec3 vWPos;\n' + shader.vertexShader.replace(
      '#include <project_vertex>',
      '#include <project_vertex>\n  vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
    );
  };
  return mat;
}

// Crystal stage sprites (full / reduced / small) per resource type. Cached by
// path so the few PNGs load once, not once per node. Each crystal node owns ONE
// billboard whose material.map is swapped to the stage texture as it depletes
// (see world.ts updateCrystalVisual). All textures are pre-loaded here so the
// runtime swap never triggers a network fetch.
const crystalTexCache = new Map<string, THREE.Texture>();
function crystalStageTex(path: string): THREE.Texture {
  let t = crystalTexCache.get(path);
  if (!t) {
    t = groundLoader.load(path);
    t.colorSpace = THREE.SRGBColorSpace;
    crystalTexCache.set(path, t);
  }
  return t;
}
// (Rock textures + boulder placement + vegetation now live in props.ts.)

/** Tileable grain/noise texture multiplied over vertex colors for surface detail. */
function makeGrainTexture(): THREE.Texture {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#d2d2d8';
  ctx.fillRect(0, 0, S, S);
  // Soft blotches, drawn with wrap-around so the texture tiles seamlessly.
  for (let i = 0; i < 240; i++) {
    const v = 175 + Math.random() * 70;
    ctx.fillStyle = `rgba(${v | 0},${v | 0},${(v + 12) | 0},0.10)`;
    const r = 6 + Math.random() * 26;
    const x = Math.random() * S, y = Math.random() * S;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      ctx.beginPath(); ctx.arc(x + ox, y + oy, r, 0, 7); ctx.fill();
    }
  }
  // Cracks: thin dark strokes.
  ctx.strokeStyle = 'rgba(40,38,60,0.16)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 60; i++) {
    let x = Math.random() * S, y = Math.random() * S;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let s = 0; s < 5; s++) { x += (Math.random() - 0.5) * 26; y += (Math.random() - 0.5) * 26; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  // Per-pixel grain.
  const img = ctx.getImageData(0, 0, S, S);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 26;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Radial glow texture for crystal light pools. */
function makeGlowTexture(): THREE.Texture {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(80,255,230,0.4)');
  g.addColorStop(0.5, 'rgba(40,200,190,0.22)');
  g.addColorStop(1, 'rgba(20,140,140,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// How close a world XZ is to a height-level boundary (cliff), 0 (interior) → 1
// (right at the edge). Used to localise the organic edge-erosion warp so plateau
// interiors stay put while only the cliff outlines meander. Pure function of the
// PRE-warp world position → shared vertices erode identically (mesh watertight).
function cliffProximity(map: GameMap, wx: number, wz: number): number {
  const tx = Math.floor(wx / TILE), tz = Math.floor(wz / TILE);
  if (!map.inBounds(tx, tz)) return 0;
  const l = map.level[map.idx(tx, tz)];
  let minD = 1e9;
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      const nx = tx + dx, nz = tz + dz;
      if (!map.inBounds(nx, nz)) continue;
      if (map.level[map.idx(nx, nz)] === l) continue;
      // distance from the vertex to that differing tile's nearest edge
      const ex = Math.max((nx) * TILE - wx, 0, wx - (nx + 1) * TILE);
      const ez = Math.max((nz) * TILE - wz, 0, wz - (nz + 1) * TILE);
      const d = Math.hypot(ex, ez);
      if (d < minD) minD = d;
    }
  }
  const falloff = TILE * 2.0;           // erosion reaches ~2 tiles inland
  const p = 1 - Math.min(1, minD / falloff);
  return p * p * (3 - 2 * p);           // smoothstep
}

function cornerLevel(map: GameMap, tx: number, tz: number, cx: number, cz: number): number {
  const i = map.idx(tx, tz);
  const lvl = map.level[i];
  if (!(map.flags[i] & F_RAMP)) return lvl;
  const d = map.rampDir[i];
  if (d === 1) return lvl + cx;
  if (d === 2) return lvl + (1 - cx);
  if (d === 3) return lvl + cz;
  return lvl + (1 - cz);
}

export function buildTerrain(map: GameMap): TerrainBuild {
  const n = map.size;
  const cTmp = new THREE.Color();
  const cTmp2 = new THREE.Color();

  // One vertex bucket per material: 3 textured height-level tops + 1 misc
  // (walls + ramps, vertex-coloured with grain). Each level's material blends
  // that level's texture variants smoothly (see makeBlendGroundMaterial), so a
  // single bucket per level is enough - no per-tile variant splitting needed.
  type Bucket = { pos: number[]; col: number[]; uv: number[] };
  const tops: Bucket[] = [
    { pos: [], col: [], uv: [] }, { pos: [], col: [], uv: [] }, { pos: [], col: [], uv: [] },
  ];
  const misc: Bucket = { pos: [], col: [], uv: [] };

  const quad = (
    b: Bucket,
    ax: number, ay: number, az: number, bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number, dx: number, dy: number, dz: number,
    ca: THREE.Color, cb: THREE.Color, cc: THREE.Color, cd: THREE.Color,
    wall: boolean,
  ) => {
    b.pos.push(ax, ay, az, cx, cy, cz, bx, by, bz, ax, ay, az, dx, dy, dz, cx, cy, cz);
    b.col.push(ca.r, ca.g, ca.b, cc.r, cc.g, cc.b, cb.r, cb.g, cb.b, ca.r, ca.g, ca.b, cd.r, cd.g, cd.b, cc.r, cc.g, cc.b);
    const uv = (x: number, y: number, z: number): [number, number] =>
      wall ? [(x + z) / 6, y / 6] : [x / 11, z / 11];
    const [ua, va] = uv(ax, ay, az), [ub, vb] = uv(bx, by, bz), [uc, vc] = uv(cx, cy, cz), [ud, vd] = uv(dx, dy, dz);
    b.uv.push(ua, va, uc, vc, ub, vb, ua, va, ud, vd, uc, vc);
  };

  // Gentle organic height ripple, faded to 0 at tile edges so tops still seam
  // perfectly with the cliff walls (no cracks).
  const heightNoise = (fx: number, fz: number, wx: number, wz: number) => {
    const ef = Math.min(1, Math.min(fx, 1 - fx, fz, 1 - fz) * 2.4);
    const a = hash2(wx * 0.6, wz * 0.6) - 0.5;
    const b = hash2(wx * 1.7 + 9, wz * 1.7 + 3) - 0.5;
    return (a + b * 0.5) * 0.16 * ef;
  };

  const higherN = (tx: number, tz: number): [boolean, boolean, boolean, boolean] => {
    const l = map.level[map.idx(tx, tz)];
    const chk = (x: number, z: number) => map.inBounds(x, z) && map.level[map.idx(x, z)] > l;
    return [chk(tx + 1, tz), chk(tx - 1, tz), chk(tx, tz + 1), chk(tx, tz - 1)];
  };

  for (let tz = 0; tz < n; tz++) {
    for (let tx = 0; tx < n; tx++) {
      const i = map.idx(tx, tz);
      const isRamp = (map.flags[i] & F_RAMP) !== 0;
      const lvl = map.level[i];
      const x0 = tx * TILE, z0 = tz * TILE;
      const h00 = cornerLevel(map, tx, tz, 0, 0) * LEVEL_H;
      const h10 = cornerLevel(map, tx, tz, 1, 0) * LEVEL_H;
      const h11 = cornerLevel(map, tx, tz, 1, 1) * LEVEL_H;
      const h01 = cornerLevel(map, tx, tz, 0, 1) * LEVEL_H;
      const baseH = (fx: number, fz: number) =>
        (h00 * (1 - fx) + h10 * fx) * (1 - fz) + (h01 * (1 - fx) + h11 * fx) * fz;
      // Ramps stay perfectly planar; flat tops get the organic ripple.
      const H = (fx: number, fz: number) =>
        baseH(fx, fz) + (isRamp ? 0 : heightNoise(fx, fz, x0 + fx * TILE, z0 + fz * TILE));

      const [hiPX, hiNX, hiPZ, hiNZ] = higherN(tx, tz);
      const ao = (fx: number, fz: number) => {
        let f = 1;
        if (hiPX) f = Math.min(f, 0.62 + 0.38 * (1 - fx) * 2);
        if (hiNX) f = Math.min(f, 0.62 + 0.38 * fx * 2);
        if (hiPZ) f = Math.min(f, 0.62 + 0.38 * (1 - fz) * 2);
        if (hiNZ) f = Math.min(f, 0.62 + 0.38 * fz * 2);
        return Math.min(1, f);
      };

      // Ramp colour keeps the paved look; flat tops use a near-neutral shade so
      // the ground texture carries the hue (AO + rim + slight grain only).
      const colorAt = (fx: number, fz: number) => {
        if (isRamp) {
          const base = (map.flags[i] & F_NARROW) ? NARROW_RAMP_COLOR : RAMP_COLOR;
          const d = map.rampDir[i];
          const across = (d === 1 || d === 2) ? fz : fx;
          const edge = across < 0.22 || across > 0.78;
          cTmp.copy(edge ? RAMP_EDGE : base);
          cTmp.multiplyScalar(0.95 + hash2(tx * 2 + fx, tz * 2 + fz) * 0.1);
          return cTmp;
        }
        let s = 1.04 * ao(fx, fz);
        const l = lvl;
        const lower = (x: number, z: number) => map.inBounds(x, z) && map.level[map.idx(x, z)] < l;
        if ((fx > 0.7 && lower(tx + 1, tz)) || (fx < 0.3 && lower(tx - 1, tz)) ||
            (fz > 0.7 && lower(tx, tz + 1)) || (fz < 0.3 && lower(tx, tz - 1))) {
          s *= 1.28;
        }
        s *= 0.92 + hash2(tx * 4 + fx * 2, tz * 4 + fz * 2) * 0.16;
        cTmp.setScalar(Math.min(1.25, s));
        return cTmp;
      };

      // Top surface: 3x3 sub-quads, into this level's textured bucket (or misc
      // for ramps). The level material blends its variants in-shader.
      const dest = isRamp ? misc : tops[lvl];
      const SUB = 3;
      for (let sz = 0; sz < SUB; sz++) {
        for (let sx = 0; sx < SUB; sx++) {
          const fa = sx / SUB, fb = (sx + 1) / SUB, fc = sz / SUB, fd = (sz + 1) / SUB;
          const pad = 0.3 / SUB;
          const ca = colorAt(fa + pad, fc + pad).clone();
          const cb = colorAt(fb - pad, fc + pad).clone();
          const cc = colorAt(fb - pad, fd - pad).clone();
          const cd = colorAt(fa + pad, fd - pad).clone();
          quad(dest,
            x0 + fa * TILE, H(fa, fc), z0 + fc * TILE,
            x0 + fb * TILE, H(fb, fc), z0 + fc * TILE,
            x0 + fb * TILE, H(fb, fd), z0 + fd * TILE,
            x0 + fa * TILE, H(fa, fd), z0 + fd * TILE,
            ca, cb, cc, cd, false,
          );
        }
      }

      // Cliff faces (into misc): SLOPED aprons instead of vertical walls. The
      // face leans OUT over the lower neighbour by `run` (toward ox,oz), turning
      // the hard 90deg step into a climbable incline. Two strata bands carry a
      // vertex-colour blend: rock at the crest -> mossy grass-green at the foot,
      // so the slope flows naturally into the valley grass texture below.
      const wall = (
        axx: number, azz: number, bxx: number, bzz: number,
        ha: number, hb: number, na: number, nb: number,
        ox: number, oz: number,
      ) => {
        if (ha <= na + 0.01 && hb <= nb + 0.01) return;
        const span = Math.max(ha - na, hb - nb);
        const run = Math.min(1.0, Math.max(0.35, span * 0.62));
        const v = 0.9 + hash2(axx * 3, azz * 3) * 0.2;
        // mid edge: halfway out and down; bottom edge: fully out, on lower tile.
        const aMx = axx + ox * run * 0.5, aMz = azz + oz * run * 0.5;
        const bMx = bxx + ox * run * 0.5, bMz = bzz + oz * run * 0.5;
        const aBx = axx + ox * run, aBz = azz + oz * run;
        const bBx = bxx + ox * run, bBz = bzz + oz * run;
        const ma = (ha + na) / 2, mb = (hb + nb) / 2;
        const naL = na - 0.02, nbL = nb - 0.02; // tuck the foot just under ground
        const top = cTmp.copy(CLIFF_HI).multiplyScalar(1.22 * v).clone();
        const mid = cTmp.copy(CLIFF_MID).multiplyScalar(1.05 * v).clone();
        const foot = cTmp2.copy(SLOPE_FOOT).multiplyScalar(0.85 + hash2(bxx, azz) * 0.3).clone();
        quad(misc, axx, ha, azz, bxx, hb, bzz, bMx, mb, bMz, aMx, ma, aMz, top, top, mid, mid, true);
        quad(misc, aMx, ma, aMz, bMx, mb, bMz, bBx, nbL, bBz, aBx, naL, aBz, mid, mid, foot, foot, true);
      };
      {
        const nz = tz + 1;
        const na = map.inBounds(tx, nz) ? cornerLevel(map, tx, nz, 0, 0) * LEVEL_H : 0;
        const nb = map.inBounds(tx, nz) ? cornerLevel(map, tx, nz, 1, 0) * LEVEL_H : 0;
        wall(x0, z0 + TILE, x0 + TILE, z0 + TILE, h01, h11, na, nb, 0, 1);
      }
      {
        const nz = tz - 1;
        const na = map.inBounds(tx, nz) ? cornerLevel(map, tx, nz, 1, 1) * LEVEL_H : 0;
        const nb = map.inBounds(tx, nz) ? cornerLevel(map, tx, nz, 0, 1) * LEVEL_H : 0;
        wall(x0 + TILE, z0, x0, z0, h10, h00, na, nb, 0, -1);
      }
      {
        const nx = tx + 1;
        const na = map.inBounds(nx, tz) ? cornerLevel(map, nx, tz, 0, 1) * LEVEL_H : 0;
        const nb = map.inBounds(nx, tz) ? cornerLevel(map, nx, tz, 0, 0) * LEVEL_H : 0;
        wall(x0 + TILE, z0 + TILE, x0 + TILE, z0, h11, h10, na, nb, 1, 0);
      }
      {
        const nx = tx - 1;
        const na = map.inBounds(nx, tz) ? cornerLevel(map, nx, tz, 1, 0) * LEVEL_H : 0;
        const nb = map.inBounds(nx, tz) ? cornerLevel(map, nx, tz, 1, 1) * LEVEL_H : 0;
        wall(x0, z0, x0, z0 + TILE, h00, h01, na, nb, -1, 0);
      }
    }
  }

  // Assemble one mesh with a material per bucket (single raycast target).
  const allPos: number[] = [], allCol: number[] = [], allUv: number[] = [];
  const buckets = [...tops, misc];
  const geo = new THREE.BufferGeometry();
  let vOff = 0;
  for (let gi = 0; gi < buckets.length; gi++) {
    const b = buckets[gi];
    const cnt = b.pos.length / 3;
    if (cnt) geo.addGroup(vOff, cnt, gi);
    vOff += cnt;
    // Plain loops: spreading huge arrays into push() overflows the call stack.
    for (let k = 0; k < b.pos.length; k++) allPos.push(b.pos[k]);
    for (let k = 0; k < b.col.length; k++) allCol.push(b.col[k]);
    for (let k = 0; k < b.uv.length; k++) allUv.push(b.uv[k]);
  }
  // Break the grid: warp every vertex horizontally so plateau/cliff outlines
  // meander instead of following straight tile rows. UVs keep using the original
  // (pre-warp) world coords baked above, so textures don't smear.
  // On top of the global warp, add a stronger EDGE-EROSION that only kicks in
  // near height-level boundaries (cliffProximity) — this is what turns the hard
  // rectangular cliff outlines into organic, eroded coastlines. Plateau interiors
  // (proximity 0) are left untouched, so units/buildings stay aligned. Both terms
  // are pure functions of the pre-warp XZ → shared vertices move identically and
  // the mesh stays watertight; heights/pathfinding are unaffected.
  for (let k = 0; k < allPos.length; k += 3) {
    const ox = allPos[k], oz = allPos[k + 2];
    let [wx, wz] = warpXZ(ox, oz);
    const prox = cliffProximity(map, ox, oz);
    if (prox > 0.001) {
      // Two octaves of organic crenellation along the edge.
      const ex = (vnoise(ox * 0.55 + 11, oz * 0.55) - 0.5)
        + (vnoise(ox * 1.3 + 4, oz * 1.3 + 9) - 0.5) * 0.5;
      const ez = (vnoise(ox * 0.55, oz * 0.55 + 19) - 0.5)
        + (vnoise(ox * 1.3 + 6, oz * 1.3 + 2) - 0.5) * 0.5;
      const amp = prox * 1.5; // up to ~1.5 world units of lateral erosion at edges
      wx += ex * amp; wz += ez * amp;
    }
    allPos[k] = wx; allPos[k + 2] = wz;
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(allPos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(allCol, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(allUv, 2));
  geo.computeVertexNormals();
  const miscMat = new THREE.MeshStandardMaterial({
    vertexColors: true, map: makeGrainTexture(), roughness: 0.94, metalness: 0.04,
  });
  // One blend material per level (each smoothly mixing that level's variants),
  // plus the misc/grain material last. Order matches the bucket order above.
  const terrain = new THREE.Mesh(geo, [
    makeBlendGroundMaterial(GROUND_TEX[0], GROUND_TINT[0]),
    makeBlendGroundMaterial(GROUND_TEX[1], GROUND_TINT[1]),
    makeBlendGroundMaterial(GROUND_TEX[2], GROUND_TINT[2]),
    miscMat,
  ]);
  terrain.receiveShadow = true;
  terrain.name = 'terrain';

  // ---------------- rock spires ----------------
  const rockPos: number[] = [];
  const rockCol: number[] = [];
  const cone = new THREE.ConeGeometry(1, 1, 6);
  const m4 = new THREE.Matrix4();
  const rockBase = new THREE.Color('#241e36');
  const rockTip = new THREE.Color('#4a4470');
  for (let tz = 0; tz < n; tz++) {
    for (let tx = 0; tx < n; tx++) {
      const i = map.idx(tx, tz);
      if (!(map.flags[i] & F_ROCK)) continue;
      const [wx, wz] = warpXZ(...map.tileToWorld(tx, tz));
      const gy = map.level[i] * LEVEL_H;
      const seeds = 3 + (tx * 7 + tz * 13) % 3;
      for (let s = 0; s < seeds; s++) {
        const ox = (hash2(tx * 31 + s, tz * 17) - 0.5) * 1.4;
        const oz = (hash2(tx * 23, tz * 29 + s) - 0.5) * 1.4;
        const h = 1.8 + hash2(tx * 13 + s, tz * 7) * 3.2;
        const r = 0.45 + hash2(tx + s, tz + s) * 0.45;
        const lean = (hash2(tx * 3 + s, tz * 5) - 0.5) * 0.35;
        m4.makeRotationZ(lean).scale(new THREE.Vector3(r, h, r)).setPosition(wx + ox, gy + h / 2 - 0.1, wz + oz);
        const g = cone.clone().applyMatrix4(m4);
        const arr = g.getAttribute('position').array as Float32Array;
        for (let k = 0; k < arr.length; k += 3) {
          rockPos.push(arr[k], arr[k + 1], arr[k + 2]);
          // Gradient: dark base to lighter violet tip.
          const t = Math.min(1, Math.max(0, (arr[k + 1] - gy) / (h + 0.001)));
          cTmp.copy(rockBase).lerp(rockTip, t * t).multiplyScalar(0.85 + hash2(k, s) * 0.3);
          rockCol.push(cTmp.r, cTmp.g, cTmp.b);
        }
      }
    }
  }
  let rocks: THREE.Mesh;
  if (rockPos.length) {
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(rockPos, 3));
    rg.setAttribute('color', new THREE.Float32BufferAttribute(rockCol, 3));
    rg.computeVertexNormals();
    rocks = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
    rocks.castShadow = true;
    rocks.receiveShadow = true;
  } else {
    rocks = new THREE.Mesh();
  }

  // ---------------- instanced environment props ----------------
  const props = new THREE.Group();
  props.name = 'props';
  const dummy = new THREE.Object3D();
  const walkableTiles: [number, number][] = [];
  for (let tz = 1; tz < n - 1; tz++)
    for (let tx = 1; tx < n - 1; tx++)
      if (map.flags[map.idx(tx, tz)] === 0) walkableTiles.push([tx, tz]);

  // True when an orthogonal neighbour sits a level higher — i.e. this tile is at
  // the foot of a cliff. Used to clump boulders along the climbs to high ground.
  const nearHigher = (tx: number, tz: number): boolean => {
    const l = map.level[map.idx(tx, tz)];
    return (
      (map.inBounds(tx + 1, tz) && map.level[map.idx(tx + 1, tz)] > l) ||
      (map.inBounds(tx - 1, tz) && map.level[map.idx(tx - 1, tz)] > l) ||
      (map.inBounds(tx, tz + 1) && map.level[map.idx(tx, tz + 1)] > l) ||
      (map.inBounds(tx, tz - 1) && map.level[map.idx(tx, tz - 1)] > l)
    );
  };

  const scatter = (
    mesh: THREE.InstancedMesh, count: number,
    place: (d: THREE.Object3D, tx: number, tz: number, r1: number, r2: number) => boolean,
  ) => {
    let placed = 0, guard = 0;
    while (placed < count && guard++ < count * 12) {
      const [tx, tz] = walkableTiles[(hash2(guard * 17, guard * 31) * walkableTiles.length) | 0];
      const r1 = hash2(guard * 7, guard * 13), r2 = hash2(guard * 19, guard * 23);
      dummy.position.set(0, 0, 0); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
      if (!place(dummy, tx, tz, r1, r2)) continue;
      dummy.updateMatrix();
      mesh.setMatrixAt(placed++, dummy.matrix);
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    props.add(mesh);
  };

  // Small pebbles: kept sparse on the open valley floor (base-building space)
  // and denser on the rockier mid/high ground.
  const pebbleGeo = new THREE.DodecahedronGeometry(0.16);
  const pebbleMat = new THREE.MeshStandardMaterial({ color: '#565272', roughness: 1, flatShading: true });
  scatter(new THREE.InstancedMesh(pebbleGeo, pebbleMat, 900), 900, (d, tx, tz, r1, r2) => {
    const lvl = map.level[map.idx(tx, tz)];
    if (lvl === 0 && r1 > 0.10) return false; // ~90% removed on ground level
    if (lvl === 1 && r1 > 0.55) return false; // medium on mid level
    const [wx, wz] = map.tileToWorld(tx, tz);
    const x = wx + (r1 - 0.5) * TILE, z = wz + (r2 - 0.5) * TILE;
    d.position.set(x, map.groundHeight(x, z) + 0.04, z);
    d.rotation.set(r1 * 3, r2 * 6, r1 * 2);
    d.scale.setScalar(0.5 + r2 * 1.1);
    return true;
  });

  // Alien grass blades: thin dark-teal cones, denser in valleys.
  const grassGeo = new THREE.ConeGeometry(0.05, 0.55, 4);
  const grassMat = new THREE.MeshStandardMaterial({ color: '#2f5f5c', roughness: 0.9, flatShading: true });
  scatter(new THREE.InstancedMesh(grassGeo, grassMat, 3600), 3600, (d, tx, tz, r1, r2) => {
    if (map.level[map.idx(tx, tz)] > 1 && r1 > 0.3) return false; // mostly low ground
    const [wx, wz] = map.tileToWorld(tx, tz);
    const x = wx + (r1 - 0.5) * TILE * 0.95, z = wz + (r2 - 0.5) * TILE * 0.95;
    d.position.set(x, map.groundHeight(x, z) + 0.22, z);
    d.rotation.set((r1 - 0.5) * 0.5, 0, (r2 - 0.5) * 0.5);
    d.scale.set(1, 0.6 + r1 * 1.3, 1);
    return true;
  });

  // Rocks: instanced glTF boulders (triplanar albedo + baked vertex AO), loaded
  // async and added to the prop group when ready. Distribution (clean valleys,
  // clumped at the climbs, dense high) lives in props.ts; rides the same warp.
  props.add(buildRocks(map).group);

  // Vegetation — visual-only. DEFAULT (no `?veg=` query) is the approved v3.1
  // GLB vegetation (instanced, static). `?veg=sprite` forces the legacy Y-locked
  // sprite billboards, `?veg=none` disables vegetation, `?veg=glb` is the explicit
  // alias for the default. `?vegCount=N` overrides the object count. This affects
  // only the visual prop layer — no gameplay/balance/pathfinding/terrain change.
  const { mode: vegMode, count: vegCount } = vegModeFromQuery();
  let vegetation: VegetationBuild | null = null;
  if (vegMode === 'sprite') {
    // Explicit legacy fallback → the shipping billboard vegetation.
    vegetation = buildVegetation(map, vegCount ?? undefined);
    props.add(vegetation.group);
  } else if (vegMode !== 'none') {
    // 'default' and 'glb' → approved v3.1 GLB vegetation (preloaded in main.ts).
    // Templates preload async → group fills when ready (never blocks build).
    const glbGroup = buildVegetationGlbInstances(map, vegCount ?? 285);
    props.add(glbGroup);
  }

  // Spore lamps: small glowing teal bulbs on dark stalks (two meshes).
  const stalkGeo = new THREE.CylinderGeometry(0.025, 0.045, 0.55, 4);
  const stalkMat = new THREE.MeshStandardMaterial({ color: '#1d2030', roughness: 1 });
  const bulbGeo = new THREE.SphereGeometry(0.1, 6, 5);
  const bulbMat = new THREE.MeshStandardMaterial({ color: '#46e0c8', emissive: '#1da592', emissiveIntensity: 1.1 });
  const stalks = new THREE.InstancedMesh(stalkGeo, stalkMat, 220);
  const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, 220);
  {
    let placed = 0, guard = 0;
    while (placed < 220 && guard++ < 4000) {
      const [tx, tz] = walkableTiles[(hash2(guard * 11, guard * 29) * walkableTiles.length) | 0];
      const r1 = hash2(guard * 3, guard * 41), r2 = hash2(guard * 43, guard * 5);
      if (map.level[map.idx(tx, tz)] !== 0 && r1 > 0.25) continue;
      const [wx, wz] = map.tileToWorld(tx, tz);
      const ox = wx + (r1 - 0.5) * TILE, oz = wz + (r2 - 0.5) * TILE;
      const y = map.groundHeight(ox, oz);
      const [x, z] = warpXZ(ox, oz);
      const s = 0.7 + r2 * 0.9;
      dummy.position.set(x, y + 0.27 * s, z); dummy.rotation.set(0, 0, (r1 - 0.5) * 0.3); dummy.scale.setScalar(s);
      dummy.updateMatrix(); stalks.setMatrixAt(placed, dummy.matrix);
      dummy.position.set(x, y + 0.55 * s, z); dummy.scale.setScalar(s);
      dummy.updateMatrix(); bulbs.setMatrixAt(placed, dummy.matrix);
      placed++;
    }
    stalks.count = bulbs.count = placed;
    stalks.instanceMatrix.needsUpdate = bulbs.instanceMatrix.needsUpdate = true;
    props.add(stalks, bulbs);
  }

  // ---------------- crystal nodes ----------------
  // One pre-rendered crystal-cluster billboard per node + an additive teal glow
  // pool so it stays readable in the dark. Each node owns its OWN SpriteMaterial
  // and references to the three stage textures (full/reduced/small), stored in
  // grp.userData, so the depletion stage can be swapped at runtime with a single
  // material.map assignment — no geometry rebuild, no per-frame work.
  const crystalGroups = new Map<number, THREE.Group>();
  const glowTex = makeGlowTexture();
  const glowMat = new THREE.MeshBasicMaterial({
    map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const glowGeo = new THREE.PlaneGeometry(6.5, 6.5);
  glowGeo.rotateX(-Math.PI / 2);

  // Sprite aspect ≈ 1.587 (768×484). Sized so the cluster reads as a node and
  // its base sits on the ground (pivot is centred → lift by ~0.4·height).
  const SPRITE_W = 4.6, SPRITE_H = SPRITE_W / 1.587; // ≈ 2.9

  for (const node of map.crystals) {
    const grp = new THREE.Group();
    const [wx, wz] = warpXZ(...map.tileToWorld(node.tx, node.tz));
    const gy = map.level[map.idx(node.tx, node.tz)] * LEVEL_H;

    // Additive glow pool first (drawn under the sprite).
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.y = 0.1;
    glow.renderOrder = 3;
    grp.add(glow);

    // Pre-load the three stage textures for this node's resource type (default
    // today). Nodes start full (amount === max), so the billboard begins at full.
    const rt = node.resourceType ?? 'default';
    const texFull = crystalStageTex(crystalStageImagePath(rt, 'full')!);
    const texReduced = crystalStageTex(crystalStageImagePath(rt, 'reduced')!);
    const texSmall = crystalStageTex(crystalStageImagePath(rt, 'small')!);

    const mat = new THREE.SpriteMaterial({
      map: texFull, transparent: true, depthWrite: false, fog: true,
    });
    const sp = new THREE.Sprite(mat);
    // Slight per-node size variety so a field doesn't look stamped.
    const sv = 0.9 + hash2(node.id, 3) * 0.25;
    sp.scale.set(SPRITE_W * sv, SPRITE_H * sv, 1);
    sp.position.set(0, SPRITE_H * sv * 0.4, 0);
    grp.add(sp);

    // Metadata read by world.ts updateCrystalVisual for the stage swap.
    grp.userData = { stage: 'full', mat, tex: { full: texFull, reduced: texReduced, small: texSmall } };

    grp.position.set(wx, gy, wz);
    crystalGroups.set(node.id, grp);
  }

  // Only the sprite vegetation needs a per-frame camera re-orient; GLB/none are
  // static → no-op update (keeps the render loop allocation-free).
  return { terrain, rocks, props, crystalGroups, updateProps: (cam) => vegetation?.update(cam) };
}
