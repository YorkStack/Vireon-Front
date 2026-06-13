// Validates a vehicle-spec on both sides of the interface. Readable rejects;
// the game falls back to procedural geometry on any invalid/missing spec.
import { ARG_ARITY, FACTIONS, PRIMS, SLOTS, type VehicleSpec } from './vehicleSpec';

const fin = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const triple = (v: unknown): v is number[] => Array.isArray(v) && v.length === 3 && v.every(fin);

export function validateSpec(spec: VehicleSpec): { ok: boolean; errors: string[] } {
  const e: string[] = [];
  if (spec?.schemaVersion !== '1.0') e.push('schemaVersion must be "1.0"');
  if (!FACTIONS.includes(spec?.faction)) e.push(`faction invalid: ${spec?.faction}`);
  if (!spec?.vehicleClass) e.push('vehicleClass required');
  const f = spec?.footprint;
  if (!f || !fin(f.w) || !fin(f.h) || !fin(f.l)) e.push('footprint w/h/l must be finite');
  const maxR = f ? 1.5 * Math.max(f.w, f.h, f.l) : Infinity;

  let hasTurret = false;
  (spec?.parts ?? []).forEach((p, i) => {
    if (!PRIMS.includes(p.prim)) { e.push(`part[${i}] prim invalid: ${p.prim}`); return; }
    if (!SLOTS.includes(p.slot)) e.push(`part[${i}] slot invalid: ${p.slot}`);
    if (p.texGroup !== undefined && (typeof p.texGroup !== 'string' || !p.texGroup.trim()))
      e.push(`part[${i}] texGroup must be a non-empty string`);
    if (!Array.isArray(p.size) || p.size.length !== ARG_ARITY[p.prim] || !p.size.every(fin))
      e.push(`part[${i}] size must be ${ARG_ARITY[p.prim]} finite numbers for ${p.prim}`);
    if (!triple(p.pos)) e.push(`part[${i}] pos must be 3 finite numbers`);
    if (p.rot !== undefined && !triple(p.rot)) e.push(`part[${i}] rot invalid`);
    if (p.scale !== undefined && !triple(p.scale)) e.push(`part[${i}] scale invalid`);
    if (p.round !== undefined && !fin(p.round)) e.push(`part[${i}] round invalid`);
    if (p.anim === 'turret') hasTurret = true;
    if (triple(p.pos) && p.pos.some((v) => Math.abs(v) > maxR))
      e.push(`part[${i}] center outside 1.5x footprint`);
  });
  if (!(spec?.parts?.length > 0)) e.push('parts must be non-empty');
  if (hasTurret && !spec.turretPivot) e.push('turretPivot required when a turret part exists');
  return { ok: e.length === 0, errors: e };
}
