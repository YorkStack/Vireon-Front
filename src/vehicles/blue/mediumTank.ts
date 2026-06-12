// Blue mediumTank - faction visual variant.
// Azure Concord: wheeled precision vehicles - disciplined, technical.
// Balance lives in src/data/unitClasses.ts ('mediumTank' template). This file only
// shapes how this faction's mediumTank LOOKS and moves. Extract & edit freely:
// chassis proportions, kit knobs, textureSetId - gameplay stats stay untouched
// unless you add an explicit balanceOverrides entry (with a reason).
import type { VehicleVariant } from '../types';

export const blueMediumTank: VehicleVariant = {
  classId: 'mediumTank',
  factionId: 'blue',
  movementType: 'wheeled',
  chassis: { style: 'wheeled', halfW: 0.82, len: 2.1, hullH: 0.5, wheelCount: 3, },
  textureSetId: 'blue/medium_tank',
  artMetadataId: 'blue_mediumTank',
  previewCamera: { distance: 7.0, height: 3.9 },
};
