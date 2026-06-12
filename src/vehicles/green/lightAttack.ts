// Green lightAttack - faction visual variant.
// Verdant Swarm: grav/hover vehicles - sleek, efficient, semi-organic.
// Balance lives in src/data/unitClasses.ts ('lightAttack' template). This file only
// shapes how this faction's lightAttack LOOKS and moves. Extract & edit freely:
// chassis proportions, kit knobs, textureSetId - gameplay stats stay untouched
// unless you add an explicit balanceOverrides entry (with a reason).
import type { VehicleVariant } from '../types';

export const greenLightAttack: VehicleVariant = {
  classId: 'lightAttack',
  factionId: 'green',
  movementType: 'hover',
  chassis: { style: 'hover', halfW: 0.64, len: 2.05, hullH: 0.45, skirtGlow: true, },
  textureSetId: 'green/light_attack',
  artMetadataId: 'green_lightAttack',
  previewCamera: { distance: 6.9, height: 3.8 },
};
