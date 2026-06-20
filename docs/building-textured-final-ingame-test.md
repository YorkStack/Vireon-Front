# Textured Final Buildings — Gated In-Game Test

> **Visual-only, OPT-IN, NOT default.** No gameplay/balance/cost/HP/power/build-time/
> AI/combat/pathfinding/build-menu/footprint/terrain change. Committed (gated) in
> `485b3a8`.

## 0. Active building-texture path (status 2026-06-20)
- **The single approved base building texture path is the embedded textures inside
  the final GLB assets** (`public/assets/buildings/textured_final/<faction>/`). Each
  GLB carries its own baked textures (3+ per model); no runtime atlas is applied.
- **Mode:** `?buildings=textured` swaps the 24 mapped static buildings (6 roles × 4
  factions) to these final-textured GLBs. **Default (no query) stays `current`** —
  today's flat-material generated GLBs. `?buildings=current` is the explicit fallback.
- **Crimson Texture Atlas Pilot is DEPRECATED & REMOVED** — the runtime
  `applyCrimsonTexturePilot` wiring, `src/render/crimsonTexturePilot.ts`, and the
  `public/assets/buildings/textures/crimson/` atlas crops are gone (archived note:
  [archive/building-texture-pilot.md](archive/building-texture-pilot.md)). There are
  **no longer two competing ways to texture buildings.**
- **Runtime texture mutation is reserved for FUTURE dynamic game-state effects only**
  (damage, bullet holes, fire/smoke, repair state, low-power state, faction aura) —
  **never** for base building textures.

## 1. External source asset paths
`/Users/yorkvonloew/Downloads/Vireon-Front-Assets/Buildings/output/with texture/<faction>/`
— 7 GLBs per faction (28 total), QA-approved (21 APPROVE, 7 APPROVE-WITH-MINOR, 0 rework).

## 2. Repo-served asset paths
`public/assets/buildings/textured_final/<faction>/` — 28 GLBs copied, original
filenames, byte-identical (the 4 repaired assets `crimson_bunker_garrison`,
`crimson_turbine_station`, `crimson_vehicle_assembly`, `verdant_acid_pool` md5-match
source). The current generated set under `…/generated/` is untouched; procedural
fallback intact.

## 3. Role mapping
The textured set re-exports the **same 6 static buildings** per faction as the
generated set (identical stems) plus a 7th tower. So the safe static mapping is 1:1
— only the folder + assetKey differ.

| gameplay id | role | crimson | azure | verdant | solar |
|---|---|---|---|---|---|
| nexus | hq | fortress_hq | operations_hub | apex_hatchery | singularity_nexus |
| spire | power | turbine_station | resonance_core | spore_spire | sun_pillar |
| refinery | resource | ore_melt | purification_plant | bio_digestor | extraction_depot |
| barracks | production | bunker_garrison | portal_spire | spawning_nest | manifestation_gateway |
| foundry | production | vehicle_assembly | matrix_warp | strain_chrysalis | astral_forge |
| wall | defense | wall_segment | hardlight_gate | spike_wall | monolith_wall |

`assetKey = <faction>.tex.<buildingId>`, registry `TEXTURED_FINAL_BUILDING_ASSETS`
+ resolver `texturedFinalAsset()` in `buildingAssets.ts`.

## 4. Roles not mapped / review-only
The 7th GLB per faction is a **tower/defense candidate** and is **NOT mapped**
(kept review-only): `crimson_coil_tower`, `azure_pulse_obelisk`, `verdant_acid_pool`,
`solar_beam_monolith`. `cannon`/`lance` stay **procedural** (no verified ATTACH
pivots). Tower GLBs remain inactive.

## 5. Query parameter
| Param | Effect |
|---|---|
| *(none)* | **default — current generated buildings (unchanged)** |
| `?buildings=current` | explicit alias for the default |
| `?buildings=textured` | final textured GLBs for the 6 safe static roles |

Resolved in `buildingGlb.ts` (`buildingModeFromQuery()` → `BUILDING_MODE`).
`activeBuildingAsset` prefers the textured asset in textured mode, else falls back
to the generated asset, else procedural. `preloadBuildingGlbs` loads the textured
set only in textured mode. SSR/test-safe (no `window` → `current`).

## 6. Crimson visual result
All 6 roles resolve to `crimson.tex.*` and load as `glb`. Textures clearly visible:
spire/refinery/wall show red panels + emissive rims; nexus/barracks/foundry read as
dark crimson/gunmetal (faction aesthetic) — zooming in shows panel lines, striations,
emblem detail (NOT flat black, no magenta/error material, no atlas labels, no UV
stretching). Emissive accents preserved.

## 7. All-faction visual result
- **Azure** `azure.tex.*` — clean white ceramic + cyan emissive rings.
- **Verdant** `verdant.tex.*` — organic bio membranes (spotted) + warm-brown chitin
  dome (matches QA "warm earthy browns" art-direction note).
- **Solar** `solar.tex.*` — dark obsidian bases + gold/violet-pink emissive (matches
  QA "violet/pink accents" art-direction note).
All 24 static roles load as `glb` with visible baked textures; no material failures.

## 8. FPS / console result
Console clean across all faction smokes + mode switches (no errors/warnings). The
textured GLBs are small (≤~680 KB) and render via the same cached GLB path as the
generated set; no measurable cost. (FPS not numerically probed — the rAF eval hits
a known long-session harness timeout — but the scene renders smoothly in every
screenshot.)

## 9. Known issues
- Crimson nexus/barracks/foundry look quite dark in the neutral dev-harness light;
  under the game's sun+hemi+fill they read brighter. Worth an in-match look before
  defaulting.
- Verdant warm browns / Solar violet-pink are intentional art-direction (per QA).
- Detail pass (grain + adaptive AO + emissive ×1.7) is **bypassed** for textured
  GLBs so their baked textures aren't muddied/over-brightened; the old Crimson
  runtime texture pilot is **never** applied to textured assets.

## 10. Ready to become default?
**Keep gated for review.** The path is correct and the textures are clearly visible
across all 4 factions. Recommend an in-match (built-base) look — especially the
darker Crimson trio under real lighting — before flipping the default. The switch
itself would be a one-line `BUILDING_MODE` default change in a separate approved step.

## 11. Towers
Remain **procedural** — the 7th tower GLB per faction is review-only and unmapped;
`cannon`/`lance` untouched.

## 12. Next recommended step
In-match visual review of a fully-built Crimson + one other base under game lighting
(build the 6 structures), then decide on the default switch. Optionally evaluate a
*light* detail pass for textured GLBs if the dark Crimson trio needs lift.

## Changed / added files (all uncommitted, dev/test only)
- `src/data/buildingAssets.ts` (+TEXTURED_FINAL_BUILDING_ASSETS, +texturedFinalAsset)
- `src/render/buildingGlb.ts` (+buildingModeFromQuery, gated preload/resolve, bypass detail-pass + pilot for textured)
- `public/assets/buildings/textured_final/<faction>/*.glb` (28)
- `building_textured_test.html` + `src/tools/buildingTexturedTestViewer.ts` (dev review harness)
- `docs/building-textured-final-ingame-test.md` (this)
