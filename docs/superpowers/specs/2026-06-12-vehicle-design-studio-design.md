# Vireon Vehicle Design Studio — Design

> Status: approved design (brainstorm). Next: implementation plan (writing-plans).
> Date: 2026-06-12. Language note: project owner prefers German in chat; this
> spec is in English for tooling/review compatibility.

## 1. Problem & Goal

The in-game faction vehicles are procedurally generated in `src/render/vehicleModels.ts`
(hand-written part lists per chassis + role kit). The owner is not satisfied with
the models and wants to **author each vehicle's geometry and textures in an
external program** driven by Google Gemini + Nano Banana, then **import the
results back into the game** so geometry and textures land in the right places.

Hard requirement: the design tool must **pass the in-game vehicle size to
Gemini** at design time so the detail-to-size ratio is correct. The flow must
**start with a Nano Banana sketch** (model description in → sketch out); only
after the owner approves the sketch does the tool design the actual model.

## 2. Locked decisions (from brainstorm)

| Decision | Choice |
|---|---|
| Geometry representation | **Parametric part-list JSON** (Gemini text emits it; no real meshes — Gemini cannot produce meshes) |
| Tool form | **Local web app** (Vite + TS + Three.js, runs in browser) |
| Coupling | **Separate repo + portable bundle**; the JSON **schema is the shared interface** (each side implements it independently, no shared code) |
| Build strategy | **Vertical slice first** — one vehicle end-to-end, then scale to all 32 |
| Geometry quality strategy | **Few-shot from real models** — convert existing procedural vehicles to schema JSON and feed them (plus the approved sketch + size) to Gemini |

## 3. The interface: `vehicle-spec v1` (the linchpin)

A versioned, documented JSON schema both repos implement independently.

```jsonc
{
  "schemaVersion": "1.0",
  "faction": "blue",              // red | blue | green | yellow
  "vehicleClass": "mediumTank",   // matches UNIT_CLASS_TEMPLATES id
  "displayName": "Vanguard",
  "footprint": { "w": 2.0, "h": 1.9, "l": 2.3 },  // MODEL-LOCAL units (same space as vehicleModels.ts), size baked in
  "turretPivot": [0, 1.3, -0.05], // optional; required iff any part has anim:"turret"
  "parts": [
    {
      "prim": "rbox",             // box|cyl|sph|cone|torus|rbox
      "size": [1.4, 0.5, 2.05],   // per-prim arg vector (see table)
      "round": 0.12,              // rbox only: chamfer radius
      "slot": "body",             // body|dark|accent|light|smooth|roof
      "pos": [0, 0.85, 0],
      "rot": [0, 0, 0],           // euler radians
      "anim": null                // null|turret|spin|load
    }
    // ...
  ]
}
```

**Primitive arg vectors** (mirror `vehicleModels.ts` helpers):
`box=[w,h,d]`, `cyl=[rTop,rBottom,h]`, `sph=[r]`, `cone=[r,h]`,
`torus=[r,tube]`, `rbox=[w,h,d]` (+ `round`).
Segment counts (`cyl`/`sph`/`cone`) are **interpreter defaults, not authored by
Gemini** — the schema deliberately omits them so the LLM never has to reason
about tessellation; the interpreter applies the same defaults as `models.ts`.

**Units:** model-local — the exact space the current `Part[]` code uses. The
game renders every unit at `scale = UNIT_VISUAL_SCALE (1.28) × silhouetteScale`
(per-variant; default 1) — see `src/render/models.ts` `makeEntityGroup`. Specs
do **not** bake in that render scale; they bake in the model-local footprint.
The catalog (§4) derives the model-local target from the in-game world size by
dividing out the **full** render scale (both factors), so a variant with
`silhouetteScale ≠ 1` still gets the correct size to Gemini.

**Validation:** a shared-shape validator on both sides — checks enums, arg-vector
arity per prim, finite numbers, `turretPivot` presence when a `turret` part
exists, and clamps any part center outside `1.5×footprint` (guards against
runaway Gemini output). Invalid specs are rejected with a readable error; the
game falls back to procedural geometry (§7).

## 4. Size to Gemini (core requirement)

The game exports `catalog.json` (one entry per faction × class):

```jsonc
{
  "blue:mediumTank": {
    "displayName": "Vanguard", "role": "tank", "techTier": 2,
    "renderScale": 1.28,                                    // UNIT_VISUAL_SCALE * silhouetteScale (1.0 here)
    "worldFootprint": { "w": 2.56, "h": 2.43, "l": 2.94 },  // localFootprint * renderScale — the size players see
    "tilesWide": 1.28, "tileSize": 2.0,
    "localFootprint": { "w": 2.0, "h": 1.9, "l": 2.3 },     // worldFootprint / renderScale — what specs author in
    "movementType": "wheeled",
    "designBrief": { /* from src/data/artMetadata.ts: silhouette, components, palette, alienKeywords, forbidden, rtsReadabilityNotes */ }
  }
}
```

Generation source: `collisionRadius` (template), chassis `halfW/len/hullH`
(variant), `UNIT_VISUAL_SCALE`, **`silhouetteScale`** (variant; folded into
`renderScale`), `TILE`, plus `ART_METADATA` briefs. The studio injects size into
**every** prompt — sketch *and* geometry — e.g. "this vehicle is ~2.6×2.9 world
units, about 1.3 tiles wide; design at this scale; keep detail readable at RTS
camera distance."

## 5. Gemini pipeline (studio side)

Per vehicle, four stages; each persists its prompt for reproducibility.

1. **Sketch** (Nano Banana): faction art language + class brief + role + size +
   required/forbidden components → orthographic concept sketch (¾ + side).
   Owner **approves** or **regenerates with notes**. Gate: no geometry until
   approved.
2. **Geometry** (Gemini 3 Pro, multimodal): approved **sketch image** + size +
   `vehicle-spec` schema doc + **few-shot examples** (real converted models of
   the same/adjacent class) → a `vehicle-spec` JSON. Studio validates, renders
   it **live in 3D at correct size**. Owner iterates ("turret too big, lower the
   cannon" → regenerate with feedback) or accepts.
3. **Texture** (Nano Banana): the existing bright `vehicle` texture style
   (`generate_asset.py` kind, re-implemented in the studio's Node service) →
   `baseColor.png` (+ optional `emissive.png`).
4. **Export bundle** (§6).

**Few-shot seed (quality enabler):** a one-time converter runs the existing
chassis+kit functions and dumps their `Part[]` as `vehicle-spec` JSON into a
`seeds/` library. These concrete, good, in-style examples are handed to Gemini
in stage 2, sharply improving output quality and consistency.

## 6. Portable bundle

```
exports/<faction>_<class>/
  geometry.json   # vehicle-spec v1
  baseColor.png   # vehicle hull texture (bright style)
  emissive.png    # optional
  sketch.png      # approved concept sketch (provenance)
  meta.json       # prompts (sketch/geometry/texture), model ids, date, size, status
```

Self-contained and portable; no path assumptions about the game repo.

## 7. Game-side integration

- **Schema interpreter** `buildPartsFromSpec(spec): Part[]` in the game —
  converts a `vehicle-spec` into the existing `Part[]` (reusing `P/box/cyl/...`),
  registers `turretPivot`. Feeds the unchanged mesh pipeline.
- **Factory hook:** `getVariantTemplate` prefers an imported spec at
  `src/vehicles/specs/<faction>/<class>.json` when present and the art status
  allows; otherwise falls back to today's procedural `buildVehicleParts`. So
  studio-designed vehicles override; undesigned ones are unaffected. The new
  `src/vehicles/specs/` subdir is intentional and separate from the existing
  per-vehicle `src/vehicles/<faction>/<class>.ts` modules (which keep the
  visual-variant metadata + procedural fallback); the two never collide.
- **Import script** `npm run import:vehicle -- <bundle-dir>` (and an
  `--all <dir>` form): validates the bundle, copies `geometry.json` →
  `src/vehicles/specs/...`, textures → `public/assets/vehicles/<faction>/<class>/`,
  flips `ART_METADATA` status to `generated`. Reversible (status →
  `needsRevision` reverts to procedural). Dry-run flag prints actions only.

## 8. Studio app structure (separate repo `vireon-design-studio`)

- **Vite + TS + Three.js.** Browser UI + a **minimal Node service** that holds
  the Gemini key (from `.env`, gitignored; `.env.example` provided) and runs all
  Gemini/Nano-Banana calls server-side — the **browser never sees the key**.
- **UI:** left = faction/vehicle list (from `catalog.json`); center = sketch
  viewer + **live 3D preview of the real spec** at correct size; right =
  controls (notes, generate sketch, approve, generate geometry, regenerate with
  feedback, generate texture, export). Status badges per vehicle.

### Components (each independently understandable/testable)
| Unit | Responsibility | Depends on |
|---|---|---|
| `spec/` | `vehicle-spec` type + validator (the contract) | — |
| `catalog` | vehicle list + sizes + briefs (input) | catalog.json |
| `gemini-service` (Node) | sketch / geometry / texture calls; holds key | spec, @google/genai |
| `preview` | Three.js renderer interpreting a spec → meshes | spec |
| `studio-ui` | orchestrates the flow | all above |
| `bundle` | export writer | spec |
| game `spec-interpreter` | `buildPartsFromSpec` | spec, models.ts |
| game `import` | bundle → repo + status | spec, artMetadata |

## 9. Vertical slice (first deliverable)

One vehicle (owner picks; default **Azure `mediumTank`**) through the whole
chain: sketch → approve → geometry (few-shot) → texture → export → import →
**renders in game at correct size**. Includes: the `vehicle-spec` schema +
validator, the few-shot converter (≥ that vehicle's class across the styles),
the game interpreter + import script + factory hook, and the studio app
skeleton with the vehicle list (only the slice vehicle fully wired). Then scale
to all 32 (list + batch).

## 10. Error handling & testing

- **Schema validation** on both sides; readable rejects; game falls back to
  procedural on any invalid/missing spec.
- **Gemini failures**: 503/empty-image retry with backoff (the existing pipeline
  pattern); key-missing fails safely with a clear message; nothing is written on
  failure.
- **Tests:** validator unit tests (valid/invalid specs, arg arity, turret-pivot
  rule, clamp); `buildPartsFromSpec` round-trip on a seed (convert procedural →
  spec → parts, assert part count/slots/bbox match within tolerance); import
  script dry-run assertion (correct destination paths, status flip).

## 11. Out of scope (YAGNI for now)

- Manual numeric/slider editing of parts in the studio (rely on regenerate +
  feedback; add later if iteration proves insufficient).
- Roughness/normal/decal maps (baseColor + optional emissive only).
- Animation authoring beyond the existing `turret/spin/load` channels.
- Publishing/packaging the studio (dev-run via npm is enough).

## 12. Open risks

- **Gemini geometry quality** is the central risk; mitigated by sketch-as-visual
  reference + few-shot real examples + live preview + feedback loop + validation
  clamp. If still insufficient, fallback is option C (semi-manual block nudging)
  — a later increment, not this slice.
- **Unit/scale mismatch** between spec (model-local) and game
  (×`UNIT_VISUAL_SCALE`×`silhouetteScale`) — pinned by authoring specs in
  model-local units, dividing out the **full** render scale (both factors) in
  the catalog, and verifying via the round-trip test (which asserts the imported
  spec's world bbox matches the procedural model's within tolerance, including
  `silhouetteScale`).
