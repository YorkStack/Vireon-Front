// Blue lightAttack - faction visual variant.
// Azure Concord: wheeled precision vehicles - 4-wheel configuration, disciplined, technical.
// Balance lives in src/data/unitClasses.ts ('lightAttack' template). This file only
// shapes how this faction's lightAttack LOOKS and moves. Extract & edit freely:
// chassis proportions, kit knobs, textureSetId - gameplay stats stay untouched
// unless you add an explicit balanceOverrides entry (with a reason).
import type { VehicleVariant } from '../types';

export const blueLightAttack: VehicleVariant = {
  classId: 'lightAttack',
  factionId: 'blue',
  movementType: 'wheeled',
  chassis: { style: 'wheeled', halfW: 0.7, len: 1.9, hullH: 0.45, wheelCount: 2, },
  textureSetId: 'blue/light_attack',
  artMetadataId: 'blue_lightAttack',
  previewCamera: { distance: 6.6, height: 3.6 },
};
