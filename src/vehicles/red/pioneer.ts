// Red pioneer - faction visual variant (procedural fallback).
// Crimson Pact "Pact Landcleaver": a tracked industrial forestry dozer - blunt
// blade, saw drums and a grinder maw. Robust and straightforward.
// Balance lives in src/data/unitClasses.ts ('pioneer' template). This file only
// shapes how this faction's pioneer LOOKS and moves.
import type { VehicleVariant } from '../types';

export const redPioneer: VehicleVariant = {
  classId: 'pioneer',
  factionId: 'red',
  displayName: 'Pact Landcleaver',
  movementType: 'tracked',
  chassis: { style: 'tracked', halfW: 1.1, len: 2.9, hullH: 0.85 },
  textureSetId: 'red/pioneer',
  artMetadataId: 'red_pioneer',
  previewCamera: { distance: 8.0, height: 4.6 },
};
