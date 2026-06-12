// Red lightAttack - faction visual variant.
// Crimson Pact: heavy tracked war machines - broad, angular, aggressive.
// Balance lives in src/data/unitClasses.ts ('lightAttack' template). This file only
// shapes how this faction's lightAttack LOOKS and moves. Extract & edit freely:
// chassis proportions, kit knobs, textureSetId - gameplay stats stay untouched
// unless you add an explicit balanceOverrides entry (with a reason).
import type { VehicleVariant } from '../types';

export const redLightAttack: VehicleVariant = {
  classId: 'lightAttack',
  factionId: 'red',
  movementType: 'tracked',
  chassis: { style: 'tracked', halfW: 0.74, len: 1.9, hullH: 0.45, },
  textureSetId: 'red/light_attack',
  artMetadataId: 'red_lightAttack',
  previewCamera: { distance: 6.6, height: 3.6 },
};
