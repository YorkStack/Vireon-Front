// Building Asset Approval registry — a DEV-ONLY review list. It enumerates the
// GLBs a human must visually approve before any future activation, with every
// asset starting at status PENDING. It carries NO gameplay weight: it never
// touches ACTIVE_ASSET_ROLES, buildings.json, or any balance value.
//
// Two batches:
//   • generated (28) — the freshly imported faction buildings under
//     public/assets/buildings/generated/ (review-only, none wired to gameplay).
//   • active (12) — the GLBs already in buildingAssets.ts (hq + power render in
//     gameplay today; defense towers are registered-but-disabled).

import { BUILDING_ASSETS, CANONICAL_FACTION } from '../data/buildingAssets';
import { GENERATED_BUILDING_ASSETS } from './generatedBuildingAssets';
import type { FactionId } from '../data/factionModifiers';
import type { BuildingRole } from '../data/buildingRoles';

export type ApprovalStatus = 'PENDING' | 'YES' | 'NO';
export type ApprovalBatch = 'generated' | 'active';

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
  batch: ApprovalBatch;
  factionId: FactionId;
  factionName: string;     // canonical (crimson/azure/verdant/solar)
  buildingId?: string;     // buildings.json id / inferred id
  role: BuildingRole;
  modelPath: string;
  /** Whether this asset is currently rendered in gameplay (active hq/power = yes). */
  activeInGameplay: boolean;
}

/** Roles that render as GLB in gameplay TODAY. A read-only mirror of
 *  buildingGlb.ACTIVE_ASSET_ROLES — the viewer must never mutate the real one. */
const GAMEPLAY_ACTIVE_ROLES = new Set<BuildingRole>(['power', 'hq']);

/** The 28 freshly-generated buildings (review-only — none are active in gameplay). */
export const GENERATED_APPROVAL_ASSETS: ApprovalAsset[] = GENERATED_BUILDING_ASSETS.map((a) => ({
  assetKey: a.assetKey,
  batch: 'generated',
  factionId: a.factionId,
  factionName: a.factionName,
  buildingId: a.inferredBuildingId,
  role: a.inferredRole,
  modelPath: a.modelPath,
  activeInGameplay: false, // generated batch is not wired to gameplay
}));

/** The 12 GLBs already in the gameplay asset registry. */
export const ACTIVE_APPROVAL_ASSETS: ApprovalAsset[] = BUILDING_ASSETS.map((a) => ({
  assetKey: a.assetKey,
  batch: 'active',
  factionId: a.factionId,
  factionName: CANONICAL_FACTION[a.factionId],
  buildingId: a.buildingId,
  role: a.role,
  modelPath: a.modelPath,
  activeInGameplay: GAMEPLAY_ACTIVE_ROLES.has(a.role),
}));

/** Everything reviewable: 28 generated + 12 active. */
export const APPROVAL_ASSETS: ApprovalAsset[] = [...GENERATED_APPROVAL_ASSETS, ...ACTIVE_APPROVAL_ASSETS];

/** The default approval state for an asset. ALWAYS PENDING — never auto-approve. */
export function defaultApprovalRecord(asset: ApprovalAsset) {
  return {
    assetKey: asset.assetKey,
    status: 'PENDING' as ApprovalStatus,
    checklist: Object.fromEntries(APPROVAL_CHECKLIST_ITEMS.map((i) => [i, false])) as Record<ApprovalChecklistItem, boolean>,
  };
}

export function approvalAssetsForFaction(factionId: FactionId, batch?: ApprovalBatch): ApprovalAsset[] {
  return APPROVAL_ASSETS.filter((a) => a.factionId === factionId && (!batch || a.batch === batch));
}

export const APPROVAL_FACTIONS: { id: FactionId; label: string }[] = [
  { id: 'red', label: 'Crimson Pact' },
  { id: 'blue', label: 'Azure Concorde' },
  { id: 'green', label: 'Verdant Swarm' },
  { id: 'yellow', label: 'Solar Dominion' },
];
