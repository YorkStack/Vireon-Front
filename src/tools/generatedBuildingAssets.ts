// Generated building GLB manifest (VFX/Asset review batch). These are the 28
// freshly-generated faction buildings imported from the external asset source
// into public/assets/buildings/generated/<faction>/. This manifest is REVIEW-ONLY:
// none of these are wired into gameplay (they are NOT in buildingAssets.ts, the
// gameplay loader never reads this file, ACTIVE_ASSET_ROLES is untouched). The
// `inferredRole` is a best-effort guess from the asset name — York confirms the
// real role visually in the approval viewer.

import type { FactionId } from '../data/factionModifiers';
import type { BuildingRole } from '../data/buildingRoles';

export interface GeneratedBuildingAsset {
  assetKey: string;
  factionId: FactionId;
  factionName: string;        // crimson/azure/verdant/solar
  sourceFileName: string;
  modelPath: string;          // /assets/buildings/generated/<faction>/<file>
  inferredRole: BuildingRole;
  /** Best-effort buildings.json id this asset would map to (review hint only). */
  inferredBuildingId: string;
}

interface Row { file: string; role: BuildingRole; bid: string }

// 7 per faction → hq, resource(refinery), power(spire), production(barracks),
// production(foundry), defense(wall), defense(turret). Inferred from names.
const PLAN: Record<FactionId, { name: string; rows: Row[] }> = {
  red: { name: 'crimson', rows: [
    { file: 'crimson_fortress_hq.glb',       role: 'hq',         bid: 'nexus' },
    { file: 'crimson_ore_melt.glb',          role: 'resource',   bid: 'refinery' },
    { file: 'crimson_turbine_station.glb',   role: 'power',      bid: 'spire' },
    { file: 'crimson_bunker_garrison.glb',   role: 'production', bid: 'barracks' },
    { file: 'crimson_vehicle_assembly.glb',  role: 'production', bid: 'foundry' },
    { file: 'crimson_wall_segment.glb',      role: 'defense',    bid: 'wall' },
    { file: 'crimson_coil_tower.glb',        role: 'defense',    bid: 'cannon|lance' },
  ] },
  blue: { name: 'azure', rows: [
    { file: 'azure_operations_hub.glb',      role: 'hq',         bid: 'nexus' },
    { file: 'azure_purification_plant.glb',  role: 'resource',   bid: 'refinery' },
    { file: 'azure_resonance_core.glb',      role: 'power',      bid: 'spire' },
    { file: 'azure_portal_spire.glb',        role: 'production', bid: 'barracks' },
    { file: 'azure_matrix_warp.glb',         role: 'production', bid: 'foundry' },
    { file: 'azure_hardlight_gate.glb',      role: 'defense',    bid: 'wall' },
    { file: 'azure_pulse_obelisk.glb',       role: 'defense',    bid: 'cannon|lance' },
  ] },
  green: { name: 'verdant', rows: [
    { file: 'verdant_apex_hatchery.glb',     role: 'hq',         bid: 'nexus' },
    { file: 'verdant_bio_digestor.glb',      role: 'resource',   bid: 'refinery' },
    { file: 'verdant_spore_spire.glb',       role: 'power',      bid: 'spire' },
    { file: 'verdant_spawning_nest.glb',     role: 'production', bid: 'barracks' },
    { file: 'verdant_strain_chrysalis.glb',  role: 'production', bid: 'foundry' },
    { file: 'verdant_spike_wall.glb',        role: 'defense',    bid: 'wall' },
    { file: 'verdant_acid_pool.glb',         role: 'defense',    bid: 'cannon|lance' },
  ] },
  yellow: { name: 'solar', rows: [
    { file: 'solar_singularity_nexus.glb',       role: 'hq',         bid: 'nexus' },
    { file: 'solar_extraction_depot.glb',        role: 'resource',   bid: 'refinery' },
    { file: 'solar_sun_pillar.glb',              role: 'power',      bid: 'spire' },
    { file: 'solar_manifestation_gateway.glb',   role: 'production', bid: 'barracks' },
    { file: 'solar_astral_forge.glb',            role: 'production', bid: 'foundry' },
    { file: 'solar_monolith_wall.glb',           role: 'defense',    bid: 'wall' },
    { file: 'solar_beam_monolith.glb',           role: 'defense',    bid: 'cannon|lance' },
  ] },
};

export const GENERATED_BUILDING_ASSETS: GeneratedBuildingAsset[] = (
  Object.entries(PLAN) as [FactionId, { name: string; rows: Row[] }][]
).flatMap(([factionId, { name, rows }]) =>
  rows.map((r) => ({
    assetKey: `gen.${name}.${r.bid.split('|')[0]}.${r.file.replace(/\.glb$/, '')}`,
    factionId,
    factionName: name,
    sourceFileName: r.file,
    modelPath: `/assets/buildings/generated/${name}/${r.file}`,
    inferredRole: r.role,
    inferredBuildingId: r.bid,
  })),
);
