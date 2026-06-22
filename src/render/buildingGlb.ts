// Runtime GLB path for BUILDINGS (Asset/Foundation Phase 2). Mirrors the vehicle
// GLB loader: preload registered building GLBs once, then synchronously build a
// procedural-shaped group from the cache (userData.topY/inner/anim) — or return
// null so the caller falls back to the procedural renderer (src/render/models.ts).
//
// CONSERVATIVE SCOPE (Option B): only POWERPLANTS are active (static, no turret
// aim). Defense-tower GLBs are inventoried in buildingAssets.ts but NOT wired to
// cannon/lance here, so the existing turret-aim visuals never break.
//
// A missing/broken GLB must NEVER crash the game — every failure path returns null.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TILE } from '../map/map';
import {
  GENERATED_GAMEPLAY_ASSETS, ACTIVE_GENERATED_BUILDING_IDS, generatedGameplayAsset,
  TEXTURED_FINAL_BUILDING_ASSETS, texturedFinalAsset,
  type BuildingAssetDefinition,
} from '../data/buildingAssets';
import type { FactionId } from '../data/factionModifiers';

/** Gated building visual mode (query `?buildings=current|textured`). Default
 *  `current` keeps today's generated GLBs. `textured` swaps in the QA-approved
 *  final textured re-exports for the safe static roles (visual-only). */
export type BuildingVisualMode = 'current' | 'textured';
/**
 * Resolve the building visual mode. Default is now **textured** (final baked GLBs);
 * `?buildings=current` is the explicit fallback to the older generated set. Any other
 * value (absent/invalid) → textured. Pure when given `search`; SSR/test-safe.
 */
export function buildingModeFromQuery(search?: string): BuildingVisualMode {
  const s = search ?? (typeof window !== 'undefined' ? window.location.search : '');
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(s);
  } catch {
    return 'textured';
  }
  return params.get('buildings') === 'current' ? 'current' : 'textured';
}
const BUILDING_MODE: BuildingVisualMode = buildingModeFromQuery();
/** Textured-final assetKeys carry `.tex.` — used to bypass the flat-material
 *  detail pass + the Crimson texture pilot (they have their own baked textures). */
const isTexturedAsset = (assetKey: string) => assetKey.includes('.tex.');

/** Building ids whose generated GLB renders in gameplay. Static buildings only
 *  (nexus/spire/refinery/barracks/foundry/wall) — cannon/lance stay procedural so
 *  turret-aim isn't disturbed (the generated turrets have no ATTACH pivot). */
export const ACTIVE_BUILDING_IDS = ACTIVE_GENERATED_BUILDING_IDS;

/** A baked emissive material registered for the gentle idle glow-pulse. */
export interface BuildingPulseMat { mat: THREE.MeshStandardMaterial; base: number; }

function isEmissiveStd(m: THREE.Material): m is THREE.MeshStandardMaterial {
  const e = (m as THREE.MeshStandardMaterial).emissive;
  return !!e && typeof e.r === 'number' && (e.r + e.g + e.b) > 0.01;
}

/**
 * Fidelity pass over a cloned GLB material. The building GLBs carry NO textures
 * and bake the faction colour + emissive strength (KHR_materials_emissive_strength,
 * already applied by GLTFLoader) straight into named PBR materials (Aqua_Glow,
 * Status_Glow, Crimson_Accent, …). So we deliberately PRESERVE every material and
 * its baked look — we only clone the emissive ones per-instance (so the idle pulse
 * can modulate them without leaking to the cached template or sibling buildings)
 * and register the clone for the pulse at its baked intensity. A literal
 * `mat_accent` (none today, future-proof) still gets the faction tint. Transparent
 * (alphaMode BLEND) materials keep their transparency untouched.
 */
function fidelityRemap(m: THREE.Material, accentHex: string, pulse: BuildingPulseMat[]): THREE.Material {
  const name = (m as unknown as { name?: string })?.name;
  if (name === 'mat_accent') {
    const c = (m as THREE.MeshStandardMaterial).clone();
    c.color.set(accentHex); c.emissive.set(accentHex); c.emissiveIntensity = 0.8;
    pulse.push({ mat: c, base: 0.8 });
    return c;
  }
  if (isEmissiveStd(m)) {
    const c = m.clone();                       // per-instance clone: pulse never leaks
    const base = m.emissiveIntensity ?? 1;     // PRESERVE the artist-baked strength
    c.emissiveIntensity = base;
    pulse.push({ mat: c, base });
    return c;
  }
  return m; // preserve all other PBR materials exactly (unmutated → safe to share)
}

// ── Surface-detail pass ──────────────────────────────────────────────────────
// The generated building GLBs are textureless (flat PBR colours), so big faces
// read monotone. We inject — at the SHADER level, once per cached template (no
// per-instance recompile) — a subtle world-space grain + a normal-based fake AO
// (tops brighter, undersides darker) so flat surfaces gain micro-variation and
// form. Plus a modest emissive boost so the faction glow accents pop. Purely
// visual; no geometry/scale/gameplay change. Meshes carry NORMAL (+UVs).
const DETAIL_GLSL = `
  float bHash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float bNoise(vec3 q){
    vec3 i = floor(q), f = fract(q); f = f * f * (3.0 - 2.0 * f);
    float z0 = i.z * 7.0, z1 = (i.z + 1.0) * 7.0;
    float a = mix(mix(bHash(i.xy + z0), bHash(i.xy + vec2(1.0,0.0) + z0), f.x),
                  mix(bHash(i.xy + vec2(0.0,1.0) + z0), bHash(i.xy + vec2(1.0,1.0) + z0), f.x), f.y);
    float b = mix(mix(bHash(i.xy + z1), bHash(i.xy + vec2(1.0,0.0) + z1), f.x),
                  mix(bHash(i.xy + vec2(0.0,1.0) + z1), bHash(i.xy + vec2(1.0,1.0) + z1), f.x), f.y);
    return mix(a, b, f.z);
  }
`;
const EMISSIVE_BOOST = 1.7;

/** Inject the surface-detail shader into a MeshStandardMaterial (idempotent-ish). */
function addSurfaceDetail(m: THREE.MeshStandardMaterial) {
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = 'varying vec3 vBWPos;\nvarying vec3 vBNrm;\n' + shader.vertexShader
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n  vBNrm = normalize(mat3(modelMatrix) * objectNormal);')
      .replace('#include <project_vertex>', '#include <project_vertex>\n  vBWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = 'varying vec3 vBWPos;\nvarying vec3 vBNrm;\n' + DETAIL_GLSL + shader.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        // Adaptive: full grain+AO on DARK materials (Crimson concrete), almost
        // none on BRIGHT ones (Azure ceramic) so clean whites stay clean.
        float bLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        float bDark = 1.0 - smoothstep(0.35, 0.80, bLum);              // 1 dark → 0 bright
        float bGrain = bNoise(vBWPos * 1.8) + 0.5 * bNoise(vBWPos * 5.0); // ~0..1.5
        diffuseColor.rgb *= 0.975 + 0.04 * bGrain;                     // subtle mottle for ALL (avg ~1.0)
        float bUp = clamp(vBNrm.y * 0.5 + 0.5, 0.0, 1.0);
        diffuseColor.rgb *= mix(1.0, mix(0.86, 1.05, bUp), bDark);     // fake AO only where dark
      `);
  };
  m.needsUpdate = true;
}

// ── Textured-building readability pass ───────────────────────────────────────
// The final textured GLBs bake their detail into albedo, which reads dark/flat/
// wrong at RTS zoom (Crimson near-black, Azure uniform, Verdant orange blobs,
// Solar structureless). Rather than edit the binary GLBs, we inject a per-faction
// WORLD-SPACE correction+detail shader (UV-independent → safe on any GLB UV),
// once per cached template. Purely visual; geometry/scale/gameplay untouched.
type Archetype = 'crimson' | 'azure' | 'verdant' | 'solar';
function archOf(f: FactionId): Archetype {
  return f === 'red' ? 'crimson' : f === 'blue' ? 'azure' : f === 'green' ? 'verdant' : 'solar';
}

// Per-faction fragment body, run after <color_fragment>. It FULLY REPLACES the
// (baked, wrong) albedo with a deterministic world-space material so dark/orange/
// flat embedded textures are overridden — `puv` = triplanar 2D world coords,
// `up`/`down` = normal facing, `vBWPos`/`vBNrm` provided.
const TEX_FACTION_FRAG: Record<Archetype, string> = {
  // Brushed industrial steel with ROOF vs WALL differentiation: vertical walls =
  // darker ribbed brushed steel + rivet rows + vertical seams; horizontal roofs =
  // lighter worn plates, larger maintenance panels, hatch lines, grime streaks.
  crimson: `
    float roof = smoothstep(0.55, 0.82, up);                  // 1 = horizontal roof/top
    vec3 wallC = vec3(0.35, 0.36, 0.40);                      // darker vertical steel
    vec3 roofC = vec3(0.52, 0.53, 0.57);                      // lighter worn roof plates
    vec3 base = mix(wallC, roofC, roof);
    base *= 0.90 + 0.16 * bNoise(vec3(vBWPos.x * 9.0, vBWPos.y * 1.3, vBWPos.z * 9.0)); // brushed
    // WALLS: tight vertical ribs + rivet rows.
    vec2 wc = abs(fract(puv / 0.85) - 0.5);
    float rib = smoothstep(0.42, 0.5, wc.x);
    // ROOFS: large square maintenance panels + hatch seams.
    vec2 rc = abs(fract(puv / 1.9) - 0.5);
    float rseam = smoothstep(0.45, 0.5, max(rc.x, rc.y));
    base *= 1.0 - 0.28 * rib * (1.0 - roof) - 0.26 * rseam * roof;
    vec2 cc = mix(wc, rc, roof);
    float e = max(cc.x, cc.y);
    base += 0.10 * smoothstep(0.36, 0.45, e) * (1.0 - smoothstep(0.46, 0.5, e)); // edge highlight
    float rivet = smoothstep(0.43, 0.5, cc.x) * smoothstep(0.43, 0.5, cc.y);
    base += 0.17 * rivet;                                      // rivets at panel corners
    base *= mix(1.0, 0.93 + 0.07 * bNoise(vBWPos * 3.0), roof); // roof grime streaks
    float pid = bHash(floor(puv / 0.85));
    float warn = step(0.62, pid) * step(pid, 0.67) * smoothstep(0.30, 0.34, wc.x) * (1.0 - smoothstep(0.34, 0.38, wc.x)) * (1.0 - roof);
    base = mix(base, vec3(0.60, 0.07, 0.06), warn * 0.82);    // sparse crimson warning trim (walls)
    diffuseColor.rgb = base;
  `,
  // Aquatic ceramic/shell with BASE vs UPPER zoning by height: lower body = darker
  // blue-grey desaturated ceramic + ribbed shell-supports; upper rounded = bright
  // pearl with shell-segment arcs, wave lines, pearlescent bands, cyan grooves.
  azure: `
    float baseZone = 1.0 - smoothstep(0.7, 1.8, vBWPos.y);    // 1 near ground
    vec3 lower = vec3(0.54, 0.61, 0.69);                      // blue-grey desat aqua ceramic
    vec3 upper = vec3(0.86, 0.89, 0.93);                      // bright pearl
    vec3 base = mix(upper, lower, baseZone);
    base += vec3(-0.03, 0.0, 0.05) * (bNoise(vBWPos * 1.1) - 0.5) * 2.0; // perlmutt shift
    vec2 lc = abs(fract(puv / 0.8) - 0.5);
    base -= 0.11 * smoothstep(0.40, 0.5, lc.x) * baseZone;    // ribbed shell-supports (lower)
    vec2 uc = abs(fract(puv / 1.5) - 0.5);
    float seam = smoothstep(0.45, 0.5, max(uc.x, uc.y));
    base -= 0.06 * seam * (1.0 - baseZone);                   // recessed shell seam (upper)
    base += vec3(0.0, 0.05, 0.08) * seam * (1.0 - baseZone);  // cyan groove
    float wave = sin(puv.x * 1.8 + puv.y * 1.1 + 4.0 * bNoise(vBWPos * 0.5)) * 0.5 + 0.5;
    base += 0.045 * smoothstep(0.7, 0.95, wave) * vec3(0.0, 0.06, 0.09) * (1.0 - baseZone); // wave arcs
    base += 0.04 * up * vec3(0.02, 0.04, 0.06);               // pearlescent band on tops
    diffuseColor.rgb = base;
  `,
  // Technical insectoid chitin: segmented beetle-shell plates with deep grooves,
  // layered shell ridges, plate sheen, sparse amber bio-nodes. Per-building phase
  // variation via uSeed so building types don't look one-note.
  verdant: `
    vec3 base = vec3(0.15, 0.19, 0.12);
    base *= 0.9 + 0.14 * bNoise(vBWPos * 2.2 + uSeed * 7.0);  // chitin mottle (varied)
    vec2 sc = puv * vec2(1.6, 3.0) + uSeed * 5.0;             // per-building phase
    sc.x += 0.5 * mod(floor(sc.y), 2.0);                       // overlapping rows
    vec2 f = fract(sc) - 0.5;
    float d = length(f * vec2(1.0, 1.7));
    float groove = smoothstep(0.30, 0.5, d);
    base *= 1.0 - 0.5 * groove;                                // deep grooves between plates
    base += 0.06 * (1.0 - groove) * smoothstep(0.55, 0.0, d);  // raised plate sheen
    float ridge = smoothstep(0.46, 0.5, abs(fract(puv.y * 1.2 + 0.3 * bNoise(vBWPos * 0.8)) - 0.5) * 2.0);
    base *= 1.0 - 0.18 * ridge;                                // layered shell ridges (segmentation)
    float pore = smoothstep(0.45, 0.5, 1.0 - d) * step(0.92, bHash(floor(sc)));
    base = mix(base, vec3(0.55, 0.30, 0.02), pore * 0.7);      // sparse amber bio-nodes
    diffuseColor.rgb = base;
  `,
  // Zoned sun-prism crystal: triplanar — dark faceted walls, ivory/gold roofs,
  // darker base supports, controlled gold energy seams.
  solar: `
    vec3 wall = vec3(0.24, 0.21, 0.15);                        // dark faceted crystal/graphite-gold
    vec3 roof = vec3(0.82, 0.73, 0.46);                        // ivory/gold ornamental plates
    vec3 supp = vec3(0.10, 0.09, 0.07);                        // darker structural base
    vec3 base = mix(wall, roof, smoothstep(0.45, 0.85, up));
    base = mix(base, supp, down * 0.75);
    float facet = step(0.5, bNoise(floor(vBWPos * 2.2)));
    base *= mix(0.86, 1.08, facet);                            // faceted variation
    float v = bNoise(vBWPos * 1.6);
    float seam = smoothstep(0.47, 0.5, abs(fract(v * 3.0) - 0.5) * 2.0);
    base += vec3(0.40, 0.27, 0.05) * seam;                     // controlled gold energy seams
    // ---- Base-floor facade: windows, sliders & vents on the vertical walls of the 3 base stories ----
    float side = clamp(1.0 - 1.7 * up - 1.7 * down, 0.0, 1.0);  // 1 on vertical walls, 0 on roofs/base
    float baseFloors = 1.0 - smoothstep(3.5, 3.9, vBWPos.y);    // limit to base; spike above stays clean
    float facade = side * baseFloors;
    vec2 cell = vec2(puv.x / 0.80, puv.y / 1.05);              // facade module grid (col, row)
    vec2 cf = fract(cell) - 0.5;                               // -0.5..0.5 within a module
    float cid = bHash(floor(cell));                            // stable per-module id
    float openX = 1.0 - smoothstep(0.28, 0.34, abs(cf.x));     // opening rectangle inside the module
    float openY = 1.0 - smoothstep(0.30, 0.36, abs(cf.y));
    float opening = openX * openY * facade;
    float reveal = (1.0 - opening) * (1.0 - smoothstep(0.40, 0.46, max(abs(cf.x), abs(cf.y)))) * facade;
    base *= 1.0 - 0.42 * reveal;                              // recessed dark frame/reveal around openings
    float isVent = step(0.60, cid);                           // ~40% of modules are vents
    float isBlank = step(0.28, cid) * step(cid, 0.40);        // a few solid armored panels
    // WINDOW: dark glass with a lit horizontal slider rail + faint vertical divider
    float mullH = 1.0 - smoothstep(0.02, 0.06, abs(cf.y));    // horizontal slider mullion
    float mullV = 1.0 - smoothstep(0.015, 0.05, abs(cf.x));   // vertical divider
    vec3 glass = vec3(0.05, 0.09, 0.12);
    glass += vec3(0.10, 0.26, 0.34) * (1.0 - mullH) * 0.7;    // cool glass glow
    glass += vec3(0.46, 0.38, 0.16) * mullH * 0.8;            // lit gold slider rail
    glass += vec3(0.30, 0.25, 0.12) * mullV * 0.5;            // gold vertical divider
    // VENT: stack of horizontal louver slats
    float louver = smoothstep(0.30, 0.5, abs(fract(cf.y * 6.0) - 0.5) * 2.0);
    vec3 ventC = vec3(0.12, 0.11, 0.085) * (0.55 + 0.55 * louver);
    // BLANK: flush armored panel (no lit opening)
    vec3 blankC = vec3(0.20, 0.18, 0.13);
    vec3 content = mix(glass, ventC, isVent);
    content = mix(content, blankC, isBlank);
    base = mix(base, content, opening);
    diffuseColor.rgb = base;
  `,
};

/** Inject the per-faction textured-albedo replacement shader into a MeshStandardMaterial.
 *  `seed` (0..1) varies the pattern phase per building template so types differ. */
function addTexturedDetail(m: THREE.MeshStandardMaterial, arch: Archetype, seed: number) {
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = 'varying vec3 vBWPos;\nvarying vec3 vBNrm;\n' + shader.vertexShader
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n  vBNrm = normalize(mat3(modelMatrix) * objectNormal);')
      .replace('#include <project_vertex>', '#include <project_vertex>\n  vBWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = 'varying vec3 vBWPos;\nvarying vec3 vBNrm;\n' + DETAIL_GLSL + shader.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 an = abs(vBNrm);
        vec2 puv = an.y > 0.5 ? vBWPos.xz : (an.x > 0.5 ? vBWPos.zy : vBWPos.xy);
        float up = clamp(vBNrm.y, 0.0, 1.0);
        float down = clamp(-vBNrm.y, 0.0, 1.0);
        float uSeed = ${seed.toFixed(3)};
        ${TEX_FACTION_FRAG[arch]}
      `);
  };
  m.needsUpdate = true;
}

/** Deterministic 0..1 seed from an assetKey (stable per building template). */
function texSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return (h % 1000) / 1000;
}

// Core hull materials per faction (named in the GLBs) whose baked albedo we fully
// override. Accent/glow materials (CY, AQ, VT, SAM, SP) are deliberately preserved.
const TEX_CORE_MATERIALS: Record<Archetype, string[]> = {
  crimson: ['CC', 'CS', 'CW'],
  azure: ['AW'],
  verdant: ['VH', 'VB'],
  solar: ['SA'],
};

/**
 * Apply the textured readability pass to a textured template's materials (once).
 * Core hull materials get a full world-space albedo replacement (their baked
 * texture is dropped); Crimson's always-on red emissive (CR) is tamed so it stops
 * reading like a construction/power-preview marker. All other accent/glow
 * materials are left exactly as the artist baked them.
 */
function enhanceTexturedTemplate(scene: THREE.Object3D, factionId: FactionId, seed: number) {
  const arch = archOf(factionId);
  const core = new Set(TEX_CORE_MATERIALS[arch]);
  const seen = new Set<THREE.Material>();
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat || seen.has(mat)) continue;
      seen.add(mat);
      const std = mat as THREE.MeshStandardMaterial;
      if (!std.isMaterial || !('metalness' in std)) continue;
      const nm = (std as unknown as { name?: string }).name ?? '';
      if (core.has(nm)) {
        std.map = null;             // drop the wrong baked albedo → shader fully owns the colour
        if (std.emissive) { std.emissive.setRGB(0, 0, 0); std.emissiveIntensity = 0; } // kill baked tint glow on hull
        std.metalness = arch === 'azure' ? 0.15 : arch === 'verdant' ? 0.0 : 0.55;
        std.roughness = arch === 'azure' ? 0.35 : arch === 'verdant' ? 0.7 : 0.5;
        addTexturedDetail(std, arch, seed);
      } else if (arch === 'crimson' && nm === 'CR') {
        std.emissiveIntensity = (std.emissiveIntensity ?? 1) * 0.3; // tame red shimmer/spikes
        std.needsUpdate = true;
      }
      // CY / AQ / VT / SAM / SP and any other accent → preserved untouched.
    }
  });
}

/** Enhance a cached template's materials once: surface detail + emissive boost. */
function enhanceTemplate(scene: THREE.Object3D) {
  const seen = new Set<THREE.Material>();
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat || seen.has(mat)) continue;
      seen.add(mat);
      const std = mat as THREE.MeshStandardMaterial;
      if (std.isMaterial && 'metalness' in std) addSurfaceDetail(std);
      if (isEmissiveStd(std)) std.emissiveIntensity = (std.emissiveIntensity ?? 1) * EMISSIVE_BOOST;
    }
  });
}

const cache = new Map<string, THREE.Group>(); // assetKey -> loaded template scene
/** Which path each building visual actually used this session (debug). */
export const BUILDING_SOURCE: Record<string, 'glb' | 'procedural'> = {};

function activeAssets(): BuildingAssetDefinition[] {
  // Always preload the current generated set (the default + the textured-mode
  // fallback). In textured mode ALSO preload the final textured re-exports.
  return BUILDING_MODE === 'textured'
    ? [...GENERATED_GAMEPLAY_ASSETS, ...TEXTURED_FINAL_BUILDING_ASSETS]
    : GENERATED_GAMEPLAY_ASSETS;
}

export const hasBuildingGlb = (assetKey: string) => cache.has(assetKey);

/** Preload all ACTIVE building GLBs. Call before a match starts. Never throws. */
export async function preloadBuildingGlbs(): Promise<void> {
  const loader = new GLTFLoader();
  for (const a of activeAssets()) {
    if (cache.has(a.assetKey)) continue;
    try {
      const gltf = await loader.loadAsync(a.modelPath);
      // Textured GLBs get the per-faction readability pass (lift/recolor + world-
      // space surface structure); textureless generated GLBs get the flat-material
      // grain/AO + emissive boost. Both are visual-only, once per cached template.
      if (isTexturedAsset(a.assetKey)) enhanceTexturedTemplate(gltf.scene, a.factionId, texSeed(a.assetKey));
      else enhanceTemplate(gltf.scene);
      cache.set(a.assetKey, gltf.scene);
    } catch (e) {
      if (import.meta.env.DEV) console.warn(`[bld] GLB-Load fehlgeschlagen ${a.assetKey} (${a.modelPath}) → prozedural`, e);
    }
  }
}

/** Test-only: seed the cache with a hand-built scene (avoids a real GLTF load). */
export function __setBuildingGlbForTest(assetKey: string, scene: THREE.Group | null) {
  if (scene) cache.set(assetKey, scene); else cache.delete(assetKey);
}

/**
 * The active, cached GLB asset for a (buildingId, faction), or null → fallback.
 * Only `spire` (Power Spire) maps to a powerplant GLB this phase, and only when
 * a faction asset exists AND is already loaded into the cache.
 */
export function activeBuildingAsset(buildingId: string, factionId: FactionId): BuildingAssetDefinition | null {
  if (!ACTIVE_BUILDING_IDS.has(buildingId)) return null; // cannon/lance → procedural
  // Textured mode: prefer the final textured asset when it loaded; otherwise fall
  // back to the current generated asset (which falls back to procedural below).
  if (BUILDING_MODE === 'textured') {
    const tx = texturedFinalAsset(factionId, buildingId);
    if (tx && cache.has(tx.assetKey)) return tx;
  }
  const a = generatedGameplayAsset(factionId, buildingId);
  return a && cache.has(a.assetKey) ? a : null;
}

/**
 * Build a building visual from a cached GLB, shaped like makeEntityGroup's output
 * (userData.topY/inner/anim). Auto-fits the model to the footprint and grounds it
 * (base at y=0). Returns null if no GLB is cached.
 */
export function makeGlbBuildingGroup(
  asset: BuildingAssetDefinition, accentHex: string, footprintTiles: number,
): THREE.Group | null {
  const tmpl = cache.get(asset.assetKey);
  if (!tmpl) return null;

  const scene = tmpl.clone(true);
  const pulseMats: BuildingPulseMat[] = [];
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const remap = (m: THREE.Material): THREE.Material => fidelityRemap(m, accentHex, pulseMats);
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(remap) : remap(mesh.material);
  });

  // NOTE: Solar Command Center "bigger central spike" is NOT done here. Inspection
  // of solar_singularity_nexus shows only 3 building-sized meshes (SA hull incl. the
  // spike, SAM thin glow ring, SP magenta — all ~6×5×6). There is no separable small
  // "core/spike" mesh, so scaling SP just inflates a building-sized magenta volume
  // that pokes through the hull as a pink blob. A real bigger spike needs GLB
  // geometry surgery on the SA hull (asset-level) — deliberately not attempted.

  // Auto-fit: scale the model so its horizontal extent ≈ footprint (× fill),
  // then ground it (bottom at y=0). Per-asset visualTransform fine-tunes.
  const box = new THREE.Box3().setFromObject(scene);
  const horiz = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) || 1;
  const vt = asset.visualTransform;
  const autoScale = (footprintTiles * TILE * 0.92) / horiz;
  const scale = autoScale * (vt?.scale ?? 1);

  const inner = new THREE.Group();
  inner.add(scene);
  inner.scale.setScalar(scale);
  if (vt?.rotationY) inner.rotation.y = vt.rotationY;
  inner.position.y = -box.min.y * scale + (vt?.yOffset ?? 0);
  if (vt?.positionOffset) {
    inner.position.x += vt.positionOffset[0];
    inner.position.y += vt.positionOffset[1];
    inner.position.z += vt.positionOffset[2];
  }

  const outer = new THREE.Group();
  outer.add(inner);
  outer.userData.inner = inner;
  // No turret/spin/load animation; only a gentle emissive idle pulse when the
  // GLB carries baked emissive materials (world.ts animateBuilding drives it).
  outer.userData.anim = pulseMats.length ? { pulseMats } : {};
  outer.userData.topY = (box.max.y - box.min.y) * scale + (vt?.yOffset ?? 0);
  BUILDING_SOURCE[asset.assetKey] = 'glb';
  return outer;
}
