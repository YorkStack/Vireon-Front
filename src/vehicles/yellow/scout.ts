// Yellow scout - faction visual variant.
// Solar Dominion: exotic mono-wheel platforms - unusual alien mechanics.
// Balance lives in src/data/unitClasses.ts ('scout' template). This file only
// shapes how this faction's scout LOOKS and moves. Extract & edit freely:
// chassis proportions, kit knobs, textureSetId - gameplay stats stay untouched
// unless you add an explicit balanceOverrides entry (with a reason).
import type { VehicleVariant } from '../types';

export const yellowScout: VehicleVariant = {
  classId: 'scout',
  factionId: 'yellow',
  movementType: 'monoWheel',
  chassis: { style: 'monoWheel', halfW: 0.53, len: 1.7, hullH: 0.35, wheelRadius: 0.62, },
  textureSetId: 'yellow/scout',
  artMetadataId: 'yellow_scout',
  previewCamera: { distance: 6.1, height: 3.4 },
};
