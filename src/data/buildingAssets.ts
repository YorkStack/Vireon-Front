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
