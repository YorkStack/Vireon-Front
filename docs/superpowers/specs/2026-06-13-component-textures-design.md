# Component Textures, Texture Library & Trapezoid Primitive — Design

> Status: approved direction (brainstorm 2026-06-13); revised after adversarial
> spec review. Spans both repos: the game (`Vireon Front`) and the studio
> (`vireon-design-studio`). The `vehicle-spec` schema is the contract between them.

## Problem
Texturing is per **slot** (`body/dark/accent/light/smooth/roof`). A slot is a
*material category*, not a *component*: tracks, the harvester cutter, gun barrels
and walker legs are all `dark`, so they share one texture. The user needs distinct
components to take distinct textures, a way to assign parts to texture units, a
reusable preset library, and a trapezoid-prism primitive so tank tracks have the
right shape.

## Goals
1. Texture **individual components** independently, finer than the 6 slots.
2. A **preset texture library** (recipe + optional baked PNG).
3. A new **trapezoid-prism primitive** (`trap`) for tracks / wedges.
4. Foundation for later **per-face** textures (Phase 3).

Non-goals now: true per-face material arrays (Phase 3); a Stable-Diffusion backend
(Gemini-native stays).

## Core concept: `texGroup` is the texture unit; `slot` stays the material kind
Each `SpecPart` gains optional **`texGroup: string`** (normalized: trimmed +
lowercased). The **texture is assigned per `texGroup`**; the `slot` keeps its only
job — the *material kind* (metalness/roughness, accent glow, glass). When
`texGroup` is absent the part's group **defaults to its slot**.

Crucially the texture map's key is the **group**, and a group defaults to the
slot, so **the existing `slotTextures` field and `slot_<key>.png` filenames are
reused unchanged** — their key meaning simply broadens from "slot" to "group".
Legacy bundles (parts with no `texGroup`) have group==slot, so **no migration and
no field rename**: every existing export and committed spec keeps working as-is.
(We keep the names `slotTextures` / `slot_<key>.png` / `importedSlotMats` to avoid
churn; only their key semantics generalize.)

The 2-pass geometry generator **auto-assigns** a group per part (it already
reasons per-part). The studio lets the user rename / merge / split / reassign.
Chosen approach: **A — auto-groups from the generator, editable in the studio.**

---

## Phase 1 — component groups

### vehicle-spec (both repos)
- `SpecPart.texGroup?: string` (optional; normalized). Group key; default = slot.
- `SCHEMA_DOC` (geometry system prompt): instruct a short lowercase `texGroup`
  per part naming its component (`hull`, `cab`, `track`, `roadwheel`, `cutter`,
  `barrel`, `leg`, `dome`, `glass`, …); related parts share a group.
- Validator: `texGroup` optional; if present, non-empty string after trim. No new
  hard constraints.

### Game renderer — the load-bearing change (slot → group two-level merge)
The renderer must keep **all** slot-based material logic (`bMat/dMat`,
`accentMat` glow, `lightMat`, `smoothMat`, `roofMat`, shadow flags) AND add a
group dimension. Therefore the merge becomes **two-level: slot → group →
geometry**, not "merge by group".

- `specInterpreter.buildPartsFromSpec` carries `texGroup` onto each `Part`
  (default = slot).
- The per-slot geometry merge (`SlotGeos`) sub-divides each slot bucket by group:
  effectively a list of `{ slot, group, geometry }` (or `slot → Map<group,geo>`).
  Back-compat: with no groups, each slot has exactly one group (==slot) → byte-
  identical to today.
- `meshesFor` iterates these: **material kind is chosen by `slot`** (unchanged
  branch logic); then if a **group texture** exists for that `{slot,group}` AND
  the slot is a *textured kind* (`body/dark/smooth/roof`), the map is applied
  (clone the slot material, set `.map`). `accent`/`light` keep their special
  emissive materials (a group texture does not strip the faction glow / lamps).
- Mixed-slot groups are handled naturally: a `cab` group containing `body` hull +
  `light` glass renders as a textured body sub-mesh + a normal glass sub-mesh; the
  group texture only lands on the textured-kind sub-meshes.
- `makeGhost`, bounding-box `scan`, and the turret/spin/load anim sub-groups must
  iterate the same two-level structure (each anim sub-group also splits slot→group).
- `importedSlotMats` → resolves a material per `{slot,group}` from the spec's
  `slotTextures[group]` (key = group). Reads remain named `slotTextures`.

### Studio
- The "Component Textures" panel becomes **per-group**:
  - Lists groups present (`SpecRenderer.groupsPresent()`); selecting one
    highlights all its parts (`setSelectedGroup`, parallel to the slot path).
  - Each mesh stores both `userData.slot` (material kind) and `userData.group`
    (selection + texture). `onPick` returns the group.
  - Working multi-selection: click parts to add/remove → "New group from
    selection" (name it) reassigns those parts' `texGroup`. "Rename" / "Merge
    into…" per group. Group keys normalized (trim+lowercase) to avoid collisions.
  - Per group: editable prompt + **Generate** / **Sample from sketch** / **Apply
    preset** (Phase 2) / **Clear**.
- `SpecRenderer`: `slotTex` generalizes to `groupTex` (key = group); the base body
  texture still follows a part's **slot** (`TEXTURED_SLOTS`), a group texture
  overrides it.
- Persistence reuses `slot_<group>.png` + `slotTextures[group]` (no rename). Spec
  (with `texGroup` per part) saved in the version. Export carries the same.

### Sketch sampling per group (not just slot)
`analyzeTexture` / `TEXTURE_ANALYSIS` must reason **per group**: it receives the
group list + a short meaning per group (default meaning from the group's slot, or
the group name itself) and returns a crop + img2img prompt per group — otherwise
"sample from sketch" cannot separate `track` vs `leg` vs `barrel` (all formerly
`dark`), which is the whole point.

### Game import
`importVehicle.ts` keeps copying `slot_<key>.png` → assets and injecting
`slotTextures` (key = group) into the spec. **Dual-read** is automatic because the
field/filenames are unchanged; legacy keys are just slot-named groups.

---

## Phase 2 — texture library (recipe + optional baked PNG)
- Server store `library/_presets.json`: `{ id, name, category, slotKind, prompt,
  hasPng }`; baked images `library/_presets/<id>.png`.
- Seed ~10: `wheel`, `tire`, `track` (tread band), `roadwheel`, `walker_leg`,
  `hull_riveted`, `hull_doors`, `canopy_glass`, `cannon_barrel`, `sensor_dome`.
- Studio per group: **Apply preset** → if it has a PNG, map instantly (free);
  else generate via Gemini with the preset prompt, **faction-themed**. **Save
  current as preset** grows the library. Endpoints `GET/POST /api/presets` + image.

---

## Phase 3 — per-face textures (later, optional)
Per-primitive face material arrays (box 6 faces; cyl top/side/bottom; trap faces)
so one part can carry tread-top + wheel-sides without splitting. Deferred.

---

## New primitive: `trap` (trapezoidal prism)
A symmetric (isosceles) trapezoid **side profile in the Z–Y plane** (length ×
height), extruded across the **width (X)** — the natural tank-track shape (default
orientation = Variant A; reorient anything else with `rot`).
- **size = `[wTop, wBottom, h, d]`** = top length (Z), bottom length (Z), height
  (Y), thickness/depth (X). `ARG_ARITY.trap = 4`; added to `PRIMS` and `SpecPrim`.
- `wTop` and `wBottom` are **independent**: `wBottom > wTop` (ground-contact
  wedge), `wTop > wBottom` (top overhang), or equal (box) are all valid. The
  validator imposes **no ordering** — just 4 finite `size` numbers.
- Cross-section centred at origin in (Z, Y): `(-wBottom/2,-h/2) (wBottom/2,-h/2)
  (wTop/2,h/2) (-wTop/2,h/2)`; extruded along **X** from `-d/2 … +d/2`.
- Built via `THREE.Shape` + `ExtrudeGeometry(depth=d)`, then oriented so the
  parallel edges lie along world **Z** and the extrusion along world **X**, and
  centred on the extrusion axis (`ExtrudeGeometry` extrudes the shape's local +Z
  from 0..depth, so translate by `-d/2` after orienting). Implement the orientation
  + centring **identically** in `SpecRenderer.geoFor` and the game
  `specInterpreter`/factory, or studio and game disagree on the part origin.
- Game round-trip: add a `trap(...)` factory with `tagGeo(...,'trap',
  [wTop,wBottom,h,d])` so `GEO_SPEC`/`P().spec` capture works (parity with
  box/cyl). Procedural models need not emit `trap`; only the interpreter +
  factory + validator must support it.
- `SCHEMA_DOC`: document `trap`; recommend it for tank-track bands / wedges, and
  note both `wBottom>wTop` and `wTop>wBottom` are valid silhouettes.

---

## Back-compat & risks (from spec review)
- **No migration / no rename**: `slotTextures` + `slot_<key>.png` reused with key
  = group (group defaults to slot). 29 existing bundles + committed specs render
  unchanged.
- **Riskiest edit**: the two-level slot→group merge in `models.ts`
  (`SlotGeos`/`Template`/`meshesFor`/`makeGhost`/`scan`/anim sub-groups). Covered
  by existing vitest interpreter/round-trip tests + new grouped-spec tests.
- **Material-kind preserved by slot**: accent glow / glass survive grouping
  because material is chosen by slot, texture by group.
- **`trap` Z-centering** must be identical in both engines (named risk).

## Testing
- vitest: validator accepts `texGroup` + `trap`(arity 4); interpreter builds a
  `trap` mesh, defaults group=slot, and sub-merges slot→group; round-trip keeps
  groups + `trap`; a spec with two groups in one slot yields two textured
  sub-meshes.
- Studio: tsc + live verify (assign group, per-group generate, preset apply,
  sketch-sample per group, `trap` renders).
- Game: dry-run import of a grouped + `trap` bundle; in-game render check; confirm
  a legacy (no-group) spec is byte-identical.

## Phasing
Phase 1 (groups: schema + two-level renderer + studio panel + per-group sampling)
and `trap` land together (shared schema/interpreter touch points). Then Phase 2
(library). Phase 3 (per-face) later.

## Files to touch (named for the implementer)
- Game: `src/vehicles/spec/vehicleSpec.ts`, `src/vehicles/spec/validate.ts`,
  `src/render/specInterpreter.ts`, `src/render/models.ts` (the two-level merge:
  `SlotGeos`/`Template`/`meshesFor`/`makeGhost`/`scan`/`importedSlotMats` + `trap`
  factory/`tagGeo`), `src/render/vehicleModels.ts` (trap factory if shared),
  `scripts/importVehicle.ts` (unchanged keys; copy `slot_*`).
- Studio: `src/spec/vehicleSpec.ts` + `src/spec/validate.ts` (mirror),
  `src/preview/SpecRenderer.ts` (group tex + picking + `trap` geo),
  `src/studio.ts` (group panel), `server/gemini.mjs` (`SCHEMA_DOC` group tag +
  `trap`; `TEXTURE_ANALYSIS` per group; presets endpoints).
