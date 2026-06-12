/// <reference types="vite/client" />
// Imported vehicle-spec geometry (produced by the design studio, copied here by
// `npm run import:vehicle`). The factory prefers an imported spec over the
// procedural model — unless the art status is `needsRevision` (revert hatch).
//
// Specs are eager-globbed at build time: a freshly imported JSON appears after a
// dev-server restart / rebuild (import is a build-time action, not hot).
import type { VehicleSpec } from './spec/vehicleSpec';
import { ART_METADATA } from '../data/artMetadata';

const GLOB = import.meta.glob('./specs/*/*.json', { eager: true, import: 'default' }) as Record<string, VehicleSpec>;

/** Pure decision: which imported spec (if any) to prefer. Exposed for tests. */
export function chooseImportedSpec(
  specMap: Record<string, VehicleSpec>,
  faction: string,
  classId: string,
  status?: string,
): VehicleSpec | null {
  if (status === 'needsRevision') return null;
  const suffix = `/specs/${faction}/${classId}.json`;
  for (const k in specMap) if (k.endsWith(suffix)) return specMap[k];
  return null;
}

/** The wired lookup used by the factory. */
export function importedSpecFor(faction: string, classId: string): VehicleSpec | null {
  return chooseImportedSpec(GLOB, faction, classId, ART_METADATA[`${faction}_${classId}`]?.status);
}
