# Environment-Assets — Design-Spec (Teilprojekt A)

> Stand: 2026-06-14. Sprache: Deutsch. Spiel-Repo (`Vireon Front`), reine Web-App (TS + Three.js r184 + Vite).
> Kontext: Der User will einen **sichtbaren Map-Qualitätssprung mit niedrigem Risiko, ohne die Fahrzeug-Studio-Pipeline anzufassen**. Fahrzeuge bleiben (in diesem Teilprojekt) prozedural. Die große Blender-Komponentenfabrik für Fahrzeuge ist ein **separates Folge-Vorhaben** (siehe Memory `vehicle-blender-component-factory`).

## Ziel
Umgebungs-Props (Felsen, Vegetation, Schatten) von einfachen Primitiven/Sprites auf hochwertigere, performante Render-Pfade heben:
1. **Vegetation:** `THREE.Sprite` (vollsphärisch) → **Y-locked (cylindrical) Billboards**, instanziert.
2. **Vegetationsschatten:** neues **gemeinsames Blob-Shadow-`InstancedMesh`** (existiert bisher gar nicht).
3. **Felsen:** verstreute Icosaeder-Boulders → **authored glTF (Blender-MCP) + `InstancedMesh` + Triplanar-Material**.

Nicht im Scope: Klippen-„Spires" (Teil des Terrains, bleiben unberührt), Fahrzeuge/Gebäude, Geometrie-Generierung (eigenes Folge-Spec B).

## Ist-Stand (verifiziert in `src/render/terrain.ts`)
- Boulders: `IcosahedronGeometry(0.4, 0)` (flach), `InstancedMesh` pro Fels-Textur (4 PNG `assets/terrain/rock/01–04.png`), `MeshStandardMaterial{map}`.
- Vegetation: `THREE.Sprite` + `SpriteMaterial{alphaTest:0.45}`, ~95 Bäume + ~190 Büsche (~285 Sprites → viele Draw-Calls).
- Blob-Shadows: **keine** vorhanden.
- Keine `.glb`/`.gltf`-Assets im Projekt. `GLTFLoader` noch nicht genutzt.
- Positionen folgen dem horizontalen Domain-Warp (`warpXZ`).

## Architektur
Neues, in sich geschlossenes Modul **`src/render/props.ts`** für statische Instanz-Props (Felsen, Vegetations-Billboards, Blob-Shadows). `terrain.ts` (schon groß) behält Boden-Mesh + Klippen. Begründung: klare Grenzen, eigenständig testbar, terrain.ts wächst nicht weiter. Öffentliche API z. B. `buildProps(scene, map, opts) => { update(camera) }`, plus ein `preloadRockGlbs(): Promise<…>` das vor dem Szenenaufbau aufgerufen wird.

### Komponente 1 — Felsen (Blender-glTF → Instancing + Triplanar)
**Asset-Erzeugung (Blender-MCP, reproduzierbares `bpy`-Skript, abgelegt unter `tools/blender/rocks.py`):**
- 4–6 low-poly Fels-Varianten (~150–400 Tris), kantiger Bruchstein-/Voronoi-Look.
- **Ein geschlossenes Mesh, eine Material-ID** pro Fels (Pflicht für `InstancedMesh`).
- Smooth Shading mit Auto-Smooth (scharfe Bruchkanten bleiben).
- **AO als „Dirty Vertex Colors"** eingebacken (`bpy.ops.paint.vertex_color_dirt`) — kein UV-/Textur-Bake nötig, exportiert sauber in glb, wirkt pro Instanz → liefert „optisches Gewicht".
- Export `public/assets/terrain/rock/rock_01.glb` … via `bpy.ops.export_scene.gltf` (GLB, `+Y up`).

**In-Engine (`props.ts`):**
- glb wird **nur für Geometrie + Vertex-AO** genutzt; **Material wird im Code gesetzt** (volle Kontrolle, konsistent).
- `MeshStandardMaterial` mit **Triplanar-Albedo** (vorhandene `rock/01–04.png`) per `onBeforeCompile`-Patch (gleiches Muster wie der bestehende Terrain-Blend-Shader), `roughness ≈ 0.9`, `metalness 0`, AO über `vertexColors`.
- **Triplanar** projiziert in Weltkoordinaten → keine Streck-Verzerrung bei nicht-uniformer Skalierung.
- Verteilung: **ein `InstancedMesh` pro Fels-Variante** (ersetzt die Icosaeder-Boulders), pro Instanz zufällige Y-Rotation + Skala (seeded), Positionen wie bisher (Warp, gehäuft an Aufgängen). Verteil-Logik aus dem bestehenden `scatter` übernommen.
- `castShadow`/`receiveShadow` wie bisher.

**Risiko-Abstufung (bewusst):**
- **Kern:** Triplanar-Albedo + Vertex-AO + gute Geometrie (Großteil des visuellen Gewinns, moderates Risiko).
- **Politur:** Triplanar-**Normal**-Mapping (tangentenbasiert, der heikelste Shader-Teil). Wird implementiert; falls es visuell zickt → **Fallback auf Albedo-only Triplanar** (kein Blocker). Entscheidung per visueller Prüfung auf 5199.

### Komponente 2 — Vegetation: Y-locked Billboards, instanziert
- `THREE.Sprite` → **`InstancedMesh` aus 1×1-`PlaneGeometry`** mit Custom-Vertex-Shader (`onBeforeCompile` oder `ShaderMaterial`), der die Billboard-Basis **nur aus der horizontalen Kamerarichtung** baut (Y = Welt-Hoch). Effekt: Bäume „stehen" bei Kamera-Tilt, kippen nicht um.
- **Ein `InstancedMesh` pro Textur** (2 Baum + 2 Busch = 4 Draw-Calls statt ~285). `alphaTest` für Cutout, Fog-Support, **Bottom-Pivot** (Quad-Geometrie so verschoben, dass die Basis bei y=0 sitzt; Instanz auf Bodenhöhe).
- Pro Instanz: Position (Warp, auf Boden), seeded Skala, leichte Y-Basis-Variation. (Textur-Atlas → 1 Draw-Call als spätere Optimierung notiert, nicht in diesem Scope.)
- `update(camera)` pro Frame: aktualisiert die horizontale Kamerarichtung als Shader-Uniform (nicht 285 Matrizen — die Billboard-Drehung passiert im Shader).

### Komponente 3 — Blob-Shadows (ein gemeinsames InstancedMesh)
- **Neu**: `InstancedMesh` flacher Discs (`CircleGeometry` oder Quad) knapp über dem Boden, **eine Instanz pro Pflanze** (Baum + Busch).
- Weiche radiale Alpha-Textur **zur Laufzeit per Canvas erzeugt** (radialer Gradient, dunkel→transparent) → **kein neues Asset-File**.
- `transparent`, `depthWrite:false`, `polygonOffset` gegen Z-Fighting mit dem Terrain, passende `renderOrder`.
- Matrizen **einmalig** gesetzt (Pflanzen bewegen sich nicht). Größe ~ Pflanzen-Footprint. → **1 Draw-Call für alle Map-Schatten**.

## Datenfluss & Async
`GLTFLoader` ist asynchron. Ablauf: **`preloadRockGlbs()` vor dem Szenenaufbau** (Promise) → Geometrien (+ Vertex-Colors) extrahieren → eigenes Triplanar-Material überstülpen → `InstancedMesh` bauen. Kein Pop-in, deterministische Ladereihenfolge. Vegetation + Shadows brauchen kein Preload (laufzeit-generiert/PNG wie bisher).

## Testing
Rendering ist schwer unit-zu-testen; ehrlicher Plan:
- **Reine Helfer** als Vitest-Units (happy-dom): seeded Scatter-Verteilung (Determinismus), Billboard-Basis-Mathe (horizontale Rechts/Vorn-Vektoren bei gegebener Kamerarichtung), Triplanar-UV-Blend-Gewichte (Summe ≈ 1).
- **Guard-Test:** erwartete `rock_*.glb`-Dateien existieren (sonst klare Fehlermeldung).
- **Visuelle Verifikation** auf Port 5199 (Vorher/Nachher-Screenshots) als primärer Nachweis — wird offen so kommuniziert.

## Risiken
1. **Triplanar-Normal-Mapping** (Shader-Komplexität) → gemildert durch Albedo-only-Fallback.
2. **Blender-MCP-Skript** (AO-Bake + GLB-Export) muss robust/reproduzierbar sein → als versioniertes `tools/blender/rocks.py` ablegen, nicht nur Ad-hoc-MCP-Calls.
3. **`terrain.ts`-Split** → etwas Churn, aber klare Grenzen; bestehendes Verhalten (Verteilung, Warp, Schatten) muss erhalten bleiben.
4. **GLTFLoader-Bundle** (three/addons) — kleiner Bundle-Zuwachs, unkritisch.

## Planungs-Hinweise (aus Spec-Review eingearbeitet)
- **PNG↔glb-Zuordnung:** Es gibt 4–6 Fels-Geometrie-Varianten, aber nur 4 Albedo-PNGs (`rock/01–04.png`). Zuordnung **seeded/zyklisch** festlegen (nicht willkürlich), im Plan als ein Schritt notieren.
- **Blob-Shadow-Skala pro Instanz:** Bäume und Büsche teilen sich ein InstancedMesh, unterscheiden sich aber stark in der Größe → Disc-Skala **pro Instanz aus dem Pflanzen-Footprint** über die Instanz-Matrix (explizit im Plan bestätigen).
- **Früher COLOR_0-Check:** Der `vertex_color_dirt`→glTF-Vertex-Color-Pfad hat im Repo am wenigsten Präzedenz. **Erster Verifikationsschritt:** sicherstellen, dass die exportierte `.glb` ein `COLOR_0`-Attribut trägt und `GLTFLoader` es als `color`-Attribut bereitstellt, BEVOR das Material darauf aufbaut.
- **Guard-Test erweitern:** nicht nur `rock_*.glb`-Existenz, sondern auch dass die geladene Geometrie ein `color`-Attribut hat (bindet den Test an die AO-Abhängigkeit).

## Offene Defaults (vom User implizit via „A jetzt fertig" bestätigt)
- AO via **Vertex-Colors** statt gebackener AO-Textur.
- Triplanar-Normal als **Politur mit Fallback**.
- Split nach **`src/render/props.ts`**.
