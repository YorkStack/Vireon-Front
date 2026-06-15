// Yellow warden - faction visual variant (procedural fallback).
// Solar Dominion: heavy armoured walker - wide stance, ponderous and tanky.
// Balance lives in src/data/unitClasses.ts ('warden' template). This file only
// shapes how this faction's warden LOOKS and moves.
import type { VehicleVariant } from '../types';

export const yellowWarden: VehicleVariant = {
  classId: 'warden',
  factionId: 'yellow',
  movementType: 'walker',
  chassis: { style: 'walker', halfW: 1.35, len: 3.0, hullH: 1.05, legCount: 6, },
  textureSetId: 'yellow/warden',
  artMetadataId: 'yellow_warden',
  previewCamera: { distance: 8.2, height: 4.8 },
};
