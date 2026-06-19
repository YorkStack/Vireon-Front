# Commander Profile — Local Storage Data Layer (MVP 1, Step 1)

> **Implementiert:** reine, getestete, lokale Datenschicht. **Keine UI, keine
> Gameplay-Verdrahtung, kein Backend.** Base HEAD `6213d50`. Nicht committet.

## 1. Zweck
Ein **lokales Commander Profile** ist die Spieleridentität + der Save-/Fortschritts-
Container des Offline-Spiels: Commander-Name, optionale Lieblingsfraktion,
Kampagnenfortschritt, lokale Scores, optionale Settings. Es ersetzt die früher
angedachte Online-Auth für MVP 1.

## 2. Warum das **keine** echte Authentifizierung ist
- Keine Server, keine Passwörter, kein Login, kein Token/JWT, kein Provider.
- Alles liegt im Browser (`localStorage`), pro Gerät. Keine Identitätsprüfung.
- Es ist ein **Komfort-/Save-System** wie bei klassischen Offline-Spielen — nicht
  sicher gegen Manipulation und das ist für lokales Spiel völlig in Ordnung.

## 3. Storage-Keys
```
vireon.commanderProfile   → CommanderProfile
vireon.campaignProgress   → CampaignProgress
vireon.localScores        → LocalScoreEntry[]
vireon.settings           → LocalGameSettings
```
Zentral in [src/platform/storage/keys.ts](../src/platform/storage/keys.ts) (`STORAGE_KEYS`).

## 4. Interfaces / Typen
- [profile/types.ts](../src/platform/profile/types.ts): `CommanderProfile`, `CampaignProgress`, `CampaignProgressEntry`, `LocalGameSettings`.
- [leaderboard/types.ts](../src/platform/leaderboard/types.ts): `LocalScoreEntry`.
- [storage/keys.ts](../src/platform/storage/keys.ts): `StorageLike` (injizierbar → Tests nutzen In-Memory-Storage statt echtem `localStorage`).

## 5. Store-Verantwortlichkeiten
| Store | Datei | Aufgabe |
|---|---|---|
| `CommanderProfileStore` | [CommanderProfileStore.ts](../src/platform/profile/CommanderProfileStore.ts) | get/create/update/rename/delete; Namens-Normalisierung; `schemaVersion: 1`; Stats=0 |
| `LocalLeaderboardStore` | [LocalLeaderboardStore.ts](../src/platform/leaderboard/LocalLeaderboardStore.ts) | addScore, getTopScores(+mission), getPlayerBestScore, clearScores; Sortierung Score↓ dann neueste zuerst; Cap 1000 |
| `CampaignProgressStore` | [CampaignProgressStore.ts](../src/platform/profile/CampaignProgressStore.ts) | get (leer wenn keine/fremde/korrupte Daten), save, reset |
| `LocalGameSettingsStore` | [LocalGameSettingsStore.ts](../src/platform/profile/LocalGameSettingsStore.ts) | get (Defaults gemerged), save, reset |

**Sicherheit/Robustheit:** Alle Reads laufen über `readJson` (Fallback bei
fehlendem Key / korruptem JSON / Storage-Fehler → **nie crashen**); Writes über
`writeJson` (gibt `false` bei Quota/Fehler zurück, kein Throw). Fehlt `localStorage`
(Node/SSR/Tests), liefert `browserStorage()` `null` und alle Stores arbeiten als
no-op statt zu werfen.

## 6. Reset-Verhalten (was bleibt / was geht)
| Aktion | Methode | Löscht | Behält |
|---|---|---|---|
| Rename Commander | `renameCommander(name)` | nichts | Fortschritt + Scores; nur `displayName` (+ `lastPlayedAt`) |
| Reset Campaign Progress | `CampaignProgressStore.resetProgress` | `vireon.campaignProgress` | Profil + Scores |
| Clear Local Scores | `LocalLeaderboardStore.clearScores` | `vireon.localScores` | Profil + Fortschritt |
| Delete Local Profile | `CommanderProfileStore.deleteProfile` | **nur** `vireon.commanderProfile` | (Scores/Progress werden separat über ihre eigenen Resets gelöscht) |

> Hinweis: Ein vollständiges „Delete Everything" (Profil + Progress + Scores +
> Settings) wäre eine **UI-seitige Komposition** dieser vier Resets — die Datenschicht
> hält sie bewusst getrennt.

## 7. First-Launch-UI (MVP 1, Step 2 — implementiert)
[src/ui/commanderProfile.ts](../src/ui/commanderProfile.ts) (Logik-Helfer +
DOM, nutzt **nur** den `CommanderProfileStore` — kein direkter localStorage-Zugriff):
- **Erststart** (kein Profil): `ensureCommanderProfile()` zeigt den „Welcome
  Commander / Enter Commander Name"-Screen (Eingabe, trim, Max 24, Enter/Start);
  leerer Name → Inline-Fehler, kein Profil. Bei Erfolg `createProfile` → Spielfluss
  geht zum bestehenden Start-Screen. Verdrahtet vor der Menü-Schleife in
  [main.ts](../src/main.ts).
- **„Continue as Commander"**: `buildCommanderBanner()` rendert oben im Start-Screen
  ([screens.ts](../src/ui/screens.ts)) „WEITER ALS COMMANDER → `<Name>`" + **Umbenennen**
  (inline, Store-Rename, Fortschritt/Scores bleiben) + **Profil löschen** (confirm →
  `deleteProfile` → `location.reload()` → Erststart; Query-Params bleiben erhalten).
- Wortwahl bewusst „Commander Profile", **nicht** Login/Account. Kein Passwort, keine
  E-Mail, kein Netzwerk.

## 8. Noch NICHT implementiert (bewusst)
- ~~Score-Berechnungs-Verdrahtung~~ → umgesetzt (Scoring-Foundation + Match-End-Integration + Local-Score-UI).
- Kampagnenfortschritt-Verdrahtung (Unlock/Complete aus dem Spiel → `CampaignProgressStore`)
- Settings-Screen (Store existiert, UI fehlt)
- ~~Export/Import Savegame (JSON)~~ → **umgesetzt** in MVP 1, Step 4, siehe [local-savegame-export-import.md](local-savegame-export-import.md) (Export/Import-Buttons im Commander-Banner + First-Launch-Screen).
- Online-Leaderboard / echtes Auth (erst MVP 3/4)

## 9. Nächster Schritt
**Score-Verdrahtung am Match-Ende** (`game.ts checkEnd()` → `MatchSummary` →
`calculateMatchScore` → `LocalLeaderboardStore.addScore` + Profil-Aggregate
`totalMatches/wins/losses/bestScore`).
