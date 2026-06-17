# Building Asset Roadmap — Exact Buildables, Faction Gaps & Generation Prompts

> **Asset Planning Phase** (2026-06-17). Pure analysis + roadmap — **no code,
> runtime, balance, combat, economy, placement, pathfinding, VFX, crystal or
> defense-tower-activation change.** Source of truth: `src/data/buildings.json`,
> `src/data/buildingRoles.ts`, `src/data/buildingAssets.ts`, `src/ui/hud.ts`
> (`BUILD_ORDER`), `src/ai/enemy.ts` (`CORE_PLAN`/`DEFENSE_PLAN`),
> `src/render/buildingGlb.ts` (`ACTIVE_ASSET_ROLES`).

## A. Exact building list (everything in code)

There are **8 buildings**. ALL 8 are player-buildable (`BUILD_ORDER` in
[hud.ts](../src/ui/hud.ts)) and ALL 8 are used by the AI
(`CORE_PLAN` + `DEFENSE_PLAN` in [enemy.ts](../src/ai/enemy.ts)). **No
internal/decorative/tech-only buildings exist.**

| ID | Display Name | Role | Tags | Player | AI | Cost | Build | Power | Prereq | Produces | Weapon | Footprint | Current Visual |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `nexus` | Command Nexus | hq | energyProducer | ✓ | ✓ | 2000 | 30 | **+20** | — | — | — | 3×3 | **GLB ×4 (active)** |
| `refinery` | Refinery | resource | — | ✓ | ✓ | 900 | 16 | −10 | — | — | — | 3×2 | procedural |
| `spire` | Power Spire | power | powerPlant, energyProducer | ✓ | ✓ | 450 | 10 | **+50** | — | — | — | 2×2 | **GLB ×4 (active)** |
| `barracks` | Barracks | production | — | ✓ | ✓ | 700 | 14 | −15 | spire | infantry | — | 2×2 | procedural |
| `foundry` | Vehicle Foundry | production | — | ✓ | ✓ | 1200 | 20 | −25 | refinery | vehicle | — | 3×3 | procedural |
| `wall` | Barrier Segment | defense | — | ✓ | ✓ | 60 | 2 | 0 | — | — | — | 1×1 | procedural |
| `cannon` | Bastion Cannon | defense | turret | ✓ | ✓ | 500 | 10 | −8 | barracks | — | shell dmg40 r9 cd1.7 | 1×1 | procedural (GLB candidate, disabled) |
| `lance` | Pulse Lance | defense | turret | ✓ | ✓ | 800 | 13 | −20 | foundry | — | laser dmg55 r10.5 cd1.9 | 1×1 | procedural (GLB candidate, disabled) |

Extra flags: `nexus` is `critical` + `buildSource` (limit 1, no prereq);
`refinery` is the harvester `dropoff`; `lance` is `needsPower` (offline when
power short); `wall` is a passive `wall` barrier. **`buildings.json` is
faction-agnostic** — every faction shares the same 8 defs; only the *visual*
differs per faction (and only for nexus + spire today).

## B. Building asset registry status

`buildingAssets.ts` holds **12 GLB mappings** (4 HQ + 4 power + 4 defense).
`ACTIVE_ASSET_ROLES = {'power','hq'}` → **only HQ + power render as GLB**; the
4 defense GLBs are inventoried but **NOT wired** (cannon/lance stay procedural so
turret-aim is undisturbed). `refinery/barracks/foundry/wall` have **no GLB at all**.

| Building | Role | Crimson | Azure | Verdant | Solar | Active? | Fallback | Notes |
|---|---|---|---|---|---|---|---|---|
| `nexus` | hq | ✅ fortress | ✅ headquarters | ✅ hive_core | ✅ singularity | **Yes** | hq | live per-faction |
| `spire` | power | ✅ power_plant | ✅ resonance_core | ✅ bio_reactor | ✅ radiant_nexus | **Yes** | powerPlant | live per-faction |
| `cannon` | defense | 🟡 vulcan | 🟡 pulse | 🟡 spitter | 🟡 monolith | **No** | turret | GLB exists but disabled; 1 turret GLB must serve cannon **and** lance |
| `lance` | defense | 🟡 (shared) | 🟡 (shared) | 🟡 (shared) | 🟡 (shared) | **No** | turret | no dedicated lance GLB — mapping deferred |
| `refinery` | resource | ❌ | ❌ | ❌ | ❌ | proc | — | **missing all 4** |
| `barracks` | production | ❌ | ❌ | ❌ | ❌ | proc | — | **missing all 4** |
| `foundry` | production | ❌ | ❌ | ❌ | ❌ | proc | — | **missing all 4** |
| `wall` | defense | ❌ | ❌ | ❌ | ❌ | proc | — | **missing all 4** |

✅ active GLB · 🟡 GLB present but disabled · ❌ no GLB (procedural for every faction)

## C. Asset-gap matrix per faction

Identical shape for all four factions (the only difference is the asset names):

| | Crimson Pact | Azure Concorde | Verdant Swarm | Solar Dominion |
|---|---|---|---|---|
| **Present + active** | HQ, power | HQ, power | HQ, power | HQ, power |
| **Present but disabled** | defense turret (vulcan autocannon) | defense turret (pulse laser) | defense turret (acid spitter) | defense turret (beam monolith) |
| **Missing** | refinery, barracks, foundry, wall, + a 2nd turret (cannon vs lance split) | refinery, barracks, foundry, wall, + 2nd turret | refinery, barracks, foundry, wall, + 2nd turret | refinery, barracks, foundry, wall, + 2nd turret |
| **Most important next** | refinery → barracks → foundry | refinery → barracks → foundry | refinery → barracks → foundry | refinery → barracks → foundry |

**Per-faction coverage today: 2 of 8 buildings have a faction-unique look (25%).**
The other 6 (refinery, barracks, foundry, wall, cannon, lance) look identical
across factions (shared procedural mesh) — the biggest faction-identity gap.

## D. Prioritization of missing assets

Suggested order vs. code reality:

1. **Refinery** — ✅ top priority. Built very early, always present (economy core,
   AI `CORE_PLAN[1]`), large 3×2 footprint, highly visible, fully generic today,
   high faction-identity value.
2. **Barracks** — ✅ early prereq for cannon, common, 2×2, generic today.
3. **Foundry** — ✅ vehicle production, prereq for lance, big 3×3, generic.
4. **Wall** — ⚠️ built in quantity (many 1×1 segments) so identity payoff per
   asset is high, but it is small/low-detail; do AFTER production buildings.
5. **Cannon turret** — needs **pivot/muzzle analysis** (turret-aim). The existing
   per-faction defense GLB is the natural cannon. Higher effort than static buildings.
6. **Lance / special tower** — needs its **own** GLB (only one turret GLB exists
   per faction today) + pivot/muzzle analysis.
7. Support/tech buildings — **none exist**; skip until new gameplay adds them.

The code matches the suggested order. **Recommendation:** generate refinery +
barracks + foundry first (static, directly activatable, no turret rig), then wall,
then the two turrets last (they need attachment-node / pivot work).

## E. Design language per faction

Pulled from the prompt brief + faction flavour in code (taglines, tactical labels).

- **Crimson Pact** — human military-industrial. Concrete, steel, armour plates,
  red warning lights, antennas, vents, weapon mounts. Angular, functional,
  fortified. Existing HQ = "Command Fortress"; power = "Power Plant".
- **Azure Concorde** — aquatic high-tech. White/pearl/cyan, smooth ceramic shells,
  domes, fluid curves, shield emitters, water-pressure conduits. Elegant,
  defensive. Existing HQ = "Command Headquarters" (ceramic dome); power =
  "Resonance Core".
- **Verdant Swarm** — insectoid organic biotech. Chitin, biomass, pods; toxic
  green/purple/dark-teal; asymmetrical, alive, wet highlights; hive-growth /
  mutation structures. Tagline "We are many." HQ = "Apex Hive Core"; power =
  "Bio Reactor".
- **Solar Dominion** — alien crystalline solar-tech. Amber/gold/bronze/magenta,
  vertical monoliths, prism cores, plasma veins. Ceremonial, radiant, non-human.
  HQ = "Singularity Nexus"; power = "Radiant Nexus".

## F. Naming convention & target folders

**Follow the existing structure** `public/assets/buildings/<roleDir>/<faction>/<file>.glb`
(used today for hq/power/defense). Add role dirs `resource/` and `production/`:

```
public/assets/buildings/resource/{crimson,azure,verdant,solar}/<faction>_refinery.glb
public/assets/buildings/production/{crimson,azure,verdant,solar}/<faction>_barracks.glb
public/assets/buildings/production/{crimson,azure,verdant,solar}/<faction>_foundry.glb
public/assets/buildings/defense/{crimson,azure,verdant,solar}/<faction>_wall_segment.glb
public/assets/buildings/defense/{crimson,azure,verdant,solar}/<faction>_cannon_turret.glb   # = current vulcan/pulse/spitter/monolith
public/assets/buildings/defense/{crimson,azure,verdant,solar}/<faction>_lance_turret.glb     # NEW, distinct from cannon
```

The flat `crimson_refinery.glb` names in the brief are fine as *file* names; keep
them **inside the role/faction subfolders** to match `buildingAssets.ts` paths.

## G. Shared technical constraints (every prompt)

```
stylized RTS 3D building asset · low/mid-poly readable at RTS camera distance ·
single origin at ground center · clean uniform scale · no baked floor plane ·
no terrain base · no text/labels/UI/characters · no excessive tiny detail ·
faction colour accents · clear silhouette · fits the existing Vireon RTS style ·
exportable as GLB · emissive accents on glow/energy parts (KHR_materials_emissive_strength)
```

For **turrets** add:
```
named attachment nodes if the tool supports them: ATTACH_turret_pivot (Y-rotating
head), ATTACH_muzzle (barrel tip, +Z forward), ATTACH_barrel.
If nodes are impossible: model a CLEARLY separable head + a visible barrel/muzzle
so pivot and muzzle can be located later.
```

---

## H. Generation prompts (24 — 6 building types × 4 factions)

Footprints (keep proportions): refinery 3×2, barracks 2×2, foundry 3×3, wall 1×1,
cannon 1×1, lance 1×1.

### REFINERY (resource dropoff, 3×2 — a docking/processing plant)

#### Crimson — Refinery — `crimson_refinery`
- **Purpose:** Harvesters dock here to unload vire crystal.
- **Visual:** Boxy industrial processing plant, concrete + steel, a side docking
  bay, conveyor/intake mouth, smokestack vents, red hazard stripes + a red beacon.
- **Geometry:** Rectangular main block (long axis = 3), recessed docking notch on
  one long side, 1–2 chimneys, pipe runs. Asymmetrical functional silhouette.
- **Material/Color:** Grey concrete, gunmetal steel, red accent stripes, small
  amber/red emissive status lights.
- **Readability:** Clear intake mouth (where harvesters go), low and wide.
- **Negative:** no turret, no barrel, no organic shapes, no floor plane.
- **Prompt:** "stylized low-poly RTS refinery building, human military-industrial,
  grey concrete and steel, side docking bay with crystal intake mouth, smokestacks
  and pipes, red hazard stripes, small red warning light, wide rectangular
  footprint, clear silhouette, single ground-centered origin, no base plane, GLB."

#### Azure — Refinery — `azure_refinery`
- **Purpose:** as above. **Visual:** Sleek white ceramic processing hall, cyan
  water-conduit channels feeding a glowing intake basin, rounded edges, a small
  dome over the processing core. **Material:** pearl-white, cyan emissive
  conduits/basin. **Readability:** glowing cyan intake basin marks the dock.
  **Negative:** no military plating, no organic, no floor plane.
- **Prompt:** "stylized low-poly RTS refinery, aquatic high-tech, smooth white
  ceramic hall with rounded edges, cyan glowing water conduits and an intake
  basin, small dome, elegant defensive look, wide footprint, clean silhouette,
  ground-centered origin, no base plane, GLB."

#### Verdant — Refinery — `verdant_refinery`
- **Purpose:** as above. **Visual:** Organic digestion pod cluster — a large
  chitin sac with a wet maw intake, biomass tubes, pulsing green sacs.
  **Material:** dark-teal chitin, toxic-green emissive veins, purple membranes,
  wet highlights. **Readability:** the open maw = intake. Asymmetrical.
  **Negative:** no metal panels, no straight industrial lines, no floor plane.
- **Prompt:** "stylized low-poly RTS refinery as an insectoid biotech digestion
  pod, dark teal chitin with a wet intake maw, pulsing toxic-green sacs and purple
  membrane tubes, asymmetrical organic silhouette, wet highlights, ground-centered
  origin, no base plane, GLB."

#### Solar — Refinery — `solar_refinery`
- **Purpose:** as above. **Visual:** Crystalline ceremonial processor — a low
  amber monolith ring with a magenta prism core that ingests crystal, bronze
  plates, plasma veins. **Material:** amber/gold/bronze, magenta plasma emissive.
  **Readability:** the glowing prism core marks the intake. **Negative:** no
  human industrial parts, no organic, no floor plane.
- **Prompt:** "stylized low-poly RTS refinery, alien crystalline solar-tech, low
  amber and bronze monolith ring around a magenta prism core, plasma veins,
  ceremonial radiant look, wide footprint, clean silhouette, ground-centered
  origin, no base plane, GLB."

### BARRACKS (infantry production, 2×2)

#### Crimson — Barracks — `crimson_barracks`
- "stylized low-poly RTS barracks, human military, armoured concrete bunker with a
  big bay door, antenna, sandbag/armour plates, red unit-ready light, compact
  square footprint, clear door, ground-centered origin, no base plane, GLB."

#### Azure — Barracks — `azure_barracks`
- "stylized low-poly RTS barracks, aquatic high-tech, white ceramic pod with a
  smooth arched deployment hatch, cyan trim lights, rounded compact form,
  ground-centered origin, no base plane, GLB."

#### Verdant — Barracks — `verdant_barracks`
- "stylized low-poly RTS barracks as an insectoid hatchery mound, chitin shell with
  a wet birthing aperture, toxic-green glowing pods, purple veins, asymmetrical,
  ground-centered origin, no base plane, GLB."

#### Solar — Barracks — `solar_barracks`
- "stylized low-poly RTS barracks, alien crystalline, amber monolith spire cluster
  with a glowing magenta gate, bronze plating, plasma veins, ceremonial, compact
  square footprint, ground-centered origin, no base plane, GLB."

### FOUNDRY / VEHICLE FACTORY (vehicle production, 3×3, large)

#### Crimson — Foundry — `crimson_foundry`
- "stylized low-poly RTS vehicle factory, heavy industrial hangar, concrete + steel,
  large roll-up vehicle door, gantry crane, exhaust stacks, red hazard markings and
  light, large square footprint, clear vehicle door, ground-centered origin, no base
  plane, GLB."

#### Azure — Foundry — `azure_foundry`
- "stylized low-poly RTS vehicle factory, aquatic high-tech, large white ceramic
  hangar with a smooth wide assembly arch, cyan energy conduits, dome accent,
  elegant, large square footprint, ground-centered origin, no base plane, GLB."

#### Verdant — Foundry — `verdant_foundry`
- "stylized low-poly RTS vehicle factory as a giant insectoid gestation hive, layered
  chitin plates, a wide wet exit orifice, bulging toxic-green bio-sacs, purple
  membranes, asymmetrical, wet highlights, large footprint, ground-centered origin,
  no base plane, GLB."

#### Solar — Foundry — `solar_foundry`
- "stylized low-poly RTS vehicle factory, alien crystalline, large amber monolith hall
  with a magenta plasma assembly gate, bronze plates, prism cores, plasma veins,
  ceremonial radiant, large square footprint, ground-centered origin, no base plane,
  GLB."

### WALL SEGMENT (passive barrier, 1×1, small, tileable side-to-side)

> Keep modular: a single 1×1 segment that reads when repeated in a line. Connectors
> on the two opposite sides; no doors.

#### Crimson — Wall — `crimson_wall_segment`
- "stylized low-poly RTS wall segment, armoured concrete barrier block with steel
  edges and red hazard stripe, modular connectors on opposite sides, small 1x1
  footprint, ground-centered origin, no base plane, GLB."

#### Azure — Wall — `azure_wall_segment`
- "stylized low-poly RTS wall segment, smooth white ceramic barrier with cyan trim,
  rounded top, modular connectors, small 1x1 footprint, ground-centered origin, no
  base plane, GLB."

#### Verdant — Wall — `verdant_wall_segment`
- "stylized low-poly RTS wall segment, chitin/bone barrier ridge with toxic-green
  glowing seams and purple veins, organic, modular connectors, small 1x1 footprint,
  ground-centered origin, no base plane, GLB."

#### Solar — Wall — `solar_wall_segment`
- "stylized low-poly RTS wall segment, amber crystalline barrier shard with bronze
  base and magenta plasma vein, modular connectors, small 1x1 footprint,
  ground-centered origin, no base plane, GLB."

### CANNON TURRET (ballistic defense, 1×1) — needs pivot/muzzle nodes

> The existing per-faction defense GLB (vulcan/pulse/spitter/monolith) is the
> natural **cannon**; regenerate only if the head/muzzle isn't separable.

#### Crimson — Cannon — `crimson_cannon_turret`
- "stylized low-poly RTS defense turret, armoured base with a separable Y-rotating
  head and a clear forward ballistic barrel/muzzle, concrete+steel, red accents,
  1x1 footprint, ATTACH_turret_pivot + ATTACH_muzzle nodes, ground-centered origin,
  no base plane, GLB."

#### Azure — Cannon — `azure_cannon_turret`
- "stylized low-poly RTS defense turret, white ceramic base with a smooth rotating
  head and a forward cyan-tipped barrel, fluid curves, 1x1 footprint,
  ATTACH_turret_pivot + ATTACH_muzzle, ground-centered origin, no base plane, GLB."

#### Verdant — Cannon — `verdant_cannon_turret`
- "stylized low-poly RTS defense turret, chitin base with an organic rotating head and
  a forward bio-spitter orifice/barrel, toxic-green glow, purple veins, asymmetrical,
  1x1 footprint, ATTACH_turret_pivot + ATTACH_muzzle, ground-centered origin, no base
  plane, GLB."

#### Solar — Cannon — `solar_cannon_turret`
- "stylized low-poly RTS defense turret, amber crystalline base with a rotating prism
  head and a forward magenta plasma muzzle, bronze plating, 1x1 footprint,
  ATTACH_turret_pivot + ATTACH_muzzle, ground-centered origin, no base plane, GLB."

### LANCE / SPECIAL TOWER (energy defense, 1×1, needs power) — needs pivot/muzzle nodes

> Taller, more "energy-weapon" than the cannon; reads as the advanced turret.

#### Crimson — Lance — `crimson_lance_turret`
- "stylized low-poly RTS energy turret, tall armoured pylon with a rotating emitter
  head and a long forward rail/lance muzzle, concrete+steel, red+amber energy glow,
  1x1 footprint, ATTACH_turret_pivot + ATTACH_muzzle, ground-centered origin, no base
  plane, GLB."

#### Azure — Lance — `azure_lance_turret`
- "stylized low-poly RTS energy turret, slender white ceramic spire with a rotating
  cyan lens emitter and a focused forward beam muzzle, elegant, 1x1 footprint,
  ATTACH_turret_pivot + ATTACH_muzzle, ground-centered origin, no base plane, GLB."

#### Verdant — Lance — `verdant_lance_turret`
- "stylized low-poly RTS energy turret, organic chitin stalk with a bulbous rotating
  bio-emitter and a forward toxic-green discharge muzzle, purple veins, wet highlights,
  asymmetrical, 1x1 footprint, ATTACH_turret_pivot + ATTACH_muzzle, ground-centered
  origin, no base plane, GLB."

#### Solar — Lance — `solar_lance_turret`
- "stylized low-poly RTS energy turret, tall amber crystalline monolith with a rotating
  magenta prism emitter and a forward plasma-lance muzzle, bronze base, plasma veins,
  ceremonial radiant, 1x1 footprint, ATTACH_turret_pivot + ATTACH_muzzle,
  ground-centered origin, no base plane, GLB."

---

## I. Later integration roadmap (NOT to start now)

```
Asset Integration Phase 1 — Refinery + Barracks + Foundry (static, directly
  activatable). Add 'resource' + 'production' to ACTIVE_ASSET_ROLES, add 12 entries
  to BUILDING_ASSETS, map activeBuildingAsset(buildingId) for refinery/barracks/
  foundry. No turret rig → low risk. Verify per-faction render + fallback.
Asset Integration Phase 2 — Walls. 1×1 modular; verify it reads when repeated and
  the procedural wall fallback still works for un-modelled factions.
Asset Integration Phase 3 — Defense Towers (cannon + lance) with pivot/muzzle
  analysis. Requires: split cannon vs lance GLB per faction; locate/define
  ATTACH_turret_pivot + ATTACH_muzzle so the existing turret-aim + muzzle-socket
  VFX (world.ts fireWeapon) keep working; only then add 'defense' to
  ACTIVE_ASSET_ROLES. Highest risk → last.
```

Touched-later files: `buildingAssets.ts` (new entries + role dirs),
`buildingGlb.ts` (`ACTIVE_ASSET_ROLES`, `activeBuildingAsset` mapping for the new
ids), optionally `buildingRoles.ts` (already covers all ids). No `buildings.json`
change (stats stay). Pivot/muzzle work concentrates entirely in Phase 3 (turrets).

## Honest notes / open risks

- **Only ONE turret GLB per faction today** but TWO turret buildings (cannon +
  lance) → a dedicated lance asset (or an explicit cannon=existing / lance=new
  decision) is required before activating defense towers.
- **Procedural turret-aim is the activation risk:** cannon/lance rotate to aim and
  expose a `muzzle` socket for VFX. A GLB without a separable head / named pivot
  would break aim or muzzle-flash placement — hence Phase 3 last + pivot analysis.
- **Wall is high-count, low-detail:** per-asset identity payoff is modest; could be
  deprioritised vs. production buildings if generation budget is tight.
- Footprints/stats are fixed in `buildings.json`; new GLBs must be **authored to the
  footprint proportions** (auto-fit scales to footprint×TILE, so wrong proportions
  look stretched).
- No support/tech buildings exist — prompts for them are intentionally omitted.
