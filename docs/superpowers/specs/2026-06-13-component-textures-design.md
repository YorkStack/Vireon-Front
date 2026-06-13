# Component Textures, Texture Library & Trapezoid Primitive — Design

> Status: approved direction (brainstorm 2026-06-13). Spans both repos: the game
> (`Vireon Front`) and the studio (`vireon-design-studio`). The `vehicle-spec`
> schema is the contract between them; each side implements it independently.

## Problem
Texturing is per **slot** (`body/dark/accent/light/smooth/roof`). A slot is a
*material category*, not a *component*: tracks, the harvester cutter, gun barrels
and walker legs are all `dark`, so they are forced to share one texture. The user
needs distinct components to take distinct textures (tracks ≠ cutter ≠ barrel),
a way to assign parts to texture units, a reusable preset library, and a new base
primitive (trapezoidal prism) so tank tracks can be modelled with the right shape.

## Goals
1. Texture **individual components** independently, finer than the 6 slots.
2. A **preset texture library** (recipe + optional baked PNG): wheels, tires,
   tracks, legs, riveted/doored hull, glass canopy, cannons, etc.
3. A new **trapezoid-prism primitive** (`trap`) for tracks and wedge shapes.
4. Foundation for later **per-face** textures (track top vs sides) — Phase 3.

Non-goals (now): true per-face material arrays (Phase 3, optional later); a
Stable-Diffusion backend (Gemini-native stays).

## Core concept: `texGroup` (a named texture unit), slot stays the material kind
Each `SpecPart` gains an optional **`texGroup: string`**. The `slot` keeps its
only-material-kind role (metalness/roughness, accent glow); the **texture is
assigned per `texGroup`**. When `texGroup` is absent the part's group **defaults
to its slot**, so every existing vehicle is unchanged.

The set of distinct `texGroup` values in a spec = the texturable units. The
2-pass geometry generator **auto-assigns** a semantic group per part (it already
reasons about parts: "left MG", "FL thigh"), e.g. `track`, `roadwheel`, `cutter`,
`cab`, `barrel`, `hull`. The studio lets the user rename / merge / split / reassign.

Chosen approach: **A — auto-groups from the generator, editable in the studio**
(over B: fully manual; C: per-face-only — rejected per brainstorm).

---

## Phase 1 — component groups

### vehicle-spec (both repos)
- `SpecPart.texGroup?: string`. Group key for a part; default = `slot`.
- Geometry generator (`SCHEMA_DOC`) instructs: give each part a short lowercase
  `texGroup` naming its component (`hull`, `cab`, `track`, `roadwheel`, `cutter`,
  `barrel`, `leg`, `dome`, `glass`, …). Parts that belong together share a group.
- Validator: `texGroup` optional; if present must be a non-empty string. No new
  hard constraints.

### Studio
- The current per-slot "Component Textures" panel becomes **per-group**:
  - Lists the groups present (from the spec). Selecting a group highlights all its
    parts in 3D (reuse `setSelectedSlot` → `setSelectedGroup`).
  - Click a part in 3D selects its group. A **working multi-selection** (click
    parts to add/remove) + "New group from selection" (name it) reassigns those
    parts' `texGroup`. "Rename" / "Merge into…" per group.
  - Per group: editable prompt + **Generate** (text→image) / **Sample from
    sketch** (analyze+img2img, reused) / **Apply preset** (Phase 2) / **Clear**.
- Persistence: textures saved as `tex_<group>.png`; per-group prompts/crops keyed
  by group. The spec (with `texGroup` per part) is saved in the version.
- 3D preview (`SpecRenderer`) maps per-group textures (generalize `slotTex` →
  `groupTex`); material kind still from each part's slot.

### Game
- `specInterpreter` carries `texGroup` onto each built `Part` (default slot).
- `models.ts` merges meshes by **group** instead of only by slot; the material
  kind (body/dark/accent/light/smooth/roof look) is taken from the group's parts'
  slot; the per-group texture (if present) overrides the map.
- Import copies `tex_<group>.png` → assets and injects `groupTextures` (group→url)
  into the spec; `importedSlotMats` → `importedGroupMats`.
- Back-compat: specs without `texGroup` behave exactly as today (group = slot).

---

## Phase 2 — texture library (recipe + optional baked PNG)
- Server store `library/_presets.json`: array of
  `{ id, name, category, slotKind, prompt, hasPng }`; baked images as
  `library/_presets/<id>.png`.
- Seed ~10 presets: `wheel`, `tire`, `track` (tread band), `roadwheel`,
  `walker_leg`, `hull_riveted`, `hull_doors`, `canopy_glass`, `cannon_barrel`,
  `sensor_dome`. Each ships with a strong prompt; baked PNGs optional (cache on
  first generate).
- Studio: per group, **Apply preset** → if the preset has a PNG, map it instantly
  (free); else generate via Gemini with the preset prompt, **faction-themed**
  (palette/material folded in). **Save current as preset** grows the library.
- Endpoints: `GET/POST /api/presets`, preset image read.

---

## Phase 3 — per-face textures (later, optional)
Per-primitive face material arrays (box: 6 faces; cyl: top/side/bottom; trap:
its faces) so a single part can carry e.g. tread on top + road-wheels on the
sides without splitting into parts. Deferred; not in this build.

---

## New primitive: `trap` (trapezoidal prism)
For tank tracks and wedge shapes. Side profile is a trapezoid (X = length,
Y = height) extruded across the width (Z).
- **size = `[wTop, wBottom, h, d]`** → top length, bottom length, height, depth
  (width). `ARG_ARITY.trap = 4`. Added to `PRIMS`.
- Cross-section centred at origin: corners
  `(-wBottom/2,-h/2)`, `(wBottom/2,-h/2)`, `(wTop/2,h/2)`, `(-wTop/2,h/2)`;
  extruded from `z=-d/2` to `z=+d/2`.
- Built via `THREE.Shape` + `ExtrudeGeometry(depth=d)` (then centre on Z), in
  **both** the studio `SpecRenderer.geoFor` and the game `specInterpreter`.
- Validator: `trap` requires 4 finite `size` numbers.
- `SCHEMA_DOC`: document `trap` and recommend it for tracks/wedges
  (e.g. tank track band = a wide `trap` with `wBottom > wTop`).

---

## Data flow (unchanged shape, generalized key)
sketch → geometry(2-pass, parts carry `texGroup`) → per-group textures
(generate / sample-from-sketch / preset) → save version (`tex_<group>.png` +
spec) → export bundle (`tex_<group>.png` + `groupTextures` in spec) →
`import:vehicle` → game renders per group.

## Back-compat & risks
- Specs without `texGroup` render identically (group = slot). Existing 29 saved
  vehicles keep working; re-generating gives them auto-groups.
- Renderer change (merge-by-group) is the riskiest edit — covered by the existing
  vitest interpreter/round-trip tests plus a new test for grouped specs.
- `trap` is additive; absent in all current specs, so no migration needed.

## Testing
- vitest: validator accepts `texGroup` + `trap`(arity 4); interpreter builds a
  `trap` mesh and groups parts by `texGroup`; round-trip keeps groups.
- Studio: tsc + live verify (assign group, generate per-group, preset apply).
- Game: dry-run import of a grouped + `trap` bundle; in-game render check.

## Phasing / order
Phase 1 (groups: schema + studio panel + game render) → Phase 2 (library) →
Phase 3 (per-face, later). `trap` lands with Phase 1 (it needs the same schema +
interpreter touch points).
