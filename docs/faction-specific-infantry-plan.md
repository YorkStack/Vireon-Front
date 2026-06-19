# Faction-Specific Infantry — Analyse & Designplan

> **Status:** Untersuchung + Designplan (MVP-Folgeschritt). **Kein** Code-/Balance-/
> Asset-/Rendering-Change in diesem Dokument — reine Doku. Base HEAD `5ede68a`.

## 1. Start-Einheiten-Analyse (woher kommen die zwei „Soldaten")

**Befund:** Der Spieler startet mit **drei** Einheiten, nicht zwei „Soldaten" allein:
`1× fabricator` (Builder) + **`2× lancer`** (Infanterie). Die zwei soldatenartigen
Einheiten sind die **Lancer**.

| Frage | Antwort |
|---|---|
| Wo gespawnt? | [game.ts](../src/core/game.ts) Konstruktor: `spawn(0, mission.startingUnits, this.map.playerStart)` (und `spawn(1, mission.enemyStartingUnits, …)` für den Gegner) → ruft `world.spawnUnit(...)` direkt. |
| Quelle der Liste | **Mission-Definition**, nicht Hardcode/Debug: [mission_01.json](../public/campaigns/campaign_01/mission_01.json) `startingUnits: [fabricator, lancer, lancer]`. |
| Unit-Typ/-ID | `lancer` — [unitClasses.ts:220](../src/data/unitClasses.ts) `unitClass: 'infantry', role: 'rifle'`, „Cheap versatile rifle trooper". |
| Team/Fraktion | Team 0 = Spieler (gewählte Fraktion), Team 1 = Gegner (zufällige andere Fraktion). |
| Gleiche Einheiten je Fraktion? | **Ja** — `lancer` ist eine geteilte Klasse; alle vier Fraktionen spawnen denselben `lancer`. |
| Auch der Gegner? | **Ja**, identische `enemyStartingUnits` (1 fabricator + 2 lancer). |
| Debug/Scenario? | **Nein** — keine Debug-Spawns; rein mission-getrieben. |
| Als Scout/Defense gedacht? | Plausibel ja (frühe Sicht/Verteidigung am Drop), aber nirgends explizit deklariert — es ist schlicht die Mission-Startaufstellung. |
| RTS-Konvention? | Üblich. Viele RTS starten mit Builder + ein paar Einheiten; manche nur mit Builder. Beides legitim. |

**Absicht:** **Beabsichtigt**, nicht versehentlich — es ist eine bewusste
Mission-Startaufstellung in der JSON, symmetrisch für beide Seiten.

## 2. `unitsProduced`-Zählung

Die Start-Lancer werden über `world.spawnUnit(...)` **direkt** gespawnt.
`unitsProduced` wird **ausschließlich** bei Queue-Produktion erhöht
([world.ts:910](../src/sim/world.ts): `stats.unitsProduced += 1` nach dem
Produktions-Complete). **→ Start-Einheiten zählen korrekt NICHT als produziert**
(per Code-Kommentar dort bestätigt). Score/Counter sind also bereits sauber; kein
Handlungsbedarf an den Countern.

## 3. Empfehlung Start-Einheiten-Politik

**Empfohlen: Option 4 (mission-konfigurierbar) + Option 2 (faction-spezifische Scouts) kombiniert** —
mit dem expliziten Ziel des Users: *einfach halten, aber keine menschenähnlichen
Soldaten für Alien-Fraktionen*.

Begründung:
- Die Startaufstellung ist **bereits** mission-konfigurierbar (`startingUnits` in der
  JSON) → Option 4 ist faktisch schon vorhanden, ohne Code-Änderung nutzbar.
- Die zwei Start-Lancer **behalten** (frühes Scouting/Verteidigung, RTS-üblich) — also
  **nicht** entfernen (Option 3 verworfen: schwächeres, fummeligeres Opening ohne Mehrwert).
- Der eigentliche Schmerzpunkt ist **rein visuell**: alle Fraktionen zeigen dieselbe
  menschliche Soldaten-Silhouette. Lösung = **gleiche Klasse `lancer`, gleiche Stats,
  faction-spezifische Optik** (Option 2). Kein Balance-Eingriff.

Verworfen: Option 1 allein (löst das Alien-Optik-Problem nicht); Option 3 (Entfernen).

## 4. Faction-spezifische Infanterie — Design-Tabelle

Gleiche Klasse (`unitClass: 'infantry'`, Balance-Slot des `lancer`), **gleiche Stats**,
nur Identität/Optik je Fraktion. Namen sind Vorschläge.

| Fraktion | Identität | Name (Vorschlag) | Silhouette / Material | Waffen-Flavor (visual-only) |
|---|---|---|---|---|
| **Crimson Pact** (`red`) | menschliche Militär-Infanterie | **Iron Guard** (alt: Crimson Rifleman, Pact Trooper) | gepanzerter Mensch, Gunmetal-Rüstung, rote Schulter-/Brust-Akzente, Karabiner | kompaktes Gewehr (heutiger Lancer-Look passt hier 1:1) |
| **Azure Concorde** (`blue`) | aquatische Wesen im Exo-Frame | **Shellwalker** (alt: Tide Envoy, Azure Exo-Scout) | kleines Wasser-Organismus in transparentem, wassergefülltem Exo-Rahmen; perlweiße Keramikbeine/Hover-Shell; Cyan-Glow; Fluid-Tubes | Druck-Lanze / Sonic-Pulse |
| **Verdant Swarm** (`green`) | insektoide Aliens | **Brood Skirmisher** (alt: Chitin Runner, Swarmling) | 4–6-beiniges Insektoid, Chitinplatten, grün/bernstein Bio-Säcke, Mandibeln | Säure-Spucke / Stachel-Werfer |
| **Solar Dominion** (`yellow`) | bakteriell/Plasma-Kolonie | **Plasma Seed** (alt: Radiant Cell, Solar Colony Node) | schwebende/kriechende Kolonie-Pod; tausende Mikroorganismen in transluzenter Bernstein/Violett-Schale; pulsierender Plasmakern | Radiant-Burst / kohärenter Lichtpuls |

Wichtig: nur `lancer` ist hier exemplarisch (Start-Infanterie). Dieselbe Resolver-
Mechanik gilt später für die übrigen Infanterieklassen (`breacher`, `arcweaver`, …).

## 5. Technischer Implementierungsplan (sicherster Weg)

### Aktuelles Visual-System
- Einheiten-Instanziierung: [world.ts:71](../src/sim/world.ts)
  `makeEntityGroup('unit', def.id, accent, def.class === 'vehicle', def.visual)`.
- **Fahrzeuge** (`class === 'vehicle'`) → faction-aware **GLB-Pfad** via
  `visual.factoryId = '<faction>:<classId>'` ([models.ts](../src/render/models.ts)
  `makeGlbEntityGroup`), Fallback auf prozedurale Variant-Templates.
- **Infanterie/Buildings/Legacy** → klassische **prozedurale per-`defId`-Templates**
  ([models.ts](../src/render/models.ts) `unitParts(defId)` → `infantryBase()`).
  Die **Form** ist nur an die Unit-ID gebunden; **nur die Akzent-Farbe** (`accent`)
  ist faction-abhängig → alle Fraktionen teilen dieselbe Menschen-Silhouette.

### Befund
- Unit-Visuals sind für Infanterie **per Unit-Typ hartkodiert** (Form), faction-spez.
  Infanterie-Optik ist **heute nicht möglich** — es fehlt der Resolver.
- Aber: das **Vorbild existiert** bereits bei Fahrzeugen (`factoryId`-Resolver +
  GLB-mit-Fallback). Derselbe Muster lässt sich auf Infanterie übertragen.
- Unit-Typ-ID ist **fraktionsübergreifend geteilt** (`lancer` für alle).

### Bevorzugter Weg (gleiche Stats, nur Optik)
1. **Faction-Visual-Resolver** für Infanterie einführen:
   `infantryVisualFor(defId, factionId)` → Visual-Quelle (prozedurales Template
   *oder* GLB), mit **Fallback auf das heutige `infantryBase`-Template**, wenn kein
   faction-spezifisches Asset existiert.
2. **`factionId` in den Render-Pfad durchreichen:** `makeEntityGroup`/`instantiate`
   erhalten die Besitzer-`factionId` (heute fließt nur die Akzent-**Farbe** ein, nicht
   die ID). Rein additiver, optionaler Parameter — kein Default-Verhalten ändern.
3. **Zwei Asset-Strategien je Fraktion** (frei mischbar pro Fraktion):
   - **a) Prozedurale Geometrie-Varianten** (kein Asset-Pipeline-Risiko): je Fraktion
     eine eigene `…Base()`-Funktion (z. B. `insectoidBase`, `exoFrameBase`,
     `colonyPodBase`) statt `infantryBase`. Schnell, leichtgewichtig, kein GLB/Alpha-
     Risiko. **Empfohlen für den ersten Schritt.**
   - **b) Per-Fraktion-GLBs** (analog Fahrzeuge): höhere Detailtiefe, aber Asset-
     Generierung + Approval + Alpha-Check nötig → späterer Schritt.
4. **Keine** Änderung an `unitClasses.ts`-Stats, Waffen-Werten, `armorClass`,
   `speed`, `cost`, Counter oder Balance. Waffen-Flavor (Säure/Sonic/Plasma) ist
   zunächst **rein visuell** (VFX/Mündungs-Sprite), keine neue Damage-Mechanik.
5. **Namen:** optional `displayName` faction-abhängig im UI auflösen (Codex/HUD), ohne
   die Sim-`id` zu ändern (`id` bleibt `lancer`).

### Warum das sicher ist
- Additiver Resolver + Fallback → fehlt ein Asset, rendert exakt das heutige Visual.
- Stats/Counter/Balance bleiben unberührt (nur `id→Form/Name`-Mapping ändert sich).
- Gespiegeltes, erprobtes Muster (Fahrzeug-`factoryId`) statt neuer Architektur.

## 6. Risiken
- **Scope-Creep zu GLBs:** Per-Fraktion-GLBs ziehen die Asset-Pipeline (Generierung,
  Approval, **KI-Alpha-Falle**) nach sich → erst prozedurale Varianten (3a).
- **Render-Pfad-Berührung:** `makeEntityGroup`/`instantiate` sind heiße, geteilte
  Pfade (auch Buildings/Fahrzeuge). Änderung muss strikt additiv + optional sein,
  sonst Regressionsrisiko für alle Entities.
- **Animation/Pivots:** Insektoid/Mehrbein-Silhouetten könnten andere Anim-Channels
  (z. B. Beinbewegung) wollen — vorerst statische Geometrie, keine neue Anim.
- **Lesbarkeit/Gameplay:** Stark abweichende Silhouetten müssen weiterhin klar als
  „leichte Infanterie" lesbar sein (Größe/Scale beibehalten: `UNIT_VISUAL_SCALE`).
- **Balance-Wahrnehmung:** Optik darf nicht suggerieren, eine Fraktion sei stärker —
  Stats bleiben identisch; das klar kommunizieren.

## 7. Vorgeschlagener nächster Implementierungsschritt
**Schritt 1 (klein, risikoarm, code-only, kein Asset):** prozeduraler
Faction-Infanterie-Resolver für `lancer`:
- `infantryVisualFor('lancer', factionId)` + vier prozedurale `…Base()`-Varianten
  (Crimson = heutiger Look; Azure = Exo-Frame; Verdant = Insektoid; Solar = Kolonie-Pod),
  Fallback = heutiges `infantryBase`.
- `factionId` additiv durch `makeEntityGroup`/`instantiate` reichen.
- **Keine** Stat-/Balance-/Counter-/Mission-Änderung; gleiche `id`, gleiche Werte.
- Verify: tsc + vitest + build + validate:balance + Browser-Smoke (alle 4 Fraktionen
  zeigen distinkte Lancer-Silhouetten, gleiche Stats, kein Konsolenfehler).

Danach optional Schritt 2: GLB-Variante je Fraktion über den Fahrzeug-artigen
Resolver (mit Approval + Alpha-Check), wenn höhere Detailtiefe gewünscht ist.
