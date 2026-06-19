# Local Savegame Export/Import (MVP 1, Step 4)

> **Implementiert:** lokaler Savegame-Export/-Import als einzelne JSON-Datei.
> Offline-only, **kein Backend, kein Login, kein Paket**. Liest/schreibt nur die
> bestehenden `vireon.*`-Storage-Keys über die getestete Safe-JSON-Schicht.
> Base HEAD `4c46d11`. Nicht committet.

## 1. Zweck
Der Spieler kann seine lokalen Commander-Daten als Datei **sichern** und auf
demselben oder einem anderen Browser/Gerät **wiederherstellen** — ohne Konto,
ohne Server. Reines Offline-Backup/Restore.

## 2. Exportierte Daten
Genau die vier lokalen Slices (1:1 die `STORAGE_KEYS`):

| Feld | Key | Quelle |
|---|---|---|
| `commanderProfile` | `vireon.commanderProfile` | Commander-Profil (Name, Aggregate) |
| `campaignProgress` | `vireon.campaignProgress` | Kampagnenfortschritt |
| `localScores` | `vireon.localScores` | lokale Score-Liste (Array, ggf. leer) |
| `settings` | `vireon.settings` | lokale Einstellungen |

**Keine** Secrets, Tokens, Auth-Daten oder Backend-Referenzen — es gibt keine.

## 3. Format / Version
```jsonc
{
  "format": "vireon-local-savegame",
  "version": 1,
  "exportedAt": "<ISO>",
  "app": { "name": "Vireon Front" },
  "data": { "commanderProfile": …|null, "campaignProgress": …|null,
            "localScores": [ … ], "settings": …|null }
}
```
Serialisiert als **2-Space-Pretty-JSON**. Dateiname:
`vireon-savegame-YYYY-MM-DD.json`.

## 4. Privacy-Hinweis
Alles bleibt **lokal**. Export erzeugt eine Datei im Browser (Blob + Object-URL),
Import liest eine vom Nutzer gewählte Datei (`<input type="file">`). **Kein**
Netzwerk-Call, **kein** Upload, **kein** Tracking. Die Datei enthält nur die oben
gelisteten lokalen Spieldaten.

## 5. Import-Verhalten & Overwrite-Warnung
- **Validierung zuerst, dann Schreiben.** `parseLocalSavegame` prüft JSON,
  `format`, `version`, Existenz von `data` und grobe Slice-Shapes. Erst bei
  Erfolg wird geschrieben → **eine fehlerhafte Datei überschreibt nie** (auch nicht
  teilweise) vorhandene Daten.
- **Overwrite-Bestätigung:** Vor dem Import fragt ein `confirm()`, da lokale Daten
  überschrieben werden.
- **Was geschrieben wird:** `localScores` wird **immer** ersetzt (leeres Array,
  falls keine enthalten). `commanderProfile`/`campaignProgress`/`settings` werden
  nur geschrieben, **wenn vorhanden** — fehlende Slices lassen den bestehenden
  lokalen Wert unangetastet.
- Nach erfolgreichem Import lädt die Seite neu, damit der wiederhergestellte
  Commander direkt im Startscreen erscheint.

## 6. UI-Platzierung
- **Commander-Banner** (Startscreen, neben *Umbenennen*/*Profil löschen*):
  **Export Savegame** + **Import Savegame** + Status-Zeile.
- **First-Launch-Screen** (kein Profil vorhanden): zusätzlicher Button
  **Savegame importieren** → Recovery ohne Profil (z. B. nach „Profil löschen"
  oder auf einem neuen Gerät).

## 7. Architektur
- [src/platform/savegame/types.ts](../src/platform/savegame/types.ts) — Format/Version + Typen.
- [exportSavegame.ts](../src/platform/savegame/exportSavegame.ts) — `buildLocalSavegameExport(storage?, now?)` + `serializeLocalSavegame`.
- [importSavegame.ts](../src/platform/savegame/importSavegame.ts) — `parseLocalSavegame` + `importLocalSavegame(json, storage?)`.
- [src/ui/savegameUi.ts](../src/ui/savegameUi.ts) — Download/Upload-Glue + `savegameFilename`.
- Verdrahtung in [commanderProfile.ts](../src/ui/commanderProfile.ts) (Banner + First-Launch).

Kern liest/schreibt über **`StorageLike` + Safe-JSON** (wie die Stores), nicht über
rohes `localStorage` — `storage`/`now` injizierbar → vollständig unit-testbar.

## 8. Bekannte Limitierungen
- Kein Merge/Selektiv-Import — Import ist Voll-Restore der enthaltenen Slices.
- Keine tiefe Feldvalidierung der einzelnen Einträge (nur grobe Shape-Guards); die
  Stores filtern beim Lesen ohnehin korrupte Einträge heraus.
- Nur `version: 1`; ältere/neuere Versionen werden bewusst abgelehnt (kein Migrator).
- Kein Online-Sync (per Design offline).

## 9. Tests
- [exportSavegame.test.ts](../src/platform/savegame/exportSavegame.test.ts) — Voll-Export, fehlendes Profil, Pretty-JSON + Format/Version.
- [importSavegame.test.ts](../src/platform/savegame/importSavegame.test.ts) — valider Import, Scores via `LocalLeaderboardStore` lesbar, invalides JSON/Format/Version abgelehnt, kein Teil-Overwrite bei Fehler, leere Scores, Round-Trip, `parseLocalSavegame`-Edge-Cases.
- [savegameUi.test.ts](../src/ui/savegameUi.test.ts) — Dateiname-Formatierung. (Download/Upload-DOM ist browser-smoke-verifiziert.)

## 10. Nächster Schritt
**Kampagnenfortschritt-Unlocks** (`CampaignProgressStore` aus dem Spiel schreiben,
optional `campaignId` in den Game-Konstruktor durchreichen) — der dann ebenfalls
vom Export/Import abgedeckt ist.
