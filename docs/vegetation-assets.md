# Vireon Front — Vegetation Assets

## Why GLB Instead of PNG

The previous vegetation system used 2D PNG sprites/billboards which rendered flat from an RTS camera. Key problems:
- No 3D silhouette — objects looked flat when camera rotated
- Alpha-channel issues — KI-generated PNGs sometimes had baked-in checkerboard in RGB channel (Alpha = 255 throughout)
- No depth cueing from lighting
- Required image generation pipeline (Google Gemini Nano Banana) which was unreliable

**GLB solves all of these:**
- True 3D geometry — visible from any camera angle
- No alpha transparency issues — materials baked directly into mesh
- PBR materials with emissive channels — compatible with Three.js `GLTFLoader`
- Generated procedurally via Blender Python — fully deterministic, no external dependencies
- File sizes under 85 KB per asset — well within performance budget

---

## Asset List

All assets are in `Vegetation/output/`.

### Large / Landmark

| Asset | File | Size | Faction Inspiration |
|-------|------|------|---------------------|
| Alien Mushroom Tree | `alien_mushroom_tree.glb` | 26 KB | Neutral Vireon — bioluminescent canopy tree |
| Alien Mushroom Cluster | `alien_mushroom_cluster.glb` | 40 KB | Neutral Vireon — grouped landmark vegetation |

### Medium Scatter

| Asset | File | Size | Faction Inspiration |
|-------|------|------|---------------------|
| Alien Spore Bush | `alien_spore_bush.glb` | 26 KB | Verdant — organic bio-matter scatter |
| Alien Pod Shrub | `alien_pod_shrub.glb` | 82 KB | Verdant/Azure — bulbous pod shrub |

### Small Scatter / Accent

| Asset | File | Size | Faction Inspiration |
|-------|------|------|---------------------|
| Alien Crystal Fern | `alien_crystal_fern.glb` | 18 KB | Solar/Azure — crystalline fern blades |
| Alien Biolume Reed | `alien_biolume_reed.glb` | 20 KB | Azure — water-edge / map-boundary reeds |

---

## Material Palette

| Material Name | Color | Emissive Strength | Usage |
|---------------|-------|-------------------|-------|
| `MAT_Glowing_Stem` | #E0FFFF (pale cyan) | 1.5 | Stems, reeds |
| `MAT_Mushroom_Cap_Turquoise` | #00CED1 | — | Cap top faces |
| `MAT_Mushroom_Cap_Violet_Rim` | #BA55D3 | — | Cap underside / rim |
| `MAT_Spore_Glow` | #00FFFF | 4.0 | Spore pods, tips |
| `MAT_Alien_Dark_Base` | #0A141E | — | Base mounds, roots |
| `MAT_Crystal_Aqua` | #00B4C8 | 0.6 | Crystal blades (aqua) |
| `MAT_Crystal_Violet` | #783CB4 | 0.3 | Crystal blades (violet) |
| `MAT_Emissive_Veins` | #00F0DC | 2.0 | Vein nodes on crystal fern |

---

## Asset Detail

### alien_mushroom_tree.glb — Reference Quality

- **Role:** Large landmark vegetation, Vireon faction biome
- **Geometry:** Tapered cylinder stem (smooth-shaded) + flattened UV sphere cap (flat-shaded) + cone rim + 4 spore pods
- **Approx size:** 1.75 m wide × 2.4 m tall
- **Recommended use:** Sparse landmark placement on Vireon maps, avoid clustering

### alien_mushroom_cluster.glb

- **Role:** Medium landmark / cluster decoration
- **Geometry:** 5 mushrooms at varied heights, joined into one object
- **Approx size:** 1.6 m wide × 1.2 m tall
- **Recommended use:** Map clusters, replacing single-tree scatter in medium-density zones

### alien_spore_bush.glb

- **Role:** Low scatter bush
- **Geometry:** Dark mound base + 6 tapered stems + 6 glow pods
- **Approx size:** 0.6 m wide × 0.5 m tall
- **Recommended use:** Dense scatter on Verdant / organic terrain areas

### alien_crystal_fern.glb

- **Role:** Small accent / low scatter
- **Geometry:** 8 faceted crystal blade prisms + 4 emissive vein nodes + dark base stub
- **Approx size:** 0.5 m wide × 0.75 m tall
- **Recommended use:** Crystal field areas, Solar/Azure biomes, cliff scatter

### alien_biolume_reed.glb

- **Role:** Tall thin accent / water-edge / map-boundary decoration
- **Geometry:** 6 thin tapered cylinders (smooth-shaded) + 6 glowing tips + dark base plate
- **Approx size:** 0.55 m wide × 2.1 m tall
- **Recommended use:** Map edges, water-adjacent areas, Azure faction terrain

### alien_pod_shrub.glb

- **Role:** Medium scatter shrub
- **Geometry:** Ico sphere core + 7 pod spheres + 4 glow nodes + 5 base stubs
- **Approx size:** 0.9 m wide × 0.75 m tall
- **Recommended use:** Medium scatter, Verdant/Azure biomes, node-adjacent terrain

---

## Regenerating Assets

```bash
cd "/Users/yorkvonloew/Documents/Claude/Vireon Front"
/Applications/Blender.app/Contents/MacOS/blender --background \
  --python tools/blender/vegetation/generate_vegetation_assets.py
```

All parameters are deterministic (seeded where randomness is used). Re-running produces identical output.

---

## Open Risks

1. **alien_pod_shrub.glb (82 KB)** — largest asset due to ico sphere subdivisions. If performance budget is tight, reduce `subdivisions=2 → 1` in the script for that asset.
2. **MAT_Spore_Glow emission=4.0** — may appear overbright in Three.js HDR tone-mapped scenes. Tune to 2.0–3.0 if needed at runtime.
3. **No in-game preview** — assets need visual sign-off before placement integration. Use a glTF viewer (gltf.report, Babylon.js Sandbox) or Blender itself to review.
4. **Approval status: PENDING** — see `VEGETATION_ASSET_QA.md`. No assets auto-approved.

---

## Next Step

**Phase 2: Vegetation Placement Integration** — only begin after York explicitly approves these assets.

Tasks in Phase 2 (not started):
- Load GLBs via `THREE.GLTFLoader` in vegetation rendering
- Replace sprite/billboard system with 3D mesh instances
- Scatter placement rules (density, biome filter, exclusion zones)
- InstancedMesh batching for performance
