# Vehicle Design Studio — Implementation Plan (Vertical Slice)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author one vehicle's geometry + textures in an external Gemini-driven studio and import it back into the game so it renders at the correct in-game size — proving the full pipeline before scaling to all 32.

**Architecture:** A versioned `vehicle-spec` JSON schema is the contract between two independent repos. **Phase A (game repo)** adds the schema + validator, a spec→`Part[]` interpreter, a converter that seeds few-shot examples from the existing procedural models, a factory hook that prefers an imported spec over procedural geometry, a catalog exporter (sizes incl. `silhouetteScale`), and an import script. Phase A is independently testable: hand any conforming spec (e.g. a converter seed) to the importer and it renders in-game. **Phase B (new separate repo `vireon-design-studio`)** is the producer: a Vite/TS/Three.js browser app + a tiny Node service that holds the Gemini key, doing sketch → approve → geometry → texture → export bundle.

**Tech Stack:** TypeScript, Three.js (r184), Vite 8, Vitest (added for tests), Node, `@google/genai` (studio service). Game repo already at `/Users/yorkvonloew/Documents/Claude/Vireon Front`. Spec: `docs/superpowers/specs/2026-06-12-vehicle-design-studio-design.md`.

**Reference skills:** @superpowers:test-driven-development for every Phase-A task.

---

## File Structure

**Phase A — game repo (`Vireon Front/`)**
| File | Responsibility |
|---|---|
| `src/vehicles/spec/vehicleSpec.ts` (new) | `VehicleSpec` / `SpecPart` types + primitive arg-arity table. The contract. |
| `src/vehicles/spec/validate.ts` (new) | `validateSpec(spec): {ok, errors}` — enums, arity, finite, turretPivot rule, footprint clamp. |
| `src/vehicles/spec/validate.test.ts` (new) | Validator unit tests. |
| `src/render/specInterpreter.ts` (new) | `buildPartsFromSpec(spec): VehicleBuild` — spec → existing `Part[]` + turretPivot. |
| `src/render/specInterpreter.test.ts` (new) | Interpreter + round-trip tests. |
| `tools/convert_vehicle_to_spec.mjs` (new) | Dumps a procedural variant's `Part[]` → spec JSON into `studio-seeds/`. |
| `src/render/vehicleModels.ts` (modify) | Export a `partsToSpec()` helper + expose `buildVehicleParts` already exported. |
| `src/render/models.ts` (modify, ~`getVariantTemplate`) | Prefer `src/vehicles/specs/<f>/<c>.json` when present + status allows. |
| `src/vehicles/specs/` (new dir) | Imported geometry specs (game-consumed). |
| `scripts/export-catalog.mjs` (new) | Emits `studio-export/catalog.json` (sizes incl. renderScale, briefs). |
| `scripts/import-vehicle.mjs` (new) | Bundle → `src/vehicles/specs/` + `public/assets/vehicles/` + status flip; `--dry-run`. |
| `scripts/import-vehicle.test.mjs` (new) | Dry-run path assertions on a fixture bundle. |
| `package.json` (modify) | Add `vitest`, `test`, `export:catalog`, `import:vehicle` scripts. |
| `vite.config.ts` or `vitest.config.ts` (new/modify) | Vitest config (node env). |

**Phase B — new repo (`vireon-design-studio/`, sibling dir)**
| File | Responsibility |
|---|---|
| `package.json`, `vite.config.ts`, `tsconfig.json`, `.gitignore`, `.env.example` | Scaffold. |
| `src/spec/vehicleSpec.ts`, `src/spec/validate.ts` (+ test) | Mirror of the game contract (copied, kept in sync by the shared schemaVersion). |
| `server/gemini.mjs` | Node service holding the key: `/api/sketch`, `/api/geometry`, `/api/texture`. |
| `src/preview/SpecRenderer.ts` | Three.js renderer interpreting a spec → meshes (studio-side mirror). |
| `src/catalog.ts` | Loads `catalog.json`, lists faction×class with sizes + briefs. |
| `src/bundle.ts` | Writes the export bundle. |
| `src/studio.ts`, `index.html`, `src/style.css` | Browser UI orchestrating the flow. |
| `seeds/` | Few-shot spec seeds (copied from game's `studio-seeds/`). |

---

## PHASE A — Game-side contract, consumption & import

### Task A1: Test harness + spec types

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/vehicles/spec/vehicleSpec.ts`

- [ ] **Step 1: Add Vitest + scripts.** Run:
```bash
npm i -D vitest
```
Then add to `package.json` `scripts`: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 2: Vitest config (node env).** Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', include: ['src/**/*.test.ts'] } });
```

- [ ] **Step 3: Write the spec types.** Create `src/vehicles/spec/vehicleSpec.ts`:
```ts
// vehicle-spec v1 — the portable contract (see specs/2026-06-12-...-design.md §3).
export type SpecPrim = 'box' | 'cyl' | 'sph' | 'cone' | 'torus' | 'rbox';
export type SpecSlot = 'body' | 'dark' | 'accent' | 'light' | 'smooth' | 'roof';
export type SpecAnim = null | 'turret' | 'spin' | 'load';

export interface SpecPart {
  prim: SpecPrim;
  size: number[];        // arity per ARG_ARITY
  round?: number;        // rbox only
  slot: SpecSlot;
  pos: [number, number, number];
  rot?: [number, number, number];   // euler radians, default [0,0,0]
  anim?: SpecAnim;       // default null
}
export interface VehicleSpec {
  schemaVersion: '1.0';
  faction: 'red' | 'blue' | 'green' | 'yellow';
  vehicleClass: string;
  displayName?: string;
  footprint: { w: number; h: number; l: number };   // model-local units
  turretPivot?: [number, number, number];
  parts: SpecPart[];
}
/** Required `size` length per primitive. */
export const ARG_ARITY: Record<SpecPrim, number> = {
  box: 3, cyl: 3, sph: 1, cone: 2, torus: 2, rbox: 3,
};
export const SLOTS: SpecSlot[] = ['body', 'dark', 'accent', 'light', 'smooth', 'roof'];
export const PRIMS: SpecPrim[] = ['box', 'cyl', 'sph', 'cone', 'torus', 'rbox'];
```

- [ ] **Step 4: Commit.**
```bash
git add package.json package-lock.json vitest.config.ts src/vehicles/spec/vehicleSpec.ts
git commit -m "feat(spec): vehicle-spec v1 types + vitest harness"
```

### Task A2: Spec validator (TDD)

**Files:**
- Create: `src/vehicles/spec/validate.ts`
- Test: `src/vehicles/spec/validate.test.ts`

- [ ] **Step 1: Write failing tests.** Create `src/vehicles/spec/validate.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { validateSpec } from './validate';
import type { VehicleSpec } from './vehicleSpec';

const base: VehicleSpec = {
  schemaVersion: '1.0', faction: 'blue', vehicleClass: 'mediumTank',
  footprint: { w: 2, h: 1.9, l: 2.3 },
  parts: [{ prim: 'box', size: [1, 0.5, 2], slot: 'body', pos: [0, 0.5, 0] }],
};

describe('validateSpec', () => {
  it('accepts a minimal valid spec', () => {
    expect(validateSpec(base).ok).toBe(true);
  });
  it('rejects wrong arg arity', () => {
    const bad = { ...base, parts: [{ ...base.parts[0], size: [1, 2] }] };
    expect(validateSpec(bad as VehicleSpec).ok).toBe(false);
  });
  it('rejects unknown slot/prim/faction', () => {
    expect(validateSpec({ ...base, faction: 'purple' as any }).ok).toBe(false);
    expect(validateSpec({ ...base, parts: [{ ...base.parts[0], slot: 'x' as any }] }).ok).toBe(false);
    expect(validateSpec({ ...base, parts: [{ ...base.parts[0], prim: 'blob' as any }] }).ok).toBe(false);
  });
  it('requires turretPivot when a turret part exists', () => {
    const t = { ...base, parts: [{ ...base.parts[0], anim: 'turret' as const }] };
    expect(validateSpec(t).ok).toBe(false);
    expect(validateSpec({ ...t, turretPivot: [0, 1, 0] }).ok).toBe(true);
  });
  it('rejects non-finite numbers', () => {
    const bad = { ...base, parts: [{ ...base.parts[0], pos: [0, NaN, 0] as any }] };
    expect(validateSpec(bad).ok).toBe(false);
  });
  it('flags a part center far outside the footprint (clamp guard)', () => {
    const bad = { ...base, parts: [{ ...base.parts[0], pos: [99, 0, 0] as any }] };
    expect(validateSpec(bad).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run, expect FAIL.** Run: `npm test -- validate` → FAIL (no `validate.ts`).

- [ ] **Step 3: Implement validator.** Create `src/vehicles/spec/validate.ts`:
```ts
import { ARG_ARITY, PRIMS, SLOTS, type VehicleSpec } from './vehicleSpec';

const FACTIONS = ['red', 'blue', 'green', 'yellow'];
const fin = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

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
    if (!Array.isArray(p.size) || p.size.length !== ARG_ARITY[p.prim] || !p.size.every(fin))
      e.push(`part[${i}] size must be ${ARG_ARITY[p.prim]} finite numbers for ${p.prim}`);
    if (!Array.isArray(p.pos) || p.pos.length !== 3 || !p.pos.every(fin))
      e.push(`part[${i}] pos must be 3 finite numbers`);
    if (p.rot && (p.rot.length !== 3 || !p.rot.every(fin))) e.push(`part[${i}] rot invalid`);
    if (p.anim === 'turret') hasTurret = true;
    if (Array.isArray(p.pos) && p.pos.some((v) => Math.abs(v) > maxR))
      e.push(`part[${i}] center outside 1.5x footprint`);
  });
  if (!(spec?.parts?.length > 0)) e.push('parts must be non-empty');
  if (hasTurret && !spec.turretPivot) e.push('turretPivot required when a turret part exists');
  return { ok: e.length === 0, errors: e };
}
```

- [ ] **Step 4: Run, expect PASS.** Run: `npm test -- validate` → PASS.

- [ ] **Step 5: Commit.**
```bash
git add src/vehicles/spec/validate.ts src/vehicles/spec/validate.test.ts
git commit -m "feat(spec): validateSpec with arity/enum/turret/clamp checks (TDD)"
```

### Task A3: Spec interpreter `buildPartsFromSpec` (TDD)

**Files:**
- Create: `src/render/specInterpreter.ts`
- Test: `src/render/specInterpreter.test.ts`
- Modify: `src/render/models.ts` (ensure `P, box, cyl, sph, cone, torus` exported — already done; add `rbox` export by re-exporting from vehicleModels or defining here)

- [ ] **Step 1: Failing test.** Create `src/render/specInterpreter.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildPartsFromSpec } from './specInterpreter';
import type { VehicleSpec } from '../vehicles/spec/vehicleSpec';

const spec: VehicleSpec = {
  schemaVersion: '1.0', faction: 'blue', vehicleClass: 'mediumTank',
  turretPivot: [0, 1, 0],
  footprint: { w: 2, h: 1.5, l: 2 },
  parts: [
    { prim: 'box', size: [1, 0.5, 2], slot: 'body', pos: [0, 0.5, 0] },
    { prim: 'cyl', size: [0.3, 0.3, 0.2], slot: 'dark', pos: [0.8, 0.3, 0], rot: [0, 0, 1.57] },
    { prim: 'box', size: [0.7, 0.3, 0.9], slot: 'body', pos: [0, 1, 0], anim: 'turret' },
  ],
};

describe('buildPartsFromSpec', () => {
  it('produces one Part per spec part with matching slots', () => {
    const { parts } = buildPartsFromSpec(spec);
    expect(parts).toHaveLength(3);
    expect(parts.map((p) => p.slot)).toEqual(['body', 'dark', 'body']);
    expect(parts.filter((p) => p.anim === 'turret')).toHaveLength(1);
  });
  it('returns the turret pivot', () => {
    expect(buildPartsFromSpec(spec).turretPivot).toEqual([0, 1, 0]);
  });
  it('throws on an invalid spec', () => {
    expect(() => buildPartsFromSpec({ ...spec, parts: [] } as VehicleSpec)).toThrow();
  });
});
```

- [ ] **Step 2: Run, expect FAIL.** Run: `npm test -- specInterpreter`.

- [ ] **Step 3: Implement.** Create `src/render/specInterpreter.ts`:
```ts
import { A, P, box, cyl, sph, cone, torus, type Part } from './models';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { VehicleBuild } from './vehicleModels';
import { validateSpec } from '../vehicles/spec/validate';
import type { SpecPart, VehicleSpec } from '../vehicles/spec/vehicleSpec';

const rbox = (w: number, h: number, d: number, r?: number) =>
  new RoundedBoxGeometry(w, h, d, 2, r ?? Math.min(0.09, Math.min(w, h, d) * 0.22));

function geoFor(p: SpecPart) {
  const s = p.size;
  switch (p.prim) {
    case 'box': return box(s[0], s[1], s[2]);
    case 'rbox': return rbox(s[0], s[1], s[2], p.round);
    case 'cyl': return cyl(s[0], s[1], s[2]);
    case 'sph': return sph(s[0]);
    case 'cone': return cone(s[0], s[1]);
    case 'torus': return torus(s[0], s[1]);
  }
}

export function buildPartsFromSpec(spec: VehicleSpec): VehicleBuild {
  const v = validateSpec(spec);
  if (!v.ok) throw new Error(`invalid vehicle-spec: ${v.errors.join('; ')}`);
  const parts: Part[] = spec.parts.map((sp) => {
    const [rx, ry, rz] = sp.rot ?? [0, 0, 0];
    const part = P(geoFor(sp), sp.slot, sp.pos[0], sp.pos[1], sp.pos[2], rx, ry, rz);
    return sp.anim && sp.anim !== null ? A(sp.anim, part) : part;
  });
  return { parts, turretPivot: spec.turretPivot };
}
```

- [ ] **Step 4: Run, expect PASS.** Run: `npm test -- specInterpreter`.

- [ ] **Step 5: Commit.**
```bash
git add src/render/specInterpreter.ts src/render/specInterpreter.test.ts
git commit -m "feat(spec): buildPartsFromSpec interpreter (TDD)"
```

### Task A4: Procedural→spec converter + round-trip test (the few-shot seeds)

**Files:**
- Modify: `src/render/vehicleModels.ts` (add `partsToSpec(parts, classId, faction, footprint)` exporter)
- Create: `tools/convert_vehicle_to_spec.mjs`
- Test: extend `src/render/specInterpreter.test.ts` with a round-trip case

- [ ] **Step 1: Add `partsToSpec` exporter.** In `src/render/vehicleModels.ts`, add a function that reverses `Part` → `SpecPart`. Since `Part` stores a baked geometry (not its source prim/args), capture prim+args at build time instead: add an optional `meta` to the `P()` helper OR — simpler and robust — have the converter rebuild specs from a **parallel declarative description**. **Decision:** give each chassis/kit a thin wrapper is too invasive; instead `partsToSpec` reads each `Part`'s bounding box + a `__spec` tag we attach in `P()`. Implement by extending `P()` in `models.ts` to stash `{prim,size,round}` on the returned part when called through a new `PS()` used by vehicleModels. **Minimal approach for the slice:** add `export function specPartFromGeo(...)` is fragile — so for the seed converter we instead **author the seeds by reading the existing kit code structure once** is out of scope. → Use this concrete mechanism: extend the shared `P()` to accept and record prim metadata.

  In `src/render/models.ts`, change `Part` to optionally carry `spec?: {prim,size,round}` and have `box/cyl/...` tag their geometry via a WeakMap `GEO_SPEC` so `P()` can read it:
```ts
// models.ts — add near the primitive helpers:
export const GEO_SPEC = new WeakMap<THREE.BufferGeometry, { prim: string; size: number[]; round?: number }>();
const tag = (g: THREE.BufferGeometry, prim: string, size: number[], round?: number) => { GEO_SPEC.set(g, { prim, size, round }); return g; };
export const box = (w,h,d) => tag(new THREE.BoxGeometry(w,h,d), 'box', [w,h,d]);
export const cyl = (rt,rb,h,seg=10) => tag(new THREE.CylinderGeometry(rt,rb,h,seg), 'cyl', [rt,rb,h]);
export const sph = (r,seg=12) => tag(new THREE.SphereGeometry(r,seg,Math.max(6,seg-2)), 'sph', [r]);
export const cone = (r,h,seg=8) => tag(new THREE.ConeGeometry(r,h,seg), 'cone', [r,h]);
export const torus = (r,t) => tag(new THREE.TorusGeometry(r,t,8,20), 'torus', [r,t]);
```
  In `vehicleModels.ts` `rbox`, tag it too: `tag(new RoundedBoxGeometry(...), 'rbox', [w,h,d], r)`. Then `P()` records, before `applyMatrix4`, the pre-transform spec from `GEO_SPEC.get(geo)` and the passed pos/rot onto `part.spec`.

- [ ] **Step 2: Add `partsToSpec`.** In `vehicleModels.ts`:
```ts
import type { VehicleSpec, SpecPart } from '../vehicles/spec/vehicleSpec';
export function variantToSpec(variant: VehicleVariant, footprint: {w:number;h:number;l:number}): VehicleSpec {
  const { parts, turretPivot } = buildVehicleParts(variant);
  const specParts: SpecPart[] = parts.map((p) => {
    const m = p.spec!; // {prim,size,round,pos,rot,...}
    return { prim: m.prim as any, size: m.size, round: m.round, slot: p.slot,
             pos: m.pos, rot: m.rot, anim: p.anim ?? null };
  });
  return { schemaVersion: '1.0', faction: variant.factionId as any, vehicleClass: variant.classId,
           footprint, turretPivot, parts: specParts };
}
```
  (Record `pos`/`rot` in `P()` onto `part.spec` since the matrix bakes them in.)

- [ ] **Step 3: Round-trip test.** Add to `specInterpreter.test.ts`:
```ts
it('round-trips a real procedural variant through spec and back', async () => {
  const { getVariant } = await import('../vehicles');
  const { variantToSpec } = await import('./vehicleModels');
  const { validateSpec } = await import('../vehicles/spec/validate');
  const v = getVariant('blue', 'mediumTank')!;
  const spec = variantToSpec(v, { w: 2, h: 2, l: 2.5 });
  expect(validateSpec(spec).ok).toBe(true);
  const rebuilt = buildPartsFromSpec(spec);
  expect(rebuilt.parts.length).toBe(spec.parts.length);
});
```

- [ ] **Step 4: Run tests, expect PASS.** Run: `npm test`.

- [ ] **Step 5: Converter CLI.** Create `tools/convert_vehicle_to_spec.mjs` (Vite SSR loader, like `scripts/validate-balance.mjs`): loads `variantToSpec` + the catalog footprints, writes `studio-seeds/<faction>_<class>.json` for all 32. Add npm script `"seed:specs": "node tools/convert_vehicle_to_spec.mjs"`.

- [ ] **Step 6: Generate seeds + commit.**
```bash
npm run seed:specs
npm test
git add src/render/models.ts src/render/vehicleModels.ts src/render/specInterpreter.test.ts tools/convert_vehicle_to_spec.mjs studio-seeds/ package.json
git commit -m "feat(spec): procedural->spec converter + few-shot seeds + round-trip test"
```

### Task A5: Factory hook — prefer imported spec

**Files:**
- Modify: `src/render/models.ts` (`getVariantTemplate`)
- Create: `src/vehicles/specs/.gitkeep`

- [ ] **Step 1: Failing test.** Add `src/render/models.spec.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
// Provide a fake spec module + assert getVariantTemplate uses it. Detail: expose
// a seam loadImportedSpec(factoryId): VehicleSpec|null that getVariantTemplate calls.
```
(Implement a `loadImportedSpec(faction, classId)` seam that reads `src/vehicles/specs/<f>/<c>.json` via a static glob import map so it is testable and bundler-friendly.)

- [ ] **Step 2:** Implement in `models.ts` `getVariantTemplate`:
```ts
import.meta.glob; // use vite glob for src/vehicles/specs/**/*.json (eager: false)
// pseudo:
const SPEC_GLOB = import.meta.glob('../vehicles/specs/*/*.json');
async function loadImportedSpec(faction, classId) { /* match key, import(), return default */ }
```
For the synchronous template path, load specs eagerly at module init into a map; if a spec exists for `<faction>:<classId>`, build its template via `buildPartsFromSpec` instead of `buildVehicleParts`, registering its `turretPivot`.

- [ ] **Step 3–5:** Run tests, verify a placed spec overrides procedural; commit.
```bash
git commit -m "feat(spec): factory prefers imported vehicle-spec, falls back to procedural"
```

### Task A6: Catalog exporter (sizes incl. renderScale)

**Files:**
- Create: `scripts/export-catalog.mjs`
- Modify: `package.json` (`"export:catalog"`)

- [ ] **Step 1:** Create `scripts/export-catalog.mjs` (Vite SSR loader). For each faction×vehicle class: read template (`collisionRadius`, role, techTier, description), variant (`chassis`, `silhouetteScale`, `movementType`), and `ART_METADATA` brief. Compute `renderScale = UNIT_VISUAL_SCALE * (silhouetteScale ?? 1)`. Derive `localFootprint` from chassis (`halfW*2`, `len`, `hullH + kit height estimate`) — reuse the seed spec's bbox (from `studio-seeds/`) as the authoritative localFootprint; `worldFootprint = local * renderScale`; `tilesWide = worldFootprint.w / TILE`. Write `studio-export/catalog.json`.

- [ ] **Step 2: Run + sanity check.** Run: `npm run export:catalog`; assert `blue:mediumTank.renderScale === 1.28` and `localFootprint` matches the seed bbox.

- [ ] **Step 3: Commit.**
```bash
git add scripts/export-catalog.mjs package.json studio-export/catalog.json
git commit -m "feat(studio): catalog exporter with renderScale-correct sizes + briefs"
```

### Task A7: Import script (TDD on dry-run)

**Files:**
- Create: `scripts/import-vehicle.mjs`
- Test: `scripts/import-vehicle.test.mjs` (vitest, node)
- Modify: `package.json` (`"import:vehicle"`), `src/data/artMetadata.ts` (status flip is data-only; importer edits the STATUS map via a generated `src/data/importedStatus.json` it reads — avoid rewriting TS).

- [ ] **Step 1: Decide status mechanism.** Add `src/data/importedStatus.json` (`{}`) read by `artMetadata.ts` to overlay statuses, so the importer writes JSON, not TS. In `artMetadata.ts`: `import imported from './importedStatus.json'; ... Object.assign(STATUS, imported);` before applying.

- [ ] **Step 2: Failing test.** `scripts/import-vehicle.test.mjs`: build a fixture bundle dir (geometry.json valid, baseColor.png stub, meta.json), run `importVehicle(bundleDir, {dryRun:true})`, assert returned plan lists exact destinations: `src/vehicles/specs/blue/mediumTank.json`, `public/assets/vehicles/blue/medium_tank/baseColor.png`, and status `blue_mediumTank → generated`.

- [ ] **Step 3: Implement** `importVehicle(bundleDir, {dryRun})`: read+validate geometry.json (reuse validateSpec via SSR import or a JS copy), map class→snake for texture path, compute destinations, and on non-dry-run copy files + merge `importedStatus.json`. Reject invalid specs (no writes).

- [ ] **Step 4: Run tests, expect PASS.** Run: `npm test -- import-vehicle` (and add `.mjs` to vitest include or convert to `.ts`).

- [ ] **Step 5: Commit.**
```bash
git commit -m "feat(studio): import-vehicle script (validate->copy->status) with dry-run (TDD)"
```

### Task A8: Phase-A end-to-end proof (no studio yet)

- [ ] **Step 1:** Pick a seed, e.g. `studio-seeds/blue_mediumTank.json`, make a fixture bundle `studio-export/blue_mediumTank/` with that geometry + the existing `public/assets/vehicles/blue/medium_tank/baseColor.png` + a `meta.json`.
- [ ] **Step 2:** Run `npm run import:vehicle -- studio-export/blue_mediumTank`. Verify `src/vehicles/specs/blue/mediumTank.json` exists and `importedStatus.json` shows `blue_mediumTank: generated`.
- [ ] **Step 3:** `npx tsc --noEmit && npm run build` → clean.
- [ ] **Step 4:** Verify in-game (preview server + Chrome MCP): Azure mediumTank in the Unit Codex now renders from the imported spec (identical to procedural here, since seed == procedural) with the SAME bounding size. Confirms the consume+import path and size fidelity.
- [ ] **Step 5: Commit** the imported artifacts (or revert the test import — keep the path proven). Commit Phase A.

---

## PHASE B — The studio (new separate repo)

> Verified by running (browser + live Gemini), not unit tests, except the mirrored validator. Build incrementally; commit per task in the studio repo.

### Task B1: Scaffold `vireon-design-studio`
- [ ] Create sibling dir `../vireon-design-studio`, `git init`, `npm init`, add `vite`, `typescript`, `three`, `@google/genai`, `vitest`. Add `.gitignore` (`node_modules`, `dist`, `.env`, `seeds/raw`) and `.env.example` (`GEMINI_API_KEY=your_key_here`). `index.html` + `src/studio.ts` hello-world. Copy `studio-export/catalog.json` and `studio-seeds/*` from the game into `studio/data/`. Commit.

### Task B2: Mirror the contract
- [ ] Copy `vehicleSpec.ts` + `validate.ts` (+ test) verbatim into `src/spec/`. Run the validator test. Commit. (Sync rule: `schemaVersion` guards drift; a later task can add a checksum compare.)

### Task B3: Node Gemini service (holds the key)
- [ ] Create `server/gemini.mjs` (express or Vite middleware) with three POST endpoints, key from `process.env.GEMINI_API_KEY` (never sent to client):
  - `/api/sketch` `{brief,size,faction}` → Nano Banana orthographic concept sketch (PNG base64). Port the prompt-building from the game's `generate_asset.py` sketch style.
  - `/api/geometry` `{sketchPng, size, brief, seeds[]}` → Gemini 3 Pro multimodal → `VehicleSpec` JSON (validated server-side; retry on invalid up to N). System prompt embeds the schema doc + few-shot seeds + the size, and instructs "emit ONLY JSON matching vehicle-spec v1, model-local units, footprint = given size."
  - `/api/texture` `{brief,size,faction}` → Nano Banana bright `vehicle` texture (the fixed bright style) → baseColor PNG.
- [ ] Wire Vite dev to proxy `/api` to the service. Smoke-test each endpoint with `curl` (or a tiny test page). Commit.

### Task B4: Spec preview renderer
- [ ] `src/preview/SpecRenderer.ts`: a self-contained Three.js scene that interprets a `VehicleSpec` (same prim mapping as the game interpreter) into meshes with simple slot-colored materials + the faction accent, a ground disc, drag-rotate/zoom, and a **world-size reference** (a TILE-sized grid) so size reads correctly. Render a seed spec to verify. Commit.

### Task B5: Catalog list + studio flow UI
- [ ] `src/catalog.ts` loads `data/catalog.json`. `src/studio.ts` builds: left faction×vehicle list; center sketch image + live `SpecRenderer`; right controls: notes field, **Generate sketch** → shows sketch + Approve/Regenerate; after approve, **Generate geometry** → validate + render live + Regenerate-with-feedback/Accept; **Generate texture** → preview on the model; **Export bundle**. Status badges. Commit per sub-step.

### Task B6: Bundle export
- [ ] `src/bundle.ts`: writes `exports/<faction>_<class>/{geometry.json, baseColor.png, sketch.png, meta.json}` (meta = prompts, model ids, date, size, status). For a browser app, route the write through the Node service (`/api/export`). Commit.

### Task B7: Vertical-slice run-through
- [ ] In the studio, design **Azure mediumTank**: description+size → sketch → approve → geometry (with seeds) → iterate to acceptable → texture → export.
- [ ] In the game repo: `npm run import:vehicle -- ../vireon-design-studio/exports/blue_mediumTank`.
- [ ] `npx tsc --noEmit && npm run build`; verify in Unit Codex + in a match that the Azure mediumTank now shows the studio-designed geometry at correct size. Screenshot for the owner.
- [ ] Commit both repos. **Vertical slice complete.**

---

## Scaling (after the slice — separate follow-up plan)
List/batch in the studio over all 32; per-vehicle approve gates; `import:vehicle --all`. Out of scope for this plan.

## Testing summary
- Unit (vitest, game + studio): validator, interpreter, round-trip, import dry-run.
- Integration (run): catalog export sanity, Phase-A import proof, studio endpoints, full slice render.
- Non-tested (visual/manual): browser UI, live Gemini output quality (gated by human approval by design).
