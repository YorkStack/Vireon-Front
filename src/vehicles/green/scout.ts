// Green scout - faction visual variant.
// Verdant Swarm: grav/hover vehicles - sleek, efficient, semi-organic.
// Balance lives in src/data/unitClasses.ts ('scout' template). This file only
// shapes how this faction's scout LOOKS and moves. Extract & edit freely:
// chassis proportions, kit knobs, textureSetId - gameplay stats stay untouched
// unless you add an explicit balanceOverrides entry (with a reason).
import type { VehicleVariant } from '../types';

export const greenScout: VehicleVariant = {
  classId: 'scout',
  factionId: 'green',
  movementType: 'hover',
  chassis: { style: 'hover', halfW: 0.55, len: 1.84, hullH: 0.35, skirtGlow: true, },
  textureSetId: 'green/scout',
  artMetadataId: 'green_scout',
  previewCamera: { distance: 6.4, height: 3.5 },
};
