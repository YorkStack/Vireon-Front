// Vehicle variant registry — collects every per-faction vehicle file.
// Lookup key: `${factionId}:${classId}`. Adding a new vehicle = add one file
// under src/vehicles/<faction>/ and register it here.

import type { VehicleVariant } from './types';

import { redHarvester } from './red/harvester';
import { redBuilder } from './red/builder';
import { redScout } from './red/scout';
import { redLightAttack } from './red/lightAttack';
import { redMediumTank } from './red/mediumTank';
import { redHeavyTank } from './red/heavyTank';
import { redAntiAir } from './red/antiAir';
import { redSupport } from './red/support';
import { redWarden } from './red/warden';

import { blueHarvester } from './blue/harvester';
import { blueBuilder } from './blue/builder';
import { blueScout } from './blue/scout';
import { blueLightAttack } from './blue/lightAttack';
import { blueMediumTank } from './blue/mediumTank';
import { blueHeavyTank } from './blue/heavyTank';
import { blueAntiAir } from './blue/antiAir';
import { blueSupport } from './blue/support';
import { blueWarden } from './blue/warden';

import { greenHarvester } from './green/harvester';
import { greenBuilder } from './green/builder';
import { greenScout } from './green/scout';
import { greenLightAttack } from './green/lightAttack';
import { greenMediumTank } from './green/mediumTank';
import { greenHeavyTank } from './green/heavyTank';
import { greenAntiAir } from './green/antiAir';
import { greenSupport } from './green/support';
import { greenWarden } from './green/warden';

import { yellowHarvester } from './yellow/harvester';
import { yellowBuilder } from './yellow/builder';
import { yellowScout } from './yellow/scout';
import { yellowLightAttack } from './yellow/lightAttack';
import { yellowMediumTank } from './yellow/mediumTank';
import { yellowHeavyTank } from './yellow/heavyTank';
import { yellowAntiAir } from './yellow/antiAir';
import { yellowSupport } from './yellow/support';
import { yellowWarden } from './yellow/warden';

const ALL: VehicleVariant[] = [
  redHarvester, redBuilder, redScout, redLightAttack,
  redMediumTank, redHeavyTank, redAntiAir, redSupport, redWarden,
  blueHarvester, blueBuilder, blueScout, blueLightAttack,
  blueMediumTank, blueHeavyTank, blueAntiAir, blueSupport, blueWarden,
  greenHarvester, greenBuilder, greenScout, greenLightAttack,
  greenMediumTank, greenHeavyTank, greenAntiAir, greenSupport, greenWarden,
  yellowHarvester, yellowBuilder, yellowScout, yellowLightAttack,
  yellowMediumTank, yellowHeavyTank, yellowAntiAir, yellowSupport, yellowWarden,
];

export const VEHICLE_VARIANTS = new Map<string, VehicleVariant>(
  ALL.map((v) => [`${v.factionId}:${v.classId}`, v]),
);

export function getVariant(factionId: string, classId: string): VehicleVariant | undefined {
  return VEHICLE_VARIANTS.get(`${factionId}:${classId}`);
}

export type { VehicleVariant } from './types';
