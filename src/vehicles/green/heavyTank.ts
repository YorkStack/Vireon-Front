// Green heavyTank - faction visual variant.
// Verdant Swarm: grav/hover vehicles - sleek, efficient, semi-organic.
// Balance lives in src/data/unitClasses.ts ('heavyTank' template). This file only
// shapes how this faction's heavyTank LOOKS and moves. Extract & edit freely:
// chassis proportions, kit knobs, textureSetId - gameplay stats stay untouched
// unless you add an explicit balanceOverrides entry (with a reason).
import type { VehicleVariant } from '../types';

export const greenHeavyTank: VehicleVariant = {
  classId: 'heavyTank',
  factionId: 'green',
  movementType: 'hover',
  chassis: { style: 'hover', halfW: 0.97, len: 2.81, hullH: 0.65, skirtGlow: true, },
  textureSetId: 'green/heavy_tank',
  artMetadataId: 'green_heavyTank',
  previewCamera: { distance: 8.7, height: 4.8 },
};
