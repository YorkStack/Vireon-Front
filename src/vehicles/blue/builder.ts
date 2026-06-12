// Blue builder - faction visual variant.
// Azure Concord: wheeled precision vehicles - disciplined, technical.
// Balance lives in src/data/unitClasses.ts ('builder' template). This file only
// shapes how this faction's builder LOOKS and moves. Extract & edit freely:
// chassis proportions, kit knobs, textureSetId - gameplay stats stay untouched
// unless you add an explicit balanceOverrides entry (with a reason).
import type { VehicleVariant } from '../types';

export const blueBuilder: VehicleVariant = {
  classId: 'builder',
  factionId: 'blue',
  movementType: 'wheeled',
  chassis: { style: 'wheeled', halfW: 0.85, len: 2.2, hullH: 0.6, wheelCount: 3, },
  textureSetId: 'blue/builder',
  artMetadataId: 'blue_builder',
  previewCamera: { distance: 7.3, height: 4.0 },
};
