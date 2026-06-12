// Red support - faction visual variant.
// Crimson Pact: heavy tracked war machines - broad, angular, aggressive.
// Balance lives in src/data/unitClasses.ts ('support' template). This file only
// shapes how this faction's support LOOKS and moves. Extract & edit freely:
// chassis proportions, kit knobs, textureSetId - gameplay stats stay untouched
// unless you add an explicit balanceOverrides entry (with a reason).
import type { VehicleVariant } from '../types';

export const redSupport: VehicleVariant = {
  classId: 'support',
  factionId: 'red',
  movementType: 'tracked',
  chassis: { style: 'tracked', halfW: 0.9, len: 2.15, hullH: 0.55, },
  textureSetId: 'red/support',
  artMetadataId: 'red_support',
  previewCamera: { distance: 7.1, height: 3.9 },
};
