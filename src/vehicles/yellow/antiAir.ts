// Yellow antiAir - faction visual variant.
// Solar Dominion: exotic mono-wheel platforms - unusual alien mechanics.
// Balance lives in src/data/unitClasses.ts ('antiAir' template). This file only
// shapes how this faction's antiAir LOOKS and moves. Extract & edit freely:
// chassis proportions, kit knobs, textureSetId - gameplay stats stay untouched
// unless you add an explicit balanceOverrides entry (with a reason).
import type { VehicleVariant } from '../types';

export const yellowAntiAir: VehicleVariant = {
  classId: 'antiAir',
  factionId: 'yellow',
  movementType: 'monoWheel',
  chassis: { style: 'monoWheel', halfW: 0.7, len: 2.0, hullH: 0.5, wheelRadius: 0.62, },
  textureSetId: 'yellow/anti_air',
  artMetadataId: 'yellow_antiAir',
  previewCamera: { distance: 6.8, height: 3.7 },
};
