# Mac M2 Thermal / Performance Audit

> Read-only architecture audit + measured profiling + prioritized optimization
> plan. A dev-only `?perf=1` overlay was added for ongoing measurement. **No
> gameplay/balance/economy/score/AI/pathfinding behaviour was changed** — only
> instrumentation + docs. Base HEAD `485b3a8`.

## 1. Does rendering use the GPU? — Yes
Three.js r184 `WebGLRenderer` ([scene.ts](../src/render/scene.ts)) does all geometry,
shading, and shadows on the GPU (`powerPreference: 'high-performance'`, pixelRatio
capped at 2). The JS main thread only submits draw calls.

## 2. The main loop is UNCAPPED
[game.ts:161-167](../src/core/game.ts) renders **every `requestAnimationFrame` tick** —
i.e. at the display refresh (60 **or 120 Hz** on an M2 display). There is no frame
limiter. The simulation is **coupled** to render FPS: each frame advances the world by
the frame `dt`, clamped to `Math.min(0.05, …)` ([game.ts:163](../src/core/game.ts)) to
avoid a spiral-of-death. → On a 120 Hz panel the CPU+GPU run a sustained 120 duty
cycle even though an RTS does not need it — the primary cause of the device getting warm.

No explicit `visibilitychange` pause exists; rAF naturally stops when the tab is
hidden (the 0.05 dt clamp covers the catch-up frame on return).

## 3. CPU-bound systems (JS main thread)
- **Simulation** `world.update(dt)` every frame — units/buildings stepped each frame.
- **Pathfinding** ([path/astar.ts](../src/path/astar.ts)) is **on-demand** (on order /
  when stuck), NOT per-frame globally — good. **Hot spot:** `combatStep`
  ([world.ts](../src/sim/world.ts)) can **repath every frame** for a unit whose target
  moves >2 tiles; with many units in combat this is additive CPU. A* also allocates
  fresh `Float32Array`/`Int32Array` per search (GC pressure).
- **Per-frame allocations:** `fireWeapon` allocates ~4 `new THREE.Vector3()` per shot
  ([world.ts](../src/sim/world.ts)); heavy combat → tens of vectors/frame → GC churn.
- **Minimap** ([minimap.ts](../src/ui/minimap.ts)) repaints the canvas **every frame**
  (O(units+buildings)). Low per-item cost but runs every frame.

**Already well-throttled (no action needed):**
- **Enemy AI** ([enemy.ts:59-69](../src/ai/enemy.ts)) thinks on a 0.5–1.0 s timer, not
  per frame.
- **HUD** ([hud.ts](../src/ui/hud.ts)) updates text every frame but rebuilds panel markup
  only on a 0.25 s timer + signature check (no per-frame `innerHTML` churn).

## 4. GPU-bound systems
- **DirectionalLight shadow map 4096×4096 + PCF** ([scene.ts](../src/render/scene.ts)) —
  the **single biggest GPU thermal driver**; frustum re-centres on the camera each frame.
- **Additive crystal glow overdraw** — one additive plane per crystal node (35) under
  ~261 crystal sprites ([terrain.ts](../src/render/terrain.ts)).
- 3 fill lights (hemisphere + ambient + fill directional) — cheap.

## 5. Measured profiling (`?perf=1`, 1280×860, early match)
| Scenario | draws | tris | tex | geo | prog | units | crystals |
|---|---|---|---|---|---|---|---|
| default (`current`) buildings | 105 | 452,187 | 45 | 41 | 16 | 6 | 35 |
| `?buildings=textured`, 6 buildings placed | ~142 | — | ~66 | 41 | 16 | — | 35 |

FPS sat at the panel refresh (120 on this display) in prior smokes; frame budget is
comfortable. Draw calls (~105–142) and texture count (45–66) are modest; the cost is
**duty cycle × shadow map**, not scene complexity. No console errors.

## 5a. FPS cap + performance modes — IMPLEMENTED (2026-06-20)
The biggest thermal lever from §6 is now live (visual/loop-only, no gameplay change):
- **Pure resolver** [performanceSettings.ts](../src/core/performanceSettings.ts):
  `battery=30`, `balanced=60` (**default**), `quality=120`. Query overrides
  `?perfMode=battery|balanced|quality` and `?fps=30|60|120` (`?fps` wins; invalid →
  balanced). Unit-tested.
- **Frame pacing** in the rAF loop ([game.ts](../src/core/game.ts)): still rAF-driven,
  but skips work until ~one capped-frame interval elapsed (4 ms slack so a 60-cap is
  not halved on a 60 Hz panel). `dt` is real wall-time between PROCESSED frames,
  clamped to 0.05 s → **simulation stays real-time at any cap**; balance/AI/pathfinding
  untouched.
- **Hidden-tab safety:** a `visibilitychange` listener resets timestamps on return so
  the first visible frame never sees a huge `dt` (no catch-up storm); the loop also
  early-outs while `document.hidden`.
- **Overlay** shows the active `mode · cap` + measured FPS.
- **Player-facing menu (DONE):** a compact **⚙ Admin / Tools** button on the start
  screen ([adminTools.ts](../src/ui/adminTools.ts)) opens a fixed overlay with the
  three performance modes (Battery Saver 30 / **Balanced 60 · recommended** / Quality
  120), the current effective mode, and developer/diagnostic links (perf overlay,
  textured/current building reload, F8 balance-panel hint). The chosen mode persists
  via the existing `LocalGameSettingsStore` (`performanceMode` on `LocalGameSettings`,
  no new storage key). **Resolution priority:** `?fps=` > `?perfMode=` > saved setting
  > default `balanced`. It applies on the next match / reload (the `Game` reads the
  setting at construction); the menu states this and never auto-reloads.

## 6. Optimization plan (prioritized)
### Quick wins (highest value / lowest risk)
1. **FPS cap** ✅ **DONE** (§5a) — Balanced 60 default / Battery 30 / Quality 120,
   query-overridable. The single biggest thermal lever: halves GPU+CPU duty cycle on
   120 Hz panels with no visible RTS downside.
2. **Explicit `visibilitychange` pause** (belt-and-suspenders over rAF's own throttle).
3. **Throttle the minimap** redraw to ~15–20 Hz (it does not need 60–120 Hz).
4. **Pool `THREE.Vector3`** in `fireWeapon`/`kill`; **pool A\* arrays** — removes GC
   spikes during combat.

### Medium
5. **Fixed simulation tick** decoupled from render FPS (deterministic sim, lets render
   cap independently).
6. **Shadow map 4096 → 2048** (or dynamic res) — the largest single GPU saving.
7. **Adaptive quality**: when `frameMs` rises, drop shadow res / pixelRatio.
8. **Crystal/vegetation LOD or glow-overdraw reduction** (cap additive layers by distance).

### Future
9. **Web Worker** for pathfinding/AI off the main thread.
10. **OffscreenCanvas** render thread (if feasible).
11. **Dynamic quality by frame time / thermal mode.**
12. **Runtime texture mutation reserved for dynamic effects only** (damage, fire/smoke,
    repair, low-power, aura) — never base building textures (Crimson pilot is removed).

## 7. Recommended player-facing model (NOT implemented yet)
```
Performance Mode:  Quality | Balanced | Battery Saver
FPS Limit:         30 | 60 | 120
Default:           Balanced / 60 FPS
```
Rationale: RTS gameplay does not benefit from 120 FPS; 120 FPS roughly doubles the
CPU/GPU duty cycle and heat. 30 FPS Battery Saver is perfectly playable on a laptop.
**Implement as a separate task after this audit.**

## 8. Instrumentation added
Dev-only overlay behind `?perf=1` ([perfOverlay.ts](../src/ui/perfOverlay.ts)), wired in
[game.ts](../src/core/game.ts). Shows FPS, frame ms, sim ms, render ms, units/buildings/
vfx/crystals, draw calls, triangles, textures, geometries, programs. Updated ~2×/s (not
every frame); zero overhead and no DOM unless `?perf=1`. The sim/render timing is only
measured when the overlay is active. Pure line formatter is unit-tested
([perfOverlay.test.ts](../src/ui/perfOverlay.test.ts)).
