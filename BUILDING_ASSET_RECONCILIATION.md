# Building Asset Reconciliation

> Controlled reconciliation of the generated building GLB batch against the repo.
> **Review / QA only — nothing activated in gameplay. `ACTIVE_ASSET_ROLES` unchanged `{power,hq}`.**

## 1. Executive summary

- **Expected generated building GLBs:** 28 (7 per faction × 4).
- **Found in external source** (`/Users/yorkvonloew/Downloads/Vireon-Front-Assets/Buildings/output`): **28**.
- **Imported into repo** (`public/assets/buildings/generated/<faction>/`): **28**.
- **Now shown in approval viewer** (generated batch): **28** (+ the 12 pre-existing active assets = 40 total reviewable).
- **Missing:** 0.  **Conflicts/overwrites:** 0 (the 28 generated are a NEW batch — every md5 differs from the 12 active repo GLBs; nothing overwritten).
- **Registered in `buildingAssets.ts` (gameplay):** 0 of the 28 generated → status **FOUND_NOT_REGISTERED** (by design — review-only).
- **Glass-like (name or transparency):** 18/28 generated, all 18 assigned + transparent (effective); 0 NEEDS-VISUAL-CONFIRMATION at metadata level.
- **Emissive:** 28/28.  **Unused/missing materials:** 0.  **External textures:** 0 (self-contained).
- **ATTACH locators on generated turret candidates:** 0/28 (single-node meshes) — see §H.

## 2. External source scan

`Buildings/output/{crimson,azure,verdant,solar}/` — 7 `.glb` each, 28 total. Also present:
`Buildings/asset_generation/<faction>/` (generation working dirs, NOT imported).

## 3. Reconciliation matrix — generated batch (28)

All 28 share the same status: **FOUND_NOT_REGISTERED** (found external ✓, imported to repo ✓,
in viewer ✓, in QA ✓, NOT in gameplay `buildingAssets.ts`, NOT active). Per faction:

### Crimson Pact

| Asset file | Inferred role | External | Repo path | In external | In repo | In viewer | In QA | Registered | Active | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| crimson_bunker_garrison.glb | production | output/crimson/ | /assets/buildings/generated/crimson/crimson_bunker_garrison.glb | YES | YES | YES | YES | NO | NO | FOUND_NOT_REGISTERED |
| crimson_coil_tower.glb | defense(turret?) | output/crimson/ | /assets/buildings/generated/crimson/crimson_coil_tower.glb | YES | YES | YES | YES | NO | NO | FOUND_NOT_REGISTERED |
| crimson_fortress_hq.glb | hq | output/crimson/ | /assets/buildings/generated/crimson/crimson_fortress_hq.glb | YES | YES | YES | YES | NO | NO | FOUND_NOT_REGISTERED |
| crimson_ore_melt.glb | resource | output/crimson/ | /assets/buildings/generated/crimson/crimson_ore_melt.glb | YES | YES | YES | YES | NO | NO | FOUND_NOT_REGISTERED |
| crimson_turbine_station.glb | power | output/crimson/ | /assets/buildings/generated/crimson/crimson_turbine_station.glb | YES | YES | YES | YES | NO | NO | FOUND_NOT_REGISTERED |
| crimson_vehicle_assembly.glb | production | output/crimson/ | /assets/buildings/generated/crimson/crimson_vehicle_assembly.glb | YES | YES | YES | YES | NO | NO | FOUND_NOT_REGISTERED |
| crimson_wall_segment.glb | defense | output/crimson/ | /assets/buildings/generated/crimson/crimson_wall_segment.glb | YES | YES | YES | YES | NO | NO | FOUND_NOT_REGISTERED |

### Azure Concorde

| Asset file | Inferred role | External | Repo path | In external | In repo | In viewer | In QA | Registered | Active | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| azure_hardlight_gate.glb | defense | output/azure/ | /assets/buildings/generated/azure/azure_hardlight_gate.glb | YES | YES | YES | YES | NO | NO | FOUND_NOT_REGISTERED |
| azure_matrix_warp.glb | production | output/azure/ | /assets/buildings/generated/azure/azure_matrix_warp.glb | YES | YES | YES | YES | NO | NO | FOUND_NOT_REGISTERED |
| azure_operations_hub.glb | hq | output/azure/ | /assets/buildings/generated/azure/azure_operations_hub.glb | YES | YES | YES | YES | NO | NO | FOUND_NOT_REGISTERED |
| azure_portal_spire.glb | production | output/azure/ | /assets/buildings/generated/azure/azure_portal_spire.glb | YES | YES | YES | YES | NO | NO | FOUND_NOT_REGISTERED |
| azure_pulse_obelisk.glb | defense(turret?) | output/azure/ | /assets/buildings/generated/azure/azure_pulse_obelisk.glb | YES | YES | YES | YES | NO | NO | FOUND_NOT_REGISTERED |
| azure_purification_plant.glb | resource | output/azure/ | /assets/buildings/generated/azure/azure_purification_plant.glb | YES | YES | YES | YES | NO | NO | FOUND_NOT_REGISTERED |
| azure_resonance_core.glb | power | output/azure/ | /assets/buildings/generated/azure/azure_resonance_core.glb | YES | YES | YES | YES | NO | NO | FOUND_NOT_REGISTERED |

### Verdant Swarm

| Asset file | Inferred role | External | Repo path | In external | In repo | In viewer | In QA | Registered | Active | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| verdant_acid_pool.glb | defense(turret?) | output/verdant/ | /assets/buildings/generated/verdant/verdant_acid_pool.glb | YES | YES | YES | YES | NO | NO | FOUND_NOT_REGISTERED |
| verdant_apex_hatchery.glb | hq | output/verdant/ | /assets/buildings/generated/verdant/verdant_apex_hatchery.glb | YES | YES | YES | YES | NO | NO | FOUND_NOT_REGISTERED |
| verdant_bio_digestor.glb | resource | output/verdant/ | /assets/buildings/generated/verdant/verdant_bio_digestor.glb | YES | YES | YES | YES | NO | NO | FOUND_NOT_REGISTERED |
| verdant_spawning_nest.glb | production | output/verdant/ | /assets/buildings/generated/verdant/verdant_spawning_nest.glb | YES | YES | YES | YES | NO | NO | FOUND_NOT_REGISTERED |
| verdant_spike_wall.glb | defense | output/verdant/ | /assets/buildings/generated/verdant/verdant_spike_wall.glb | YES | YES | YES | YES | NO | NO | FOUND_NOT_REGISTERED |
| verdant_spore_spire.glb | power | output/verdant/ | /assets/buildings/generated/verdant/verdant_spore_spire.glb | YES | YES | YES | YES | NO | NO | FOUND_NOT_REGISTERED |
| verdant_strain_chrysalis.glb | production | output/verdant/ | /assets/buildings/generated/verdant/verdant_strain_chrysalis.glb | YES | YES | YES | YES | NO | NO | FOUND_NOT_REGISTERED |

### Solar Dominion

| Asset file | Inferred role | External | Repo path | In external | In repo | In viewer | In QA | Registered | Active | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| solar_astral_forge.glb | production | output/solar/ | /assets/buildings/generated/solar/solar_astral_forge.glb | YES | YES | YES | YES | NO | NO | FOUND_NOT_REGISTERED |
| solar_beam_monolith.glb | defense(turret?) | output/solar/ | /assets/buildings/generated/solar/solar_beam_monolith.glb | YES | YES | YES | YES | NO | NO | FOUND_NOT_REGISTERED |
| solar_extraction_depot.glb | resource | output/solar/ | /assets/buildings/generated/solar/solar_extraction_depot.glb | YES | YES | YES | YES | NO | NO | FOUND_NOT_REGISTERED |
| solar_manifestation_gateway.glb | production | output/solar/ | /assets/buildings/generated/solar/solar_manifestation_gateway.glb | YES | YES | YES | YES | NO | NO | FOUND_NOT_REGISTERED |
| solar_monolith_wall.glb | defense | output/solar/ | /assets/buildings/generated/solar/solar_monolith_wall.glb | YES | YES | YES | YES | NO | NO | FOUND_NOT_REGISTERED |
| solar_singularity_nexus.glb | hq | output/solar/ | /assets/buildings/generated/solar/solar_singularity_nexus.glb | YES | YES | YES | YES | NO | NO | FOUND_NOT_REGISTERED |
| solar_sun_pillar.glb | power | output/solar/ | /assets/buildings/generated/solar/solar_sun_pillar.glb | YES | YES | YES | YES | NO | NO | FOUND_NOT_REGISTERED |

## 4. Pre-existing active repo assets (12) — unchanged

These are a SEPARATE earlier batch (different files/content) and remain the gameplay assets.
They are untouched by this import.

| Asset file | Role | Repo path | Registered | Active in gameplay | Maps to |
|---|---|---|---|---|---|
| crimson_command_fortress.glb | hq | hq/crimson/ | YES | YES | nexus |
| crimson_power_plant.glb | power | power/crimson/ | YES | YES | spire |
| crimson_vulcan_autocannon_turret.glb | defense | defense/crimson/ | YES | NO (disabled) | cannon/lance |
| azure_command_headquarters.glb | hq | hq/azure/ | YES | YES | nexus |
| azure_resonance_core.glb | power | power/azure/ | YES | YES | spire |
| azure_pulse_precision_laser_turret.glb | defense | defense/azure/ | YES | NO (disabled) | cannon/lance |
| verdant_apex_hive_core.glb | hq | hq/verdant/ | YES | YES | nexus |
| verdant_bio_reactor.glb | power | power/verdant/ | YES | YES | spire |
| verdant_spitter_acid_projectile_turret.glb | defense | defense/verdant/ | YES | NO (disabled) | cannon/lance |
| solar_singularity_nexus.glb | hq | hq/solar/ | YES | YES | nexus |
| solar_radiant_nexus.glb | power | power/solar/ | YES | YES | spire |
| solar_beam_monolith_tower.glb | defense | defense/solar/ | YES | NO (disabled) | cannon/lance |

## 5–10. Imports / present / missing / mismatches

- **Files imported (this phase):** all 28 generated GLBs → `public/assets/buildings/generated/`.
- **Files already present:** the 12 active repo GLBs (different batch) — left in place.
- **Missing files:** none (28/28 found + imported).
- **Found but not registered:** all 28 generated (review-only, intentional).
- **Registered but not found:** none.
- **Duplicates / name mismatches:** the generated names differ from the active names
  (e.g. generated `crimson_fortress_hq` vs active `crimson_command_fortress`; generated
  `azure_resonance_core` 173KB vs active `azure_resonance_core` 410KB — same name, DIFFERENT
  content, different folders → no collision). Treated as distinct assets, not duplicates.

## 11. Glass / material findings (28 generated)

Detection is name **and behaviour** based. The generated batch uses short code material
names (CC/CS/CR/AW/AQ/AB/VH/VA/VT/SA/SAM…) — so name-only detection finds nothing, but the
transparent (alphaMode BLEND, alpha 0.72–0.85) panels ARE detected by behaviour:

- **18/28** have a transparent/glass-like material, **all assigned to a mesh + transparent** → looks effective.
- Crimson (7) has **no transparent material** (opaque concrete/steel/red) — correct for its industrial style; emissive accent present.
- Azure/Verdant/Solar carry transparent glass/energy panels (cyan, acid membrane, plasma).
- 0 unused materials, 0 meshes without material, 0 external/missing textures.

## 12. Defense tower pivot findings (still explicit)

- The 4 **active** repo towers have ATTACH locators but `ATTACH_turret_pivot` is an EMPTY
  marker (geometry not parented) — aim NOT plug-and-play (see `docs/defense-tower-readiness.md`).
- The 4 **generated** turret candidates (coil_tower, pulse_obelisk, acid_pool, beam_monolith)
  are **single-node with NO ATTACH locators** → even less rig-ready. No activation / re-parenting here.

## 13. Vegetation status

- Vegetation generated in commit `391fa91` (6 GLBs) and pushed.
- Vegetation remains **PENDING approval** — NOT integrated, NOT placed, terrain scatter untouched.
- Open risks preserved: `alien_pod_shrub.glb` (82 KB) = first optimization candidate;
  `MAT_Spore_Glow` emission ×4.0 may be too strong under HDR/tone mapping; no preview renders yet.
- This phase did **not** touch any vegetation GLB, script, QA, terrain scatter or runtime loading.

## 14. Runtime / gameplay untouched

No change to runtime/gameplay: balance, costs, HP, power, build times, AI, combat, build menu,
tower behavior, terrain generation, vegetation placement. `ACTIVE_ASSET_ROLES` stays `{power,hq}`.
`buildings.json` and the gameplay `buildingAssets.ts` registry are unchanged. The viewer/tooling
is never imported into the game bundle.

