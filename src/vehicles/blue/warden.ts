// Blue warden - faction visual variant (procedural fallback).
// Azure Concord: sleek hi-tech strider - precise legs, narrow profile.
// Balance lives in src/data/unitClasses.ts ('warden' template). This file only
// shapes how this faction's warden LOOKS and moves.
import type { VehicleVariant } from '../types';

export const blueWarden: VehicleVariant = {
  classId: 'warden',
  factionId: 'blue',
  movementType: 'walker',
  chassis: { style: 'walker', halfW: 1.1, len: 3.2, hullH: 0.85, legCount: 6, },
  textureSetId: 'blue/warden',
  artMetadataId: 'blue_warden',
  previewCamera: { distance: 8.0, height: 4.6 },
};
