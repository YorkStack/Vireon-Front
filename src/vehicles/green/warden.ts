// Green warden - faction visual variant (factory-authored runtime GLB).
// Verdant Swarm: six-legged organic assault walker with a living-vein cannon.
// This is the canonical Warden — its baked GLB (green_warden.glb) is preferred
// at render time; the chassis below is the procedural fallback silhouette.
// Balance lives in src/data/unitClasses.ts ('warden' template).
import type { VehicleVariant } from '../types';

export const greenWarden: VehicleVariant = {
  classId: 'warden',
  factionId: 'green',
  movementType: 'walker',
  chassis: { style: 'walker', halfW: 1.2, len: 3.1, hullH: 0.9, legCount: 6, },
  textureSetId: 'green/warden',
  artMetadataId: 'green_warden',
  previewCamera: { distance: 8.0, height: 4.6 },
};
