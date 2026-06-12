// Yellow lightAttack - faction visual variant.
// Solar Dominion: exotic mono-wheel platforms - unusual alien mechanics.
// Balance lives in src/data/unitClasses.ts ('lightAttack' template). This file only
// shapes how this faction's lightAttack LOOKS and moves. Extract & edit freely:
// chassis proportions, kit knobs, textureSetId - gameplay stats stay untouched
// unless you add an explicit balanceOverrides entry (with a reason).
import type { VehicleVariant } from '../types';

export const yellowLightAttack: VehicleVariant = {
  classId: 'lightAttack',
  factionId: 'yellow',
  movementType: 'monoWheel',
  chassis: { style: 'monoWheel', halfW: 0.62, len: 1.9, hullH: 0.45, wheelRadius: 0.62, },
  textureSetId: 'yellow/light_attack',
  artMetadataId: 'yellow_lightAttack',
  previewCamera: { distance: 6.6, height: 3.6 },
};
