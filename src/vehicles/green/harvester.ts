// Green harvester - faction visual variant.
// Verdant Swarm: grav/hover vehicles - sleek, efficient, semi-organic.
// Balance lives in src/data/unitClasses.ts ('harvester' template). This file only
// shapes how this faction's harvester LOOKS and moves. Extract & edit freely:
// chassis proportions, kit knobs, textureSetId - gameplay stats stay untouched
// unless you add an explicit balanceOverrides entry (with a reason).
import type { VehicleVariant } from '../types';

export const greenHarvester: VehicleVariant = {
  classId: 'harvester',
  factionId: 'green',
  movementType: 'hover',
  chassis: { style: 'hover', halfW: 0.87, len: 2.65, hullH: 0.7, skirtGlow: true, },
  textureSetId: 'green/harvester',
  artMetadataId: 'green_harvester',
  previewCamera: { distance: 8.3, height: 4.6 },
};
