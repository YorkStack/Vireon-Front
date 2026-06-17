// Crystal resource NODE logic — pure, side-effect-free helpers.
//
// World Phase 1b — Foundation only. These functions describe how a crystal node
// is created, how depleted it is, and which visual stage it should show. They are
// PREPARED for a future depletion-visual / special-spawn pass but are not yet
// wired into the live harvest loop (world.ts) — so they cannot change balance.
//
// The canonical CrystalNode lives in map.ts and was extended with optional
// fields; existing nodes (and saved maps) stay compatible because every new
// field is optional with a safe default.

import type { CrystalNode } from '../map/map';
import {
  type CrystalResourceType,
  type CrystalVisualSize,
  getCrystalYieldMultiplier,
} from '../data/crystalAssets';

/** Discrete depletion phase derived from amount/max. Decoupled from intrinsic size. */
export type CrystalVisualStage = 'full' | 'reduced' | 'depleted';

/** Fraction thresholds for the stages. Deterministic; pure function of amount/max. */
export const CRYSTAL_STAGE_REDUCED_BELOW = 0.5; // amount/max < 0.5 → reduced (until depleted)

/** Default resource type for a freshly-generated node (today: always 'default'). */
export const DEFAULT_CRYSTAL_RESOURCE_TYPE: CrystalResourceType = 'default';

/**
 * Derive the visual depletion stage from remaining/max.
 * full   : amount/max >= 0.5
 * reduced: 0 < amount/max < 0.5
 * depleted: amount <= 0 (or max <= 0)
 */
export function getCrystalVisualStage(amount: number, max: number): CrystalVisualStage {
  if (amount <= 0 || max <= 0) return 'depleted';
  return amount / max < CRYSTAL_STAGE_REDUCED_BELOW ? 'reduced' : 'full';
}

/** A node is depleted once nothing remains. */
export function isCrystalDepleted(node: Pick<CrystalNode, 'amount'>): boolean {
  return node.amount <= 0;
}

/** Yield multiplier for a node, defaulting to the `default` family (×1) when unset. */
export function crystalNodeYieldMultiplier(node: Pick<CrystalNode, 'resourceType' | 'yieldMultiplier'>): number {
  if (typeof node.yieldMultiplier === 'number') return node.yieldMultiplier;
  return getCrystalYieldMultiplier(node.resourceType ?? DEFAULT_CRYSTAL_RESOURCE_TYPE);
}

/** Map an `amount/max` capacity to an intrinsic size bucket (for asset selection). */
export function crystalSizeFromMax(max: number): CrystalVisualSize {
  if (max >= 5000) return 'large';
  if (max >= 2500) return 'medium';
  return 'small';
}

export interface CreateCrystalNodeArgs {
  id: number;
  tx: number;
  tz: number;
  amount: number;
  max?: number; // defaults to amount (a full node)
  resourceType?: CrystalResourceType;
}

/**
 * Build a fully-formed CrystalNode with safe defaults for the new optional fields.
 * Mirrors today's spawn shape (`{id,tx,tz,amount,max}`) and adds the prepared
 * resource metadata. Does NOT change how nodes are placed in map.ts.
 */
export function createDefaultCrystalNode(args: CreateCrystalNodeArgs): CrystalNode {
  const max = args.max ?? args.amount;
  const resourceType = args.resourceType ?? DEFAULT_CRYSTAL_RESOURCE_TYPE;
  return {
    id: args.id,
    tx: args.tx,
    tz: args.tz,
    amount: args.amount,
    max,
    resourceType,
    yieldMultiplier: getCrystalYieldMultiplier(resourceType),
    visualSize: crystalSizeFromMax(max),
    visualStage: getCrystalVisualStage(args.amount, max),
  };
}

/**
 * Pure helper: given a node after `amount` was reduced, return the fields a future
 * visual pass would refresh. PREPARED — not called by the live harvest loop yet,
 * so it cannot affect balance. Lets the eventual wiring stay a one-line change.
 */
export function updateCrystalAfterHarvest(node: CrystalNode): { visualStage: CrystalVisualStage; depleted: boolean } {
  const stage = getCrystalVisualStage(node.amount, node.max);
  return { visualStage: stage, depleted: stage === 'depleted' };
}
