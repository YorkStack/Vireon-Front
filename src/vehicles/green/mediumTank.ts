// Green mediumTank - faction visual variant.
// Verdant Swarm: grav/hover vehicles - sleek, efficient, semi-organic.
// Balance lives in src/data/unitClasses.ts ('mediumTank' template). This file only
// shapes how this faction's mediumTank LOOKS and moves. Extract & edit freely:
// chassis proportions, kit knobs, textureSetId - gameplay stats stay untouched
// unless you add an explicit balanceOverrides entry (with a reason).
import type { VehicleVariant } from '../types';

export const greenMediumTank: VehicleVariant = {
  classId: 'mediumTank',
  factionId: 'green',
  movementType: 'hover',
  chassis: { style: 'hover', halfW: 0.75, len: 2.27, hullH: 0.5, skirtGlow: true, },
  textureSetId: 'green/medium_tank',
  artMetadataId: 'green_mediumTank',
  previewCamera: { distance: 7.4, height: 4.1 },
};
