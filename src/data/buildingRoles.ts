// ─────────────────────────────────────────────────────────────────────────
// Building roles & tags (Asset/Foundation Phase 1) — PURE METADATA.
//
// A minimal, non-invasive classification of buildings. This does NOT change any
// gameplay value, stat, or runtime behaviour — it only labels what each building
// IS, so later work (GLB asset selection, turret durability, colony aura, shields,
// upkeep) can query buildings by role/tag instead of hard-coding ids.
// ─────────────────────────────────────────────────────────────────────────

export type BuildingRole =
  | 'hq'
  | 'resource'
  | 'power'
  | 'production'
  | 'defense'
  | 'support'
  | 'tech'
  | 'special';

export type BuildingTag =
  | 'turret'
  | 'energyProducer'
  | 'powerPlant'
  | 'auraSource'
  | 'shieldProjector'
  | 'upkeepReducer'
  | 'colonyNode';

export const BUILDING_ROLES_ALL: BuildingRole[] = [
  'hq', 'resource', 'power', 'production', 'defense', 'support', 'tech', 'special',
];
export const BUILDING_TAGS_ALL: BuildingTag[] = [
  'turret', 'energyProducer', 'powerPlant', 'auraSource', 'shieldProjector', 'upkeepReducer', 'colonyNode',
];

export interface BuildingRoleInfo {
  role: BuildingRole;
  tags: BuildingTag[];
}

/**
 * Classification of the existing buildings (src/data/buildings.json). Read-only
 * labelling — no stat lives here. `spire` is the live power producer (power +50);
 * `cannon`/`lance` are the weapon turrets; `wall` is a passive barrier.
 */
export const BUILDING_ROLES: Record<string, BuildingRoleInfo> = {
  nexus: { role: 'hq', tags: ['energyProducer'] },        // Command Nexus (also produces power +20)
  refinery: { role: 'resource', tags: [] },               // Refinery / resource dropoff
  spire: { role: 'power', tags: ['powerPlant', 'energyProducer'] }, // Power Spire (+50)
  barracks: { role: 'production', tags: [] },             // infantry production
  foundry: { role: 'production', tags: [] },              // vehicle production
  wall: { role: 'defense', tags: [] },                    // passive barrier (no turret)
  cannon: { role: 'defense', tags: ['turret'] },          // Bastion Cannon
  lance: { role: 'defense', tags: ['turret'] },           // Pulse Lance (needs power)
};

export function getBuildingRole(buildingId: string): BuildingRoleInfo | undefined {
  return BUILDING_ROLES[buildingId];
}
/** Building ids carrying a given tag (e.g. all 'turret' buildings). */
export function buildingsWithTag(tag: BuildingTag): string[] {
  return Object.entries(BUILDING_ROLES).filter(([, info]) => info.tags.includes(tag)).map(([id]) => id);
}
/** Building ids of a given role (e.g. all 'defense' buildings). */
export function buildingsWithRole(role: BuildingRole): string[] {
  return Object.entries(BUILDING_ROLES).filter(([, info]) => info.role === role).map(([id]) => id);
}
