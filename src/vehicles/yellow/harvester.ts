// Yellow harvester - faction visual variant.
// Solar Dominion: gyro mono-wheel - dominant armored ring, hub cab inside, no outriggers (concept sheet).
// Balance lives in src/data/unitClasses.ts ('harvester' template). This file only
// shapes how this faction's harvester LOOKS and moves. Extract & edit freely:
// chassis proportions, kit knobs, textureSetId - gameplay stats stay untouched
// unless you add an explicit balanceOverrides entry (with a reason).
import type { VehicleVariant } from '../types';

export const yellowHarvester: VehicleVariant = {
  classId: 'harvester',
  factionId: 'yellow',
  movementType: 'monoWheel',
  chassis: { style: 'monoWheel', halfW: 0.84, len: 2.45, hullH: 0.7, wheelRadius: 0.8, },
  textureSetId: 'yellow/harvester',
  artMetadataId: 'yellow_harvester',
  previewCamera: { distance: 7.8, height: 4.3 },
};
