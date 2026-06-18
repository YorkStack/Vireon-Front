// Building Asset Approval registry — a DEV-ONLY review list. It is built from the
// existing BUILDING_ASSETS inventory and carries NO gameplay weight: it never
// touches ACTIVE_ASSET_ROLES, buildings.json, or any balance value. Its only job
// is to enumerate the GLBs a human must visually approve before any future
// activation, with every asset starting at status PENDING.

import { BUILDING_ASSETS, CANONICAL_FACTION } from '../data/buildingAssets';
import type { FactionId } from '../data/factionModifiers';
import type { BuildingRole } from '../data/buildingRoles';

export type ApprovalStatus = 'PENDING' | 'YES' | 'NO';

/** The fixed, human-checked checklist shown per asset (all start unchecked). */
export const APPROVAL_CHECKLIST_ITEMS = [
  'Geometry loads correctly',
  'Scale looks plausible',
  'Faction style is recognizable',
  'Building role is recognizable',
  'No obvious missing mesh',
  'No obvious broken material',
  'Glass / transparent materials verified',
  'Emissive materials verified if applicable',
  'ATTACH locators verified if applicable',
] as const;
export type ApprovalChecklistItem = typeof APPROVAL_CHECKLIST_ITEMS[number];

export interface ApprovalAsset {
  assetKey: string;
  factionId: FactionId;
  factionName: string;     // canonical (crimson/azure/verdant/solar)
  buildingId?: string;     // buildings.json id, when mapped 1:1
  role: BuildingRole;
  modelPath: string;
  /** Whether this asset is currently rendered in gameplay (hq/power = yes today). */
  activeInGameplay: boolean;
}

/** Roles that render as GLB in gameplay TODAY. Mirrors buildingGlb.ACTIVE_ASSET_ROLES
 *  but is a read-only copy here — the viewer must never mutate the real one. */
const GAMEPLAY_ACTIVE_ROLES = new Set<BuildingRole>(['power', 'hq']);

/** Every building GLB to review, derived from the live asset inventory. */
export const APPROVAL_ASSETS: ApprovalAsset[] = BUILDING_ASSETS.map((a) => ({
  assetKey: a.assetKey,
  factionId: a.factionId,
  factionName: CANONICAL_FACTION[a.factionId],
  buildingId: a.buildingId,
  role: a.role,
  modelPath: a.modelPath,
  activeInGameplay: GAMEPLAY_ACTIVE_ROLES.has(a.role),
}));

/** The default approval state for an asset. ALWAYS PENDING — never auto-approve. */
export function defaultApprovalRecord(asset: ApprovalAsset) {
  return {
    assetKey: asset.assetKey,
    status: 'PENDING' as ApprovalStatus,
    checklist: Object.fromEntries(APPROVAL_CHECKLIST_ITEMS.map((i) => [i, false])) as Record<ApprovalChecklistItem, boolean>,
  };
}

export function approvalAssetsForFaction(factionId: FactionId): ApprovalAsset[] {
  return APPROVAL_ASSETS.filter((a) => a.factionId === factionId);
}

export const APPROVAL_FACTIONS: { id: FactionId; label: string }[] = [
  { id: 'red', label: 'Crimson Pact' },
  { id: 'blue', label: 'Azure Concorde' },
  { id: 'green', label: 'Verdant Swarm' },
  { id: 'yellow', label: 'Solar Dominion' },
];
