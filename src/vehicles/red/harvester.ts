// Red harvester - faction visual variant.
// Crimson Pact: heavy tracked war machines - broad, angular, aggressive.
// Balance lives in src/data/unitClasses.ts ('harvester' template). This file only
// shapes how this faction's harvester LOOKS and moves. Extract & edit freely:
// chassis proportions, kit knobs, textureSetId - gameplay stats stay untouched
// unless you add an explicit balanceOverrides entry (with a reason).
import type { VehicleVariant } from '../types';

export const redHarvester: VehicleVariant = {
  classId: 'harvester',
  factionId: 'red',
  movementType: 'tracked',
  chassis: { style: 'tracked', halfW: 1.01, len: 2.45, hullH: 0.7, },
  textureSetId: 'red/harvester',
  artMetadataId: 'red_harvester',
  previewCamera: { distance: 7.8, height: 4.3 },
};
