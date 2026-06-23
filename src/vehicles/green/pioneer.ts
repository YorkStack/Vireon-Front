// Green pioneer - faction visual variant (procedural fallback).
// Verdant Swarm "Swarm Root-Eater": an insectoid bio-grinder beast-machine -
// six low legs, chewing mandibles and enzyme glands that mulch organic growth.
// Balance lives in src/data/unitClasses.ts ('pioneer' template). This file only
// shapes how this faction's pioneer LOOKS and moves.
import type { VehicleVariant } from '../types';

export const greenPioneer: VehicleVariant = {
  classId: 'pioneer',
  factionId: 'green',
  displayName: 'Swarm Root-Eater',
  movementType: 'walker',
  chassis: { style: 'walker', halfW: 1.0, len: 2.8, hullH: 0.8, legCount: 6 },
  textureSetId: 'green/pioneer',
  artMetadataId: 'green_pioneer',
  previewCamera: { distance: 8.0, height: 4.6 },
};
