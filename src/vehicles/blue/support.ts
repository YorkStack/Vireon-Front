// Blue support - faction visual variant.
// Azure Concord: wheeled precision vehicles - 6-wheel configuration, disciplined, technical.
// Balance lives in src/data/unitClasses.ts ('support' template). This file only
// shapes how this faction's support LOOKS and moves. Extract & edit freely:
// chassis proportions, kit knobs, textureSetId - gameplay stats stay untouched
// unless you add an explicit balanceOverrides entry (with a reason).
import type { VehicleVariant } from '../types';

export const blueSupport: VehicleVariant = {
  classId: 'support',
  factionId: 'blue',
  movementType: 'wheeled',
  chassis: { style: 'wheeled', halfW: 0.85, len: 2.15, hullH: 0.55, wheelCount: 3, },
  textureSetId: 'blue/support',
  artMetadataId: 'blue_support',
  previewCamera: { distance: 7.1, height: 3.9 },
};
