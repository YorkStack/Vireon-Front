# Vehicle Component Factory — Slice 1 Implementation Plan

> REQUIRED SUB-SKILL: superpowers:executing-plans (inline). Steps use `- [ ]`.

**Goal:** Crimson Medium Tank Ende-zu-Ende: LLM-konfigurierte parametrische bpy-Templates → Assembly → Bake → Runtime-GLB → neuer Spiel-Render-Pfad (GLB laden, Akzent-Tint, Turm drehen, Muzzle-Effekt), ersetzt prozedurales `red/mediumTank`.

**Spec:** `docs/superpowers/specs/2026-06-14-vehicle-component-factory-design.md`

**Repos:** Studio (`../vireon-design-studio`, Blender headless + specs) + Spiel (`Vireon Front`, Runtime).

**Querschnitt:** Nach jedem großen Schritt HANDOFF-Update; Tests für kritische Komponenten; Commits häufig. Blender headless via `"/Applications/Blender.app/Contents/MacOS/Blender" --background --python <script>`.

---

### Task 1 — De-Risk: Koordinaten-Vertrag + Mini-Assembly + Achsen/Pivot-Guard
**Files:** Create `../vireon-design-studio/tools/blender/bpy_contract.py` (Helfer: Achsen, Empty-Erzeugung, Slot-Material-Naming, GLB-Export +Yup), `../vireon-design-studio/tools/blender/_minislice.py` (Mini-Tank: Box-Chassis + `turret_ring`-Empty + Turm-Node + Lauf +Z + `muzzle`-Empty + `mat_accent`/`mat_body`), Test `tools/factory.contract.test.ts` (Spiel-Repo, GLB-Parse-Guard).
- [ ] Helfer + Mini-Slice schreiben (Vertrag §2: +Y up, Forward +Z, Turm-Pivot am Ring, `muzzle` +Z, kanonische Material-Namen).
- [ ] Headless ausführen → `tools/blender/out/minislice.glb`.
- [ ] Guard-Test: GLB hat Node `turret` (getrennt) + Empty `muzzle`; Lauf/Geometrie entlang +Z; Materialien ⊆ kanonische Slots; +Y up. Falls Vertrag verletzt → Helfer fixen, wiederholen.
- [ ] HANDOFF-Update + Commit.

### Task 2 — Crimson-Komponenten-Templates (parametrisch)
**Files:** Create `../vireon-design-studio/tools/blender/components/{chassis,track,turret,weapon,sensor}.py`.
- [ ] Pro Template: deterministische bpy-Funktion `build(params) -> obj` mit **deklarierten Hardpoints** (id/type/pos/rot/size_class/optional) + **Param-Schema** (Ranges/Enums) + kanonischen Slot-Materialien. Crimson = kantig/harte Platten.
  - chassis: bietet `turret_ring`, `movement_slot.L/R`, `decor.*`.
  - track: steckt in `movement_slot`.
  - turret: steckt auf `turret_ring`, Node `turret`, bietet `weapon_mount`.
  - weapon (medium_cannon): steckt auf `weapon_mount`, Lauf +Z, bietet `muzzle`.
  - sensor: steckt auf `decor`.
- [ ] Mini-Renderskript pro Template (headless GLB) + visuelle Sichtprüfung.
- [ ] HANDOFF-Update + Commit.

### Task 3 — Component-Spec + Validator (Whitelist, Hardpoint-Kompat, Assembly)
**Files:** Create `../vireon-design-studio/src/factory/componentSpec.ts` + `assemblySpec.ts` + `validate.ts` + `validate.test.ts`.
- [ ] Schema-Typen (Component-Spec, Assembly-Spec) + Template-Registry (Param-Schema je Template).
- [ ] Validator: Param ∈ Whitelist (Range/Enum); Hardpoint-Kompat (type+size_class); Assembly-`mount` existiert am Parent. **Tests zuerst (TDD).**
- [ ] Crimson-Medium-Tank Component-Specs + Assembly-Spec als Daten (`src/factory/crimson_mediumTank.json`).
- [ ] HANDOFF-Update + Commit.

### Task 4 — Assembly + Bake/Merge/Optimize → Runtime-GLB
**Files:** Create `../vireon-design-studio/tools/blender/assemble.py` + `bake.py`.
- [ ] assemble.py: liest Assembly-Spec, baut Komponenten (Templates), parentet rekursiv an Mount-Transforms.
- [ ] bake.py: statisch nach Slot mergen; **Preserve-Regeln §5** (turret/muzzle/effect_socket/Material-Namen unantastbar); Transforms/Origin; **harte Post-Bake-Validierung** (Nodes `turret`+`muzzle`, Materialien ⊆ kanonisch, Tris ≤ Budget, BBox = `red/mediumTank` ±15 %); Export `exports/red_mediumTank/red_mediumTank_final.glb` + `metadata.json`.
- [ ] Guard-Test (Spiel-Repo `tools/`): finale GLB erfüllt alle Post-Bake-Invarianten.
- [ ] HANDOFF-Update + Commit.

### Task 5 — Spiel-Runtime-Render-Pfad (GLB bevorzugt, Fallback sichtbar)
**Files:** Create `src/render/vehicleGlb.ts`; Modify `src/render/models.ts`/`vehicleModels.ts` (Einhängepunkt), `src/render/effects.ts` (falls nötig). Test `src/render/vehicleGlb.test.ts`.
- [ ] `loadVehicleGlb(faction,classId)` (GLTFLoader, Cache); Instanz: klonen, `turret`-Node-Ref, `muzzle`-Empty(s), `mat_accent`→Fraktionsfarbe.
- [ ] Integration: für `red/mediumTank` GLB bevorzugen, sonst prozedural; **Dev-Warn** bei fehlendem/ungültigem GLB + `window.__game.vehSource`-Flag.
- [ ] Turm-Node an bestehenden Turm-Animator (`rotation.y`) hängen.
- [ ] Loader-Test (liefert turret-Node, Tint greift, Fallback-Warn feuert). HANDOFF + Commit.

### Task 6 — Muzzle-Effekt Ende-zu-Ende
**Files:** Modify Schuss-Pfad (`src/sim/world.ts` Muzzle-Aufruf) für GLB-Fahrzeuge.
- [ ] Beim Schuss `muzzle`-Empty **Welt-Matrix auflösen** → `muzzleFlash(worldPos)`. Visuell auf 5199.
- [ ] HANDOFF + Commit.

### Task 7 — Finale Verifikation
- [ ] tsc + build + alle Tests grün (beide Repos).
- [ ] Visuell auf 5199: GLB-Crimson-Tank, drehender Turm, Akzent-Tint, Mündungseffekt; andere Fahrzeuge unverändert prozedural.
- [ ] HANDOFF „Jüngster Stand" + Commit (+ Push auf Ansage).

## Test-Strategie (kritisch)
- GLB-Vertrags-Guard (Task 1) + finaler Bake-Guard (Task 4): Nodes/Materialien/Achsen/BBox.
- Validator-Units (Task 3): Whitelist, Hardpoint-Kompat, Assembly-Auflösung.
- Game-Loader-Test (Task 5): turret-Node, Tint, Fallback-Warn.
- Visuell auf 5199 (Shader/Optik/Anim).
