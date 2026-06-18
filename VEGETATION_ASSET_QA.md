# Vegetation Asset QA Report

**Generated:** 2026-06-18
**Generator:** `tools/blender/vegetation/generate_vegetation_assets.py`
**Blender:** 4.0.2 (headless CLI)
**Output dir:** `Vegetation/output/`
**Approval status:** All assets default to **PENDING** — do not auto-approve.

---

## Asset Inventory

### 1. alien_mushroom_tree.glb

| Field | Value |
|-------|-------|
| **File path** | `Vegetation/output/alien_mushroom_tree.glb` |
| **File size** | 26,944 bytes (~26 KB) |
| **Approx dimensions** | ~1.75 m wide × 2.4 m tall (footprint: ~1.75 m dia.) |
| **Object count** | 1 (joined) |
| **Materials** | MAT_Glowing_Stem, MAT_Mushroom_Cap_Turquoise, MAT_Mushroom_Cap_Violet_Rim, MAT_Spore_Glow |
| **Emissive materials** | YES (MAT_Glowing_Stem ×1.5, MAT_Spore_Glow ×4.0) |
| **Origin bottom-center** | OK |
| **Poly style** | Low-poly (stem smooth-shaded, cap flat-shaded) |
| **RTS readability** | Excellent — tall distinct silhouette, glowing cap visible from top-down |
| **Status** | ✅ OK |
| **Notes** | Reference quality asset. Spore pods glow at emission strength 4.0. |

---

### 2. alien_mushroom_cluster.glb

| Field | Value |
|-------|-------|
| **File path** | `Vegetation/output/alien_mushroom_cluster.glb` |
| **File size** | 40,864 bytes (~40 KB) |
| **Approx dimensions** | ~1.6 m wide × 1.2 m tall (5-mushroom group) |
| **Object count** | 1 (joined) |
| **Materials** | MAT_Glowing_Stem, MAT_Mushroom_Cap_Turquoise, MAT_Mushroom_Cap_Violet_Rim, MAT_Spore_Glow |
| **Emissive materials** | YES (MAT_Glowing_Stem, MAT_Spore_Glow) |
| **Origin bottom-center** | OK |
| **Poly style** | Low-poly |
| **RTS readability** | Good — varied heights create recognisable cluster silhouette |
| **Status** | ✅ OK |
| **Notes** | 5 mushrooms, deterministic seed=42. Alternating turquoise/violet caps. |

---

### 3. alien_spore_bush.glb

| Field | Value |
|-------|-------|
| **File path** | `Vegetation/output/alien_spore_bush.glb` |
| **File size** | 26,728 bytes (~26 KB) |
| **Approx dimensions** | ~0.6 m wide × 0.5 m tall |
| **Object count** | 1 (joined) |
| **Materials** | MAT_Alien_Dark_Base, MAT_Glowing_Stem, MAT_Spore_Glow |
| **Emissive materials** | YES (MAT_Glowing_Stem ×1.5, MAT_Spore_Glow ×4.0) |
| **Origin bottom-center** | OK |
| **Poly style** | Low-poly compact |
| **RTS readability** | Good for scatter — low footprint, visible glow pods |
| **Status** | ✅ OK |
| **Notes** | Suitable for dense scatter on alien terrain. 6 stems + 6 glow pods. |

---

### 4. alien_crystal_fern.glb

| Field | Value |
|-------|-------|
| **File path** | `Vegetation/output/alien_crystal_fern.glb` |
| **File size** | 18,168 bytes (~18 KB) |
| **Approx dimensions** | ~0.5 m wide × 0.75 m tall |
| **Object count** | 1 (joined) |
| **Materials** | MAT_Alien_Dark_Base, MAT_Crystal_Aqua, MAT_Crystal_Violet, MAT_Emissive_Veins |
| **Emissive materials** | YES (MAT_Crystal_Aqua ×0.6, MAT_Crystal_Violet ×0.3, MAT_Emissive_Veins ×2.0) |
| **Origin bottom-center** | OK |
| **Poly style** | Faceted / fully flat-shaded crystal blades |
| **RTS readability** | Good — distinct crystalline silhouette, aqua/violet contrast readable at distance |
| **Status** | ✅ OK |
| **Notes** | Lightest asset at 18 KB. 8 crystal blades + 4 vein nodes. |

---

### 5. alien_biolume_reed.glb

| Field | Value |
|-------|-------|
| **File path** | `Vegetation/output/alien_biolume_reed.glb` |
| **File size** | 20,268 bytes (~20 KB) |
| **Approx dimensions** | ~0.55 m wide × 2.1 m tall |
| **Object count** | 1 (joined) |
| **Materials** | MAT_Alien_Dark_Base, MAT_Glowing_Stem, MAT_Spore_Glow |
| **Emissive materials** | YES (MAT_Glowing_Stem ×1.5, MAT_Spore_Glow ×4.0) |
| **Origin bottom-center** | OK |
| **Poly style** | Thin tapered cylinders, smooth-shaded |
| **RTS readability** | Good for map-edge / water-edge decoration. Tall vertical silhouette. |
| **Status** | ✅ OK |
| **Notes** | 6 reeds, slightly varied heights and tilt. Glowing tips prominent from top-down view. |

---

### 6. alien_pod_shrub.glb

| Field | Value |
|-------|-------|
| **File path** | `Vegetation/output/alien_pod_shrub.glb` |
| **File size** | 83,928 bytes (~82 KB) |
| **Approx dimensions** | ~0.9 m wide × 0.75 m tall |
| **Object count** | 1 (joined) |
| **Materials** | MAT_Alien_Dark_Base, MAT_Mushroom_Cap_Turquoise, MAT_Mushroom_Cap_Violet_Rim, MAT_Spore_Glow, MAT_Glowing_Stem |
| **Emissive materials** | YES (MAT_Spore_Glow ×4.0, MAT_Glowing_Stem ×1.5) |
| **Origin bottom-center** | OK |
| **Poly style** | Mixed: ico spheres (bulbous pods) + tapered cylinders (stubs) |
| **RTS readability** | Good — compact footprint, visible glow detail |
| **Status** | ✅ OK |
| **Notes** | Largest file (~82 KB) due to higher-subdivisions ico spheres on pods. Performance-safe but consider lowering ico subdivisions to 1 if framerate budget is tight. 7 pods + 4 glow nodes + 5 stubs. |

---

## Summary

| Asset | Size | Emissive | Origin | Status | Approval |
|-------|------|----------|--------|--------|----------|
| alien_mushroom_tree | 26 KB | YES | OK | ✅ OK | **PENDING** |
| alien_mushroom_cluster | 40 KB | YES | OK | ✅ OK | **PENDING** |
| alien_spore_bush | 26 KB | YES | OK | ✅ OK | **PENDING** |
| alien_crystal_fern | 18 KB | YES | OK | ✅ OK | **PENDING** |
| alien_biolume_reed | 20 KB | YES | OK | ✅ OK | **PENDING** |
| alien_pod_shrub | 82 KB | YES | OK | ✅ OK | **PENDING** |

**All 6 assets generated and valid.** No asset failed.

---

## Open Risks

1. **alien_pod_shrub.glb is 82 KB** — largest asset. If performance budget is tight, reduce `subdivisions=2` to `subdivisions=1` on the pod ico spheres in `generate_vegetation_assets.py` and re-run.
2. **No preview renders** — assets are inspectable in Blender or any glTF viewer (e.g. gltf.report, Babylon.js Sandbox). No in-game preview UI created in this phase.
3. **Emission strength** — `MAT_Spore_Glow` at `4.0` strength may appear extremely bright in HDR-tonemapped scenes. Tune down to `2.0`–`3.0` if overbright in Three.js render.
4. **Blender 4.x Emission node names** — script uses `"Emission Color"` + `"Emission Strength"` with fallback for Blender 3.x. Tested on Blender 4.0.2.
5. **No runtime integration** — these assets are NOT placed on maps yet. Integration is a separate phase requiring explicit user approval.

---

## Regeneration

```bash
cd "/Users/yorkvonloew/Documents/Claude/Vireon Front"
/Applications/Blender.app/Contents/MacOS/blender --background \
  --python tools/blender/vegetation/generate_vegetation_assets.py
```

## Next Step

**Vegetation Placement Integration Phase** — separate task, awaiting asset approval by York.
