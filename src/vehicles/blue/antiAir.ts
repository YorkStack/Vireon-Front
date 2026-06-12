// Blue antiAir - faction visual variant.
// Azure Concord: wheeled precision vehicles - disciplined, technical.
// Balance lives in src/data/unitClasses.ts ('antiAir' template). This file only
// shapes how this faction's antiAir LOOKS and moves. Extract & edit freely:
// chassis proportions, kit knobs, textureSetId - gameplay stats stay untouched
// unless you add an explicit balanceOverrides entry (with a reason).
import type { VehicleVariant } from '../types';

export const blueAntiAir: VehicleVariant = {
  classId: 'antiAir',
  factionId: 'blue',
  movementType: 'wheeled',
  chassis: { style: 'wheeled', halfW: 0.8, len: 2.0, hullH: 0.5, wheelCount: 3, },
  textureSetId: 'blue/anti_air',
  artMetadataId: 'blue_antiAir',
  previewCamera: { distance: 6.8, height: 3.7 },
};
