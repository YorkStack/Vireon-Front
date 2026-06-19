# Local Campaign Progress (MVP 1, Step 5)

> **Implementiert:** lokaler Kampagnenfortschritt wird am Match-Ende geschrieben,
> wenn eine Kampagnen-Mission **gewonnen** wird. Offline-only, **kein Backend, kein
> Login, kein Paket**. Nutzt den bestehenden `CampaignProgressStore`
> (`vireon.campaignProgress`). Base HEAD `5a29f46`. Nicht committet.

## 1. Was gespeichert wird
Pro Commander (`playerId`) und Kampagne (`campaignId`) ein `CampaignProgressEntry`:

| Feld | Inhalt |
|---|---|
| `unlockedMissionIds` | freigeschaltete Missionen (aktuelle + nächste) |
| `completedMissionIds` | abgeschlossene Missionen (nur bei Sieg) |
| `bestScoresByMission` | bester Score je Mission |
| `bestDifficultyByMission` | höchste je gewonnene Schwierigkeit je Mission |
| `updatedAt` | ISO-Zeitstempel des letzten Updates |

Mehrere Kampagnen liegen unabhängig nebeneinander unter `campaigns[campaignId]`.

## 2. Wann es aktualisiert wird
In [game.ts `checkEnd()`](../src/core/game.ts), **nach** der lokalen
Score-Speicherung, **einmal pro Match** (durch das bestehende `this.over`-Gate).
Bedingungen: Sieg **und** Commander-Profil vorhanden **und** Kampagnen-Kontext
vorhanden. Sonst passiert nichts (kein Crash, Score wird normal gespeichert).
Der Aufruf ist in `try/catch` gekapselt → ein Storage-Fehler blockiert die
Win/Lose-Anzeige nie.

## 3. Mission-Completion
`recordCampaignMissionResult` ([recordCampaignProgress.ts](../src/game/campaignProgress/recordCampaignProgress.ts))
markiert bei **Sieg** die Mission als `completed` **und** `unlocked`. Bei
**Niederlage** ist der Helper ein No-op (kein Schreibvorgang). Bestehende
abgeschlossene/freigeschaltete Missionen bleiben immer erhalten.

## 4. Next-Mission-Unlock
Die Mission-Reihenfolge kommt aus `CampaignDef.missions` (geordnete Liste) und wird
über den optionalen `CampaignContext` (`{ campaignId, missionOrder }`) in den
`Game`-Konstruktor durchgereicht ([main.ts](../src/main.ts):
`choice.campaign.missions.map(m => m.id)`). Bei Sieg wird die **nächste** Mission in
der Reihenfolge freigeschaltet, falls vorhanden — nach der letzten Mission wird
**keine** Phantom-Mission angelegt.

## 5. Best-Score / Best-Difficulty
- **Best Score je Mission:** wird nur ersetzt, wenn der neue Score **höher** ist.
  Es wird der tatsächliche Match-Score dieses Spiels durchgereicht (derselbe Wert,
  den `recordMatchResult` berechnet hat — **kein** Neuberechnen, keine Formeländerung).
- **Best Difficulty je Mission:** wird nur ersetzt, wenn die neue Stufe **höher**
  ist gemäß `leicht < mittel < schwer < superschwer` (`DIFFICULTY_ORDER`). Unbekannte
  Strings ranken am niedrigsten.

## 6. Export/Import-Abdeckung
`vireon.campaignProgress` ist Teil des Savegame-Export/-Imports (MVP 1, Step 4,
siehe [local-savegame-export-import.md](local-savegame-export-import.md)) — der
Kampagnenfortschritt wird also automatisch mit gesichert und wiederhergestellt.

## 7. Bekannte Limitierungen
- **Keine Unlock-UI:** Der Fortschritt wird **still** gespeichert; der Startscreen
  zeigt (noch) keine Sperr-/Frei-Markierung oder „Mission completed"-Zeile. Das ist
  bewusst out-of-scope für diesen Schritt (kein Kampagnen-Screen-Redesign).
- **Nur eine Mission heute:** `campaign_01` enthält aktuell nur `mission_01`, daher
  ist der Next-Unlock-Pfad real erst mit weiteren Missionen sichtbar (per Test mit
  Mehr-Missionen-Reihenfolge abgedeckt).
- Kampagnen-Definition wird am Match-Ende nicht neu geladen — die Reihenfolge kommt
  aus dem bereits geladenen `MissionChoice`.
- Kein Online-Sync (per Design offline).

## 8. Tests
[recordCampaignProgress.test.ts](../src/game/campaignProgress/recordCampaignProgress.test.ts):
Sieg → completed; Niederlage → kein Write; Next-Unlock; letzte Mission → kein
Phantom-Unlock; Erhalt bestehender Daten; Best-Score nur höher; Best-Difficulty nur
höher (Order); fehlende campaignId/missionId → No-op; Kampagnen-Isolation. Die
`game.ts`-Verdrahtung ist browser-smoke-verifiziert (node-Env kann `world.ts`/`game.ts`
wegen `document`-abhängigem Textur-Load nicht laden).

## 9. Nächster Schritt
Optional eine **Kampagnen-Unlock-UI** (Sperr-/Frei-/Completed-Markierung +
Best-Score/Difficulty im Startscreen) — rein lesend aus dem `CampaignProgressStore`.
Sonst: Rückkehr zur Textured-Buildings-Default/Review-Entscheidung.
