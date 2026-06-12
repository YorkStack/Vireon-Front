// Yellow support - faction visual variant.
// Solar Dominion: armored 4-legged walker - gyro-stabilized mech platform (concept sheet).
// Balance lives in src/data/unitClasses.ts ('support' template). This file only
// shapes how this faction's support LOOKS and moves. Extract & edit freely:
// chassis proportions, kit knobs, textureSetId - gameplay stats stay untouched
// unless you add an explicit balanceOverrides entry (with a reason).
import type { VehicleVariant } from '../types';

export const yellowSupport: VehicleVariant = {
  classId: 'support',
  factionId: 'yellow',
  movementType: 'walker',
  chassis: { style: 'walker', halfW: 0.75, len: 2.15, hullH: 0.55, legCount: 4, },
  textureSetId: 'yellow/support',
  artMetadataId: 'yellow_support',
  previewCamera: { distance: 7.1, height: 3.9 },
};
