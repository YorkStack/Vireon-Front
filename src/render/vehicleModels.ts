// Procedural vehicle model factory — builds faction-specific silhouettes.
//
//   chassis (running gear, faction identity)  ×  role kit (class identity)
//
// Chassis styles: tracked (Red), wheeled (Blue), hover (Green), monoWheel
// (Yellow) — defined per vehicle in src/vehicles/<faction>/<class>.ts, so a
// single vehicle's look can be tuned without touching anything else.
// Role kits guarantee class readability across factions: a harvester always
// shows a hopper+intake, a tank always a turret+cannon, AA always missile
// pods + radar, etc. Animation channels reuse the existing names
// (turret/spin/load) so world.ts animation code works unchanged.

import { A, P, box, cone, cyl, sph, type Part } from './models';
import type { ChassisSpec, VehicleVariant } from '../vehicles/types';

export interface VehicleBuild {
  parts: Part[];
  /** Pivot for the 'turret' animation group (if the kit has one). */
  turretPivot?: [number, number, number];
}

// ---------------- chassis builders (faction identity) ----------------
// Each returns the Y of the hull's top deck, where the role kit mounts.

function chassisTracked(p: Part[], c: ChassisSpec): number {
  for (const side of [-1, 1]) {
    p.push(P(box(0.42, 0.55, c.len), 'dark', side * c.halfW, 0.32, 0));
    p.push(P(box(0.46, 0.2, c.len * 1.02), 'dark', side * c.halfW, 0.5, 0));
    for (let i = 0; i < 4; i++) {
      p.push(P(cyl(0.16, 0.16, 0.1, 8), 'body', side * (c.halfW + 0.18), 0.22,
        -c.len / 2 + 0.35 + i * (c.len - 0.7) / 3, 0, 0, Math.PI / 2));
    }
  }
  const top = 0.6 + c.hullH;
  p.push(P(box(c.halfW * 1.7, c.hullH, c.len * 0.97), 'body', 0, 0.6 + c.hullH / 2));
  p.push(P(box(c.halfW * 1.76, 0.1, c.len), 'dark', 0, top + 0.03));
  // Angular glacis plate — aggressive Red language.
  p.push(P(box(c.halfW * 1.1, 0.16, 0.7), 'body', 0, top - 0.12, c.len / 2 - 0.2, -0.4));
  return top;
}

function chassisWheeled(p: Part[], c: ChassisSpec): number {
  const wheels = c.wheelCount ?? 3;
  for (const side of [-1, 1]) {
    for (let i = 0; i < wheels; i++) {
      const z = -c.len / 2 + 0.42 + i * (c.len - 0.84) / Math.max(1, wheels - 1);
      p.push(P(cyl(0.3, 0.3, 0.22, 12), 'dark', side * c.halfW, 0.3, z, 0, 0, Math.PI / 2));
      p.push(P(cyl(0.12, 0.12, 0.24, 8), 'body', side * c.halfW, 0.3, z, 0, 0, Math.PI / 2));
    }
    // Clean fender line — disciplined Blue language.
    p.push(P(box(0.34, 0.1, c.len * 0.96), 'body', side * c.halfW, 0.66, 0));
  }
  const top = 0.72 + c.hullH;
  p.push(P(box(c.halfW * 1.6, c.hullH, c.len * 0.94), 'body', 0, 0.72 + c.hullH / 2));
  p.push(P(box(c.halfW * 1.66, 0.08, c.len * 0.97), 'dark', 0, top + 0.02));
  // Sensor blade — technical look.
  p.push(P(box(0.06, 0.3, 0.06), 'dark', c.halfW * 0.9, top + 0.18, -c.len / 2 + 0.3));
  p.push(P(sph(0.05, 6), 'light', c.halfW * 0.9, top + 0.36, -c.len / 2 + 0.3));
  return top;
}

function chassisHover(p: Part[], c: ChassisSpec): number {
  // Beveled skirt instead of running gear — sleek Green language.
  p.push(P(box(c.halfW * 2.0, 0.3, c.len), 'dark', 0, 0.5, 0, 0, 0, 0, 1, 1, 1));
  p.push(P(box(c.halfW * 1.7, 0.18, c.len * 0.84), 'dark', 0, 0.34));
  if (c.skirtGlow) {
    p.push(P(box(c.halfW * 1.9, 0.06, c.len * 0.94), 'accent', 0, 0.42));
  }
  const top = 0.66 + c.hullH;
  // Rounded-feeling hull: main slab + tapered nose cap.
  p.push(P(box(c.halfW * 1.6, c.hullH, c.len * 0.9), 'body', 0, 0.66 + c.hullH / 2));
  p.push(P(cone(c.halfW * 0.8, 0.7, 6), 'body', 0, 0.66 + c.hullH * 0.5, c.len / 2 - 0.1, Math.PI / 2));
  p.push(P(box(c.halfW * 1.66, 0.08, c.len * 0.92), 'dark', 0, top + 0.02));
  return top;
}

function chassisMonoWheel(p: Part[], c: ChassisSpec): number {
  const r = c.wheelRadius ?? 0.62;
  // One big central drive wheel — exotic Yellow language.
  p.push(P(cyl(r, r, 0.36, 16), 'dark', 0, r, 0, 0, 0, Math.PI / 2));
  p.push(P(cyl(r * 0.55, r * 0.55, 0.4, 10), 'accent', 0, r, 0, 0, 0, Math.PI / 2));
  // Outrigger struts with caster spheres (stability feel).
  for (const side of [-1, 1]) {
    p.push(P(box(0.1, 0.1, c.len * 0.8), 'body', side * c.halfW, r * 0.7, 0));
    p.push(P(sph(0.14, 8), 'dark', side * c.halfW, 0.16, c.len / 2 - 0.3));
    p.push(P(sph(0.14, 8), 'dark', side * c.halfW, 0.16, -c.len / 2 + 0.3));
  }
  const top = r + 0.15 + c.hullH;
  // Hull straddles the wheel.
  p.push(P(box(c.halfW * 1.9, c.hullH, c.len * 0.8), 'body', 0, r + 0.15 + c.hullH / 2));
  p.push(P(box(c.halfW * 1.96, 0.08, c.len * 0.84), 'dark', 0, top + 0.02));
  return top;
}

function buildChassis(p: Part[], c: ChassisSpec): number {
  switch (c.style) {
    case 'tracked': return chassisTracked(p, c);
    case 'wheeled': return chassisWheeled(p, c);
    case 'hover': return chassisHover(p, c);
    case 'monoWheel': return chassisMonoWheel(p, c);
  }
}

// ---------------- role kits (class identity) ----------------
// Mount on the hull top deck; keep the class readable at RTS zoom.

function kitHarvester(p: Part[], top: number, c: ChassisSpec) {
  p.push(
    P(box(c.halfW * 1.45, 0.85, c.len * 0.5), 'body', 0, top + 0.45, -c.len * 0.18),   // hopper
    A('load', P(box(c.halfW * 1.2, 0.55, c.len * 0.42), 'accent', 0, top + 0.8, -c.len * 0.18)),
    P(box(c.halfW * 1.5, 0.5, 0.8), 'dark', 0, 0.55, c.len * 0.6, 0.55),               // intake scoop
    P(cyl(0.12, 0.12, c.halfW * 1.6, 8), 'dark', 0, 0.6, c.len * 0.58, 0, 0, Math.PI / 2), // drum
    P(box(0.8, 0.45, 0.55), 'body', 0, top + 0.25, c.len * 0.3),                       // cab
    P(box(0.65, 0.12, 0.4), 'light', 0, top + 0.32, c.len * 0.38),                     // glass
    P(cyl(0.09, 0.12, 0.55, 6), 'dark', -c.halfW * 0.6, top + 0.4, -c.len * 0.4),      // exhaust
  );
}

function kitBuilder(p: Part[], top: number, c: ChassisSpec) {
  p.push(
    P(box(c.halfW * 1.35, 0.55, 0.7), 'accent', 0, top + 0.3, -c.len * 0.25),          // cab
    P(box(c.halfW * 1.1, 0.12, 0.5), 'light', 0, top + 0.36, -c.len * 0.05),           // window strip
    P(box(0.2, 0.2, c.len * 0.75), 'body', c.halfW * 0.35, top + 0.65, c.len * 0.2, -0.55), // crane boom
    P(box(0.16, 0.4, 0.16), 'dark', c.halfW * 0.35, top + 0.95, c.len * 0.45),         // crane head
    P(box(0.5, 0.3, 0.5), 'dark', -c.halfW * 0.5, top + 0.2, c.len * 0.18),            // toolbox
    A('spin', P(box(0.08, 0.3, 0.08), 'accent', -c.halfW * 0.5, top + 0.5, c.len * 0.18)), // beacon
  );
}

function kitScout(p: Part[], top: number, c: ChassisSpec) {
  p.push(
    P(cone(c.halfW * 0.65, 0.9, 5), 'body', 0, top - 0.1, c.len / 2 + 0.25, Math.PI / 2), // nose
    P(box(0.5, 0.1, 0.5), 'light', 0, top + 0.08, c.len * 0.1),                        // canopy
    P(cyl(0.13, 0.13, 0.9, 8), 'accent', -c.halfW * 0.8, top - 0.15, -c.len * 0.15, Math.PI / 2), // pods
    P(cyl(0.13, 0.13, 0.9, 8), 'accent', c.halfW * 0.8, top - 0.15, -c.len * 0.15, Math.PI / 2),
    P(box(0.06, 0.06, 0.7), 'dark', 0, top + 0.05, c.len * 0.45),                      // repeater
  );
}

function kitLightAttack(p: Part[], top: number, c: ChassisSpec): [number, number, number] {
  const pivot: [number, number, number] = [0, top + 0.12, 0.1];
  p.push(
    A('turret', P(box(0.55, 0.26, 0.62), 'body', 0, top + 0.25, 0.1)),
    A('turret', P(cyl(0.05, 0.06, 0.95, 8), 'dark', 0, top + 0.25, 0.75, Math.PI / 2)),
    A('turret', P(box(0.18, 0.1, 0.2), 'accent', 0, top + 0.42, 0.0)),
    P(box(0.4, 0.1, 0.4), 'dark', 0, top + 0.06, 0.1),                                  // turret base
    P(box(0.12, 0.18, 0.12), 'light', -c.halfW * 0.7, top + 0.1, -c.len * 0.3),         // tail light
  );
  return pivot;
}

function kitMediumTank(p: Part[], top: number, c: ChassisSpec): [number, number, number] {
  const pivot: [number, number, number] = [0, top + 0.26, -0.05];
  p.push(
    P(cyl(0.52, 0.6, 0.42, 12), 'body', 0, top + 0.26),                                  // turret ring
    P(cyl(0.04, 0.04, 0.6, 6), 'dark', c.halfW * 0.55, top + 0.9, -c.len * 0.19),        // antenna
    A('turret', P(box(0.78, 0.34, 0.95), 'body', 0, top + 0.5, -0.05)),
    A('turret', P(box(0.5, 0.12, 0.5), 'accent', 0, top + 0.72)),
    A('turret', P(cyl(0.08, 0.09, 1.45, 8), 'dark', 0, top + 0.5, 1.0, Math.PI / 2)),     // cannon
    A('turret', P(cyl(0.11, 0.11, 0.26, 8), 'dark', 0, top + 0.5, 1.65, Math.PI / 2)),    // muzzle
    A('turret', P(box(0.2, 0.12, 0.2), 'light', 0.3, top + 0.45, 0.45)),
  );
  return pivot;
}

function kitHeavyTank(p: Part[], top: number, c: ChassisSpec): [number, number, number] {
  const pivot: [number, number, number] = [0, top + 0.25, -0.55];
  p.push(
    P(box(0.34, 0.55, c.len * 0.65), 'accent', -c.halfW * 0.95, top + 0.2, -0.1),        // side armor
    P(box(0.34, 0.55, c.len * 0.65), 'accent', c.halfW * 0.95, top + 0.2, -0.1),
    P(box(0.85, 0.25, 0.9), 'dark', 0, 0.5, -c.len * 0.58),                              // rear spade
    P(cyl(0.1, 0.13, 0.7, 6), 'dark', -c.halfW * 0.65, top + 0.5, -c.len * 0.42),        // stacks
    P(cyl(0.1, 0.13, 0.7, 6), 'dark', c.halfW * 0.65, top + 0.5, -c.len * 0.42),
    A('turret', P(box(1.0, 0.6, 1.25), 'body', 0, top + 0.55, -0.55)),
    A('turret', P(box(0.7, 0.16, 0.6), 'light', 0, top + 0.65, 0.15)),
    A('turret', P(cyl(0.13, 0.16, 2.3, 10), 'dark', 0, top + 0.95, 0.6, Math.PI / 2 - 0.45)), // howitzer
    A('turret', P(cyl(0.18, 0.18, 0.3, 8), 'dark', 0, top + 1.35, 1.45, Math.PI / 2 - 0.45)),
  );
  return pivot;
}

function kitAntiAir(p: Part[], top: number, c: ChassisSpec): [number, number, number] {
  const pivot: [number, number, number] = [0, top + 0.15, -0.1];
  p.push(
    P(cyl(0.4, 0.48, 0.3, 10), 'body', 0, top + 0.15, -0.1),                             // mount
    A('turret', P(box(0.34, 0.34, 0.95), 'body', -0.35, top + 0.5, -0.1, -0.5)),         // missile pods (angled)
    A('turret', P(box(0.34, 0.34, 0.95), 'body', 0.35, top + 0.5, -0.1, -0.5)),
    A('turret', P(box(0.28, 0.28, 0.1), 'accent', -0.35, top + 0.68, 0.28, -0.5)),       // pod faces
    A('turret', P(box(0.28, 0.28, 0.1), 'accent', 0.35, top + 0.68, 0.28, -0.5)),
    A('spin', P(box(0.7, 0.05, 0.12), 'dark', 0, top + 0.95, -0.1)),                     // radar bar
    A('spin', P(sph(0.07, 6), 'light', 0.32, top + 0.98, -0.1)),
    P(box(0.5, 0.16, 0.4), 'dark', 0, top + 0.08, c.len * 0.3),                          // sensor cab
  );
  return pivot;
}

function kitSupport(p: Part[], top: number, c: ChassisSpec) {
  p.push(
    P(box(c.halfW * 1.3, 0.5, c.len * 0.45), 'body', 0, top + 0.27, -c.len * 0.15),      // workshop
    P(box(c.halfW * 1.0, 0.1, c.len * 0.35), 'light', 0, top + 0.55, -c.len * 0.15),     // skylight
    P(cyl(0.3, 0.05, 0.18, 10), 'accent', 0, top + 0.75, c.len * 0.22),                  // repair dish
    A('spin', P(box(0.06, 0.42, 0.06), 'accent', 0, top + 1.0, c.len * 0.22)),           // antenna
    P(box(0.14, 0.14, c.len * 0.5), 'dark', -c.halfW * 0.8, top + 0.3, 0.1, -0.3),       // tool arms
    P(box(0.14, 0.14, c.len * 0.5), 'dark', c.halfW * 0.8, top + 0.3, 0.1, -0.3),
  );
}

/** Builds the full part list for a faction vehicle variant. */
export function buildVehicleParts(variant: VehicleVariant): VehicleBuild {
  const p: Part[] = [];
  const top = buildChassis(p, variant.chassis);
  let turretPivot: [number, number, number] | undefined;
  switch (variant.classId) {
    case 'harvester': kitHarvester(p, top, variant.chassis); break;
    case 'builder': kitBuilder(p, top, variant.chassis); break;
    case 'scout': kitScout(p, top, variant.chassis); break;
    case 'lightAttack': turretPivot = kitLightAttack(p, top, variant.chassis); break;
    case 'mediumTank': turretPivot = kitMediumTank(p, top, variant.chassis); break;
    case 'heavyTank': turretPivot = kitHeavyTank(p, top, variant.chassis); break;
    case 'antiAir': turretPivot = kitAntiAir(p, top, variant.chassis); break;
    case 'support': kitSupport(p, top, variant.chassis); break;
  }
  return { parts: p, turretPivot };
}
