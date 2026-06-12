// Blue harvester - faction visual variant.
// Azure Concord: wheeled precision vehicles - 8-wheel configuration, disciplined, technical.
// Balance lives in src/data/unitClasses.ts ('harvester' template). This file only
// shapes how this faction's harvester LOOKS and moves. Extract & edit freely:
// chassis proportions, kit knobs, textureSetId - gameplay stats stay untouched
// unless you add an explicit balanceOverrides entry (with a reason).
import type { VehicleVariant } from '../types';

export const blueHarvester: VehicleVariant = {
  classId: 'harvester',
  factionId: 'blue',
  movementType: 'wheeled',
  chassis: { style: 'wheeled', halfW: 0.95, len: 2.45, hullH: 0.7, wheelCount: 4, },
  textureSetId: 'blue/harvester',
  artMetadataId: 'blue_harvester',
  previewCamera: { distance: 7.8, height: 4.3 },
};
