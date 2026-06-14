# Component Factory — Slice 2: Parametric Movement + Selector + Texture Library (Design)

> Stand: 2026-06-14. Baut auf Slice 1 (`2026-06-14-vehicle-component-factory-design.md`). Repos: Studio (Authoring/Blender/Server/GUI) + Spiel (Runtime-GLB-Render). Sprache: Deutsch.
> Entscheidungen (User): parametrisches Movement-System (count+type), Monowheel als eigene Chassis-Topologie; **erst Räder 4/6/8** end-to-end; Textur-Bibliothek wird **jetzt mitdesignt**.

## Ziel
1. **Parametrische Lauf­werke**: Anzahl + Typ wählbar (Ketten 1–4/Seite, Räder 4/6/8, Mix, Beine 2–8, Hover-Pads 1–12), prozedural ausgelegt — statt fixer L/R-Slots.
2. **Monowheel** als eigene Chassis-Topologie (Rad mit Naben-Mounts: Kanzel/Antrieb + Waffe L/R).
3. **GUI-Selektor**: Fraktion → Klasse → Chassis-Typ → Movement(type+count) → Waffen/Aufbauten, fraktionsgefiltert.
4. **Textur-Bibliothek**: profilierte Reifen, Kettenmuster, Hover-Pad-Oberflächen, Lauf-Texturen — gekeyt nach Komponententyp × Fraktion × Stil; pro Komponente in der GUI wählbar und auf dem Runtime-GLB sichtbar.
5. **Exotische Geometrie** (z. B. Verdant-Organik-Lauf mit Leuchtadern, siehe Referenz) = eigene Komponenten-Templates (Geometrie), getrennt von Texturen.

**Erst-Implementierung (vertikaler Durchstich):** Räder 4/6/8 durch das neue parametrische Modell + GUI-Selektor (Fraktion/Klasse/Chassis-Typ/Movement) + Textur-Bibliothek-Schema + Picker + EIN Reifen-Set, end-to-end im Spiel. Beine/Hover/Monowheel/weitere Texturen folgen, sobald das Modell steht.

## 1. Movement-System-Modell (löst die fixen L/R-Slots ab)
- Das **Chassis** deklariert genau **einen** Hardpoint `movement_system` (statt movement_slot.L/R) **plus eine Lauf­werk-Bucht** = `{ length, width, groundY }` (aus dem Footprint abgeleitet, im Template deklariert).
- Ein **Movement-Template** (`*_wheels`, `*_tracks`, `*_legs`, `*_hover`) ist `type: movement` mit Params:
  - gemeinsam: `count` (Range/Enum je Typ), optional `gauge` (Spurbreite-Faktor).
  - wheels: `count` ∈ {4,6,8} → paarweise entlang z, Radius aus Bucht-Höhe.
  - tracks: `perSide` ∈ {1,2,3,4} → N Bänder/Seite an ±x.
  - legs: `count` ∈ {2,4,6,8} → gespiegelte Beinpaare.
  - hover: `pads` ∈ {1,2,4,6,8,10,12} → ein großes Pad oder Raster.
- Das Template bekommt die **Bucht-Maße** übergeben und **legt die Einheiten selbst aus** (eine Quelle, beliebige Anzahl). Es erzeugt EIN Movement-Objekt (gemerged) im slot `dark`, texGroups je nach Typ (`wheel`/`track`/`leg`/`hoverpad`).
- **Registry-Erweiterung**: Movement-Templates deklarieren `params.count` als Enum + ein `mount_target: "movement_system"`; pro **Fraktion** eine Whitelist erlaubter Movement-Typen (Crimson: wheels/tracks/halftrack; Azure: hover/amphibious; Verdant: legs/organic-hover; Solar: colony/legs).
- **Validator-Erweiterung**: `count`/`perSide`/`pads` ∈ erlaubter Menge; Movement-Typ ∈ Fraktions-Whitelist; genau ein Movement-System pro Fahrzeug.

## 2. Monowheel-Topologie
Eigene Chassis-Template-Familie `*_monowheel` (`type: chassis`, `size_class`): Geometrie = großer Radring (torus/zyl) + Nabe; deklarierte Hardpoints: `hub_cabin` (Kanzel/Antrieb), `weapon_mount.L`, `weapon_mount.R`. **Kein** `movement_system` (das Rad IST das Lauf­werk). Im GUI-Selektor als Chassis-Typ wählbar; Waffen-Slots links/rechts statt Turm.

## 3. GUI-Selektor (Factory-Overlay-Ausbau)
- **Fraktion** (Tabs) + **Klasse** (Dropdown aus CLASS_ORDER) + **Vehicle id** (auto `${faction}_${cls}`).
- **Chassis-Typ**: Dropdown der `chassis`-Templates der Fraktion (standard / monowheel / legged-body / hover-hull …).
- **Movement**: bei Standard-Chassis ein Movement-Typ-Dropdown (fraktionsgefiltert) + **count-Slider/Select**; bei Monowheel ausgeblendet.
- Restliche Hardpoints wie bisher (Turm/Waffe/Decor), rekursiv.
- Registry treibt alles; nur erlaubte Optionen je Fraktion/Topologie.

## 4. Textur-Bibliothek
- **Preset-Schema erweitern** (bestehende `library/_presets.json`): pro Preset `{ id, name, target, faction?, style, slotKind, prompt, png? }`. `target` = Komponenten-Texturziel: `tire | track | hoverpad | leg | barrel | hull | cabin | dome | …`. `style` = Variante (`tire/aggressive`, `track/chevron`, `barrel/organic-veins`).
- **Seeds**: pro Target mehrere Stile (profilierte Reifen: aggressive/road/studded; Ketten: chevron/flat/segmented; Hover-Pads: ribbed/glow; Läufe: plain/organic-veins).
- **GUI**: jede Komponente im Selektor bekommt einen **Textur-Picker** (Presets gefiltert nach dem Komponenten-`target`), inkl. Vorschau-Thumb + „aus Skizze sampeln"/„generieren" (bestehende Pipeline).
- **Auf den GLB bringen**: Der Bake vergibt **texGroups je Komponente** (wheel/track/barrel/…); die gewählte Textur wird als `slotTextures[group]` ins `metadata.json` geschrieben und mit dem GLB ins Spiel exportiert. Der **Spiel-GLB-Pfad** wendet pro Gruppe die Textur an (analog zum bestehenden `importedGroupTex`/Per-Group-Textur-System) — `mat_<slot>` bleibt Material-Kind, Textur kommt pro texGroup.
- **Exotische Geometrie** (Referenz-Screenshot: organischer Lauf mit Leuchtadern) = neue **Komponenten-Templates** pro Fraktion (z. B. `verdant_organic_cannon`), `accent`/emissive für die Adern; die Textur kommt zusätzlich aus der Bibliothek (`barrel/organic-veins`).

## 5. Render/Material-Vertrag (Ergänzung zu Slice 1 §2/§6)
- texGroups sind benannte Untergruppen je Material-Slot (wie im bestehenden texGroup-System). Bake hält sie getrennt genug, dass das Spiel pro Gruppe eine Textur mappen kann; `mat_<slot>` bleibt kanonisch (Tint-Vertrag unverändert).
- Movement bleibt statisch (Teil von `hull_static`); Räder/Pads drehen sich in dieser Slice NICHT (Animation = späteres Add-on).

## 6. Testing
- Validator-Units: count/perSide/pads-Ranges, Fraktions-Movement-Whitelist, „genau ein Movement-System", Monowheel ohne movement_system + mit weapon_mount.L/R.
- uiLogic-Units: Selektor-Optionen je Fraktion/Topologie; Movement-count-Optionen; Textur-Picker-Filter nach target.
- Bake-Guard: gebautes GLB mit N Rädern hat erwartete Mesh-/Tris-Grenzen, texGroups vorhanden, Materialien kanonisch.
- Preset-Schema: validate/lesen der erweiterten Felder.
- Visuell auf 5181 (Studio) + 5199 (Spiel): 4/6/8-Räder-Crimson baut, previewt, exportiert, rendert mit Reifenprofil-Textur.

## 7. Risiken
1. **Bucht-Layout-Mathematik** (Räder paarweise/Beine gespiegelt im Footprint) — pro Typ reine, getestete Layout-Funktion.
2. **Per-Komponente-Textur auf dem GLB** — neue Verdrahtung Bake→metadata→Spiel; an EINEM Reifen-Set zuerst beweisen.
3. **GUI-Komplexität** wächst — Selektor sauber registry-getrieben halten, reine Logik in uiLogic + Tests.
4. **Monowheel-Pivot/Geometrie** — eigene Topologie, separat verifizieren (später).

## 8. Implementierungs-Reihenfolge (Plan-Vorschau)
1. Movement-Modell: Chassis `movement_system`+Bucht; `crimson_wheels`-Template (count 4/6/8, paarweises Layout) + Registry/Validator-Erweiterung + Layout-Tests.
2. Bake: ein Movement-System auslegen + mergen; Bake-Guard erweitern.
3. GUI-Selektor: Fraktion/Klasse/Chassis-Typ/Movement(type+count); uiLogic-Tests.
4. Textur-Bibliothek: Preset-Schema + Seeds + Picker (Filter nach target) + texGroup→metadata→Spiel-Anwendung, mit einem Reifen-Set.
5. Verifikation E2E (Studio+Spiel). DANN: Beine/Hover/Monowheel + weitere Texturen/exotische Geometrie.

## Nicht in dieser Slice
Beine/Hover/Monowheel-Implementierung (nur Modell/GUI vorbereitet), Lauf­werk-Animation, organische Fraktions-Templates komplett, volle Textur-Stil-Bibliothek (nur Schema + erstes Set).
