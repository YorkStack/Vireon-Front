// Green antiAir - faction visual variant.
// Verdant Swarm: grav/hover vehicles - sleek, efficient, semi-organic.
// Balance lives in src/data/unitClasses.ts ('antiAir' template). This file only
// shapes how this faction's antiAir LOOKS and moves. Extract & edit freely:
// chassis proportions, kit knobs, textureSetId - gameplay stats stay untouched
// unless you add an explicit balanceOverrides entry (with a reason).
import type { VehicleVariant } from '../types';

export const greenAntiAir: VehicleVariant = {
  classId: 'antiAir',
  factionId: 'green',
  movementType: 'hover',
  chassis: { style: 'hover', halfW: 0.74, len: 2.16, hullH: 0.5, skirtGlow: true, },
  textureSetId: 'green/anti_air',
  artMetadataId: 'green_antiAir',
  previewCamera: { distance: 7.2, height: 4.0 },
};
