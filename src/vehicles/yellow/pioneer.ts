// Yellow pioneer - faction visual variant (procedural fallback).
// Solar Dominion "Lumen Grader": a ponderous solar/thermal sterilizer crawler -
// wide stance, focusing lens array and a scorching grading blade.
// Balance lives in src/data/unitClasses.ts ('pioneer' template). This file only
// shapes how this faction's pioneer LOOKS and moves.
import type { VehicleVariant } from '../types';

export const yellowPioneer: VehicleVariant = {
  classId: 'pioneer',
  factionId: 'yellow',
  displayName: 'Lumen Grader',
  movementType: 'tracked',
  chassis: { style: 'tracked', halfW: 1.2, len: 2.9, hullH: 0.95 },
  textureSetId: 'yellow/pioneer',
  artMetadataId: 'yellow_pioneer',
  previewCamera: { distance: 8.2, height: 4.8 },
};
