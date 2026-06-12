// Red heavyTank - faction visual variant.
// Crimson Pact: heavy tracked war machines - broad, angular, aggressive.
// Balance lives in src/data/unitClasses.ts ('heavyTank' template). This file only
// shapes how this faction's heavyTank LOOKS and moves. Extract & edit freely:
// chassis proportions, kit knobs, textureSetId - gameplay stats stay untouched
// unless you add an explicit balanceOverrides entry (with a reason).
import type { VehicleVariant } from '../types';

export const redHeavyTank: VehicleVariant = {
  classId: 'heavyTank',
  factionId: 'red',
  movementType: 'tracked',
  chassis: { style: 'tracked', halfW: 1.11, len: 2.6, hullH: 0.65, },
  textureSetId: 'red/heavy_tank',
  artMetadataId: 'red_heavyTank',
  previewCamera: { distance: 8.2, height: 4.5 },
};
