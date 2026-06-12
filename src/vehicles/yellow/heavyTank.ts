// Yellow heavyTank - faction visual variant.
// Solar Dominion: armored 6-legged walker - gyro-stabilized mech platform (concept sheet).
// Balance lives in src/data/unitClasses.ts ('heavyTank' template). This file only
// shapes how this faction's heavyTank LOOKS and moves. Extract & edit freely:
// chassis proportions, kit knobs, textureSetId - gameplay stats stay untouched
// unless you add an explicit balanceOverrides entry (with a reason).
import type { VehicleVariant } from '../types';

export const yellowHeavyTank: VehicleVariant = {
  classId: 'heavyTank',
  factionId: 'yellow',
  movementType: 'walker',
  chassis: { style: 'walker', halfW: 0.92, len: 2.6, hullH: 0.65, legCount: 6, },
  textureSetId: 'yellow/heavy_tank',
  artMetadataId: 'yellow_heavyTank',
  previewCamera: { distance: 8.2, height: 4.5 },
};
