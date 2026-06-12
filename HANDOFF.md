# Vireon Front — Handoff / Arbeitsstand

> Stand: Übergabe vor /compact. Sprache: **Antworten immer auf Deutsch** (User-Präferenz, in Memory hinterlegt).

## Was das ist
Echtzeit-Strategiespiel (RTS) im C&C-Stil auf dem feindlichen Kristallplaneten **Vireon**.
Stack: **TypeScript + Three.js + Vite**. Läuft im Browser, 120 FPS auf M2.

## Starten / Server
- **`npm run dev` → http://localhost:5199`** (Port in package.json gepinnt — das ist die feste Adresse des Users).
- Das Claude-Preview-Tool nutzt Port **5180** und hat einen **Canvas-Resize-Bug** (Screenshots oft abgeschnitten). Workaround: frischer `preview_start` + `desktop`-preset + im eval `renderer.setPixelRatio(1); setSize(innerWidth,innerHeight)`. Der User beurteilt Visuals selbst auf 5199.
- Debug-Hook im Spiel: `window.__game` mit `.world`, `.map`, `.rig`, `.input` und `.step(secs)` (Sim vorspulen, für Verifikation ohne Klicken).

## Build / Verifikation
- `npx tsc --noEmit` (Type-Check), `npm run build` (Production-Build). Beide aktuell sauber.

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

---

## OFFENE PUNKTE / PLAN (Priorität vom User bestätigt: Terrain-Block war zuletzt dran und ist fertig)

Reihenfolge war **A→B→D→C** vereinbart; Terrain (Teil von A/C) gerade gemacht. Noch offen:

1. **Konsolen-Grafik für Fraktions-Terminals** — User will statt der CSS-Metalloptik eine **gerenderte Terminal-Grafik** (wie sein angehängter Screenshot: physisches Konsolen-Terminal mit eingelassenem Display). Asset generieren (Pro) + als border-image/background einbauen. **Eingeplant, noch nicht gemacht.**
2. ~~Klippen-Kanten abschrägen~~ — **ERLEDIGT** (Terrain-Overhaul 2): Klippen sind jetzt geneigte Aprons mit Gras→Fels-Blend.
3. **Phase B — Vulkan + Spezial-Erz**: 1–2 seltene Vulkanzonen auf der Map, leuchtendes **Spezial-Erz mit 3× Wert**, Lava-Optik. (Map-Gen + Logik + Assets.) **Geplant, nicht begonnen.**
4. **Phase C — Biome/Gegenden**: Flachland, Gebirge, **Seen** (Wasser-Hindernis), Wälder, Steppen, Wüsten als Regionen über die Höhenkarte; pro Biom Bodentextur + Vegetation. **Großes Feature, mehrere Sitzungen.** Bodentexturen pro Höhe sind als Vorarbeit schon da.
5. **Phase D — mehr Gebäude-/Fahrzeug-Texturvarianten** falls gewünscht.

---

## Fahrzeug-Architektur (datengetrieben, seit Refactor)

**Schichten:** `src/data/unitClasses.ts` (Klassen-Templates = EINZIGE Balance-Quelle) → `src/vehicles/<fraktion>/<klasse>.ts` (32 Dateien: NUR Optik + auditierte `balanceOverrides`) → `factions.json`-Perks → `src/systems/unitFactory.ts#resolveUnit()` liefert flaches, legacy-kompatibles `UnitDef`. Legacy-Aliase (`vanguard`→`mediumTank`, `fabricator`→`builder`, `dartcycle`→`scout`, `earthshaker`→`heavyTank`) halten Kampagnen-JSONs am Laufen. `units.json` ist GELÖSCHT.

- **Waffen:** `src/data/weapons.ts` (reiches Schema, `toLegacyWeapon()` für die Sim). **Rüstung:** `src/data/armor.ts`. **Bewegung (nur visuell!):** `src/data/movementProfiles.ts` — Red=tracked, Blue=wheeled, Green=hover, Yellow=monoWheel; `animateUnit` macht Bob/Banking, effektive Speed bleibt gleich.
- **Neue Klassen:** `lightAttack` (Striker), `antiAir` (Skywatch, schwacher Bodenkampf + `antiAirBonus` für später), `support` (Tender, Repair-Aura `supportAuraStep` in world.ts).
- **Autonomie (Sim nutzt):** `canAutoAttack`, `autoAcquireRange`, `pursuitRange`, `defaultStance` (holdFire/returnFire/defendArea/aggressive — returnFire hook in `applyDamage`). Datenmodell hat zusätzlich patrol/guard/intelligence etc. (noch ungenutzt).
- **Modelle:** `src/render/vehicleModels.ts` — Chassis (tracked/wheeled/hover/monoWheel) × Rollen-Kit (hopper/crane/turret/AA-pods/dish …); `makeEntityGroup(..., visual)` cached per `unit:<faction>:<classId>`.
- **Balance-Wächter:** `npm run validate:balance` (+ Dev-Konsole beim Start). Meldet VIOLATIONS vs. „intentional (faction perk / override)".
- **KI:** `enemy.ts` produziert nach **Rollen** (`ARMY_ROLE_MIX` → `byRole()`).
- **Unit Codex:** Start-Screen-Button → `src/ui/unitCodex.ts` (4 Fraktions-Tabs, 8 Klassen, echtes 3D-Preview per drag/wheel, Stats inkl. Resistenzen/Autonomie, Design-Brief + Asset-Status).
- **Textur-Pipeline:** `npm run generate:texture -- --faction red --unit medium_tank [--final|--variants N|--batch-initial|--all|--dry-run]`. Briefs in `src/data/artMetadata.ts` → Export `tools/art_metadata.json` → `tools/vehicle_texture.py` → `public/assets/vehicles/<faction>/<class>/{baseColor.png,prompt.json}`. Renderer lädt Sets erst, wenn `status` in artMetadata.ts auf `generated`/`approved` steht (Fallback: Rollen-Hülle → prozedural). Key nur aus `.gemini_key/.env`; `.env.example` + `.gitignore` existieren.

**Neues Fahrzeug anlegen:** Template in `unitClasses.ts` (Balance) → 4 Dateien `src/vehicles/*/<id>.ts` + Registry-Eintrag in `src/vehicles/index.ts` → ggf. Kit in `vehicleModels.ts` → Brief-Eintrag in `artMetadata.ts`. **Ein Fahrzeug ändern:** nur seine eine Datei unter `src/vehicles/<fraktion>/` anfassen.

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
- `generate_asset.py` + `asset_cost_log.csv` — Asset-Pipeline.

## Gameplay-Grundloop (funktioniert, verifiziert)
Fabricator → Command Nexus → Refinery → Spire → Foundry/Barracks → Harvester (auto-erntet) → Armee → Gegner-Nexus zerstören. Sieg/Niederlage = Command Nexus + Fabricator beider Seiten. KI baut Basis, sammelt, produziert, greift in eskalierenden Wellen an.

## Faustregeln für die Fortsetzung
- Antworten **auf Deutsch**.
- Asset-Generierung: **erst Flash-Entwurf zeigen, dann auf Go warten**, dann Pro. Kosten nennen.
- Visuals verifiziert der User auf **5199** (Preview-Screenshot-Tool unzuverlässig).
- Nach Code-Änderungen: `npx tsc --noEmit`, dann im Spiel testen (`window.__game.step()` für Sim-Checks).
