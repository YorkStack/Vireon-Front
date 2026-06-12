// Green builder - faction visual variant.
// Verdant Swarm: grav/hover vehicles - sleek, efficient, semi-organic.
// Balance lives in src/data/unitClasses.ts ('builder' template). This file only
// shapes how this faction's builder LOOKS and moves. Extract & edit freely:
// chassis proportions, kit knobs, textureSetId - gameplay stats stay untouched
// unless you add an explicit balanceOverrides entry (with a reason).
import type { VehicleVariant } from '../types';

export const greenBuilder: VehicleVariant = {
  classId: 'builder',
  factionId: 'green',
  movementType: 'hover',
  chassis: { style: 'hover', halfW: 0.78, len: 2.38, hullH: 0.6, skirtGlow: true, },
  textureSetId: 'green/builder',
  artMetadataId: 'green_builder',
  previewCamera: { distance: 7.7, height: 4.2 },
};
