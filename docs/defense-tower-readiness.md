# Defense Tower Readiness — Pivot, Muzzle & Asset Suitability

> **Defense Tower Readiness Phase** (2026-06-17). Pure analysis — **no activation,
> no integration, no code/runtime/balance/combat change.** Defense-tower GLBs stay
> disabled (`ACTIVE_ASSET_ROLES = {'power','hq'}`).

## 1. Short verdict

The four defense-tower GLBs are **higher quality than expected**: each ships
explicit named locator nodes (`ATTACH_turret_pivot`, `ATTACH_muzzle`,
`ATTACH_effect_origin`, `ATTACH_base_center`, `ATTACH_hitbox_center`,
`ATTACH_range_origin`) and richly named geometry + emissive faction materials.

**BUT** the scene graph is **flat**: `ATTACH_turret_pivot` is an **empty marker
with zero children** — the rotating head meshes are NOT parented under it. So:

- **Muzzle / fire-origin: READY** — `ATTACH_muzzle` is a usable locator now.
- **Turret aim: NOT plug-and-play** — rotating the pivot marker moves nothing;
  enabling aim needs per-faction re-parenting of the head meshes under a pivot.

Style fit (one GLB per faction, no second asset):

| Faction | GLB | Weapon style | Natural mapping |
|---|---|---|---|
| Crimson | vulcan autocannon (2 barrels, ammo box) | ballistic | **cannon** |
| Verdant | spitter acid projectile (maw, mandibles) | projectile | **cannon** |
| Azure | pulse precision laser (lens aperture) | energy/laser | **lance** |
| Solar | beam monolith (crystal, beam lens, static spire) | energy/beam | **lance** |

→ Each faction's existing GLB suits exactly **one** of the two turret buildings.
The other type is missing for every faction.

## 2. Current tower GLBs (Task B)

`buildingAssets.ts` registers **4 defense assets** (role `defense`, tag `turret`),
one per faction. They are registered but **inactive** — `buildingGlb.ts`
`ACTIVE_ASSET_ROLES = {'power','hq'}` excludes `defense`, so `activeBuildingAsset`
never returns them and cannon/lance stay procedural (so turret-aim isn't disturbed).
`UNMAPPED_BUILDING_ASSETS` is empty (no tower gaps recorded).

| Faction | Asset Key | File | Exists | Registered | Active | Notes |
|---|---|---|---|---|---|---|
| Crimson | `crimson.defense.vulcan` | defense/crimson/crimson_vulcan_autocannon_turret.glb | ✅ | ✅ | ❌ | ballistic, 2 barrels |
| Azure | `azure.defense.pulse` | defense/azure/azure_pulse_precision_laser_turret.glb | ✅ | ✅ | ❌ | laser lens |
| Verdant | `verdant.defense.spitter` | defense/verdant/verdant_spitter_acid_projectile_turret.glb | ✅ | ✅ | ❌ | acid projectile |
| Solar | `solar.defense.monolith` | defense/solar/solar_beam_monolith_tower.glb | ✅ | ✅ | ❌ | beam spire |

**Exactly one tower GLB per faction.** `defenseTowerAsset(factionId)` returns it,
but nothing maps it to the `cannon` vs `lance` building ids
(`activeBuildingAsset` only handles `spire`→power and `nexus`→hq).

## 3. GLB node / material analysis (Task C)

All four share the same locator set: **`ATTACH_base_center`,
`ATTACH_turret_pivot`, `ATTACH_muzzle`, `ATTACH_effect_origin`,
`ATTACH_hitbox_center`, `ATTACH_range_origin`** (empty marker nodes).

| | Crimson vulcan | Azure pulse | Verdant spitter | Solar monolith |
|---|---|---|---|---|
| Meshes | 26 | 21 | 29 | 31 |
| Named nodes | 32 | 27 | 35 | 37 |
| Base parts | CRI_base, bolts, slew_outer | AZU_base, base_ring, lower_body | VER_base_main, plates, legs/claws | SOL_step1-3, runes |
| Rotating/head parts | slew_inner, housing, side_plates, gun_shield, **barrel_-15/+15**, **muzzle_tip_-15/+15**, shrouds, ammo_box, feed_chute | waist, upper_body, lens_housing, lens_ring, **lens_aperture**, top_cap/tip | thorax, dorsal_*, acid_sacs, **mandible_L/R**, **maw_tube**, acid_core | mono_body/taper, rings/glows, crystal, shards, **beam_lens** |
| Barrel/muzzle geo | ✅ explicit (barrel + muzzle_tip ×2) | ✅ lens aperture | ✅ maw tube / mandibles | ✅ beam lens / crystal tip |
| Emissive mat | CRI_warn_light (1,0.55,0.05) | AZU_cyan_emissive (0,0.88,1) + laser_lens | VER_acid_emissive (0.14,1,0.05) | SOL_amber_emissive (1,0.65,0) + crystal_magenta |
| Transparency | — | laser_lens ALPHA | flesh_membrane ALPHA | crystal_magenta ALPHA |
| Style | cannon-like | laser/lance-like | flak/projectile (cannon-ish) | beam/lance, **static spire (no obvious rotating head)** |
| Faction identity | strong | strong | strong | strong |
| `ATTACH_turret_pivot` children | **0 (empty marker)** | **0** | **0** | **0** |
| `ATTACH_muzzle` (GLB-local) | y0.78 z0.98 | y1.36 z0.61 | (present) | (present) |

**Muzzle derivable?** Yes — directly from `ATTACH_muzzle` (and `ATTACH_effect_origin`)
locators; or, fallback, from the named `*_muzzle_tip` / `*_lens` / `*_beam_lens`
geometry. No guessing needed.

**Key blocker:** the pivot is a locator, not a parent. The head geometry sits at
scene root next to the base; nothing is grouped for rotation.

## 4. Current tower rendering & combat logic (Task D)

- **Defs:** `cannon` + `lance` in [buildings.json](../src/data/buildings.json).
  `cannon`: shell, dmg40, range9, cd1.7, prereq barracks. `lance`: laser, dmg55,
  range10.5, cd1.9, `needsPower`, prereq foundry.
- **Procedural visuals:** [models.ts](../src/render/models.ts) `buildingParts`:
  - `cannon` (≈L587) builds a real **`A('turret', …)` aim group** with a horizontal
    barrel → it **rotates to face the target**.
  - `lance` (≈L602) builds a static pylon + an **`A('spin', …)` group** (floating
    energy orb that just spins) → it does **NOT aim/rotate toward the target**.
- **Aim rotation:** [world.ts](../src/sim/world.ts) `animateBuilding` (≈L1088):
  `anim.turret.rotation.y = aimYaw(...)` toward the target, else idle sweep. Only
  `anim.turret` aims; `anim.spin` only spins.
- **Muzzle / fire origin:** [world.ts](../src/sim/world.ts) `fireWeapon` (≈L540):
  if `shooter.group.userData.muzzle` exists it uses that node's world position;
  **procedural buildings set no `muzzle`**, so `from` falls back to a height-based
  point (`topY * 0.7`). Buildings use the **same `fireWeapon` VFX path as units**
  (muzzleFlash + beam/projectile), now faction-aware (VFX Phase 2).
- **shell vs laser:** decided by `weapon.projectile` — `'laser'` → `effects.beam`,
  else → `effects.projectile`. cannon=shell→projectile, lance=laser→beam.
- **GLB loader today:** [buildingGlb.ts](../src/render/buildingGlb.ts)
  `makeGlbBuildingGroup` sets `userData.anim = {}` (or `pulseMats`) and does **not**
  wire `anim.turret` or `userData.muzzle`. So even if a tower GLB were activated as
  is, it would render **static** (no aim, height-based muzzle).
- **Risk if activated without a separated head:** the cannon would **stop visibly
  aiming** (procedural turret replaced by a static GLB whose pivot marker has no
  geometry). Combat numbers are unaffected (aim is cosmetic — hits are
  cooldown/range based), but the visual "turret tracks target" cue is lost for the
  cannon. The lance already doesn't aim, so it's unaffected.

## 5. Mapping options (Task E)

| Option | Pros | Cons |
|---|---|---|
| **1. GLB = cannon** | crimson/verdant GLBs are ballistic → perfect fit | azure/solar GLBs are laser/beam → wrong for cannon; lance still un-modelled |
| **2. GLB = lance** | azure/solar GLBs are energy → perfect fit | crimson/verdant are ballistic → wrong for lance; cannon still un-modelled |
| **3. GLB = generic tower for BOTH** | one asset covers both ids now; quick | cannon and lance look identical per faction (loses silhouette distinction, the whole point of two towers) |
| **4. GLB base + procedural head (hybrid)** | keeps proven aim; muzzle from ATTACH | mixing GLB body + procedural barrel rarely lines up; per-faction tuning; fiddly |
| **5. Generate the missing 4 assets** | each faction gets a distinct cannon AND lance | 4 more generations + the same pivot-rig work |

**Recommendation:** **per-faction split by style** (Option 1 ∪ 2):
`cannon` ← crimson vulcan + verdant spitter; `lance` ← azure pulse + solar
monolith. Then **generate the four missing counterparts** (crimson lance, verdant
lance, azure cannon, solar cannon) for full distinct coverage. Activate **static
first** (ATTACH_muzzle for VFX, no aim), add aim re-parenting only for the
cannon-style towers in a later sub-step. This keeps each step low-risk and the
procedural fallback intact throughout.

## 6. Are they directly activatable? (Task F summary)

**Not as a clean drop-in.** Activation requires, in order of effort:

1. **Mapping** — `activeBuildingAsset` must map `cannon`/`lance` → the right
   faction GLB (today only spire/nexus are mapped); add `'defense'` to
   `ACTIVE_ASSET_ROLES`.
2. **Muzzle wiring** — in `makeGlbBuildingGroup`, find `ATTACH_muzzle` (and/or
   `ATTACH_effect_origin`) and set `outer.userData.muzzle` so `fireWeapon` uses the
   barrel tip. (Read world position AFTER auto-fit scaling.) **Low risk.**
3. **Aim (optional)** — to restore the cannon's tracking: group the rotating head
   meshes (by name prefix, e.g. crimson everything from `slew_inner` up) under a new
   pivot at `ATTACH_turret_pivot`, expose it as `userData.anim.turret`. **Per-faction
   mesh-grouping logic; medium risk.** Without this, towers render static.
4. **Fallback** — keep returning `null`/procedural when no GLB or when a faction's
   tower id isn't mapped, exactly like power/hq today.
5. **Tests** — registry mapping per faction; `userData.muzzle` present when activated;
   missing-GLB → procedural; aim group present only when head meshes found; no
   gameplay numbers touched.

## 7. Requirements for NEW cannon / lance assets (Task G)

If/when generating the missing counterparts, each GLB must provide:

**Mandatory locator nodes** (the existing 4 already do this — match them):
```
ATTACH_base_center · ATTACH_turret_pivot · ATTACH_muzzle · ATTACH_effect_origin
```
**Plus, to make aim trivial (improvement over the current assets):** parent the
rotating head geometry UNDER `ATTACH_turret_pivot` (a real transform parent, not a
flat sibling marker), `+Z` forward, muzzle at the barrel tip. If the tool can't
parent, keep a **clearly separable, name-prefixed head set** so code can group it.

**`cannon` (ballistic):** visible barrel(s), clear muzzle, rotating head,
mechanical, faction-specific.
**`lance` (energy):** clear emitter core, clear emission point, rotating head or
aiming emitter, visibly more advanced than the cannon.

Per faction (other-type counterpart to generate):
- **Crimson → lance:** armoured rail/pylon, red+amber energy glow, long forward rail muzzle.
- **Verdant → lance:** organic chitin stalk, bulbous bio-emitter, toxic-green discharge muzzle.
- **Azure → cannon:** white ceramic base, smooth rotating head, forward cyan-tipped ballistic barrel.
- **Solar → cannon:** amber crystalline base, rotating prism head, forward magenta plasma muzzle.

Suggested filenames (existing structure `buildings/defense/<faction>/`):
```
crimson_lance_turret.glb · verdant_lance_turret.glb
azure_cannon_turret.glb  · solar_cannon_turret.glb
```
(The 4 existing files become the cannon (crimson/verdant) and lance (azure/solar).)

## 8. Later integration roadmap (NOT now)

```
Phase 3a — Static tower GLBs: map cannon←crimson/verdant, lance←azure/solar;
  add 'defense' to ACTIVE_ASSET_ROLES; wire ATTACH_muzzle → userData.muzzle;
  fallback intact. Cannon loses visible aim (acceptable interim). Verify + tests.
Phase 3b — Cannon aim: re-parent the rotating head under ATTACH_turret_pivot for
  the cannon-style towers; expose userData.anim.turret. Per-faction grouping.
Phase 3c — Generate the 4 missing counterparts (crimson/verdant lance,
  azure/solar cannon) so every faction has a distinct cannon AND lance.
```

Touched-later files: `buildingAssets.ts` (cannon/lance asset keys + buildingId
links), `buildingGlb.ts` (`ACTIVE_ASSET_ROLES`, `activeBuildingAsset` mapping,
muzzle/pivot wiring in `makeGlbBuildingGroup`). No `buildings.json` change.

## 9. Risks

- **Flat pivot marker:** the biggest surprise — `ATTACH_turret_pivot` has no
  children, so aim is NOT free despite the node existing. Static activation is safe;
  aim is extra work.
- **One asset, two towers:** without the 4 new counterparts, cannon and lance look
  identical per faction (Option 3) — a readability regression vs. the procedural
  pair (which look different).
- **Solar monolith has no rotating head** by design (a static spire) — fine for a
  non-aiming lance, wrong if forced into an aiming cannon.
- **Muzzle marker is in GLB-local space** → must read its world position after the
  loader's auto-fit scale, or the flash sits at the wrong spot.
- **`needsPower` lance:** when offline the procedural lance dims via the low-power
  overlay; a GLB lance must keep that overlay working (it's footprint/topY based, so
  it should — verify).
- Aim is purely cosmetic (hits are cooldown/range based), so none of this changes
  balance — but the "turret tracks you" feedback is a real UX cue worth preserving
  for the cannon.
