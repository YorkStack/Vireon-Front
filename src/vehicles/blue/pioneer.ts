// Blue pioneer - faction visual variant (procedural fallback).
// Azure Concorde "Hydro-Shear Pioneer": an elegant hover skimmer with
// water/sonic cutting equipment - clean lines, narrow profile, underside glow.
// Balance lives in src/data/unitClasses.ts ('pioneer' template). This file only
// shapes how this faction's pioneer LOOKS and moves.
import type { VehicleVariant } from '../types';

export const bluePioneer: VehicleVariant = {
  classId: 'pioneer',
  factionId: 'blue',
  displayName: 'Hydro-Shear Pioneer',
  movementType: 'hover',
  chassis: { style: 'hover', halfW: 0.95, len: 2.7, hullH: 0.7, skirtGlow: true },
  textureSetId: 'blue/pioneer',
  artMetadataId: 'blue_pioneer',
  previewCamera: { distance: 8.0, height: 4.6 },
};
