# Scoring — Match-End Integration (MVP 1, Step 3b)

> **Implementiert:** Match-Counter + lokale Score-Speicherung am Match-Ende.
> Additiv, offline, kein Backend. Keine Balance-/Sim-Regeländerung. Base HEAD
> `beec419`. Nicht committet. Baut auf der Scoring-Foundation
> ([scoring-foundation.md](scoring-foundation.md)) + dem Commander-Profile-Layer auf.

## 1. Hinzugefügte Counter
`MatchStats` ([src/sim/matchStats.ts](../src/sim/matchStats.ts)) pro Team, an
`TeamState.stats` gehängt (in [world.ts](../src/sim/world.ts)), bei Spielstart `0`:
`buildingsBuilt, unitsProduced, enemyUnitsDestroyed, enemyBuildingsDestroyed,
ownUnitsLost, ownBuildingsLost, resourcesCollected, resourcesSpent`.
**Rein beobachtend** — kein Effekt auf Economy/Power/Combat/Balance.

## 2. Wo jeder Counter inkrementiert (an bestehenden Events)
| Counter | Stelle in `world.ts` | Hinweis |
|---|---|---|
| `resourcesSpent` | `placeBuilding` (Kostenabzug) + `enqueue` (Unit-Kosten) | `cancelQueue` zieht den Refund wieder ab → Netto-Ausgabe |
| `buildingsBuilt` | `placeBuilding` (erfolgreiche Platzierung) | **keine** vorplatzierten Basen im Spiel → nur echte Builds; **Wände zählen pro Segment** |
| `resourcesCollected` | `gatherStep` (Gutschrift beim Refinery-Abladen) | identischer Betrag wie der credits-Zuwachs |
| `unitsProduced` | Produktions-Completion (Queue → `spawnUnit`) | **Start-Einheiten** nutzen `spawnUnit` direkt → **nicht** gezählt |
| `ownUnitsLost` / `ownBuildingsLost` | `kill()` (einziger Death-Pfad) | Opfer-Team; deckt auch evtl. künftige Nicht-Combat-Kills ab |
| `enemyUnitsDestroyed` / `enemyBuildingsDestroyed` | `applyDamage` nach dem Kill, via `attackerTeam` | nur wenn Angreifer ≠ Opfer-Team |

Die bestehende Economy/Combat-Logik bleibt unverändert — die Counter sind reine
`+=`-Zusätze neben den vorhandenen Effekten (credits-Abzug/-Zuwachs identisch).

## 3. MatchSummary-Aufbau (am Match-Ende)
In [game.ts `checkEnd()`](../src/core/game.ts), wenn eine Seite besiegt ist:
`recordMatchResult` ([recordMatchEnd.ts](../src/game/scoring/recordMatchEnd.ts))
baut aus **Team 0** (lokaler Spieler) eine `MatchSummary`:
- `playerId`/`playerName` ← geladenes Commander-Profil
- `factionId` ← Team-0-Fraktion, `opponentFactionId` ← Team-1-Fraktion
- `victory` ← `playerAlive`; `commandCenterDestroyed` ← `victory` (Siegbedingung = gegnerische Kommando-Nexus zerstört)
- `difficulty` ← `this.difficultyId`; `missionId` ← `mission.id`; `mapId` ← `<seed>_<size>`
- `durationSeconds` ← `world.time`; Counter ← `teams[0].stats`

## 4. Lokale Score-Speicherung
`calculateMatchScore(summary)` → `LocalLeaderboardStore.addScore(LocalScoreEntry)`
(Key `vireon.localScores`). Eine eigene zweite Leaderboard-Logik gibt es **nicht** —
es wird der bestehende Store genutzt.

## 5. Profil-Aggregate
`CommanderProfileStore.updateProfile` aktualisiert: `totalMatches += 1`,
`wins += victory?1:0`, `losses += victory?0:1`, `bestScore = max(bestScore, score)`,
`lastPlayedAt = now`.

## 6. Doppel-Speicher-Schutz
`checkEnd()` setzt `this.over = true` und hat oben `if (this.over) return` → der
gesamte End-Block (inkl. `recordMatchResult`) läuft **genau einmal** pro Match. Der
Aufruf ist zusätzlich in `try/catch` gekapselt → ein Storage-Fehler blockiert die
Win/Lose-Anzeige nie. Fehlt ein Commander-Profil, ist `recordMatchResult` ein No-op
(`saved:false`, kein Crash). Im DEV-Modus wird das Ergebnis per `console.info` geloggt.

## 7. Bekannte Limitierungen
- **Kill-Attribution**: Heute ist Combat (`applyDamage`) der **einzige** Death-Pfad,
  daher ist die Zuordnung vollständig. Eigene Verluste werden in `kill()` für ALLE
  Tode gezählt (robust gegen künftige Nicht-Combat-Kills); Gegner-Zerstörungen nur
  bei bekanntem Angreifer.
- **`campaignId`** wird noch nicht durchgereicht (Game erhält aktuell nur `mission`,
  nicht die Kampagne) → bleibt `undefined`. Später nachrüstbar.
- **Counter-Unit-Tests**: Die In-Sim-Counter sind **nicht** als Vitest-Unit-Test
  abgedeckt, weil `world.ts` über `models.ts` beim Import Texturen lädt, die ein
  `document` brauchen — im `node`-Test-Env nicht verfügbar, und jsdom wäre ein neues
  Package (verboten). Stattdessen: `recordMatchEnd`-Tests (Scoring/Aggregate/Save) +
  Code-Review der `+=`-Stellen + Browser-Smoke.

## 8. Noch NICHT implementiert (bewusst)
- Ergebnis-/Result-Screen (Endscreen unverändert)
- Local-Scores-Menü
- Kampagnenfortschritt-Unlocks
- Online-Leaderboard

## 9. Tests
- [matchStats.test.ts](../src/sim/matchStats.test.ts) — Default-Init + Unabhängigkeit.
- [recordMatchEnd.test.ts](../src/game/scoring/recordMatchEnd.test.ts) — no-profile-No-op, Score-Entry-Felder, Sieg/Niederlage-Aggregate, `bestScore` monoton, zwei Matches = zwei Einträge.

## 10. Nächster Schritt
**Score-/Match-Result-UI** (Endscreen erweitern oder Local-Scores-Menü), die die
gespeicherten `LocalScoreEntry` + Profil-Aggregate anzeigt. Optional `campaignId`
durchreichen + Kampagnenfortschritt schreiben.
