// ─────────────────────────────────────────────────────────────────────────
// Building asset registry (Asset/Foundation Phase 1) — PURE DATA, no loader.
//
// Maps faction + role/tag to a GLB model path. This is ONLY a data inventory:
// nothing here is loaded or rendered yet (buildings still use the procedural
// renderer in src/render/models.ts). Asset/Foundation Phase 2 will add a GLB
// loader that consults this registry and falls back to `fallbackShape`.
//
// Faction folder names are the canonical faction names (crimson/azure/verdant/
// solar); the registry's `factionId` uses the runtime ids (red/blue/green/yellow).
// ─────────────────────────────────────────────────────────────────────────
import type { FactionId } from './factionModifiers';
import type { BuildingRole, BuildingTag } from './buildingRoles';

/** runtime FactionId → canonical faction folder/name (used in asset paths/keys). */
export const CANONICAL_FACTION: Record<FactionId, string> = {
  red: 'crimson', blue: 'azure', green: 'verdant', yellow: 'solar',
};

export interface BuildingAssetDefinition {
  /** Stable, unique key, e.g. "crimson.defense.vulcan". */
  assetKey: string;
  factionId: FactionId;
  /** Optional link to a buildings.json id (when the mapping is 1:1). */
  buildingId?: string;
  role: BuildingRole;
  tags: BuildingTag[];
  /** Public path to the GLB, served from /public. */
  modelPath: string;
  /** Procedural shape to fall back to if the GLB is missing/unloadable. */
  fallbackShape?: string;
  /** Original filename as delivered (for traceability). */
  sourceFileName?: string;
  notes?: string;
  /** Optional fine-tuning of the GLB placement (applied on top of auto-fit). */
  visualTransform?: {
    scale?: number;        // multiplier on the auto-fit scale
    rotationY?: number;    // radians
    yOffset?: number;      // world units added after grounding
    positionOffset?: [number, number, number];
  };
}

const DEF = '/assets/buildings/defense';
const PWR = '/assets/buildings/power';
const HQ = '/assets/buildings/hq';

/** Live, file-backed asset mappings (each modelPath exists under /public). */
export const BUILDING_ASSETS: BuildingAssetDefinition[] = [
  // ---- Command centers (role hq) → buildings.json `nexus`, one per faction ----
  {
    assetKey: 'crimson.hq.fortress', factionId: 'red', buildingId: 'nexus', role: 'hq', tags: [],
    modelPath: `${HQ}/crimson/crimson_command_fortress.glb`, fallbackShape: 'hq',
    sourceFileName: 'crimson_command_fortress.glb',
  },
  {
    assetKey: 'azure.hq.headquarters', factionId: 'blue', buildingId: 'nexus', role: 'hq', tags: [],
    modelPath: `${HQ}/azure/azure_command_headquarters.glb`, fallbackShape: 'hq',
    sourceFileName: 'azure_command_headquarters.glb',
  },
  {
    assetKey: 'verdant.hq.hivecore', factionId: 'green', buildingId: 'nexus', role: 'hq', tags: [],
    modelPath: `${HQ}/verdant/verdant_apex_hive_core.glb`, fallbackShape: 'hq',
    sourceFileName: 'verdant_apex_hive_core.glb',
  },
  {
    assetKey: 'solar.hq.singularity', factionId: 'yellow', buildingId: 'nexus', role: 'hq', tags: [],
    modelPath: `${HQ}/solar/solar_singularity_nexus.glb`, fallbackShape: 'hq',
    sourceFileName: 'solar_singularity_nexus.glb',
  },

  // ---- Defense towers (role defense, tag turret) — one per faction ----
  {
    assetKey: 'crimson.defense.vulcan', factionId: 'red', role: 'defense', tags: ['turret'],
    modelPath: `${DEF}/crimson/crimson_vulcan_autocannon_turret.glb`, fallbackShape: 'turret',
    sourceFileName: 'crimson_vulcan_autocannon_turret.glb',
    notes: 'Dual-barrel autocannon. Candidate model for cannon/lance (mapping deferred).',
  },
  {
    assetKey: 'azure.defense.pulse', factionId: 'blue', role: 'defense', tags: ['turret'],
    modelPath: `${DEF}/azure/azure_pulse_precision_laser_turret.glb`, fallbackShape: 'turret',
    sourceFileName: 'azure_pulse_precision_laser_turret.glb',
    notes: 'Precision laser. Candidate model for cannon/lance (mapping deferred).',
  },
  {
    assetKey: 'verdant.defense.spitter', factionId: 'green', role: 'defense', tags: ['turret'],
    modelPath: `${DEF}/verdant/verdant_spitter_acid_projectile_turret.glb`, fallbackShape: 'turret',
    sourceFileName: 'verdant_spitter_acid_projectile_turret.glb',
    notes: 'Acid spitter. Candidate model for cannon/lance (mapping deferred).',
  },
  {
    assetKey: 'solar.defense.monolith', factionId: 'yellow', role: 'defense', tags: ['turret'],
    modelPath: `${DEF}/solar/solar_beam_monolith_tower.glb`, fallbackShape: 'turret',
    sourceFileName: 'beam_monolith_tower.glb',
    notes: 'Beam monolith. Renamed from beam_monolith_tower.glb (added solar_ prefix).',
  },

  // ---- Powerplants (role power, tags powerPlant + energyProducer) ----
  {
    assetKey: 'crimson.power.plant', factionId: 'red', buildingId: 'spire', role: 'power',
    tags: ['powerPlant', 'energyProducer'],
    modelPath: `${PWR}/crimson/crimson_power_plant.glb`, fallbackShape: 'powerPlant',
    sourceFileName: 'crimson_power_plant.glb',
  },
  {
    assetKey: 'azure.power.core', factionId: 'blue', buildingId: 'spire', role: 'power',
    tags: ['powerPlant', 'energyProducer'],
    modelPath: `${PWR}/azure/azure_resonance_core.glb`, fallbackShape: 'powerPlant',
    sourceFileName: 'azure_resonance_core.glb',
  },
  {
    assetKey: 'verdant.power.reactor', factionId: 'green', buildingId: 'spire', role: 'power',
    tags: ['powerPlant', 'energyProducer'],
    modelPath: `${PWR}/verdant/verdant_bio_reactor.glb`, fallbackShape: 'powerPlant',
    sourceFileName: 'verdant_bio_reactor.glb',
  },
  {
    assetKey: 'solar.power.nexus', factionId: 'yellow', buildingId: 'spire', role: 'power',
    tags: ['powerPlant', 'energyProducer'],
    modelPath: `${PWR}/solar/solar_radiant_nexus.glb`, fallbackShape: 'powerPlant',
    sourceFileName: 'solar_radiant_nexus.glb',
  },
];

/**
 * Known-but-missing assets (no GLB delivered yet). Now EMPTY — all four factions
 * have HQ + powerplant + defense-tower GLBs. Kept for structure/future gaps.
 */
export const UNMAPPED_BUILDING_ASSETS: { assetKey: string; factionId: FactionId; role: BuildingRole; tags: BuildingTag[]; reason: string }[] = [];

// ── Approved generated building assets (review-approved by York) ──────────────
// The generated batch under public/assets/buildings/generated/. Maps the static,
// non-turret buildings (nexus/spire/refinery/barracks/foundry/wall) to faction-
// specific GLBs. Turret candidates (cannon/lance) are deliberately EXCLUDED — they
// are single-node without ATTACH locators and would break turret aim, so they stay
// procedural. PURE VISUAL: no stat / footprint / balance change.
const GEN = '/assets/buildings/generated';
const GEN_ROLE: Record<string, BuildingRole> = {
  nexus: 'hq', spire: 'power', refinery: 'resource', barracks: 'production', foundry: 'production', wall: 'defense',
};
const GEN_FILES: Record<FactionId, Record<string, string>> = {
  red: {
    nexus: 'crimson_fortress_hq', spire: 'crimson_turbine_station', refinery: 'crimson_ore_melt',
    barracks: 'crimson_bunker_garrison', foundry: 'crimson_vehicle_assembly', wall: 'crimson_wall_segment',
  },
  blue: {
    nexus: 'azure_operations_hub', spire: 'azure_resonance_core', refinery: 'azure_purification_plant',
    barracks: 'azure_portal_spire', foundry: 'azure_matrix_warp', wall: 'azure_hardlight_gate',
  },
  green: {
    nexus: 'verdant_apex_hatchery', spire: 'verdant_spore_spire', refinery: 'verdant_bio_digestor',
    barracks: 'verdant_spawning_nest', foundry: 'verdant_strain_chrysalis', wall: 'verdant_spike_wall',
  },
  yellow: {
    nexus: 'solar_singularity_nexus', spire: 'solar_sun_pillar', refinery: 'solar_extraction_depot',
    barracks: 'solar_manifestation_gateway', foundry: 'solar_astral_forge', wall: 'solar_monolith_wall',
  },
};

/** Building ids whose generated GLB is activated in gameplay (NOT cannon/lance). */
export const ACTIVE_GENERATED_BUILDING_IDS: ReadonlySet<string> = new Set(Object.keys(GEN_ROLE));

/** The activated generated gameplay assets (24 = 6 buildings × 4 factions). */
export const GENERATED_GAMEPLAY_ASSETS: BuildingAssetDefinition[] = (
  Object.entries(GEN_FILES) as [FactionId, Record<string, string>][]
).flatMap(([factionId, files]) =>
  Object.entries(files).map(([buildingId, stem]) => ({
    assetKey: `${CANONICAL_FACTION[factionId]}.gen.${buildingId}`,
    factionId,
    buildingId,
    role: GEN_ROLE[buildingId],
    tags: [] as BuildingTag[],
    modelPath: `${GEN}/${CANONICAL_FACTION[factionId]}/${stem}.glb`,
    fallbackShape: buildingId,
    sourceFileName: `${stem}.glb`,
  })),
);

/** The activated generated asset for a faction + buildings.json id, or undefined. */
export function generatedGameplayAsset(factionId: FactionId, buildingId: string): BuildingAssetDefinition | undefined {
  if (!ACTIVE_GENERATED_BUILDING_IDS.has(buildingId)) return undefined;
  return GENERATED_GAMEPLAY_ASSETS.find((a) => a.factionId === factionId && a.buildingId === buildingId);
}

// ── Final TEXTURED building assets (QA-approved re-exports) ───────────────────
// Same 6 static buildings per faction as the generated set, but re-exported WITH
// baked textures/materials (3–4 textures each vs 0 in the generated set). Served
// from public/assets/buildings/textured_final/. REVIEW-ONLY, gated behind the
// `?buildings=textured` query — NOT default. The 7th GLB per faction is a
// tower/defense candidate (crimson_coil_tower, azure_pulse_obelisk,
// verdant_acid_pool, solar_beam_monolith); it is deliberately NOT mapped here so
// cannon/lance stay procedural (no ATTACH pivots verified). Reuses the same stems
// as GEN_FILES, so the static role mapping is identical — only the folder differs.
const TEX_FINAL = '/assets/buildings/textured_final';
export const TEXTURED_FINAL_BUILDING_ASSETS: BuildingAssetDefinition[] = (
  Object.entries(GEN_FILES) as [FactionId, Record<string, string>][]
).flatMap(([factionId, files]) =>
  Object.entries(files).map(([buildingId, stem]) => ({
    assetKey: `${CANONICAL_FACTION[factionId]}.tex.${buildingId}`,
    factionId,
    buildingId,
    role: GEN_ROLE[buildingId],
    tags: [] as BuildingTag[],
    modelPath: `${TEX_FINAL}/${CANONICAL_FACTION[factionId]}/${stem}.glb`,
    fallbackShape: buildingId,
    sourceFileName: `${stem}.glb`,
  })),
);

/** The final-textured asset for a faction + buildings.json id, or undefined.
 *  Same safe static roles as the generated set (cannon/lance/tower excluded). */
export function texturedFinalAsset(factionId: FactionId, buildingId: string): BuildingAssetDefinition | undefined {
  if (!ACTIVE_GENERATED_BUILDING_IDS.has(buildingId)) return undefined;
  return TEXTURED_FINAL_BUILDING_ASSETS.find((a) => a.factionId === factionId && a.buildingId === buildingId);
}

// ── Lookups (data only — no loading) ─────────────────────────────────────────
export function getBuildingAsset(assetKey: string): BuildingAssetDefinition | undefined {
  return BUILDING_ASSETS.find((a) => a.assetKey === assetKey);
}
export function buildingAssetsForFaction(factionId: FactionId): BuildingAssetDefinition[] {
  return BUILDING_ASSETS.filter((a) => a.factionId === factionId);
}
export function buildingAssetsByRole(role: BuildingRole): BuildingAssetDefinition[] {
  return BUILDING_ASSETS.filter((a) => a.role === role);
}
export function buildingAssetsByTag(tag: BuildingTag): BuildingAssetDefinition[] {
  return BUILDING_ASSETS.filter((a) => a.tags.includes(tag));
}
/** Defense tower for a faction (role defense + turret tag), if a GLB exists. */
export function defenseTowerAsset(factionId: FactionId): BuildingAssetDefinition | undefined {
  return BUILDING_ASSETS.find((a) => a.factionId === factionId && a.role === 'defense' && a.tags.includes('turret'));
}
/** Powerplant for a faction (role power + powerPlant tag), if a GLB exists. */
export function powerPlantAsset(factionId: FactionId): BuildingAssetDefinition | undefined {
  return BUILDING_ASSETS.find((a) => a.factionId === factionId && a.role === 'power' && a.tags.includes('powerPlant'));
}
/** Command-center (HQ) model for a faction, if a GLB exists. */
export function hqAsset(factionId: FactionId): BuildingAssetDefinition | undefined {
  return BUILDING_ASSETS.find((a) => a.factionId === factionId && a.role === 'hq');
}
