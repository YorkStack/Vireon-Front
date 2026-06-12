// Yellow builder - faction visual variant.
// Solar Dominion: exotic mono-wheel platforms - unusual alien mechanics.
// Balance lives in src/data/unitClasses.ts ('builder' template). This file only
// shapes how this faction's builder LOOKS and moves. Extract & edit freely:
// chassis proportions, kit knobs, textureSetId - gameplay stats stay untouched
// unless you add an explicit balanceOverrides entry (with a reason).
import type { VehicleVariant } from '../types';

export const yellowBuilder: VehicleVariant = {
  classId: 'builder',
  factionId: 'yellow',
  movementType: 'monoWheel',
  chassis: { style: 'monoWheel', halfW: 0.75, len: 2.2, hullH: 0.6, wheelRadius: 0.62, },
  textureSetId: 'yellow/builder',
  artMetadataId: 'yellow_builder',
  previewCamera: { distance: 7.3, height: 4.0 },
};
