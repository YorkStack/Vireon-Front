// Red mediumTank - faction visual variant.
// Crimson Pact: heavy tracked war machines - broad, angular, aggressive.
// Balance lives in src/data/unitClasses.ts ('mediumTank' template). This file only
// shapes how this faction's mediumTank LOOKS and moves. Extract & edit freely:
// chassis proportions, kit knobs, textureSetId - gameplay stats stay untouched
// unless you add an explicit balanceOverrides entry (with a reason).
import type { VehicleVariant } from '../types';

export const redMediumTank: VehicleVariant = {
  classId: 'mediumTank',
  factionId: 'red',
  movementType: 'tracked',
  chassis: { style: 'tracked', halfW: 0.87, len: 2.1, hullH: 0.5, },
  textureSetId: 'red/medium_tank',
  artMetadataId: 'red_mediumTank',
  previewCamera: { distance: 7.0, height: 3.9 },
};
