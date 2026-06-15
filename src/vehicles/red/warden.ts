// Red warden - faction visual variant (procedural fallback).
// Crimson Pact: heavy, angular war machine - a brutal stomping siege walker.
// Balance lives in src/data/unitClasses.ts ('warden' template). This file only
// shapes how this faction's warden LOOKS and moves.
import type { VehicleVariant } from '../types';

export const redWarden: VehicleVariant = {
  classId: 'warden',
  factionId: 'red',
  movementType: 'walker',
  chassis: { style: 'walker', halfW: 1.25, len: 3.0, hullH: 1.0, legCount: 6, },
  textureSetId: 'red/warden',
  artMetadataId: 'red_warden',
  previewCamera: { distance: 8.0, height: 4.6 },
};
