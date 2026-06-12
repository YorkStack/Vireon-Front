// Blue scout - faction visual variant.
// Azure Concord: wheeled precision vehicles - 4-wheel configuration, disciplined, technical.
// Balance lives in src/data/unitClasses.ts ('scout' template). This file only
// shapes how this faction's scout LOOKS and moves. Extract & edit freely:
// chassis proportions, kit knobs, textureSetId - gameplay stats stay untouched
// unless you add an explicit balanceOverrides entry (with a reason).
import type { VehicleVariant } from '../types';

export const blueScout: VehicleVariant = {
  classId: 'scout',
  factionId: 'blue',
  movementType: 'wheeled',
  chassis: { style: 'wheeled', halfW: 0.6, len: 1.7, hullH: 0.35, wheelCount: 2, },
  textureSetId: 'blue/scout',
  artMetadataId: 'blue_scout',
  previewCamera: { distance: 6.1, height: 3.4 },
};
