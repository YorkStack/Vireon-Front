# Scoring Foundation (MVP 1, Step 3a)

> **Implementiert:** reine, deterministische, getestete Score-Berechnung. **Keine
> Gameplay-Verdrahtung, keine TeamState-Counter, keine Speicherung, keine UI, kein
> Backend.** Base HEAD `291e98b`. Nicht committet.

## 1. Zweck
Eine eigenständige Funktion, die aus einer `MatchSummary` einen fairen Match-Score
+ nachvollziehbares `ScoreBreakdown` berechnet. Sie wird **später** an das
Match-Ende (`game.ts checkEnd()`) und an den `LocalLeaderboardStore` angebunden —
hier nur die Grundlage.

## 2. Warum lokal/offline
Reine Funktion ohne Seiteneffekte, Uhr oder Zufall → identisches Ergebnis für
identische Eingabe. Kein Server, kein Login, kein Netzwerk. Genau wie die übrige
Commander-Profile-Schicht ist Scoring lokal; ein optionales Online-Leaderboard
würde dieselbe Funktion serverseitig re-rechnen (erst MVP 3/4).

## 3. Formel
```
base = min(buildingsBuilt,40)*25 + min(unitsProduced,160)*6
     + min(enemyUnitsDestroyed,220)*18 + min(enemyBuildingsDestroyed,80)*70
commandCenterBonus = commandCenterDestroyed ? 2500 : 0
efficiencyBonus    = round(400 * clamp(resourcesCollected/resourcesSpent, 0, 1.5))   // spent=0 → 0
ownLossPenalty     = ownUnitsLost*10 + ownBuildingsLost*60
survivalBonus      = victory ? max(0, 500 - ownLossPenalty) : 0
timeRatio          = clamp((1800 - durationSeconds)/1800, 0, 1)                       // target 30 min
timeBonus          = victory ? round(600 * timeRatio) : 0
rawScore           = base + commandCenterBonus + efficiencyBonus + survivalBonus + timeBonus - ownLossPenalty
finalScore         = max(0, round(rawScore * outcomeMultiplier * difficultyMultiplier * campaignMultiplier))
```

### Prinzipien (warum fair)
- **Sieg zählt klar** (`outcomeMultiplier` ×1 vs. Niederlage ×0.25).
- **Kommandozentrale** stark belohnt (+2500 vor Multiplikatoren).
- **Länger ≠ mehr**: Zeit gibt nur bei Sieg einen *fadenden* Bonus, nie eine Strafe, nie mehr fürs Trödeln.
- **Farmen gedeckelt** (Caps).
- **Effizienz** + **wenig Verluste** werden belohnt.
- **Niederlagen** bekommen Restscore, aber deutlich weniger.

## 4. Caps
| Eingabe | Cap | Punkte/Stk |
|---|---:|---:|
| buildingsBuilt | 40 | 25 |
| unitsProduced | 160 | 6 |
| enemyUnitsDestroyed | 220 | 18 |
| enemyBuildingsDestroyed | 80 | 70 |

## 5. Multiplikatoren
| | Wert |
|---|---|
| outcomeMultiplier | Sieg 1.0 · Niederlage 0.25 |
| difficultyMultiplier | leicht 0.8 · mittel 1.0 · schwer 1.25 · superschwer 1.6 (unbekannt → mittel) |
| campaignMultiplier | optional, Default 1 (0/negativ/NaN → 1) |

## 6. Beispielrechnung
Sieg, **superschwer**, CC zerstört, 5 min, 12 Gebäude, 40 Units, 60 Gegner-Units +
8 Gegner-Gebäude zerstört, 6 Units / 1 Gebäude verloren, 8000 gesammelt / 6000
ausgegeben:
```
base = 12*25 + 40*6 + 60*18 + 8*70 = 300+240+1080+560 = 2180
commandCenterBonus = 2500
efficiencyBonus = round(400 * clamp(8000/6000,0,1.5)) = round(400*1.333) = 533
ownLossPenalty = 6*10 + 1*60 = 120
survivalBonus = max(0, 500-120) = 380
timeRatio = (1800-300)/1800 = 0.8333 → timeBonus = round(600*0.8333) = 500
rawScore = 2180 + 2500 + 533 + 380 + 500 - 120 = 5973
finalScore = round(5973 * 1.0 * 1.6 * 1.0) = 9557
```

## 7. Robustheit
Alle numerischen Eingaben werden saniert: NaN/∞ → 0, negativ → 0, Counts → ganze
Zahlen, `durationSeconds` Minimum 1. `resourcesSpent=0` → Effizienz 0 (kein NaN).
Alle Punkt-/Bonus-/Penalty-Felder + `finalScore` sind ganze Zahlen; `finalScore`
ist nie negativ. `rawScore` = Summe der Teile (im Test verifiziert).

## 8. Noch NICHT verdrahtet (bewusst)
- Keine `TeamState`-Counter (buildingsBuilt/unitsProduced/kills/losses/resources).
- Keine `game.ts checkEnd()`-Integration (noch kein `MatchSummary`-Builder).
- Keine Speicherung über `LocalLeaderboardStore`.
- Keine UI (Ergebnis-/Leaderboard-Anzeige).

## 9. Nächster Schritt
**Match-Counter + `MatchSummary`-Builder am Match-Ende:** `TeamState` (Spieler,
team 0) um Counter erweitern (rein additiv), in `game.ts checkEnd()` eine
`MatchSummary` zusammenstellen → `calculateMatchScore` → über den
`LocalLeaderboardStore` speichern + Commander-Profil-Aggregate aktualisieren.

## Dateien
- [src/game/scoring/types.ts](../src/game/scoring/types.ts) · [calculateMatchScore.ts](../src/game/scoring/calculateMatchScore.ts) · [calculateMatchScore.test.ts](../src/game/scoring/calculateMatchScore.test.ts)
