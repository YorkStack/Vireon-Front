// Red antiAir - faction visual variant.
// Crimson Pact: heavy tracked war machines - broad, angular, aggressive.
// Balance lives in src/data/unitClasses.ts ('antiAir' template). This file only
// shapes how this faction's antiAir LOOKS and moves. Extract & edit freely:
// chassis proportions, kit knobs, textureSetId - gameplay stats stay untouched
// unless you add an explicit balanceOverrides entry (with a reason).
import type { VehicleVariant } from '../types';

export const redAntiAir: VehicleVariant = {
  classId: 'antiAir',
  factionId: 'red',
  movementType: 'tracked',
  chassis: { style: 'tracked', halfW: 0.85, len: 2.0, hullH: 0.5, },
  textureSetId: 'red/anti_air',
  artMetadataId: 'red_antiAir',
  previewCamera: { distance: 6.8, height: 3.7 },
};
