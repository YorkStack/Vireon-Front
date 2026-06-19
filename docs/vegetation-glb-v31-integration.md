# GLB Vegetation v3.1 — Gated Integration Test

> **Visual-only, OPT-IN, not default.** No gameplay/balance/AI/combat/pathfinding/
> terrain-rule/building/unit change. Not committed. Date 2026-06-19, branch `main`,
> base HEAD `a1b18fb`. Decision basis: [VEGETATION_RENDERING_DECISION.md](../../../Downloads/Vireon-Front-Assets/Vegetation/VEGETATION_RENDERING_DECISION.md).

## 1. v3.1 asset summary

| Asset | id | Tris | KB | Emissive | Weight |
|---|---|---:|---:|---|---|
| Forest Canopy Tree | `forest_canopy_tree` | 242 | 38.4 | none | common (3) |
| Highland Canopy Tree | `highland_canopy_tree` | 234 | 34.7 | cyan 0.65 | common (3) |
| Forest Hiveshroom | `forest_hiveshroom` | 334 | 33.1 | none | occasional (2) |
| Oasis Glow-Shroom | `oasis_glowshroom` | 352 | 42.9 | cyan 0.70 | occasional (2) |
| Coastal Coral Tree | `coastal_coral_tree` | 368 | 42.3 | cyan 0.60 | occasional (2) |
| Desert Crystal Cactus | `desert_crystal_cactus` | 392 | 44.8 | amber 0.60 | rare (1) |
| Highland Luminous Fern | `highland_luminous_fern` | 152 | 21.9 | cyan 0.70 | rare (1) |

All: 1 mesh, 2–3 primitives/materials, **embedded textures**, **origin bottom y≈0**
(grounding correct), no transparency. Verified via GLB JSON-chunk analysis.

## 2. Repo asset paths

- Served GLBs: `public/assets/vegetation/glb_v31/<biome>/<id>_v31.glb` (7 files in
  per-biome subfolders coastal/desert/forest/highland/oasis, ~258 KB; byte-identical
  to the approved source set).
- Source (external, unchanged): `…/Vegetation/output_v31/assets/<biome>/`.
- Sprite PNGs, v1/v2/v3/test GLBs untouched.

## 3. Loader architecture

[`src/render/vegetationGlb.ts`](../src/render/vegetationGlb.ts):
- `VEG_V31_ASSETS` registry (id, file, target world-height, scatter weight).
- `preloadVegetationGlbs()` — GLTFLoader, cached templates; for each: extracts
  every primitive (geometry + material + baked node matrix), computes bbox height
  → per-asset `baseScale = targetHeight / bboxHeight`, counts tris. Never throws
  (DEV-logs + skips on failure → graceful fallback).
- Preloaded only when `?veg=glb` is active (default world loads nothing extra) —
  wired into `main.ts` `glbReady`.

## 4. Instancing approach

`buildVegetationGlbInstances(map, count)`:
- Deterministic positions from the shipping `scatterVegInstances` (same warp/
  grounding as the sprite path), `salt 101`.
- Per placement: deterministic `hash2` RNG → weighted asset pick + ±15 % scale
  jitter + full random Y rotation. **All matrices baked once** (no per-frame
  rebuild, no per-frame allocation).
- **One `InstancedMesh` per (asset, primitive/material)** → caps at ~20 instanced
  meshes for the whole 7-asset set regardless of object count. `castShadow` +
  `receiveShadow` on. Materials preserved (no per-instance recompile).
- Returns a `Group` dropped straight into the terrain props group.
- Re-exported from `props.ts` as `buildVegetationGlb`.

## 5. Query parameters (gating)

Resolved by `vegModeFromQuery()` (SSR/test-safe), consumed in `terrain.ts`
`buildTerrain`:

| Param | Effect |
|---|---|
| *(none)* | **default — approved v3.1 GLB vegetation (instanced)** |
| `?veg=glb` | explicit alias for the default (v3.1 GLB) |
| `?veg=sprite` | legacy fallback — force sprite billboards |
| `?veg=none` | no vegetation |
| `?vegCount=30\|75\|150\|300\|600` | object-count override (sprite split 1:2 trees:bushes; GLB total) |

No simulation/gameplay logic reads the vegetation mode. Default path is byte-for-byte
the old behavior (sprite count override only applies when `?vegCount` present).

## 6. Density scenarios

sparse 30 · normal 75 (≈ today's 285 default) · medium 150–300 · forest 600.

## 7. Performance results

Instrumented via the real `buildVegetationGlbInstances` (vegetation_test.html
`glbV31` mode), realistic world load, fresh session. Display vsync-capped ~120.

| Mode | Count | FPS | Draw calls | Rendered tris |
|---|---:|---:|---:|---:|
| none (baseline) | 0 | 120 | 31 | 357,170 |
| glb v3.1 | 30 | 120 | 46 | 365,578 |
| glb v3.1 | 75 | 121 | 51 | 379,926 |
| glb v3.1 | 150 | 121 | 51 | 402,074 |
| glb v3.1 | 300 | 120 | 51 | 445,592 |
| glb v3.1 | 600 | 121 | 51 | 534,776 |

Draw calls flat at **51** (≈ +20 = the per-primitive instanced meshes) from 75 up.
FPS held the 120 cap to 600; **never below 60**. In-game (`?veg=glb&vegCount=150`,
full match): HUD 120 FPS, smooth pan/zoom, no console errors.

## 8. Visual findings

- Upright, **grounded** (trunk base on terrain), correct scale vs units/rocks/
  buildings, real cast shadows — sits in the world like the rocks do.
- 600 reads as a believable alien forest; **does not obstruct** units/buildings;
  RTS readability preserved.
- Emissive tasteful, no blowout.
- Default (sprite) and `?veg=none` confirmed visually distinct and correct.

## 9. Known issues

- **Hiveshroom slightly dominant** at high density (3 common assets, amber cap is
  eye-catching) — tune weights later if desired.
- `InstancedMesh` has no per-instance frustum cull → all tris submitted (534 K at
  600). Trivial here; matters only if assets get heavier.
- Multi-material assets → 2–3 instanced meshes each (vs 1 if authored single-
  material). Fine at this scale.

## 10. Default status

**GLB v3.1 is now the DEFAULT vegetation** (no query parameter). `?veg=sprite`
forces the legacy billboards, `?veg=none` disables vegetation, `?veg=glb` is the
explicit alias for the default. Hiveshroom was reduced common→occasional so its
amber cap no longer dominates at high density. Biome-aware placement remains a
future step.

## 11. Sprite fallback

**Keep it.** It remains the default and the explicit `?veg=sprite` path; it is the
safe fallback if a GLB load ever fails and is still useful as a cheap far-distance
background option.

## Changed / added files (all uncommitted)

- `src/render/vegetationGlb.ts` (new) · `src/render/props.ts` (+countOverride, re-export)
- `src/render/terrain.ts` (gated veg selection) · `src/main.ts` (conditional preload)
- `public/assets/vegetation/glb_v31/*.glb` (7) · `vegetation_test.html` + `src/tools/vegetationTestViewer.ts` (glbV31 mode)
- `docs/vegetation-glb-v31-integration.md` (this)
