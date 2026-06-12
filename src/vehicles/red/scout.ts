// Red scout - faction visual variant.
// Crimson Pact: heavy tracked war machines - broad, angular, aggressive.
// Balance lives in src/data/unitClasses.ts ('scout' template). This file only
// shapes how this faction's scout LOOKS and moves. Extract & edit freely:
// chassis proportions, kit knobs, textureSetId - gameplay stats stay untouched
// unless you add an explicit balanceOverrides entry (with a reason).
import type { VehicleVariant } from '../types';

export const redScout: VehicleVariant = {
  classId: 'scout',
  factionId: 'red',
  movementType: 'tracked',
  chassis: { style: 'tracked', halfW: 0.64, len: 1.7, hullH: 0.35, },
  textureSetId: 'red/scout',
  artMetadataId: 'red_scout',
  previewCamera: { distance: 6.1, height: 3.4 },
};
