// Red builder - faction visual variant.
// Crimson Pact: heavy tracked war machines - broad, angular, aggressive.
// Balance lives in src/data/unitClasses.ts ('builder' template). This file only
// shapes how this faction's builder LOOKS and moves. Extract & edit freely:
// chassis proportions, kit knobs, textureSetId - gameplay stats stay untouched
// unless you add an explicit balanceOverrides entry (with a reason).
import type { VehicleVariant } from '../types';

export const redBuilder: VehicleVariant = {
  classId: 'builder',
  factionId: 'red',
  movementType: 'tracked',
  chassis: { style: 'tracked', halfW: 0.9, len: 2.2, hullH: 0.6, },
  textureSetId: 'red/builder',
  artMetadataId: 'red_builder',
  previewCamera: { distance: 7.3, height: 4.0 },
};
