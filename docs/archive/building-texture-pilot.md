# Crimson Texture Atlas Pilot — ⚠️ DEPRECATED / ARCHIVED

> **DEPRECATED (archived 2026-06-20).** This runtime texture-atlas experiment is
> **removed from the codebase** — `src/render/crimsonTexturePilot.ts` and the
> `public/assets/buildings/textures/crimson/` atlas crops were deleted, and the
> wiring was removed from `src/render/buildingGlb.ts` in commit `485b3a8`. The
> approved base building texture path is now **embedded textures inside the final
> GLB assets** (see [building-textured-final-ingame-test.md](../building-textured-final-ingame-test.md)).
> Runtime texture mutation is reserved for **future dynamic game-state effects only**
> (damage, bullet holes, fire/smoke, repair, low-power, faction aura) — NOT base
> building textures. This file is kept only for its findings (Gunmetal-too-dark →
> Blender per-panel-UV + AO-bake recommended). Do **not** revive this as an active path.
>
> ─────────────────────────────────────────────────────────────────────────────
>
> Visual experiment — **Crimson only, OFF by default, no gameplay/balance change,
> not committed-as-active.** Tests whether the clean Gemini material atlas can be
> applied to the generated static Crimson building GLBs at runtime.

## Source atlas

`/Users/yorkvonloew/Downloads/Vireon-Front-Assets/Buildings/Textures-Buildings/`

| File | Dims | Size | Labels? | Used |
|---|---|---|---|---|
| **`Texture-with-no-text.jpeg`** | 1024² | 128 KB | **none** | ✅ PRIMARY (clean) |
| `Gemini_Generated_Image_5fngz1….png` | 2048² | 5.5 MB | YES (ZONE A–H text) | layout reference only |
| `alte Texturen mit schrift/…` (5×) | 2048² | 3–12 MB | YES | ignored (old labeled) |

The clean 1024² sheet has the same 4×2 zone layout as the labeled reference but
no text. Zones (from the labeled reference): A Gunmetal `#2C2E33`, B Steel
`#4A4D53`, C Concrete `#6B6D72`, D Red `#A82424`, E Hazard, F Smoky Glass
`#1A222D`, G Amber Emissive `#FF5500`, H Panel/Decal greebles.

## Derived textures (`public/assets/buildings/textures/crimson/`, 372 KB total)

Cropped from the clean sheet (no labels present in source → none in crops). The 4
**surface** zones are clean interior squares resized to 256² (power-of-two); the
4 **feature** strips keep aspect (≤512 wide).

| File | Source crop (1024²) | Out | Type |
|---|---|---|---|
| `crimson_zone_armor.png` | (40,40,470,470) | 256² | tileable surface (gunmetal) |
| `crimson_zone_steel.png` | (525,20,760,255) | 256² | tileable surface (bolted steel) |
| `crimson_zone_concrete.png` | (540,275,1000,460) | 256² | tileable surface (concrete) |
| `crimson_zone_red.png` | (20,510,480,705) | 256² | tileable surface (red plates) |
| `crimson_zone_hazard.png` | (525,515,1010,600) | 485×85 | feature decal |
| `crimson_zone_glass.png` | (525,625,1010,705) | 485×80 | feature decal |
| `crimson_zone_emissive.png` | (15,725,500,1015) | 485×290 | feature decal |
| `crimson_zone_decals.png` | (520,725,1015,1015) | 495×290 | feature greebles |

Crop boundaries are approximate (derived by proportion from the label-free layout);
the 4 surface crops were visually verified clean (no label, no zone-edge bleed).

## Crimson GLB materials (all 6 buildings have TEXCOORD_0)

| Code | Base | Metal | Rough | Emissive | Meaning |
|---|---|---|---|---|---|
| `CC` | #474742 | 0 | 0.92 | — | concrete / foundation body |
| `CS` | #33383d | 1 | 0.40 | — | gunmetal steel frame |
| `CR` | #bf0a0a | 0 | 0.50 | **yes** | red accent trim/lights |
| `CY` | #ffe000 | 0 | 0.50 | **yes** | amber energy glow |
| `CG` | #00ff33 | 0 | 0.50 | **yes** | green status (barracks only) |

## Material → zone mapping (deterministic, by code)

| Material | Zone texture | Wired? |
|---|---|---|
| `CC` | `crimson_zone_concrete` | ✅ |
| `CS` | `crimson_zone_armor` (gunmetal) | ✅ |
| `CR`/`CY`/`CG` (emissive) | — (left untouched, preserve glow) | ❌ |
| red/hazard/glass/decals/steel | — (no matching large surface / are decals) | ❌ |

Only the two non-emissive surface materials are textured. The emissive accents are
the faction's glow identity and would be ruined by a flat albedo, so they are kept.

## Runtime technique

`src/render/crimsonTexturePilot.ts`:
- Feature flag `ENABLE_CRIMSON_TEXTURE_PILOT` (default **OFF**) + a `window.__CRIMSON_TEX_PILOT` override for browser smoke.
- `applyCrimsonTexturePilot(scene, factionId, buildingId)` — no-op unless enabled AND `factionId==='red'`.
- Clones each `CC`/`CS` material per-instance (never leaks to the cached template or other factions), sets `.map` (SRGB, `RepeatWrapping`, `repeat 2×2`), `color=white`.
- Called from `buildingGlb.makeGlbBuildingGroup` after the fidelity remap. One import + one call; everything else unchanged.

### Interaction with the adaptive detail pass
The detail pass (`onBeforeCompile` grain + luminance-adaptive fake-AO) is preserved
by `Material.clone()`. It now modulates `baseColor × map`. On the dark `CS` gunmetal
the adaptive AO + the dark texture compound → the gunmetal reads near-black, so its
panel detail is lost. The lighter `CC` concrete reads its texture well.

## Visual results (browser, Crimson, ON vs OFF, fresh session)

- **Concrete (CC):** clearly improved — visible slab/panel detail on the foundation
  base and the lighter side wings (no longer flat).
- **Gunmetal (CS):** texture applied + maps cleanly, but the dark base colour +
  adaptive AO crush it to near-black → detail barely visible.
- **No text/labels** anywhere on the buildings. **No stretching/distortion** — the
  textures map cleanly to the panels → **UVs are usable**.
- Emissive orange/amber trim preserved and glowing.
- ON/OFF confirmed via material inspection: ON nexus `CC:MAP CS:MAP`, OFF nexus
  `CC:nomap CS:nomap` (flag works; default-OFF safety intact).
- **120 FPS**, no console errors. Towers stay procedural. Azure/Verdant/Solar
  structurally unaffected (red-only guard + flag).

## UV / stretching findings

UVs (`TEXCOORD_0`) exist on all 6 buildings and are **usable** — a `repeat 2×2`
tiled map reads as believable surface detail without visible stretching. This means
the meshes are export-ready for textured materials.

## Performance

No measurable cost — 120 FPS with the pilot ON. Textures are small (256²), shared
+ cached, applied once per building at build time.

## Is the runtime pilot viable?

**Technically yes, but the payoff on Crimson specifically is low.** A runtime tiled
`.map` can only repeat one sample across a material's UVs — it can't place *specific*
atlas zones onto *specific* panels (e.g. hazard strip on a door, glass on a
viewport, red plate on a flank). And Crimson's dark gunmetal hides its texture.

**Recommended path: Blender / GLB re-export.** Re-author the Crimson GLBs with a
proper UV unwrap onto the atlas (each face sampling its intended zone), bake AO, and
export. That gives full per-panel control (hazard/glass/decals usable) and avoids
the dark-on-dark gunmetal problem — far richer than a runtime tiled repeat. The
runtime pilot has proven the assets are UV-ready and the atlas is clean, which is
the prerequisite for that re-export.

Interim alternative (if staying runtime): lighten the gunmetal map application
(don't force `color=white`, or reduce adaptive AO on textured materials) so `CS`
isn't crushed — but this is a band-aid vs. the re-export.

## Status

- Pilot code + crops exist locally, **flag OFF by default**, **not committed**.
- No gameplay/balance/AI/combat/footprint/terrain/vegetation change.
- Towers remain procedural; only Crimson static buildings are touched, and only
  when the flag is on.
