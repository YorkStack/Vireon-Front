# Vireon Front — Handoff / Arbeitsstand

> Stand: Übergabe vor /compact. Sprache: **Antworten immer auf Deutsch** (User-Präferenz, in Memory hinterlegt).

## 🌿 Teilprojekt A — Environment-Assets (in Arbeit, 2026-06-14)
Ziel: sichtbarer Map-Qualitätssprung ohne Eingriff in die Fahrzeug-Pipeline. Spec: `docs/superpowers/specs/2026-06-14-environment-assets-design.md`, Plan: `docs/superpowers/plans/2026-06-14-environment-assets.md`.
- **ERLEDIGT (Tasks 2–4):**
  - Reine Noise-Helfer extrahiert → `src/render/terrainNoise.ts` (`hash2`/`vnoise`/`warpXZ`), von terrain.ts + props.ts genutzt, unit-getestet.
  - Neues Modul `src/render/props.ts`: **Vegetation = Y-locked (cylindrical) instanzierte Billboards** (CPU-per-Instanz-Yaw, kein Shader → robust) statt `THREE.Sprite`. **285 Instanzen in 4 InstancedMeshes** statt ~285 Sprites. Plus **gemeinsames Blob-Shadow-InstancedMesh** (285 Instanzen, 1 Draw-Call, Canvas-Gradient).
  - Per-Frame-Reorientierung via `TerrainBuild.updateProps(camera)` → in `game.ts#frame` eingehängt.
  - Tests: `terrainNoise.test.ts` + `props.test.ts` (billboardYaw, triplanarWeights, scatterVegInstances-Determinismus/in-bounds). **Gesamt 38 grün** (vorher 27). tsc + build sauber. Visuell auf 5180 verifiziert: Bäume stehen aufrecht bei Kamera-Tilt, Schatten sichtbar, 120 FPS, keine Fehler.
- **OFFEN (Tasks 1, 5, 6):** Felsen als glTF — **braucht laufendes Blender mit MCP-Addon (`localhost:9876`)**, war bei diesem Durchlauf NICHT verbunden. `tools/blender/rocks.py` (Cell-Fracture, Vertex-AO via `vertex_color_dirt`, GLB-Export) + COLOR_0-Guard-Test, dann InstancedMesh + Triplanar-Albedo (+ Normal-Politur mit Fallback) ersetzt die Icosaeder-Boulders. `triplanarWeights` ist schon implementiert + getestet.
- **DANACH:** Teilprojekt C — volle Blender-Komponentenfabrik für Fahrzeuge (Runtime-GLB), siehe Memory `vehicle-blender-component-factory`. Vertikaler Durchstich zuerst.

## ⏱️ Jüngster Stand (Fortsetzung nach /compact)
- **Beide Repos committet & gepusht, Arbeitsbäume sauber:** Spiel `main` @ `8d202ba`, Studio `main` @ `45700ac`.
- **Worauf zuletzt gearbeitet wurde — Vehicle Design Studio reift stark:** editierbare Original-Prompts pro Fraktion×Fahrzeug (Skizze/Geometrie/Textur, Prompt-Pack als Default, pro Version gespeichert), Prompt-Feld direkt über jedem Erzeugen-Button; **Batch-Modus** (Header „⚙ Batch all") mit **anklickbarem Auswahl-Raster** (Zelle/Fraktion/Klasse), Resume, Export-pro-Fahrzeug, optionale Multi-Pass-Komponenten-Texturen, robustem Stop/Cancel; **Overview-Seite** (Header „📋 Overview") mit Bulk-Export/-Delete; **Texturen aus der Skizze sampeln** (Gemini-Vision → ziehbare Crop-Box → img2img); **2-Pass-Geometrie** (Technical-Artist-System-Prompt + Phase-1-Analyse) — auch im Batch.
- **Zuletzt fertiggestellt (dieses Thema):** **Komponenten-Textur-Gruppen** (`texGroup` pro Bauteil; Textur pro Gruppe, Material pro Slot; zweistufiger Renderer; keine Migration) + **`trap`-Primitive** (Trapezprisma für Panzerketten); **Phase 2 Preset-Bibliothek** (Rezept + optionales PNG, 10 Seeds, Apply/Save); **GUI-Überarbeitung**: Komponenten-Panel = aufklappbare **Karte pro Gruppe** mit eigenem Prompt + Generate/Sample/Preset/Clear/Rename/Move inline. Spec: `docs/superpowers/specs/2026-06-13-component-textures-design.md`. Tests: Spiel **27 grün**, Studio-Build sauber.
- **NÄCHSTER offener Punkt (vom User gewünscht):** **Phase 3 — per-Fläche-Texturen** (Profil oben vs. Rollen seitlich am selben Teil). Bewusst zurückgestellt: großer Cross-Engine-Render-Umbau (Un-Merge + Material-Arrays je Primitive: Box 6 / Zylinder Seite-oben-unten / `trap` Wände-Deckel + Flächen-Picking-UI + Spec/Validator/Tests). Haupt-Use-Case „Kette oben vs. Seiten" ist über Phase 1 (getrennte `trap`-„track" + `cyl`-„roadwheel"-Gruppen) bereits abgedeckt — Phase 3 ist die granulare Kür. User sagte „mach Phase 3" → als eigener, voll getesteter Pass starten.
- **Weitere offene Studio-/Spiel-Punkte:** siehe Sektionen „OFFENE PUNKTE / PLAN" und „Vehicle Design Studio" unten (u. a. Geometrie-Qualität iterieren; große Spiel-Lücken: Audio, Fog-of-War, Steuerungskomfort, Speichern/Laden, KI-Schwierigkeit).
- **Studio läuft** auf Port **5188** (`cd ../vireon-design-studio && npm run dev`); Spiel auf **5199**. `GEMINI_API_KEY` liegt lokal (Spiel `.gemini_key/.env`, Studio `.env`) — gitignored, auf neuem Rechner nötig.

## Was das ist
Echtzeit-Strategiespiel (RTS) im C&C-Stil auf dem feindlichen Kristallplaneten **Vireon**.
Stack: **TypeScript + Three.js + Vite**. Läuft im Browser, 120 FPS auf M2.

## Git-Repos
- **Spiel:** `https://github.com/YorkStack/Vireon-Front` (**public**) — lokal hier. Branch `main`.
- **Studio:** `https://github.com/YorkStack/Vireon-Design-Studio` (**private**) — lokal `../vireon-design-studio`. Branch `main`.
- `gh` ist als `YorkStack` angemeldet. Commit-Messages enden mit `Co-Authored-By: Claude …`.

## Starten / Server
- **`npm run dev` → http://localhost:5199`** (Port in package.json gepinnt — das ist die feste Adresse des Users).
- Das Claude-Preview-Tool nutzt Port **5180** und hat einen **Canvas-Resize-Bug** (Screenshots oft abgeschnitten). Workaround: frischer `preview_start` + `desktop`-preset + im eval `renderer.setPixelRatio(1); setSize(innerWidth,innerHeight)`. Der User beurteilt Visuals selbst auf 5199.
- Debug-Hook im Spiel: `window.__game` mit `.world`, `.map`, `.rig`, `.input` und `.step(secs)` (Sim vorspulen, für Verifikation ohne Klicken).

## Build / Verifikation
- `npx tsc --noEmit` (Type-Check), `npm run build` (Production-Build), **`npm test` (Vitest, 27 Tests)**. Alle aktuell grün/sauber.
- Vitest: Validator + Interpreter + Round-Trip (`happy-dom`-Env für Render-Tests, da `models.ts` beim Import Texturen lädt) + Import-Dry-Run. Studio hat eigene Tests (`npm test` dort).

---

## Asset-Generierung (Nano Banana / Gemini)
- Skript: **`generate_asset.py`** (venv aktivieren: `source venv/bin/activate`). Key in `.gemini_key/.env`.
- **Modellstrategie (in Memory verankert):**
  - **Flash** (`gemini-2.5-flash-image`, ~$0,039/Bild) für kleine/vergebende Assets (Icons, Props, Boden-/Texturen) UND für alle **Entwürfe**.
  - **Pro** (`gemini-3-pro-image-preview`, ~$0,134/Bild) für Detail/Konsistenz + große, mehrfach sichtbare Assets (Einheiten, Gebäude-Texturen, Menü-Hintergrund).
  - **Workflow: immer erst Flash-Entwurf zeigen → auf Go des Users warten → dann finale Variante.** Nie ungefragt teure Pro-Aufrufe.
- Funktionen: `create_draft()` (Flash), `create_final(category=...)` (Modell nach Kategorie), `create_texture(final=False/True)`, plus `kind`-Modi in `create_game_asset`: `sprite`, `icon`, `texture` (nahtlos, Sci-Fi-Metall), `terrain` (Naturgestein, kein Tech), `scene` (cinematic, kein Stilzwang).
- Texturen brauchen **kein Alpha** (Chroma-Key nur bei Sprites/Icons via Magenta-Hintergrund). Texturen werden teils per Pillow nachbearbeitet (Helligkeit, Crop, nahtlos).
- **Kosten:** automatisch in **`asset_cost_log.csv`**; `python -c "import generate_asset as g; g.print_cost_summary()"`. **Bisher gesamt ~$2,42** (53 Bilder).
- **Kind-Modi** in `generate_asset.py`: `sprite`/`icon` (Chroma-Key Alpha), `texture` (Metall), `terrain` (Naturfels), **`grass`** (Gras/Moos OHNE Steinzwang — wichtig für Boden-Lvl-0!), `scene` (cinematic).

### Asset-Ordnerstruktur (`public/assets/`)
Seit dem Struktur-Umbau nach Kategorien (Pfade in `generate_asset.py` via `filename`-Unterpfad, z.B. `terrain/ground/valley/02.png`):
```
public/assets/
  terrain/ground/{valley,mid,high}/01.png 02.png 03.png   (3 Varianten je Höhe)
  terrain/crystal/crystal.png                              (war icon_crystal.png)
  buildings/common/{hull,panels,foundation,dome,roof}.png  (Flash, faktionsneutral, im Code eingefärbt)
  vehicles/common/hull.png
  people/common/                                           (Platzhalter: Infanterie noch ohne Textur)
  ui/{background_main.jpg, panel.png}                      (war ui_panel.png)
  drafts/                                                  (alte Flash-Entwürfe geparkt)
```
- **Fraktions-Unterordner** (`buildings/crimson/`, `vehicles/azure/` …) erst anlegen, wenn faktisch fraktionsspezifische Assets erzeugt werden — aktuell Einfärbung im Code (`accentHex`).
- **Boden-Varianten + Blending:** Je Höhenlage mehrere nahtlose Varianten (valley 01–04, mid/high 01–03). `terrain.ts` hat **EIN Blend-Material pro Höhe** (`makeBlendGroundMaterial`, `onBeforeCompile`-Patch von MeshStandard): sampelt alle Varianten und mischt sie über eine **world-space fbm-Noise-Maske** weich (pow(2.5)-Gewichte, Scale 0.05). Dadurch **weiche organische Übergänge statt harter Tile-Kanten** — und unterschiedliche Texturen dürfen sich tonal unterscheiden. Nur 3 Top-Buckets (pro Höhe) + misc. PBR-Licht/Schatten/Vertexfarben bleiben erhalten.
- **Tonangleichung NICHT mehr nötig** (war für den alten harten Split gegen Schachbrett): `normalize_variants.py` existiert noch, wird aber vom Blend-Ansatz nicht gebraucht.
- Gras-Stil ruhig: `GRASS_STYLE` in `generate_asset.py` auf „calm/uniform, no glowing veins, no busy detail" getrimmt.
- Pipeline-Skripte: `gen_calm.py` (ruhige Varianten), `gen_variations.py` (ältere), `normalize_variants.py` (optional).
- **Screenshots:** Der Claude-**Chrome-MCP** (`mcp__Claude_in_Chrome__*`, echtes Chrome übers Plugin) erreicht `localhost:5180`/`5199` und liefert saubere Vollbild-Shots — besser als das Preview-Tool (Canvas-Bug). Der Docker-Playwright (`MCP_DOCKER__browser_*`) erreicht localhost NICHT. Ablauf: `tabs_context_mcp(createIfEmpty)` → `navigate` → `javascript_tool` (Menüs klicken) → `computer screenshot/zoom`.

### Terrain-Entblockung + Props/Fahrzeug-Texturen (neueste Sitzung)
- **Horizontaler Domain-Warp** (`warpXZ`/`vnoise` in `terrain.ts`, `WARP_AMP=0.45`): verschiebt jeden Terrain-Vertex (und Boulders/Spires/Lampen/Kristalle/Vegetation) entlang eines glatten Noise-Feldes → die rasterförmigen Plateau-/Klippen-Umrisse mäandern organisch. Pure Funktion von (x,z) → wasserdicht; Höhen/Pathfinding logisch unberührt. **Hinweis:** Klippen-FLÄCHEN sind aus der Nähe noch facettiert (nur Umriss entblockt) — echtes Aufbrechen bräuchte subdividierte, ge-noiste Wandflächen.
- **Felstexturen:** 4 nahtlose Gesteinstexturen (`terrain/rock/01–04.png`) auf Boulders gemappt — 4 InstancedMeshes (je eine Textur), Boulders zufällig verteilt.
- **Vegetations-Billboards:** Bäume (`vegetation/tree_01–03.png`) + Büsche (`bush_01–02.png`) als `THREE.Sprite` (bottom-pivot, `alphaTest 0.45`). Generiert mit Magenta/Pink-BG → Alpha per `fix_vegetation_alpha.py` (eckenmitten-basiert, weil das Modell **kein reines Magenta** liefert — Eckensampling traf transparente Reste!). ~95 Bäume + ~190 Büsche.
- **Fahrzeug-Texturen pro Rolle** (`models.ts`, `vehicleHullMat(defId)` + `VEH_ROLE_MAT`): `vehicles/{harvester,fabricator,attack,defense}/hull.png`. harvester→harvester, fabricator→fabricator, Kampf→attack; **defense noch ungenutzt** (reserviert für Verteidigungseinheiten/Türme). Hülle wirkt bei dunkler Belichtung dezent, weil Fahrzeugmodelle viele dunkle Panel-Slots haben (Modell-Geometrie-Sache, nicht Textur).
- Perf: 635 Sprites, ~134 Draw-Calls, ~269k Tris — unkritisch.
- Pipeline-Skripte neu: `gen_props.py` (Felsen/Vegetation/Fahrzeuge), `fix_vegetation_alpha.py` (BG-Stanze für Sprites). `GRASS_STYLE` + neuer `grass`-Kind in `generate_asset.py`; `OUTPUT_DIR` akzeptiert Unterpfade.

---

## Zuletzt erledigt (diese Sitzungen)
1. **Visueller Baseline-Overhaul** (Three.js bestätigt, kein Sprite-Wechsel): detaillierte prozedurale Gebäude/Einheiten, Beleuchtung, Effekte.
2. **Animationslayer**: drehende Türme, Harvester-Ladung, blinkende Lichter, Leerlauf-Spinner, Slope-Tilt, Leuchtspuren/Explosionen/Scorch.
3. **Gebäude-Texturen** eingebaut (hull/panels/foundation), Schattenseiten aufgehellt, Kuppel-Textur (Luftschlitze/Nieten via `smooth`-Slot), Dach-Textur (`roof`-Slot), Fundament-Pad (Warnrand im Bau → dezent wenn fertig).
4. **Builder-Fix**: Gebäude bauen sich **autonom fertig**, sobald der Fabricator den Bauplatz erreicht hat — Builder ist dann frei (kein Festkleben/Stocken mehr).
5. **Start-Screen-Redesign**: cinematic Hintergrund, taktische Metall-Panels, **physische Fraktions-Terminals** (raised/hover-indent/eingedrückt + pulsierender Neon-Balken), Plunger-DEPLOY, soft-teal Schrift. (`src/ui/screens.ts` + `src/ui/style.css`, Klassen `.screen.cinematic`, `.tac-panel`, `.faction-card`.)
6. **Harvester-Verhalten**: erntet **eigenständig** (sobald Raffinerie steht), **Ramm-Angriff** auf Befehl (überfährt Gegner), nach Befehl zurück zum Ernten. Flag `harvAttack`, Methode `ramStep` in `src/sim/world.ts`.
7. **Fahrzeug-Texturen**: `vehicle_hull` auf Fahrzeuge (Infanterie bleibt flach). `makeEntityGroup(..., vehicle)`.
8. **Terrain-Block**: Bodentexturen pro Höhenlage (Multi-Material-Mesh, ein Raycast-Target), 3×3-Subdivision + organisches Höhen-Rippeln (an Tile-Rändern auf 0 → keine Risse), Boulders + Büsche + Gras. Bug gefixt: Geometrie-Zusammenführung per Schleife statt `push(...spread)` (sonst Stack-Overflow beim Start).
9. **Terrain-Overhaul 2** (Klippen, Felsen, Biome, Kristalle):
   - **Geschrägte Klippen**: vertikale Wände → geneigte Aprons (`wall()` in `terrain.ts` neigt um `run` über den tieferen Nachbarn aus). Zwei Strata-Bänder mit **Vertex-Blend Fels (oben) → Moosgras (unten)** über `SLOPE_FOOT` — erfüllt die „natürlicher Übergang"-Anforderung. Kollision/Pathfinding unberührt (rein visuell).
   - **Felsverteilung**: Boden (Lvl 0) ~95 % steinfrei (sauberer Bauplatz), Mitte (Lvl 1) mittel + an Aufgängen geklumpt (`nearHigher`), Hoch (Lvl 2) dicht. Boulder-Skalierung breit gestreut (kleine Brocken bis sichtblockende Felsen). Pebbles auf Lvl 0 90 % reduziert.
   - **Biome-Texturen** neu (Flash): `ground_valley.png` = offenes Moosgras (eigener `grass`-Kind in `generate_asset.py`, OHNE Steinzwang, sonst kacheln Felsen ins Raster!), `ground_mid.png` = Misch (Gras+Riss-Stein), `ground_high.png` = dunkler Vulkanschiefer. Material-Tints auf nahezu neutral aufgehellt, UV-Footprint `/11` (weniger Kachel-Wiederholung).
   - **Kristalle**: prozedurale Oktaeder → **`icon_crystal.png` Sprite-Billboards** (`THREE.Sprite`, unlit = selbstleuchtend) in dichten Clustern + additive Teal-Glow-Plane. Depletion-Scaling/Click-Targeting unverändert kompatibel.
10. **Asset-Ordner strukturiert** (`public/assets/{terrain,buildings,vehicles,people,ui}/…`); 3 Bodentexturen pro Höhe + Blend-Shader (weiche Übergänge statt Schachbrett); Vegetation-Sprites (Bäume/Büsche) + 4 Fels-Texturen auf Boulders; horizontaler **Domain-Warp** (`warpXZ`) gegen den quadratischen Map-Look.
11. **Datengetriebene Fahrzeug-Architektur** (siehe eigene Sektion): Klassen-Templates + 32 Fraktions-Varianten-Dateien + Resolver + Balance-Validator + Unit Codex + KI-Rollen; prozedurale Geometrie v2 (gerundet, monoWheel v3, walker v2, halfTrack, +60 % Greeble); **alle 32 Fahrzeug-Texturen** im hellen Militär-Stil (Nieten/Luken/Lufteinlässe, vorher zu dunkel).
12. **Vehicle Design Studio** (separates Repo) + **Spec-Import-Pipeline** (siehe Sektion unten): `vehicle-spec`-Schema, Interpreter, Few-Shot-Seeds, Catalog-Export, Import-Skript (Phase A, TDD); Studio-App mit Skizze→Geometrie→Textur→Export, fraktions-Prompts, Versions-Bibliothek, aufgeräumtem Log (Phase B). Vertikaler Schnitt end-to-end bewiesen.
13. **Studio-Erweiterungen** (Phase C, siehe Sektion unten): editierbare Original-Prompts pro Fraktion×Fahrzeug für Skizze/Geometrie/Textur (kompletter User-Prompt-Pack als Default, pro Fahrzeug + pro Version gespeichert); klarerer Step-Status (↻ vorne, ✓ hinten); Studio-Link im Spiel-Codex; **neue Fahrzeugklassen** anlegbar (Schiffe/Flugzeuge/Raketen/Raumschiffe) — Studio-Authoring + statische Spiel-Integration (Custom-Balance-Template + Codex + Spec-Rendering), 22 Tests grün.

---

## OFFENE PUNKTE / PLAN (Priorität vom User bestätigt: Terrain-Block war zuletzt dran und ist fertig)

Reihenfolge war **A→B→D→C** vereinbart; Terrain (Teil von A/C) gerade gemacht. Noch offen:

1. **Konsolen-Grafik für Fraktions-Terminals** — User will statt der CSS-Metalloptik eine **gerenderte Terminal-Grafik** (wie sein angehängter Screenshot: physisches Konsolen-Terminal mit eingelassenem Display). Asset generieren (Pro) + als border-image/background einbauen. **Eingeplant, noch nicht gemacht.**
2. ~~Klippen-Kanten abschrägen~~ — **ERLEDIGT** (Terrain-Overhaul 2): Klippen sind jetzt geneigte Aprons mit Gras→Fels-Blend.
3. **Phase B — Vulkan + Spezial-Erz**: 1–2 seltene Vulkanzonen auf der Map, leuchtendes **Spezial-Erz mit 3× Wert**, Lava-Optik. (Map-Gen + Logik + Assets.) **Geplant, nicht begonnen.**
4. **Phase C — Biome/Gegenden**: Flachland, Gebirge, **Seen** (Wasser-Hindernis), Wälder, Steppen, Wüsten als Regionen über die Höhenkarte; pro Biom Bodentextur + Vegetation. **Großes Feature, mehrere Sitzungen.** Bodentexturen pro Höhe sind als Vorarbeit schon da.
5. **Phase D — mehr Gebäude-/Fahrzeug-Texturvarianten** falls gewünscht.

### Studio / Fahrzeug-Pipeline (neu, teils offen)
6. **Batch über alle 32** im Studio — **ERLEDIGT (Phase C):** „⚙ Batch all" im Header läuft alle Fraktionen×Klassen mit Retry/Backoff + Resume + Skip-on-Fail. Noch offen falls gewünscht: `import:vehicle --all` direkt aus dem Studio anstoßen (aktuell exportiert man pro Fahrzeug + importiert per CLI).
7. **Geometrie-Qualität iterieren** — Gemini-Specs sind grob; Hebel: stärkere Few-Shot-Auswahl, **editierbare Prompts pro Fahrzeug (ERLEDIGT, Phase C)**, ggf. Pro-Modell für Geometrie, evtl. halb-manuelles Nachjustieren (Slider) als späterer Schritt.
   - **Neue Klassen voll ins Gameplay** (Flug-/Wasser-Bewegung, Luftkampf, Höhen-Pathing) ist bewusst NICHT gemacht — aktuell „statisch" (Bodenfahrzeug-Balance). Großes eigenes Feature, wenn gewünscht.
8. **Studio-Komfort offen:** Versionen vergleichen/löschen, Textur live auf das 3D-Modell mappen (aktuell nur Slot-Farben + Textur-Thumbnail), Emissive-Maps, Batch-Export. Catalog/Seeds müssen nach Spiel-Änderungen manuell ins Studio kopiert werden (könnte automatisiert werden).
9. **Große Spiel-Lücken** (aus früherer Bestandsaufnahme, weiter offen): **Audio fehlt komplett**, **Fog-of-War/Aufklärung fehlt**, **Steuerungskomfort** (Kontrollgruppen 1–9, Rally-Points-UI, Bau-Queue-UI, Hotkeys), Speichern/Laden, Settings, KI-Schwierigkeitsgrade.

---

## Fahrzeug-Architektur (datengetrieben, seit Refactor)

**Schichten:** `src/data/unitClasses.ts` (Klassen-Templates = EINZIGE Balance-Quelle) → `src/vehicles/<fraktion>/<klasse>.ts` (32 Dateien: NUR Optik + auditierte `balanceOverrides`) → `factions.json`-Perks → `src/systems/unitFactory.ts#resolveUnit()` liefert flaches, legacy-kompatibles `UnitDef`. Legacy-Aliase (`vanguard`→`mediumTank`, `fabricator`→`builder`, `dartcycle`→`scout`, `earthshaker`→`heavyTank`) halten Kampagnen-JSONs am Laufen. `units.json` ist GELÖSCHT.

- **Waffen:** `src/data/weapons.ts` (reiches Schema, `toLegacyWeapon()` für die Sim). **Rüstung:** `src/data/armor.ts`. **Bewegung (nur visuell!):** `src/data/movementProfiles.ts` — Red=tracked, Blue=wheeled, Green=hover, Yellow=monoWheel; `animateUnit` macht Bob/Banking, effektive Speed bleibt gleich.
- **Neue Klassen:** `lightAttack` (Striker), `antiAir` (Skywatch, schwacher Bodenkampf + `antiAirBonus` für später), `support` (Tender, Repair-Aura `supportAuraStep` in world.ts).
- **Autonomie (Sim nutzt):** `canAutoAttack`, `autoAcquireRange`, `pursuitRange`, `defaultStance` (holdFire/returnFire/defendArea/aggressive — returnFire hook in `applyDamage`). Datenmodell hat zusätzlich patrol/guard/intelligence etc. (noch ungenutzt).
- **Modelle:** `src/render/vehicleModels.ts` — Chassis (tracked/wheeled/hover/**monoWheel v3**/**walker v2**/**halfTrack**) × Rollen-Kit (hopper/crane/turret/AA-pods/dish …); `makeEntityGroup(..., visual)` cached per `unit:<faction>:<classId>`. Alle Hüllen/Türme nutzen **RoundedBoxGeometry** (`rbox`, gefaste Kanten statt Voxel-Look). **MonoWheel v3** = ZWILLINGS-Panzerringe mit freiem Mittelkanal, Gyro-Kabine + Rollen-Kit wachsen AUS DER NABE (kein Sattel-Aufbau über dem Rad, keine Stützräder — User-Feedback). **Walker v2** = dicke Beine, über Hüftschürze/Pelvis VERBUNDEN, Knie-Kugeln, Hydraulik-Akzente, Greifer-Füße. **halfTrack** = lenkbare Fronträder + hintere Kettenblöcke. **`addDetails()`** = Greeble-Pass auf jedem Fahrzeug (+60 % Detail: Luken, Lufteinlässe, Kühlrippen, Antennen, Scheinwerfer, Abschlepphaken, Ersatz-Kettenglieder, Reservetanks, Staukästen).
- **Azure Concord Rad-Vielfalt:** scout/lightAttack = 4-rädrig, mediumTank/antiAir/support = 6-rädrig, harvester/builder = 8-rädrig (`wheelCount` = Räder PRO SEITE), heavyTank = **Halbkette**. Yellow: heavyTank=6-Bein-Walker, antiAir/support=4-Bein, Rest Einrad v3.
- **Asset-Status-Ledger:** `STATUS`-Map am Ende von `artMetadata.ts` — `generated` lädt die Textur, `approved` nach Review, `needsRevision` fällt zurück. Erste 6 Sets (Pro-Finals) stehen auf `generated`. Pipeline konvertiert Pro-JPEGs automatisch zu PNG (`_ensure_png`).
- **Balance-Wächter:** `npm run validate:balance` (+ Dev-Konsole beim Start). Meldet VIOLATIONS vs. „intentional (faction perk / override)".
- **KI:** `enemy.ts` produziert nach **Rollen** (`ARMY_ROLE_MIX` → `byRole()`).
- **Unit Codex:** Start-Screen-Button → `src/ui/unitCodex.ts` (4 Fraktions-Tabs, 8 Klassen, echtes 3D-Preview per drag/wheel, Stats inkl. Resistenzen/Autonomie, Design-Brief + Asset-Status).
- **Textur-Pipeline:** `npm run generate:texture -- --faction red --unit medium_tank [--final|--variants N|--batch-initial|--all|--dry-run]`. Briefs in `src/data/artMetadata.ts` → Export `tools/art_metadata.json` → `tools/vehicle_texture.py` → `public/assets/vehicles/<faction>/<class>/{baseColor.png,prompt.json}`. Renderer lädt Sets erst, wenn `status` in artMetadata.ts auf `generated`/`approved` steht (Fallback: Rollen-Hülle → prozedural). Key nur aus `.gemini_key/.env`; `.env.example` + `.gitignore` existieren.

**Neues Fahrzeug anlegen:** Template in `unitClasses.ts` (Balance) → 4 Dateien `src/vehicles/*/<id>.ts` + Registry-Eintrag in `src/vehicles/index.ts` → ggf. Kit in `vehicleModels.ts` → Brief-Eintrag in `artMetadata.ts`. **Ein Fahrzeug ändern:** nur seine eine Datei unter `src/vehicles/<fraktion>/` anfassen.

---

## Vehicle Design Studio (externes Programm) + Spec-Import-Pipeline

Externe App, in der man pro Fraktion×Fahrzeug **Geometrie und Texturen mit Gemini/Nano-Banana entwirft** und als portables Bündel **zurück ins Spiel importiert**. Brainstorm/Spec/Plan liegen unter `docs/superpowers/{specs,plans}/2026-06-12-vehicle-design-studio*`.

**Kernidee:** Gemini liefert keine 3D-Meshes → Geometrie = **parametrische Bauteil-Liste** (`vehicle-spec v1`, JSON). Das **Schema ist die Schnittstelle** zwischen den zwei separaten Repos; jede Seite implementiert es eigenständig.

### Phase A — Spiel-Seite (fertig, TDD, `npm test` = vitest)
- **`src/vehicles/spec/vehicleSpec.ts`** — `VehicleSpec`/`SpecPart`-Typen (prim box/cyl/sph/cone/torus/rbox; slot; pos/rot/scale; anim turret/spin/load). **`validate.ts`** — Validator (Enums, Arity, Turret-Pivot, Footprint-Clamp).
- **`src/render/specInterpreter.ts`** `buildPartsFromSpec()` — Spec → die bestehenden `Part[]` (durch die unveränderte Mesh-Pipeline).
- **Few-Shot-Konverter** `tools/convert_vehicle_to_spec.mjs` (`npm run seed:specs`) → `studio-seeds/*.json` (alle 32 prozeduralen Modelle als Spec-Vorlagen für Gemini). Mechanik: `GEO_SPEC`-WeakMap taggt Primitive, `P()` schreibt pos/rot/scale auf `part.spec`, `variantToSpec()` exportiert. Round-Trip-Test prüft BBox-Größentreue.
- **Factory-Hook** (`models.ts#getVariantTemplate`) bevorzugt einen importierten Spec aus `src/vehicles/specs/<f>/<c>.json` (eager `import.meta.glob`), sonst prozedural. `importedStatus.json`-Overlay (letztes in `artMetadata.ts`): `needsRevision` = zurück auf prozedural.
- **Catalog-Export** `scripts/export-catalog.mjs` (`npm run export:catalog`) → `studio-export/catalog.json` mit **größenkorrektem** `renderScale = UNIT_VISUAL_SCALE × silhouetteScale` (+ Briefs).
- **Import** `scripts/import-vehicle.mjs` (`npm run import:vehicle -- <bündel> [--dry-run | --all <dir>]`): validiert → kopiert Geometrie/Texturen → Status. **Nach Import Dev-Server neu starten** (Glob ist build-time).

### Phase B — Studio (separates privates Repo `YorkStack/Vireon-Design-Studio`, sibling-Ordner `../vireon-design-studio`)
- Vite+TS+Three; **lokaler Node-Service** (`server/gemini.mjs`, in `vite.config.ts` als `/api`-Middleware) hält den Key serverseitig (`.env`, gitignored). Browser sieht den Key nie.
- **Ablauf:** Fahrzeug wählen → **Skizze** (Nano Banana, fraktions-Prompt) → **Approve** → **Geometrie** (Gemini multimodal: Skizze + Größe + Few-Shot-Seeds → Spec) → Live-3D in echter Größe → **Textur** → **Export-Bündel** → Import ins Spiel.
- **Prompts** in `src/prompts.ts`: pro Fraktion×Fahrzeug Basis-Prompt + gemeinsamer Skizzen-Suffix (Crimson=menschlich/militärisch, Azure=aquatisch, Verdant=insektoid, Solar=mikrobiell); Fraktions-Palette steuert Texturen.
- **Versions-Bibliothek:** jede Geometrie-Generierung speichert automatisch eine nummerierte Version unter `library/<f>_<klasse>/vNNN/` (sketch+geometry+texture+meta); Versions-Liste im UI zum Durchsehen/Laden; man exportiert die **beste** Version. Endpunkte `/api/{sketch,geometry,texture,save,versions,version,export}`.
- Headless-Treiber `tools/run-slice.mjs <faction:class>` (generische Prompts) für Schnelltests.
- **Verifiziert:** voller Slice (Azure mediumTank: Skizze→73-Bauteil-Geometrie→Textur→Export→Import) rendert im Spiel in korrekter Größe; Crimson-Prompts liefern menschliche Militär-Panzer.

**Bündel-Format:** `exports/<f>_<klasse>/{geometry.json, baseColor.png, sketch.png, meta.json}`.

**Studio nutzen:** `cd ../vireon-design-studio && npm run dev` (Port 5188). Inputs aus dem Spiel aktuell halten: `npm run export:catalog` + `npm run seed:specs`, dann `catalog.json`/`seeds` nach `../vireon-design-studio/data/` kopieren.

### Phase C — Studio-Erweiterungen (neueste Sitzung)
- **Editierbare Prompts pro Fraktion×Fahrzeug (Skizze · Geometrie · Textur).** Es sind **drei getrennte** Prompts. Der vollständige **User-Prompt-Pack** (4 Fraktionen × 8 Klassen × 3 = 96 Texte) liegt in `src/prompts.ts#PROMPT_PACK` und ist die **einzige Default-Quelle** (alter generischer `VEHICLE_BASE` entfernt). Im UI steht das jeweilige Textfeld **direkt über seinem Erzeugen-Button** (Skizze über Schritt 1, Geometrie über Schritt 3, Textur über Schritt 4), vorbefüllt mit dem **Original-Prompt** (kein Anhängen — der Originaltext selbst ist editierbar). „Save prompts" / „Reset prompts" oben.
  - **Skizze** = Pack-Text wortwörtlich (enthält schon den Shared-Style-Suffix).
  - **Geometrie** = Pack-Prose wortwörtlich + mechanisches Gerüst per Token `{{SCHEMA}} {{SIZE}} {{SEEDS}} {{NOTES}}` (Server `gemini.mjs` expandiert sie → gültiges, größenrichtiges JSON; Skizzenbild wird separat angehängt).
  - **Textur** = Pack-Prose wortwörtlich + Technik-Zusatz (`TEXTURE_TECH`: seamless/tileable, flat top-down, hell genug).
  - **Persistenz:** Overrides pro Fahrzeug in `library/<id>/prompts.json` (Endpunkte `GET/POST /api/prompts`), zusätzlich in **jede Version** geschnappschottet (`prompts.json` im vNNN-Ordner; auch von `/api/version` zurückgeliefert). „Save prompts" / „Reset to defaults".
- **Klarerer Schritt-Status:** Step-Buttons mit rundem Badge vorne (Nummer → **↻ Redo** sobald erledigt) + **grünem ✓** hinten + grünem Rahmen. CSS in `style.css` (`.steps button.step`, `.done`).
- **Skizzen-Treue** ist fest im 2-Pass-Geometrie-System-Prompt verankert („STRICTLY FOLLOW THE SKETCH…" in `gemini.mjs` SCHEMA_DOC) — der frühere „Strictly follow"-Schalter (Batch + Hauptmenü) wurde **entfernt** (redundant). Die Skizze geht ohnehin als echtes **Bild** (`inlineData`) an Gemini mit.
- **Batch-Modus** (Header „⚙ Batch all"): spielt die ganze Pipeline (Skizze→Geometrie→Textur) für **alle Fraktionen × alle Klassen** einmal durch. Nutzt die **2-Pass-Geometrie automatisch** (gleicher `{{SCHEMA}}`-Pfad). **Auswahl-Raster:** Zelle anklicken (einzelnes Fahrzeug), Fraktions-Name (ganze Zeile), Klassen-Header (ganze Spalte), „all" (alles) — nur Ausgewählte laufen (`opts.only`-Set, „N selected"-Anzeige). Optionen: Haupt-Textur (full-body), **per-Slot-Komponenten-Texturen aus der Skizze** (default aus: pro Fahrzeug `analyzeTexture`→Crop→`sampleTexture` pro Slot, gespeichert + exportiert — mehrere Extra-Bild-Calls), **Export pro Fahrzeug** (`exports/`, default an), **Resume** (überspringt vorhandene Versionen), Retries. (Strict entfernt.) **Fehlerrobust:** `apiRetry()` mit exponentiellem Backoff überlebt Gemini-Aussetzer/Blocks/Rate-Limits; hartnäckige Fehler werden geloggt und übersprungen. **Stop** (sofort wirksam, auch in Backoff-Pausen via `abortableSleep`) und **Close** funktionieren jederzeit; jedes fertige Fahrzeug ist sofort in `library/` **und** `exports/` persistiert → kein Verlust. 4×8-Status-Raster, Live-Log, Zähler.
- **Übersichts-Seite** (Header „📋 Overview"): pro Fraktion (Tabs) alle Fahrzeuge als Karten — **Skizzen-Thumbnail** (lazy aus `/api/versions`), Name, Rolle·Tiles, **erzeugter Stand** (✓ vN ·tex / „not generated", grüner Rand), und die **Design-Beschreibung**. **Mehrfach-Auswahl** (Checkboxen, auch fraktionsübergreifend) + „Select generated/Clear" → **Bulk-Export** (`exportVehicle` lädt die neueste Version jedes Markierten und schreibt das Bündel) oder **Bulk-Delete** (`POST /api/deleteVehicle` löscht alle Versionen **und** das Export-Bündel; mit Rückfrage). Schnell zum Sichten „was exportieren/löschen".
- **Batch Stop/Cancel abgesichert:** Stop und Close setzen `batchAbort`; der Loop bricht beim nächsten Schritt ab, laufende Saves laufen zu Ende. Die **Geometrie-Version wird sofort nach der Geometrie gespeichert** (vor den Texturen) → bis dahin fertige Fahrzeuge sind in `library/` (+ `exports/` bei Export-pro-Fahrzeug) gesichert; abgebrochene zählen als „skip", nicht „fail".
- **Gespeicherte Fahrzeuge sichtbar (persistent):** `GET /api/library` indiziert alle `library/`-Fahrzeuge (Versions-Anzahl + Textur). Liste zeigt **✓ vN ·tex-Badge** + grünen Rand; beim **Auswählen wird automatisch die neueste Version geladen** (Skizze + 3D), also auch nach Studio-Neustart sofort sichtbar.
- **Textur aufs 3D-Modell:** `SpecRenderer.setTexture()/setTextured()` mappt die gerenderte baseColor auf body/dark/smooth/roof; **Checkbox „Show texture on 3D model"** schaltet um.
- **Expliziter Speicher-Flow (interaktiv):** Geometrie/Textur erzeugen einen **unsaved Draft** (kein Auto-Save mehr); Schritt **„Save version"** schreibt bewusst eine neue Version. Versions-Chips haben **Auswahl-Punkt (◉ = Export-Ziel)** und **Löschen-✕** (`POST /api/deleteVersion`). **Export** nutzt die gewählte gespeicherte Version (blockt bei unsaved Draft). Batch speichert weiterhin automatisch (unbeaufsichtigt).
- **Alt-Bestand retten:** `node tools/export-library.mjs` exportiert die neueste Version jedes `library/`-Fahrzeugs nach `exports/` (kostenlos, kein Gemini) → `npm run import:vehicle -- --all ../vireon-design-studio/exports`.
- **Verbesserte Geometrie-Generierung (Skizze→Spec):** Der Geometrie-„System-Prompt" (`gemini.mjs#SCHEMA_DOC`, via `{{SCHEMA}}`-Token) ist jetzt ein vollwertiger Technical-Artist-Prompt: harte API-Constraints, **Sketch→Primitive-Recipes** (Walker-Beine in Hüfte/Oberschenkel/Schienbein, Käferpanzer via nicht-uniform skalierte `sph`, Waffen = Box-Mount + langer rotierter `cyl`, Crawler = segmentierte `rbox`), ein **schema-korrektes Few-Shot** (15–45 Parts) und **Zwei-Phasen-Output** (Phase 1 Architektur-Analyse als Text → ins Studio-Log; Phase 2 reines JSON). Robuster **klammer-zählender, string-sicherer Parser** (`extractJsonAndBreakdown`) trennt Prosa vom JSON; `comment`-Felder erlaubt (helfen dem Modell) und werden nach dem Parsen gestrippt. **Wichtig:** `sph`-Arität bleibt 1 (`size:[r]`) — nicht-uniform via `scale`. Das pro-Fahrzeug editierbare Geometrie-Feld bleibt die „TARGET VEHICLE"-Beschreibung; echte Seeds (`{{SEEDS}}`) zusätzlich als gültige Referenz. (Alte gespeicherte Geometrie-Prompts bekommen den neuen System-Teil automatisch über das `{{SCHEMA}}`-Token; „Reset prompts" gibt die volle neue Struktur.)
- **Texturen aus der Skizze sampeln (img2img):** „🔍 Analyze sketch → suggest texture regions" lässt **Gemini-Vision** die Skizze analysieren und liefert pro Slot eine **Crop-Region** (0–1000 normalisiert) + einen **img2img-Prompt** + Phase-1-Analyse (→ Log). Auf der Skizze erscheint eine **ziehbare/resizebare Crop-Box** (verschieben + Eck-Griff), die du pro Slot korrigierst. „✂ Sample … from sketch" croppt den Patch **client-seitig per Canvas** (kein `sharp` nötig) und schickt ihn an Gemini-**img2img** (`/api/sampleTexture`, `image(prompt, patch)`) → nahtlose, matte, entsättigte Kachel-Textur, die den Skizzen-Look bewahrt. Backend bewusst **Gemini-nativ** (kein SD): `denoising_strength`/`tiling`/`negative_prompt` gibt es dort nicht → Negatives sind in den Prompt gefaltet. Endpunkte `/api/{analyzeTexture,sampleTexture}`; System-Prompt `TEXTURE_ANALYSIS`. Ergebnis landet als normale per-Slot-Textur (s. u.) und wird mitexportiert/gerendert.
- **Komponenten-Gruppen (`texGroup`) + Trapezprisma (`trap`)** — Spec/Plan unter `docs/superpowers/specs/2026-06-13-component-textures-design.md`. Jedes Bauteil hat eine **`texGroup`** (Textur-Einheit; Default = Slot). **Textur pro Gruppe, Material weiter pro Slot** → Ketten/Fräse/Rohr (alle `dark`) bekommen verschiedene Texturen; Accent-Glühen/Glas bleiben. Renderer ist **zweistufig** (`models.ts` Slot→Gruppe-Merge; `slotTextures`-Keys sind jetzt Gruppen, Default=Slot → **keine Migration**, 29 Altbündel unverändert). Der 2-Pass-Generator vergibt Gruppen automatisch (`track`/`cutter`/`barrel`/`leg`…); im Studio-Panel: Bauteil klicken → Gruppe wählen/markieren, **Gruppe umbenennen**, **einzelnes Teil in (neue) Gruppe verschieben**, je Gruppe Generate/Sample-from-sketch/Clear. **`trap`** `size:[wTop,wBottom,h,d]` (Trapez in Z×Y, extrudiert entlang X; wTop/wBottom beliebige Reihenfolge) für Panzerketten — identisch in beiden Engines, `tagGeo`-Round-Trip. Tests grün (Spiel 27). **Phase 2 (Preset-Bibliothek) ERLEDIGT:** Studio-Server `library/_presets.json` (Rezept + optionales PNG) mit 10 Seeds (wheel/tire/track/roadwheel/leg/riveted-hull/doors/glass/cannon/dome), Endpunkte `GET/POST /api/presets`. Im Studio pro Gruppe **„Apply preset"** (sofort bei gebackenem PNG, sonst fraktions-getönt generiert) + **„Save as preset"**. **GUI überarbeitet:** Komponenten-Panel ist jetzt **eine aufklappbare Karte pro Gruppe** mit eigenem Prompt + Generate/Sample/Preset/Clear/Rename/Move **inline** (Prompt direkt an der Textur-Klasse); Klick aufs Bauteil öffnet seine Karte; Crop-Box erscheint für die offene Gruppe. **Phase 3 (per-Fläche) noch offen** — großer Cross-Engine-Render-Umbau (Un-Merge + Material-Arrays + Flächen-Picking); der Haupt-Use-Case „Kette oben vs. Seiten" ist über Phase 1 (getrennte `trap`-„track" + `cyl`-„roadwheel"-Gruppen) bereits abgedeckt.
- **Komponenten-Texturen (per Slot, Vorgänger von Gruppen):** Im 3D-Preview **Bauteil anklicken** → wählt dessen **Slot** (body/dark/accent/light/smooth/roof, grün hervorgehoben; `SpecRenderer.onPick`/Raycast). Pro Slot eigener **Prompt + „Generate"-Knopf** → Textur wird **nur auf diesen Slot** gemappt (z. B. `dark` = Ketten/Beine, `body` = Schuppen-/Hüllenpanzer). Persistenz: `slot_<slot>.png` + `slotPrompts.json` in der Version, im Export-Bündel mitgeführt. **Spiel-Rendering:** Import kopiert `slot_<slot>.png` nach `public/assets/.../` und injiziert `slotTextures: {slot:url}` in die Spec; `models.ts#importedSlotMats` + `meshesFor(slotMats)` überschreiben das Material pro Slot. Test in `importVehicle.test.ts` (Erkennung + Injektion). **Auswahl ist slot-basiert** (Klick wählt alle Bauteile desselben Slots) — User-Entscheidung.
- **Studio-Link im Spiel-Codex:** `src/ui/unitCodex.ts` Button „🎨 DESIGN STUDIO ↗" öffnet `localhost:5188` (per `?studio=URL` überschreibbar).
- **Neue Fahrzeugklassen (Schiffe/Flugzeuge/Raketen/Raumschiffe) — Studio-Authoring + statisch im Spiel.** „+ New class…" am Listenende → Dialog (id, Name, Rolle, Tiles, Subject) → `POST /api/classes` → `library/_classes.json`. Klasse erscheint für **alle Fraktionen** (`catalog.ts#makeCustomEntry` synthetisiert die CatalogEntry), wird wie jede andere entworfen/exportiert. **Keine neue Flug-/Wasser-Physik** (bewusst — User-Entscheidung „statisch").
  - **Spiel-Seite:** Export trägt `classDef` in `meta.json`; `import:vehicle` registriert sie in **`src/data/customClasses.json`** (idempotent). `unitClasses.ts` merged sie via `customClassToTemplate()` als Bodenfahrzeug-Balance-Template + `CUSTOM_CLASS_IDS`; `unitFactory.resolveUnit()` setzt für varianten-lose Vehicle-Klassen `visual.factoryId` → rendert über importierten Spec; `models.ts#getVariantTemplate` baut auch ohne Varianten-Datei aus dem Spec; Codex robust gegen fehlende Art-Metadaten. Tests: `importVehicle.test.ts` (classDef getragen / nicht für Built-ins / idempotente Registrierung) — `npm test` = **22 grün**.

## Wichtige Dateien
- `src/render/terrain.ts` — Terrain-Mesh (Multi-Material, Höhen-Rippeln), Felsen, Props, Kristalle. Bodentexturen `GROUND_TEX`.
- `src/render/models.ts` — prozedurale Modelle, Material-Slots (`body/dark/accent/light/smooth/roof`), Texturen (`buildingBodyMat`, `vehicleBodyMat`, `smoothMat`=Kuppel, `roofMat`=Dach), Fundament-Pad, Auswahlringe, Healthbars.
- `src/sim/world.ts` — Simulation: Units/Buildings, Orders, Harvester (`harvAttack`/`ramStep`/Auto-Harvest), autonomer Bau, Combat, Animation-Sync (`animateUnit`/`animateBuilding`).
- `src/render/scene.ts` — Renderer, Kamera-Rig, Beleuchtung (Hemisphere/Sun/Fill).
- `src/render/effects.ts` — Projektile, Laser, Explosionen, Scorch, Marker.
- `src/ui/screens.ts` + `src/ui/style.css` — Start-Screen/Briefing/Pause/End + taktischer Look.
- `src/ui/input.ts` — Selektion, Befehle, Platzierung, Kamera.
- `src/ai/enemy.ts` — Gegner-KI (Bau, Ökonomie, Wellen).
- `public/campaigns/` — Kampagnen/Missionen als JSON (datengetrieben, leicht erweiterbar).
- `generate_asset.py` + `asset_cost_log.csv` — Asset-Pipeline (Spiel-Texturen; Studio nutzt eigenen Node-Service).
- `src/data/{unitClasses,weapons,armor,movementProfiles,artMetadata}.ts` — datengetriebene Fahrzeug-Definitionen + Briefs.
- `src/vehicles/` — `<fraktion>/<klasse>.ts` (32 Varianten), `index.ts` (Registry), `spec/` (vehicle-spec-Schema+Validator), `importedSpecs.ts` (Factory-Glob), `specs/` (importierte Geometrie).
- `src/systems/{unitFactory,balanceValidation}.ts`, `src/render/{vehicleModels,specInterpreter}.ts`, `src/ui/unitCodex.ts`.
- `scripts/{export-catalog,import-vehicle,validate-balance,export-artmeta}.mjs`, `tools/{vehicle_texture.py,convert_vehicle_to_spec.mjs}`.

## Gameplay-Grundloop (funktioniert, verifiziert)
Fabricator → Command Nexus → Refinery → Spire → Foundry/Barracks → Harvester (auto-erntet) → Armee → Gegner-Nexus zerstören. Sieg/Niederlage = Command Nexus + Fabricator beider Seiten. KI baut Basis, sammelt, produziert, greift in eskalierenden Wellen an.

## Faustregeln für die Fortsetzung
- Antworten **auf Deutsch**.
- Asset-Generierung: **erst Flash-Entwurf zeigen, dann auf Go warten**, dann Pro. Kosten nennen.
- Visuals verifiziert der User auf **5199** (Preview-Screenshot-Tool unzuverlässig).
- Nach Code-Änderungen: `npx tsc --noEmit`, dann im Spiel testen (`window.__game.step()` für Sim-Checks).
