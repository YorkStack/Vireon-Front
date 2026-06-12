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

import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { A, P, box, cone, cyl, sph, torus, type Part } from './models';
import type { ChassisSpec, VehicleVariant } from '../vehicles/types';

/** Rounded (chamfered) box — hulls, turrets and cabs use this so vehicles
 * read as machined armor instead of raw voxels. Radius scales with size. */
const rbox = (w: number, h: number, d: number, r?: number) =>
  new RoundedBoxGeometry(w, h, d, 2, r ?? Math.min(0.09, Math.min(w, h, d) * 0.22));

export interface VehicleBuild {
  parts: Part[];
  /** Pivot for the 'turret' animation group (if the kit has one). */
  turretPivot?: [number, number, number];
}

// ---------------- chassis builders (faction identity) ----------------
// Each returns the Y of the hull's top deck, where the role kit mounts.

function chassisTracked(p: Part[], c: ChassisSpec): number {
  for (const side of [-1, 1]) {
    p.push(P(rbox(0.42, 0.55, c.len, 0.12), 'dark', side * c.halfW, 0.32, 0));
    p.push(P(rbox(0.46, 0.2, c.len * 1.02, 0.07), 'dark', side * c.halfW, 0.5, 0));
    for (let i = 0; i < 4; i++) {
      p.push(P(cyl(0.16, 0.16, 0.1, 12), 'body', side * (c.halfW + 0.18), 0.22,
        -c.len / 2 + 0.35 + i * (c.len - 0.7) / 3, 0, 0, Math.PI / 2));
    }
  }
  const top = 0.6 + c.hullH;
  p.push(P(rbox(c.halfW * 1.7, c.hullH, c.len * 0.97), 'body', 0, 0.6 + c.hullH / 2));
  p.push(P(rbox(c.halfW * 1.76, 0.1, c.len, 0.04), 'dark', 0, top + 0.03));
  // Chamfered glacis plate — aggressive Red language.
  p.push(P(rbox(c.halfW * 1.1, 0.16, 0.7, 0.05), 'body', 0, top - 0.12, c.len / 2 - 0.2, -0.4));
  return top;
}

function chassisWheeled(p: Part[], c: ChassisSpec): number {
  const wheels = c.wheelCount ?? 3;
  for (const side of [-1, 1]) {
    for (let i = 0; i < wheels; i++) {
      const z = -c.len / 2 + 0.42 + i * (c.len - 0.84) / Math.max(1, wheels - 1);
      p.push(P(cyl(0.3, 0.3, 0.22, 18), 'dark', side * c.halfW, 0.3, z, 0, 0, Math.PI / 2));
      p.push(P(cyl(0.12, 0.12, 0.24, 12), 'body', side * c.halfW, 0.3, z, 0, 0, Math.PI / 2));
    }
    // Clean rounded fender line — disciplined Blue language.
    p.push(P(rbox(0.34, 0.12, c.len * 0.96, 0.05), 'body', side * c.halfW, 0.66, 0));
  }
  const top = 0.72 + c.hullH;
  p.push(P(rbox(c.halfW * 1.6, c.hullH, c.len * 0.94), 'body', 0, 0.72 + c.hullH / 2));
  p.push(P(rbox(c.halfW * 1.66, 0.08, c.len * 0.97, 0.03), 'dark', 0, top + 0.02));
  // Sensor blade — technical look.
  p.push(P(rbox(0.07, 0.3, 0.07, 0.02), 'dark', c.halfW * 0.9, top + 0.18, -c.len / 2 + 0.3));
  p.push(P(sph(0.05, 8), 'light', c.halfW * 0.9, top + 0.36, -c.len / 2 + 0.3));
  return top;
}

function chassisHover(p: Part[], c: ChassisSpec): number {
  // Rounded skirt instead of running gear — sleek Green language.
  p.push(P(rbox(c.halfW * 2.0, 0.3, c.len, 0.12), 'dark', 0, 0.5));
  p.push(P(rbox(c.halfW * 1.7, 0.18, c.len * 0.84, 0.08), 'dark', 0, 0.34));
  if (c.skirtGlow) {
    p.push(P(rbox(c.halfW * 1.9, 0.06, c.len * 0.94, 0.025), 'accent', 0, 0.42));
  }
  const top = 0.66 + c.hullH;
  // Rounded hull slab + smooth tapered nose cap.
  p.push(P(rbox(c.halfW * 1.6, c.hullH, c.len * 0.9, 0.12), 'body', 0, 0.66 + c.hullH / 2));
  p.push(P(cone(c.halfW * 0.8, 0.7, 12), 'body', 0, 0.66 + c.hullH * 0.5, c.len / 2 - 0.1, Math.PI / 2));
  p.push(P(rbox(c.halfW * 1.66, 0.08, c.len * 0.92, 0.03), 'dark', 0, top + 0.02));
  return top;
}

/**
 * Gyro mono-wheel (Solar Dominion), v3: TWIN armored rings forming one wide
 * drive wheel with a free central channel — the gyro hub cab and the entire
 * role kit grow OUT OF THE HUB between the rings instead of perching on a
 * saddle above the wheel. Slim side weapon arms, no outrigger casters.
 */
function chassisMonoWheel(p: Part[], c: ChassisSpec): number {
  const r = c.wheelRadius ?? 0.62;
  const rx = Math.max(0.34, c.halfW * 0.8 + 0.08); // ring offset from centre
  for (const side of [-1, 1]) {
    // Tread ring + energy rim per side.
    p.push(P(torus(r, 0.15), 'dark', side * rx, r, 0, 0, Math.PI / 2));
    p.push(P(torus(r * 0.72, 0.045), 'accent', side * rx, r, 0, 0, Math.PI / 2));
    // Structural spokes (Titan frame).
    p.push(P(rbox(0.07, r * 1.3, 0.12, 0.02), 'body', side * rx, r, 0));
    p.push(P(rbox(0.07, 0.12, r * 1.3, 0.02), 'body', side * rx, r, 0));
    // Axle caps.
    p.push(P(cyl(0.16, 0.16, 0.14, 14), 'dark', side * (rx + 0.12), r, 0, 0, 0, Math.PI / 2));
  }
  // Cross-drum axle + gyro hub cab in the CENTRE (between the rings).
  p.push(P(cyl(0.2, 0.2, rx * 2, 14), 'dark', 0, r, 0, 0, 0, Math.PI / 2));
  p.push(P(rbox(rx * 1.5, 0.62, 0.85, 0.16), 'body', 0, r + 0.05, 0));
  p.push(P(rbox(rx * 1.1, 0.14, 0.18, 0.05), 'light', 0, r + 0.16, 0.42));   // canopy
  p.push(P(rbox(0.3, 0.1, 0.3, 0.03), 'dark', 0, r - 0.28, 0.3));            // chin sensor
  // Side weapon/sensor arms at hub height (Waffen-Schwenkmechanismus).
  for (const side of [-1, 1]) {
    p.push(P(rbox(0.34, 0.1, 0.1, 0.03), 'body', side * (rx + 0.28), r, 0.05));
    p.push(P(cyl(0.05, 0.05, 0.55, 10), 'dark', side * (rx + 0.42), r, 0.3, Math.PI / 2));
    p.push(P(sph(0.05, 8), 'accent', side * (rx + 0.42), r, 0.6));
  }
  // Kit deck = hub top, slightly above the axle — the superstructure rises
  // from the middle of the wheel, the rings frame it left and right.
  return r + 0.36;
}

/**
 * Multi-leg walker (Solar Dominion heavies), v2: thick armored legs CONNECTED
 * through a hip skirt/pelvis block under the body (no floating joints), knee
 * spheres and gripper foot pads — per the mech concept sheet.
 */
function chassisWalker(p: Part[], c: ChassisSpec): number {
  const legs = c.legCount ?? 4;
  const perSide = legs / 2;
  const hipY = 0.95;
  // Pelvis/hip skirt connecting all legs to the hull.
  p.push(P(rbox(c.halfW * 1.95, 0.3, c.len * 0.78, 0.1), 'dark', 0, hipY, 0));
  for (const side of [-1, 1]) {
    for (let i = 0; i < perSide; i++) {
      const z = perSide === 1 ? 0 : -c.len * 0.32 + i * (c.len * 0.64) / (perSide - 1);
      const hx = side * c.halfW * 0.95;
      // hip actuator, thick upper leg, knee, thick lower leg, foot pad
      p.push(P(cyl(0.15, 0.15, 0.26, 14), 'body', hx, hipY, z, 0, 0, Math.PI / 2));
      p.push(P(rbox(0.22, 0.55, 0.3, 0.07), 'body', hx + side * 0.18, hipY - 0.24, z, 0, 0, side * 0.55));
      p.push(P(sph(0.15, 12), 'dark', hx + side * 0.34, hipY - 0.48, z));
      p.push(P(rbox(0.18, 0.55, 0.24, 0.06), 'dark', hx + side * 0.28, hipY - 0.72, z, 0, 0, -side * 0.22));
      p.push(P(cyl(0.06, 0.06, 0.3, 8), 'accent', hx + side * 0.36, hipY - 0.7, z, 0, 0, -side * 0.22)); // hydraulic
      p.push(P(rbox(0.32, 0.1, 0.42, 0.04), 'dark', hx + side * 0.22, 0.06, z));
      p.push(P(rbox(0.1, 0.08, 0.14, 0.03), 'dark', hx + side * 0.22, 0.07, z + 0.26)); // gripper toe
    }
  }
  const top = hipY + 0.12 + c.hullH;
  // Raised armored body with rounded edges + vent block (cooling louvres).
  p.push(P(rbox(c.halfW * 1.55, c.hullH, c.len * 0.72, 0.13), 'body', 0, hipY + 0.12 + c.hullH / 2));
  p.push(P(rbox(c.halfW * 1.6, 0.09, c.len * 0.75, 0.04), 'dark', 0, top + 0.02));
  p.push(P(rbox(0.3, 0.18, 0.3, 0.04), 'dark', -c.halfW * 0.7, top - 0.06, -c.len * 0.28));
  p.push(P(rbox(0.32, 0.05, 0.05, 0.02), 'accent', -c.halfW * 0.7, top + 0.06, -c.len * 0.28));
  return top;
}

/**
 * Half-track (Azure heavy gear): steerable front wheels + rear track blocks.
 */
function chassisHalfTrack(p: Part[], c: ChassisSpec): number {
  // Front wheels (one big steering wheel per side).
  for (const side of [-1, 1]) {
    const z = c.len / 2 - 0.42;
    p.push(P(cyl(0.34, 0.34, 0.24, 18), 'dark', side * c.halfW, 0.34, z, 0, 0, Math.PI / 2));
    p.push(P(cyl(0.14, 0.14, 0.26, 12), 'body', side * c.halfW, 0.34, z, 0, 0, Math.PI / 2));
    p.push(P(rbox(0.36, 0.1, 0.5, 0.04), 'body', side * c.halfW, 0.7, z));     // wheel fender
    // Rear track blocks.
    p.push(P(rbox(0.42, 0.5, c.len * 0.52, 0.1), 'dark', side * c.halfW, 0.3, -c.len * 0.2));
    p.push(P(rbox(0.46, 0.18, c.len * 0.54, 0.06), 'dark', side * c.halfW, 0.48, -c.len * 0.2));
    for (let i = 0; i < 3; i++) {
      p.push(P(cyl(0.13, 0.13, 0.1, 12), 'body', side * (c.halfW + 0.17), 0.2,
        -c.len * 0.42 + i * c.len * 0.21, 0, 0, Math.PI / 2));
    }
  }
  const top = 0.68 + c.hullH;
  p.push(P(rbox(c.halfW * 1.6, c.hullH, c.len * 0.95), 'body', 0, 0.68 + c.hullH / 2));
  p.push(P(rbox(c.halfW * 1.66, 0.08, c.len * 0.97, 0.03), 'dark', 0, top + 0.02));
  return top;
}

function buildChassis(p: Part[], c: ChassisSpec): number {
  switch (c.style) {
    case 'tracked': return chassisTracked(p, c);
    case 'wheeled': return chassisWheeled(p, c);
    case 'hover': return chassisHover(p, c);
    case 'monoWheel': return chassisMonoWheel(p, c);
    case 'walker': return chassisWalker(p, c);
    case 'halfTrack': return chassisHalfTrack(p, c);
  }
}

/**
 * Detail/greeble pass (+60% Detail): maintenance hatches, air intakes,
 * cooler ribs, antennas, headlights, tow hooks and class-appropriate spares
 * (track links / reserve fuel drums). Deterministic per chassis so templates
 * stay cacheable; merged into the same draw calls, so it costs nothing per
 * frame.
 */
function addDetails(p: Part[], top: number, c: ChassisSpec, classId: string) {
  const w = c.halfW, l = c.len;
  // Crew hatch with hinge.
  p.push(P(cyl(0.14, 0.16, 0.06, 12), 'dark', -w * 0.5, top + 0.07, -l * 0.08));
  p.push(P(rbox(0.06, 0.04, 0.1, 0.015), 'body', -w * 0.5, top + 0.1, -l * 0.02));
  // Air intakes (paired, with accent slit) on the deck.
  for (const side of [-1, 1]) {
    p.push(P(rbox(0.18, 0.1, 0.3, 0.03), 'dark', side * w * 0.78, top + 0.08, l * 0.12));
    p.push(P(rbox(0.12, 0.03, 0.22, 0.012), 'accent', side * w * 0.78, top + 0.14, l * 0.12));
  }
  // Cooler ribs (rear deck).
  for (let i = 0; i < 3; i++) {
    p.push(P(rbox(w * 0.7, 0.05, 0.05, 0.015), 'dark', 0.1, top + 0.07, -l * 0.34 + i * 0.12));
  }
  // Antenna + blinker.
  p.push(P(cyl(0.015, 0.02, 0.55, 6), 'dark', w * 0.7, top + 0.3, -l * 0.3));
  p.push(P(sph(0.035, 6), 'accent', w * 0.7, top + 0.58, -l * 0.3));
  // Headlights + tow hooks.
  for (const side of [-1, 1]) {
    p.push(P(rbox(0.1, 0.07, 0.05, 0.02), 'light', side * w * 0.55, top - 0.18, l * 0.49));
    p.push(P(rbox(0.08, 0.1, 0.1, 0.025), 'dark', side * w * 0.4, 0.42, l * 0.5));
    p.push(P(rbox(0.08, 0.1, 0.1, 0.025), 'dark', side * w * 0.4, 0.42, -l * 0.5));
  }
  // Class-appropriate spares.
  if (c.style === 'tracked' || c.style === 'halfTrack') {
    // Spare track links bolted to the glacis.
    for (let i = 0; i < 3; i++) {
      p.push(P(rbox(0.18, 0.05, 0.26, 0.015), 'dark', -w * 0.55 + i * 0.24, top - 0.06, l * 0.42));
    }
  }
  if (classId === 'heavyTank' || classId === 'support' || classId === 'harvester') {
    // Reserve fuel drums on the rear deck.
    for (const side of [-1, 1]) {
      p.push(P(cyl(0.11, 0.11, 0.34, 12), 'body', side * w * 0.55, top + 0.12, -l * 0.42, Math.PI / 2));
      p.push(P(rbox(0.26, 0.03, 0.05, 0.01), 'dark', side * w * 0.55, top + 0.24, -l * 0.42));
    }
  }
  // Side stowage boxes (Werkzeug/Ersatzteile).
  p.push(P(rbox(0.12, 0.18, l * 0.3, 0.04), 'dark', w * 1.02, top - 0.16, -l * 0.05));
}

// ---------------- role kits (class identity) ----------------
// Mount on the hull top deck; keep the class readable at RTS zoom.

function kitHarvester(p: Part[], top: number, c: ChassisSpec) {
  p.push(
    P(rbox(c.halfW * 1.45, 0.85, c.len * 0.5, 0.12), 'body', 0, top + 0.45, -c.len * 0.18), // hopper
    A('load', P(rbox(c.halfW * 1.2, 0.55, c.len * 0.42, 0.08), 'accent', 0, top + 0.8, -c.len * 0.18)),
    P(rbox(c.halfW * 1.5, 0.5, 0.8, 0.1), 'dark', 0, 0.55, c.len * 0.6, 0.55),          // intake scoop
    P(cyl(0.12, 0.12, c.halfW * 1.6, 12), 'dark', 0, 0.6, c.len * 0.58, 0, 0, Math.PI / 2), // drum
    P(rbox(0.8, 0.45, 0.55, 0.1), 'body', 0, top + 0.25, c.len * 0.3),                  // cab
    P(rbox(0.65, 0.12, 0.4, 0.04), 'light', 0, top + 0.32, c.len * 0.38),               // glass
    P(cyl(0.09, 0.12, 0.55, 10), 'dark', -c.halfW * 0.6, top + 0.4, -c.len * 0.4),      // exhaust
  );
}

function kitBuilder(p: Part[], top: number, c: ChassisSpec) {
  p.push(
    P(rbox(c.halfW * 1.35, 0.55, 0.7, 0.12), 'accent', 0, top + 0.3, -c.len * 0.25),    // cab
    P(rbox(c.halfW * 1.1, 0.12, 0.5, 0.04), 'light', 0, top + 0.36, -c.len * 0.05),     // window strip
    P(rbox(0.2, 0.2, c.len * 0.75, 0.06), 'body', c.halfW * 0.35, top + 0.65, c.len * 0.2, -0.55), // crane boom
    P(rbox(0.16, 0.4, 0.16, 0.05), 'dark', c.halfW * 0.35, top + 0.95, c.len * 0.45),   // crane head
    P(rbox(0.5, 0.3, 0.5, 0.08), 'dark', -c.halfW * 0.5, top + 0.2, c.len * 0.18),      // toolbox
    A('spin', P(rbox(0.08, 0.3, 0.08, 0.025), 'accent', -c.halfW * 0.5, top + 0.5, c.len * 0.18)), // beacon
  );
}

function kitScout(p: Part[], top: number, c: ChassisSpec) {
  p.push(
    P(cone(c.halfW * 0.65, 0.9, 10), 'body', 0, top - 0.1, c.len / 2 + 0.25, Math.PI / 2), // nose
    P(rbox(0.5, 0.1, 0.5, 0.04), 'light', 0, top + 0.08, c.len * 0.1),                  // canopy
    P(cyl(0.13, 0.13, 0.9, 12), 'accent', -c.halfW * 0.8, top - 0.15, -c.len * 0.15, Math.PI / 2), // pods
    P(cyl(0.13, 0.13, 0.9, 12), 'accent', c.halfW * 0.8, top - 0.15, -c.len * 0.15, Math.PI / 2),
    P(rbox(0.07, 0.07, 0.7, 0.02), 'dark', 0, top + 0.05, c.len * 0.45),                // repeater
  );
}

function kitLightAttack(p: Part[], top: number, c: ChassisSpec): [number, number, number] {
  const pivot: [number, number, number] = [0, top + 0.12, 0.1];
  p.push(
    A('turret', P(rbox(0.55, 0.26, 0.62, 0.08), 'body', 0, top + 0.25, 0.1)),
    A('turret', P(cyl(0.05, 0.06, 0.95, 10), 'dark', 0, top + 0.25, 0.75, Math.PI / 2)),
    A('turret', P(rbox(0.18, 0.1, 0.2, 0.03), 'accent', 0, top + 0.42, 0.0)),
    P(cyl(0.26, 0.3, 0.1, 14), 'dark', 0, top + 0.06, 0.1),                              // turret base
    P(rbox(0.12, 0.18, 0.12, 0.04), 'light', -c.halfW * 0.7, top + 0.1, -c.len * 0.3),   // tail light
  );
  return pivot;
}

function kitMediumTank(p: Part[], top: number, c: ChassisSpec): [number, number, number] {
  const pivot: [number, number, number] = [0, top + 0.26, -0.05];
  p.push(
    P(cyl(0.52, 0.6, 0.42, 18), 'body', 0, top + 0.26),                                  // turret ring
    P(cyl(0.04, 0.04, 0.6, 8), 'dark', c.halfW * 0.55, top + 0.9, -c.len * 0.19),        // antenna
    A('turret', P(rbox(0.78, 0.34, 0.95, 0.1), 'body', 0, top + 0.5, -0.05)),
    A('turret', P(rbox(0.5, 0.12, 0.5, 0.04), 'accent', 0, top + 0.72)),
    A('turret', P(cyl(0.08, 0.09, 1.45, 12), 'dark', 0, top + 0.5, 1.0, Math.PI / 2)),    // cannon
    A('turret', P(cyl(0.11, 0.11, 0.26, 12), 'dark', 0, top + 0.5, 1.65, Math.PI / 2)),   // muzzle
    A('turret', P(rbox(0.2, 0.12, 0.2, 0.04), 'light', 0.3, top + 0.45, 0.45)),
  );
  return pivot;
}

function kitHeavyTank(p: Part[], top: number, c: ChassisSpec): [number, number, number] {
  const pivot: [number, number, number] = [0, top + 0.25, -0.55];
  p.push(
    P(rbox(0.34, 0.55, c.len * 0.65, 0.1), 'accent', -c.halfW * 0.95, top + 0.2, -0.1),  // side armor
    P(rbox(0.34, 0.55, c.len * 0.65, 0.1), 'accent', c.halfW * 0.95, top + 0.2, -0.1),
    P(rbox(0.85, 0.25, 0.9, 0.08), 'dark', 0, 0.5, -c.len * 0.58),                       // rear spade
    P(cyl(0.1, 0.13, 0.7, 10), 'dark', -c.halfW * 0.65, top + 0.5, -c.len * 0.42),       // stacks
    P(cyl(0.1, 0.13, 0.7, 10), 'dark', c.halfW * 0.65, top + 0.5, -c.len * 0.42),
    A('turret', P(rbox(1.0, 0.6, 1.25, 0.14), 'body', 0, top + 0.55, -0.55)),
    A('turret', P(rbox(0.7, 0.16, 0.6, 0.05), 'light', 0, top + 0.65, 0.15)),
    A('turret', P(cyl(0.13, 0.16, 2.3, 14), 'dark', 0, top + 0.95, 0.6, Math.PI / 2 - 0.45)), // howitzer
    A('turret', P(cyl(0.18, 0.18, 0.3, 12), 'dark', 0, top + 1.35, 1.45, Math.PI / 2 - 0.45)),
  );
  return pivot;
}

function kitAntiAir(p: Part[], top: number, c: ChassisSpec): [number, number, number] {
  const pivot: [number, number, number] = [0, top + 0.15, -0.1];
  p.push(
    P(cyl(0.4, 0.48, 0.3, 16), 'body', 0, top + 0.15, -0.1),                             // mount
    A('turret', P(rbox(0.34, 0.34, 0.95, 0.09), 'body', -0.35, top + 0.5, -0.1, -0.5)),  // missile pods (angled)
    A('turret', P(rbox(0.34, 0.34, 0.95, 0.09), 'body', 0.35, top + 0.5, -0.1, -0.5)),
    A('turret', P(rbox(0.28, 0.28, 0.1, 0.04), 'accent', -0.35, top + 0.68, 0.28, -0.5)), // pod faces
    A('turret', P(rbox(0.28, 0.28, 0.1, 0.04), 'accent', 0.35, top + 0.68, 0.28, -0.5)),
    A('spin', P(rbox(0.7, 0.05, 0.12, 0.02), 'dark', 0, top + 0.95, -0.1)),              // radar bar
    A('spin', P(sph(0.07, 8), 'light', 0.32, top + 0.98, -0.1)),
    P(rbox(0.5, 0.16, 0.4, 0.05), 'dark', 0, top + 0.08, c.len * 0.3),                   // sensor cab
  );
  return pivot;
}

function kitSupport(p: Part[], top: number, c: ChassisSpec) {
  p.push(
    P(rbox(c.halfW * 1.3, 0.5, c.len * 0.45, 0.12), 'body', 0, top + 0.27, -c.len * 0.15), // workshop
    P(rbox(c.halfW * 1.0, 0.1, c.len * 0.35, 0.03), 'light', 0, top + 0.55, -c.len * 0.15), // skylight
    P(cyl(0.3, 0.05, 0.18, 16), 'accent', 0, top + 0.75, c.len * 0.22),                  // repair dish
    A('spin', P(rbox(0.06, 0.42, 0.06, 0.02), 'accent', 0, top + 1.0, c.len * 0.22)),    // antenna
    P(rbox(0.14, 0.14, c.len * 0.5, 0.04), 'dark', -c.halfW * 0.8, top + 0.3, 0.1, -0.3), // tool arms
    P(rbox(0.14, 0.14, c.len * 0.5, 0.04), 'dark', c.halfW * 0.8, top + 0.3, 0.1, -0.3),
  );
}

/** Builds the full part list for a faction vehicle variant. */
export function buildVehicleParts(variant: VehicleVariant): VehicleBuild {
  const p: Part[] = [];
  const top = buildChassis(p, variant.chassis);
  addDetails(p, top, variant.chassis, variant.classId);
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
