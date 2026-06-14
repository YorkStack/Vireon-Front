# Environment-Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Map-Props (Felsen, Vegetation, Schatten) auf hochwertigere, performante Render-Pfade heben — Felsen als Blender-glTF + Instancing + Triplanar, Vegetation als Y-locked instanzierte Billboards, plus ein gemeinsames Blob-Shadow-InstancedMesh.

**Architecture:** Neues Modul `src/render/props.ts` für statische Instanz-Props (aus `terrain.ts` extrahiert). Felsen-Meshes kommen aus einem versionierten Blender-`bpy`-Skript (`tools/blender/rocks.py`) → `.glb` mit Vertex-AO. In-Engine eigenes Triplanar-`MeshStandardMaterial` (via `onBeforeCompile`, gleiches Muster wie der bestehende Terrain-Blend-Shader). Vegetations-Billboards drehen im Vertex-Shader nur um Y (Kamera-Uniform pro Frame). Blob-Shadows: ein InstancedMesh, Canvas-Gradient-Textur, Matrizen einmalig.

**Tech Stack:** TypeScript, Three.js r184 (`three/addons/loaders/GLTFLoader.js`), Vite, Vitest (happy-dom), Blender via MCP.

**Querschnitt-Anforderungen (User):**
- Nach **jedem großen Schritt** ein Update in `HANDOFF.md` schreiben.
- **Tests für kritische Komponenten**, damit Regressionen auffallen.

---

## Reihenfolge (De-Risking zuerst)
1. Blender-Fels-glb + COLOR_0-Verifikation (höchste Unsicherheit zuerst)
2. `props.ts`-Modul-Gerüst + Extraktion bestehender Logik (verhaltensneutral)
3. Vegetation Y-locked Billboards (instanziert) + Tests
4. Blob-Shadows InstancedMesh
5. Felsen laden + Triplanar-Albedo + Vertex-AO + Tests
6. Triplanar-Normal-Politur (optional, Fallback)
7. Visuelle Verifikation + finales HANDOFF-Update

---

### Task 1: Blender-Fels-Assets erzeugen (Blender-MCP) + COLOR_0-Verifikation

**Files:**
- Create: `tools/blender/rocks.py` (reproduzierbares bpy-Skript)
- Create (Output): `public/assets/terrain/rock/rock_01.glb` … `rock_05.glb`
- Test: `src/render/props.glb.test.ts`

- [ ] **Step 1:** `tools/blender/rocks.py` schreiben: erzeugt 5 low-poly Fels-Varianten (Cube/Icosphere → Bevel/Displace/Decimate auf ~150–400 Tris), `shade_smooth` + Auto-Smooth, **AO via `bpy.ops.paint.vertex_color_dirt`** in ein `Col`-Attribut, je 1 Mesh/1 Material, Export `bpy.ops.export_scene.gltf(export_format='GLB', export_colors=True, ...)`.
- [ ] **Step 2:** Skript über den Blender-MCP ausführen (execute_blender_code), die 5 `.glb` nach `public/assets/terrain/rock/` exportieren.
- [ ] **Step 3 (KRITISCHER FRÜH-CHECK):** Guard-Test schreiben — lädt jede `rock_*.glb` (GLTFLoader, happy-dom), assertet: Datei existiert, enthält genau ein Mesh, Geometrie hat `position` UND ein `color`-Attribut (COLOR_0). 
- [ ] **Step 4:** Test ausführen. Falls `color` fehlt → Export-Flags im bpy-Skript korrigieren und Step 2–4 wiederholen. (Dies ist der zentrale De-Risking-Punkt der Spec.)
- [ ] **Step 5:** HANDOFF-Update + Commit (`feat: blender rock glb generation + color-attribute guard test`).

---

### Task 2: `props.ts`-Gerüst + Extraktion (verhaltensneutral)

**Files:**
- Create: `src/render/props.ts`
- Modify: `src/render/terrain.ts` (Boulders/Vegetation/Pebbles/Grass-Scatter herauslösen; Klippen/Boden bleiben)
- Create: `src/render/props.test.ts`

- [ ] **Step 1:** Reinen seeded Scatter-Helfer nach `props.ts` extrahieren (`hash2`/Verteil-Logik) mit klarer Signatur (`scatterInstances(map, count, seed, predicate) => Matrix4[]`-ähnlich).
- [ ] **Step 2:** Failing test `props.test.ts`: gleicher Seed → identische Positions-Liste (Determinismus), anderer Seed → andere; alle Positionen walkable/in-bounds.
- [ ] **Step 3:** Implementieren bis grün.
- [ ] **Step 4:** Bestehende Boulder-/Vegetations-/Pebble-/Grass-Erzeugung aus `terrain.ts` nach `props.ts#buildProps()` verschieben; `terrain.ts` ruft `buildProps()` auf. KEINE Verhaltensänderung in diesem Schritt.
- [ ] **Step 5:** `npx tsc --noEmit` + `npm test` grün, visuell auf 5199 unverändert.
- [ ] **Step 6:** HANDOFF-Update + Commit (`refactor: extract static props into props.ts (behaviour-neutral)`).

---

### Task 3: Vegetation → Y-locked instanzierte Billboards

**Files:**
- Modify: `src/render/props.ts`
- Test: `src/render/props.test.ts`

- [ ] **Step 1:** Reinen Helfer `billboardBasis(camDirXZ) => { right:Vec3, up:Vec3 }` schreiben (up = Welt-Y, right = horizontal ⟂ zur Kamerarichtung).
- [ ] **Step 2:** Failing test: `up` immer (0,1,0); `right` hat y=0 und ist normiert; `right·camDirXZ ≈ 0`.
- [ ] **Step 3:** Implementieren bis grün.
- [ ] **Step 4:** `THREE.Sprite`-Vegetation ersetzen durch **InstancedMesh pro Textur** (1×1 PlaneGeometry, Bottom-Pivot), `onBeforeCompile`-Vertexshader baut Billboard-Basis aus `uCamRightXZ`-Uniform (Y-locked); `alphaTest`, Fog, transparent. Pro-Instanz Position/Skala in `instanceMatrix`.
- [ ] **Step 5:** `update(camera)` aktualisiert `uCamRightXZ` pro Frame; in den Render-Loop einhängen.
- [ ] **Step 6:** `tsc` + `npm test` grün; visuell: Bäume stehen aufrecht bei Kamera-Tilt, kippen nicht.
- [ ] **Step 7:** HANDOFF-Update + Commit (`feat: Y-locked instanced vegetation billboards`).

---

### Task 4: Blob-Shadows als ein InstancedMesh

**Files:**
- Modify: `src/render/props.ts`
- Test: `src/render/props.test.ts`

- [ ] **Step 1:** Canvas-Helfer `makeRadialAlphaTexture()` (dunkel→transparent) — reine Funktion, gibt CanvasTexture.
- [ ] **Step 2:** Failing test: Helfer liefert Texture mit erwarteter Größe; Mittel-Pixel opak-dunkel, Rand transparent (über ein gemocktes/echtes happy-dom-Canvas, sonst Skalierungs-Helfer testen).
- [ ] **Step 3:** Implementieren bis grün.
- [ ] **Step 4:** `InstancedMesh` flacher Discs, **eine Instanz pro Pflanze** (Baum+Busch), Disc-Skala **pro Instanz aus Pflanzen-Footprint**, knapp über Boden, `transparent`/`depthWrite:false`/`polygonOffset`/`renderOrder`. Matrizen einmalig.
- [ ] **Step 5:** `tsc` + `npm test` grün; visuell: weiche Schatten unter Vegetation, 1 Draw-Call (Stats prüfen).
- [ ] **Step 6:** HANDOFF-Update + Commit (`feat: shared blob-shadow instanced mesh for vegetation`).

---

### Task 5: Felsen laden + Triplanar-Albedo + Vertex-AO

**Files:**
- Modify: `src/render/props.ts`
- Test: `src/render/props.test.ts`

- [ ] **Step 1:** `preloadRockGlbs(): Promise<BufferGeometry[]>` (GLTFLoader, extrahiert Geometrie + color-Attribut) — vor Szenenaufbau aufgerufen.
- [ ] **Step 2:** Reinen Triplanar-Gewichts-Helfer `triplanarWeights(normal) => [wx,wy,wz]` schreiben; Failing test: Summe ≈ 1, dominante Achse = größte Normal-Komponente.
- [ ] **Step 3:** Implementieren bis grün.
- [ ] **Step 4:** `MeshStandardMaterial` + `onBeforeCompile`: Triplanar-Albedo (rock 01–04.png, **seeded/zyklische** Zuordnung zu den 5 Geometrien), Weltkoordinaten-Projektion, `roughness 0.9`/`metalness 0`, multipliziert mit `vColor` (Vertex-AO). Icosaeder-Boulders ersetzen durch **InstancedMesh pro Fels-Variante**.
- [ ] **Step 5:** `tsc` + `npm test` grün; visuell: Felsen mit Tiefenstruktur + AO-Gewicht, keine Streckung bei skalierten Instanzen.
- [ ] **Step 6:** HANDOFF-Update + Commit (`feat: glTF rocks with triplanar albedo + vertex AO (instanced)`).

---

### Task 6: Triplanar-Normal-Politur (optional, Fallback)

**Files:**
- Modify: `src/render/props.ts`

- [ ] **Step 1:** Tangentenbasis-freies Triplanar-Normal-Mapping in den Fels-Shader ergänzen (Normal-Map aus rock-PNG abgeleitet oder generische Fels-Normal).
- [ ] **Step 2:** Visuell auf 5199 prüfen. Wenn überzeugend → behalten; wenn es zickt → **Fallback: Albedo-only Triplanar** (Schritt verwerfen), in HANDOFF dokumentieren warum.
- [ ] **Step 3:** HANDOFF-Update + Commit (`feat: triplanar normal mapping for rocks` ODER `note: kept albedo-only triplanar (normal mapping deferred)`).

---

### Task 7: Finale Verifikation + HANDOFF

- [ ] **Step 1:** `npx tsc --noEmit` + `npm run build` + `npm test` — alles grün.
- [ ] **Step 2:** Vorher/Nachher-Screenshots auf 5199; Draw-Call-Reduktion bei Vegetation dokumentieren.
- [ ] **Step 3:** HANDOFF „Jüngster Stand"-Block aktualisieren (Teilprojekt A abgeschlossen, Test-Anzahl, nächster Schritt = Komponentenfabrik C).
- [ ] **Step 4:** Commit + Push.

---

## Test-Strategie (kritische Komponenten — User-Anforderung)
Unit-getestet (Regressions-Schutz beim Weiterbauen):
- **Seeded Scatter-Determinismus** (Task 2) — Positionen reproduzierbar, walkable/in-bounds.
- **Billboard-Basis-Mathe** (Task 3) — Y-lock-Korrektheit.
- **Radial-Alpha-Helfer** (Task 4).
- **Triplanar-Gewichte** (Task 5) — Summe 1, dominante Achse.
- **glb-Guard** (Task 1) — Existenz + `color`-Attribut (bindet Test an AO-Abhängigkeit).
Nicht unit-getestet (visuell auf 5199): Shader-Optik, Triplanar-Look, Schatten-Weichheit.
