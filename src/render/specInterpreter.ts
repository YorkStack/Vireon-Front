// Interprets a vehicle-spec into the game's existing Part[] (the same shape the
// procedural factory produces), so studio-designed vehicles flow through the
// unchanged mesh pipeline. Validates first; throws on an invalid spec so the
// factory can fall back to procedural geometry.
import { A, P, box, cyl, sph, cone, torus, trap, type Part } from './models';
import { rbox, type VehicleBuild } from './vehicleModels';
import { validateSpec } from '../vehicles/spec/validate';
import type { SpecPart, VehicleSpec } from '../vehicles/spec/vehicleSpec';

function geoFor(p: SpecPart) {
  const s = p.size;
  switch (p.prim) {
    case 'box': return box(s[0], s[1], s[2]);
    case 'rbox': return rbox(s[0], s[1], s[2], p.round);
    case 'cyl': return cyl(s[0], s[1], s[2]);
    case 'sph': return sph(s[0]);
    case 'cone': return cone(s[0], s[1]);
    case 'torus': return torus(s[0], s[1]);
    case 'trap': return trap(s[0], s[1], s[2], s[3]);
  }
}

/** A part's texture group: its (normalized) texGroup, or its slot by default. */
export const groupOf = (sp: { texGroup?: string; slot: string }): string =>
  sp.texGroup?.trim().toLowerCase() || sp.slot;

export function buildPartsFromSpec(spec: VehicleSpec): VehicleBuild {
  const v = validateSpec(spec);
  if (!v.ok) throw new Error(`invalid vehicle-spec: ${v.errors.join('; ')}`);
  const parts: Part[] = spec.parts.map((sp) => {
    const [rx, ry, rz] = sp.rot ?? [0, 0, 0];
    const [sx, sy, sz] = sp.scale ?? [1, 1, 1];
    const part = P(geoFor(sp), sp.slot, sp.pos[0], sp.pos[1], sp.pos[2], rx, ry, rz, sx, sy, sz);
    part.group = groupOf(sp);
    return sp.anim ? A(sp.anim, part) : part;
  });
  return { parts, turretPivot: spec.turretPivot };
}
