// Yellow support - faction visual variant.
// Solar Dominion: exotic mono-wheel platforms - unusual alien mechanics.
// Balance lives in src/data/unitClasses.ts ('support' template). This file only
// shapes how this faction's support LOOKS and moves. Extract & edit freely:
// chassis proportions, kit knobs, textureSetId - gameplay stats stay untouched
// unless you add an explicit balanceOverrides entry (with a reason).
import type { VehicleVariant } from '../types';

export const yellowSupport: VehicleVariant = {
  classId: 'support',
  factionId: 'yellow',
  movementType: 'monoWheel',
  chassis: { style: 'monoWheel', halfW: 0.75, len: 2.15, hullH: 0.55, wheelRadius: 0.62, },
  textureSetId: 'yellow/support',
  artMetadataId: 'yellow_support',
  previewCamera: { distance: 7.1, height: 3.9 },
};
