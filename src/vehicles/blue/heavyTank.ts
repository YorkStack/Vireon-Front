// Blue heavyTank - faction visual variant.
// Azure Concord: wheeled precision vehicles - disciplined, technical.
// Balance lives in src/data/unitClasses.ts ('heavyTank' template). This file only
// shapes how this faction's heavyTank LOOKS and moves. Extract & edit freely:
// chassis proportions, kit knobs, textureSetId - gameplay stats stay untouched
// unless you add an explicit balanceOverrides entry (with a reason).
import type { VehicleVariant } from '../types';

export const blueHeavyTank: VehicleVariant = {
  classId: 'heavyTank',
  factionId: 'blue',
  movementType: 'wheeled',
  chassis: { style: 'wheeled', halfW: 1.05, len: 2.6, hullH: 0.65, wheelCount: 3, },
  textureSetId: 'blue/heavy_tank',
  artMetadataId: 'blue_heavyTank',
  previewCamera: { distance: 8.2, height: 4.5 },
};
