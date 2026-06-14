# Vehicle Component Factory — Design-Spec (Teilprojekt C, Slice 1)

> Stand: 2026-06-14. Sprache: Deutsch. Spannt **zwei Repos**: Studio (`../vireon-design-studio`, Authoring/Blender/Export) + Spiel (`Vireon Front`, Runtime-GLB-Render-Pfad).
> Strategischer Rahmen: Memory `vehicle-blender-component-factory`. Diese Spec beschreibt **Slice 1 = vertikaler Durchstich** (Crimson Medium Tank Ende-zu-Ende), mit einer Architektur, die auf 4 Fraktionen × ~40 Komponententypen erweiterbar ist. Die volle Bibliothek ist NICHT Teil dieser Spec.

## Ziel (Slice 1)
Beweise die komplette Kette an **einem** Fahrzeug:
`Component-Specs → bpy-Template-Konfiguration → Blender-Generierung → Validation → Assembly → Bake/Merge/Optimize → Runtime-GLB → neuer Spiel-Render-Pfad`, sodass im Spiel ein **Crimson Medium Tank aus GLB** mit **drehendem Turm**, **Akzent-Tinting** und **Mündungs-Effekt-Socket** das prozedurale `red/mediumTank` ersetzt.

Entscheidungen (vom User bestätigt): LLM **konfiguriert parametrische bpy-Templates** (schreibt KEINEN rohen bpy-Code); Ziel Crimson Medium Tank; Umfang bis ins Spiel gerendert.

## Komponenten-Kategorien im Slice
Chassis (medium, tracked), Movement (track L + R), Turret (medium), Weapon (medium_cannon mit `muzzle`), Sensor/Decor (1 Aufbau). Genug, um Hardpoints, Assembly, Turm-Anim und Effekt-Socket zu validieren.

---

## 1. Hardpoint-Modell — Template-Eigentum (Drift-Schutz)
**Das Template besitzt die Hardpoint-Struktur, nicht die LLM.**
- Jede bpy-Template-Funktion **deklariert** ihre Hardpoints fest: `id`, `type`, Basis-`pos`/`rot`, `size_class` und ob `optional`.
- Die **LLM-Component-Spec** darf NUR: (a) Template-Parameter innerhalb deklarierter Ranges/Enums setzen, (b) optionale Hardpoints an/aus schalten. Sie darf **keine** Hardpoints frei definieren oder Transforms überschreiben.
- Der **Validator** erzwingt: jeder Spec-Param ∈ Template-Whitelist (Range/Enum); die resultierende Hardpoint-Liste stammt aus dem Template-Output (Blender), die JSON spiegelt sie nur. Bei Abweichung JSON↔Blender → Fehler.

Hardpoint-Typen (Slice): `turret_ring`, `weapon_mount`, `movement_slot` (Seite L/R via `side`), `decor`, `muzzle`, `effect_socket`.
Buchsen/Stecker: **Chassis** (Wurzel) bietet `turret_ring`, `movement_slot.L/R`, `decor.*`; **Turret** steckt auf `turret_ring`, bietet `weapon_mount`, ist der animierte Node; **Weapon** steckt auf `weapon_mount`, bietet `muzzle`; **Movement** steckt in `movement_slot`.
Kompatibilität (validierbar): gleicher `type` + passende `size_class`.

## 2. Koordinaten- & Node-Vertrag (Blender → GLB → Three) — KERN
Verbindlich für ALLE Templates, das Bake-Skript und den Spiel-Loader:
- **Units:** 1 Blender-Unit = 1 Modell-lokale Spiel-Unit. Das Spiel skaliert beim Rendern selbst (`UNIT_VISUAL_SCALE = 1.28`). Footprint in Tiles → Modell-Units wie im bestehenden `vehicle-spec`.
- **Achsen:** Export **+Y up** (`export_yup=True`). **Forward = +Z** (Fahrzeugbug/Lauf zeigt +Z). **Right = +X** (Ketten an ±X). Deckungsgleich mit der bestehenden Spiel-Konvention (X=Breite, Y=Höhe, Z=Länge).
- **Turm:** eigener Node namens **`turret`**, **Origin/Pivot im Zentrum des `turret_ring`**, Ruhe-Ausrichtung Forward=+Z, **Drehung um lokales +Y**. (Der Spiel-Turm-Animator dreht genau diesen Node um Y.)
- **Socket-Orientierung:** Ein Hardpoint-Empty definiert ein lokales Frame. Das Kind wird so geparentet, dass **Kind-Origin → Socket-Origin**, **Kind-+Z → Socket-+Z**, **Kind-+Y → Socket-+Y**. Default-`rot` = identisch zu Fahrzeugachsen.
- **Muzzle:** Empty **`muzzle`** (bzw. `muzzle.N`), Kind des Laufs/Turms, **lokales +Z = Schussrichtung**. Da der Turm rotiert, ist die Muzzle-**Weltposition dynamisch** → der Runtime-Effekt muss pro Schuss die **Welt-Matrix** des Empties auflösen (kein gecachter lokaler Punkt). Der bestehende `muzzleFlash(at: THREE.Vector3)` erwartet einen Weltpunkt.
- **Spiegelung verboten:** Links/Rechts-Komponenten (z. B. Track L/R) werden **unabhängig** authored, NICHT durch Mirror abgeleitet — eine Spiegelung kippt die Handedness und invertiert still +X.
- **Bounding-Box-Ziel:** Das Runtime-GLB soll die Maße des prozeduralen `red/mediumTank` treffen (Footprint aus dessen `vehicle-spec`/Klassen-Template lesen) — Toleranz ±15 %. Damit hat der Post-Bake-Check (§5) ein konkretes Ziel und der GLB-Tank passt optisch zum ersetzten Fahrzeug.
- **Material-Naming (Tint-Vertrag):** Slot-Materialien heißen exakt `mat_body`, `mat_dark`, `mat_accent`, `mat_light`, `mat_smooth`, `mat_roof`. Das Spiel färbt **`mat_accent`** auf die Fraktionsfarbe um.

## 3. Component-Spec + bpy-Template-Bibliothek
LLM liefert je Komponente validierte JSON:
```
{ component_id, faction, type, size_class, template, params{}, style{}, enabled_optional_hardpoints[], material_slots[], poly_budget }
```
`template` referenziert eine getestete bpy-Funktion unter `tools/blender/components/<type>.py` (z. B. `crimson_chassis_box`, `crimson_track`, `crimson_turret`, `crimson_cannon`, `crimson_sensor`). Jede Funktion baut deterministisch: Mesh + **Hardpoint-Empties** (benannt) + **Slot-Materialien** (kanonische Namen). Fraktions-Formsprache = Style-Flags/Parameter (Crimson: kantig, harte Platten). Jede Funktion deklariert ihr **Parameter-Schema** (Ranges/Enums) + ihre **Hardpoint-Liste** (für den Validator).

## 4. Assembly-Spec
```
{ vehicle_id, faction, class, root, components:[ { component_id, mount } ] }
```
`root` = Chassis; jede weitere Komponente nennt den Eltern-Hardpoint (`mount`). Headless `tools/blender/assemble.py` baut alle Komponenten und parentet sie rekursiv an die Mount-Transforms (Vertrag §2).

## 5. Bake/Merge/Optimize — Preserve-Regeln
`tools/blender/bake.py` überführt das Assembly in ein optimiertes Runtime-Asset:
- **Statik mergen:** statische Meshes **nach Material-Slot** joinen → wenige Meshes/Materialien. **Merge nur innerhalb gleicher Slots.**
- **NIEMALS antasten:**
  - `turret`-Objekt **nicht** in den Static-Merge joinen — bleibt eigener Node mit Pivot (§2).
  - `muzzle*` / `effect_socket*`-Empties **nicht umbenennen/decimieren** — nur transform-erhaltend an den korrekten Node umhängen.
  - kanonische Material-Namen (`mat_accent` …) **bleiben** — **kein Auto-`.001`**, keine Umbenennung.
- Transforms anwenden, Origins/Pivots korrekt, Polybudget + Bounding-Box prüfen.
- **Post-Bake-Validierung (hart):** Nodes `turret` + `muzzle` existieren; alle Material-Namen ⊆ kanonische Slot-Namen; Mesh-Anzahl ≤ Limit; Tris ≤ Budget; COLOR/Naming-Checks. Schlägt der Check fehl → Export bricht ab (kein stilles kaputtes GLB).
- Export: `red_mediumTank_final.glb` (+ Authoring-`.blend`, `metadata.json`, optional `preview.png`) nach Studio-`exports/red_mediumTank/` (kompatibel zur bestehenden Import-Pipeline).

## 6. Spiel-Runtime-Render-Pfad (neu, im Spiel-Repo)
- `loadVehicleGlb(faction, classId)` via `GLTFLoader`, gecacht.
- Pro Instanz: klonen; **`turret`-Node-Referenz** an die bestehende Turm-Dreh-Animation hängen (ersetzt den prozeduralen Turm-Mechanismus für dieses Fahrzeug); **`muzzle`-Empty(s)** als Effekt-Sockets registrieren; **`mat_accent` → Fraktionsfarbe** umfärben.
- **GLB bevorzugt, prozedural als Fallback:** existiert ein gültiges GLB für `faction/class`, wird es genutzt; sonst der bestehende prozedurale Pfad (die 29 bestehenden Fahrzeuge bleiben unberührt).
- **Sichtbarer Fallback (Dev):** fehlt/zerbricht das GLB → `console.warn('[veh] GLB fehlt/ungültig für <faction>/<class> → prozedural')` nur unter `import.meta.env.DEV`; zusätzlich Debug-Flag (z. B. `window.__game.vehSource`) das pro Klasse GLB vs. prozedural ausweist. Kein stilles Verstecken.
- **Muzzle Ende-zu-Ende:** beim Schuss wird am `muzzle`-Socket ein einfacher Mündungseffekt (bestehendes Effekt-System) ausgelöst — die Runtime-Schnittstelle ist damit jetzt validiert.

## 7. Vertikaler Durchstich — Deliverable
Crimson Medium Tank: 5 Komponenten (Chassis, Track L, Track R, Turret, Cannon, Sensor) → Assembly → Bake → `red_mediumTank_final.glb` → im Spiel: drehender Turm, Akzent-Tint, Mündungseffekt am `muzzle`. Ersetzt sichtbar das prozedurale `red/mediumTank`; alle anderen Fahrzeuge bleiben prozedural.

## 8. Testing
- **Validator-Units (Studio):** Component-Spec gegen Template-Whitelist (Param-Range/Enum), Hardpoint-Kompatibilität (type+size_class), Assembly-Auflösung (jeder `mount` existiert am Parent).
- **Guard-Test GLB:** `red_mediumTank_final.glb` hat Nodes `turret` + `muzzle`, Materialien ⊆ kanonische Slots, Tris ≤ Budget, ein Turm-Node getrennt vom Static-Mesh.
- **Game-Loader-Test:** Loader liefert `turret`-Node-Referenz; `mat_accent`-Umfärbung greift; Fallback-Warnung feuert bei fehlendem GLB.
- **Visuell auf 5199:** Turm dreht, Tint stimmt, Mündungseffekt am Lauf, Silhouette aus iso-Sicht lesbar.

## 9. Risiken
1. **Achsen/Pivot-Konventionen** Blender↔three — früh mit Mini-Assembly + Guard-Test verifizieren (§2 ist der Vertrag).
2. **Turm-Pivot im GLB** für Runtime-Drehung — Post-Bake-Check + visuell.
3. **Spiel-Render-Pfad** ist echte Spiel-Arbeit (nicht nur Studio) — bewusst Teil des Slice.
4. **Akzent-Tinting** hängt am sauberen Material-Naming (§2/§5) — Preserve-Regel + Test.
5. **Headless-Blender-Abhängigkeit** (wie bei den Felsen via CLI) — reproduzierbare Skripte unter `tools/blender/`.

## 10. Nicht im Scope (spätere Slices)
Volle 4-Fraktionen-Bibliothek; organische Templates (Azure/Verdant/Solar); LOD-Varianten; Sprite-Sheet-Vorbereitung; Studio-GUI für Assembly (Slice 1 darf scriptgetrieben/headless sein); Batch über alle Fahrzeuge.
