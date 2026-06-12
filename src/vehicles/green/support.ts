// Green support - faction visual variant.
// Verdant Swarm: grav/hover vehicles - sleek, efficient, semi-organic.
// Balance lives in src/data/unitClasses.ts ('support' template). This file only
// shapes how this faction's support LOOKS and moves. Extract & edit freely:
// chassis proportions, kit knobs, textureSetId - gameplay stats stay untouched
// unless you add an explicit balanceOverrides entry (with a reason).
import type { VehicleVariant } from '../types';

export const greenSupport: VehicleVariant = {
  classId: 'support',
  factionId: 'green',
  movementType: 'hover',
  chassis: { style: 'hover', halfW: 0.78, len: 2.32, hullH: 0.55, skirtGlow: true, },
  textureSetId: 'green/support',
  artMetadataId: 'green_support',
  previewCamera: { distance: 7.5, height: 4.1 },
};
