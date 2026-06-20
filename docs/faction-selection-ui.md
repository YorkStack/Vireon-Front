# Faction Selection UI (Startscreen)

> **UI-only.** Keine Gameplay-/Balance-/Faction-Modifier-/Doctrine-/Render-/Asset-
> Änderung. Macht den Fraktions-Auswahl-Screen kompakt und entfernt irreführende
> „Schwierigkeits"-Badges. Base HEAD `d682d48`. Nicht committet.

## 1. Problem
Der Startscreen war zu hoch und scrollte; die Fraktionskarten enthielten zu viel
Text (4-Stat-Profil + lange Stärken/Schwächen-Listen) und die untere Button-Reihe
wurde nach unten gedrückt. Außerdem zeigten die Karten Badges wie
„Anspruch: Mittel / Schwer / Aggressiv".

## 2. „Anspruch"-Badges entfernt
Die `Anspruch: <difficulty>`-Badges sind **weg**. Begründung: Fraktionen sind
gegeneinander **ausbalanciert** und repräsentieren **Spielstil**, nicht
Schwierigkeit. Der Schwierigkeitsgrad wird **ausschließlich** über den separaten
Schwierigkeits-Selektor (Leicht/Mittel/Schwer/Superschwer) gewählt.

**Keine Datenänderung:** `tactical.difficulty` bleibt im `FactionDef`/`factions.json`
erhalten (von Validator/Runtime ohnehin ungenutzt) — es wird lediglich **nicht mehr
auf der Karte angezeigt**. Faction-Profile, Doctrines und Balancing bleiben unberührt.

## 3. Kompakte Fraktionskarten
Pro Karte nur noch:
1. Fraktionsname
2. eine kurze Identitätszeile (`tagline`)
3. Tactical Profile / Doctrine (`doctrineLabel`)
4. drei kompakte Playstyle-Trait-Chips (`tactical.build/attack/defense`)
5. **ⓘ Details**-Button

Die langen Plus/Minus-Listen sind **nicht** mehr auf der Karte.

## 4. Details-Ansicht (Info-Modal)
**ⓘ Details** öffnet ein **fixed** Overlay-Modal (`.faction-details-overlay`) → die
Seitenhöhe wächst dadurch **nicht**. Inhalt: Tagline, Doctrine, 4-Stat-Profil
(Bau/Angriff/Verteidigung/Wirtschaft), **Stärken** + **Schwächen** und die
empfohlene Spielweise (`shortDescription`). Schließbar per ✕-Button,
Backdrop-Klick und **Escape**.

## 5. Viewport-Fit
- Die Karten sind deutlich niedriger (~330px → ~225px Karten-Höhe).
- Eine Kompakt-Media-Query (`@media (max-height: 1024px)`) verdichtet Abstände,
  Titelgröße, Karten-Padding und blendet die Difficulty-Button-Blurbs aus (Name +
  Tooltip bleiben) — über das gesamte gängige Desktop-Höhenband, ohne Scroll-Cliff.
- Die untere Button-Reihe (`DEPLOY`/`UNIT CODEX`/`LOCAL SCORES`) liegt im
  **sticky `.screen-cta`-Footer** und bleibt immer sichtbar.
- **Verifiziert:** kein Scroll bei ≥~955px Inhaltshöhe (z. B. 1280×960 → 0px
  Überlauf); bei 900px nur ~22px Rest (Commander-Banner) bei stets sichtbaren
  Buttons. Die verbleibende Resthöhe stammt aus dem Commander-Banner, das bewusst
  **nicht** Teil dieses UI-Tasks ist.

## 6. Architektur / geänderte Dateien
- [src/ui/factionCardView.ts](../src/ui/factionCardView.ts) (NEU, DOM-frei):
  `factionCardView` (kompakt, ohne difficulty/Listen) + `factionDetailsView` (volles
  Detail). Pure View-Models → unit-testbar.
- [src/ui/screens.ts](../src/ui/screens.ts): kompakter Card-Builder + `showFactionDetails`-Modal.
- [src/ui/style.css](../src/ui/style.css): Trait-Chips, Details-Button, Modal, Kompakt-Media-Query.
- Tests: [src/ui/factionCardView.test.ts](../src/ui/factionCardView.test.ts).

## 7. Nicht geändert
Gameplay, `FACTION_MODIFIERS`/Balance, Schwierigkeitslogik, Scoring,
Kampagnenfortschritt, Unit-Stats, KI/Combat/Pathfinding, Render-Models/Assets,
Commander-Banner, Building-/Crimson-/Vegetation-Workstreams.
