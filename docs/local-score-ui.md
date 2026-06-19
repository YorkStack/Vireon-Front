# Local Score UI (MVP 1, Step 3c)

> **Implementiert:** sichtbare lokale Score-UI — Match-Result am End-Screen +
> „Local Scores"-Menü. Visual/UI-only, offline, kein Backend. Liest die
> bestehenden Stores; **keine** Änderung an Score-Formel oder Countern. Base HEAD
> `2c15472`. Nicht committet.

## 1. Was hinzugefügt wurde
- **End-Screen-Score** ([screens.ts](../src/ui/screens.ts) `showEndScreen`): unter
  VICTORY/DEFEAT ein kompakter Score-Block mit Commander-Name, finalem Score,
  Difficulty · Dauer und einem Breakdown (Base, Command Center Bonus, Efficiency,
  Survival, Time, Loss Penalty — Null-Zeilen weggelassen).
- **Local-Scores-Screen** ([localScores.ts](../src/ui/localScores.ts)): über den
  neuen **★ LOCAL SCORES**-Button im Startscreen. Zeigt Commander-Aggregate
  (Matches/Wins/Losses/Best) + Top-10-Tabelle (Rank, Score, Result, Faction,
  Difficulty, Time, Date). Buttons **Back** + **Clear Local Scores** (mit Bestätigung).
- **Reine Helfer** ([scoreFormat.ts](../src/ui/scoreFormat.ts)): `formatScore`,
  `formatDuration`, `formatSigned`, `factionLabel`, `difficultyLabel`, `formatDate`,
  `breakdownRows`, `leaderboardRows` + `MatchResultView` — DOM-frei, unit-getestet.

## 2. Welche Stores gelesen werden
- `LocalStorageLeaderboardStore` (`getTopScores(10)`, `clearScores`)
- `LocalStorageCommanderProfileStore` (`getProfile`)
Kein direkter `localStorage`-Zugriff aus der UI, kein zweites Leaderboard-System,
kein dupliziertes Profil-Modell.

## 3. Anzeige am Match-Ende
`game.ts checkEnd()` reicht das **bereits berechnete** Ergebnis von
`recordMatchResult` (jetzt inkl. `breakdown` + `playerName`) als `MatchResultView`
an `showEndScreen` weiter — **kein Neuberechnen, kein zweites Speichern**. Ohne
Commander-Profil wird der End-Screen normal (ohne Score-Block) gezeigt.

## 4. Anzeige im Local-Scores-Menü
Commander-Header + Top-10 aus dem Store. Leerer Zustand (kein Profil / keine Scores)
wird sauber abgefangen (Hinweistext statt Crash). „Clear Local Scores" löscht **nur**
`vireon.localScores` (Profil + Fortschritt bleiben); Commander-Profil wird hier
**nicht** gelöscht.

## 5. Bekannte Limitierungen
- Kein Online-Leaderboard.
- Keine Kampagnenfortschritt-Unlock-UI.
- Kein Export/Import-Savegame.
- Score-Block am End-Screen erscheint nur, wenn ein Commander-Profil existiert.

## 6. Tests
- [scoreFormat.test.ts](../src/ui/scoreFormat.test.ts): Score-/Dauer-/Signed-/Datum-Format, Faction/Difficulty-Labels, `breakdownRows` (Null-Zeilen weg, Loss negativ, Base-Aggregat), `leaderboardRows` (leer, Rank-Mapping, Cap 10, Defeat).
- [recordMatchEnd.test.ts](../src/game/scoring/recordMatchEnd.test.ts): +1 — `breakdown` + `playerName` werden zurückgegeben (für die Anzeige, ohne Recompute).
- DOM-Screens browser-smoke-verifiziert (node-Env kann `screens.ts`/`localScores.ts` nicht laden — `document`-abhängig).

## 7. Nächster Schritt
Kampagnenfortschritt-Unlocks (`CampaignProgressStore` aus dem Spiel schreiben) oder
Export/Import-Savegame (JSON-Backup von Profil/Scores/Settings).
