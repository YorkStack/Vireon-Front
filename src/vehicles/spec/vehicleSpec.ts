// vehicle-spec v1 — the portable contract between the game and the external
// Vehicle Design Studio. See docs/superpowers/specs/2026-06-12-...-design.md §3.
// Both repos implement this shape independently; the schema is the interface.

export type SpecPrim = 'box' | 'cyl' | 'sph' | 'cone' | 'torus' | 'rbox' | 'trap';
export type SpecSlot = 'body' | 'dark' | 'accent' | 'light' | 'smooth' | 'roof';
export type SpecAnim = null | 'turret' | 'spin' | 'load';

export interface SpecPart {
  prim: SpecPrim;
  size: number[];                     // arity per ARG_ARITY
  round?: number;                     // rbox only: chamfer radius
  slot: SpecSlot;
  texGroup?: string;                  // texture unit (component); default = slot. normalized lowercase
  pos: [number, number, number];
  rot?: [number, number, number];     // euler radians, default [0,0,0]
  scale?: [number, number, number];   // default [1,1,1] — some parts use non-uniform scale; must round-trip
  anim?: SpecAnim;                    // default null
}

export interface VehicleSpec {
  schemaVersion: '1.0';
  faction: 'red' | 'blue' | 'green' | 'yellow';
  vehicleClass: string;               // matches UNIT_CLASS_TEMPLATES id
  displayName?: string;
  footprint: { w: number; h: number; l: number };   // model-local units (same space as vehicleModels.ts)
  turretPivot?: [number, number, number];           // required iff a part has anim:"turret"
  parts: SpecPart[];
  /** Optional per-slot component textures, injected on import: slot -> public asset URL. */
  slotTextures?: Partial<Record<SpecSlot, string>>;
}

/** Required `size` length per primitive (mirrors vehicleModels.ts helpers). */
export const ARG_ARITY: Record<SpecPrim, number> = {
  box: 3, cyl: 3, sph: 1, cone: 2, torus: 2, rbox: 3, trap: 4,
};
export const SLOTS: SpecSlot[] = ['body', 'dark', 'accent', 'light', 'smooth', 'roof'];
export const PRIMS: SpecPrim[] = ['box', 'cyl', 'sph', 'cone', 'torus', 'rbox', 'trap'];
export const FACTIONS = ['red', 'blue', 'green', 'yellow'];
