# Commander Profile & Leaderboard — Architektur

> **Konzept-/Architekturdokument.** Kein Produktivcode, kein Backend, kein Provider.
> Grundlage = Repo-Analyse (Stand HEAD `53fe02b`).
> Begleitdokumente: [scoring-system-proposal.md](scoring-system-proposal.md),
> [campaign-expansion-desert-jungle.md](campaign-expansion-desert-jungle.md),
> [multiplayer-roadmap.md](multiplayer-roadmap.md).
>
> **Richtungsentscheidung (2026-06-19):** Der kurzfristige Weg ist ein **lokales
> Commander Profile** — KEIN echtes Login, KEIN Supabase, KEIN Firebase, KEIN JWT,
> KEIN Backend. Das Spiel bleibt einfach und offline-fähig. Echte Authentifizierung
> wird erst relevant, wenn echtes Multiplayer/kompetitives Online-Leaderboard
> startet (siehe §6). Supabase/Firebase sind **Zukunftsoptionen, keine aktuelle
> Empfehlung.**

---

## 0. Repo-Analyse (Phase A)

| Frage | Befund |
|---|---|
| **Projektstruktur** | Reine Client-Web-App (Vite + TS + Three.js r184). `src/{core,sim,ai,map,path,render,data,ui,campaign,vehicles,systems,tools}`. Statisches Hosting, kein Server. |
| **Entry Points** | [src/main.ts](../src/main.ts) (Spiel-Loop start→briefing→game), dazu Dev-Seiten `building_asset_approval.html`, `vegetation_test.html`, `building_textured_test.html`. |
| **Spielzustand / Simulation** | [src/sim/world.ts](../src/sim/world.ts) (`World`, `TeamState`, Einheiten/Gebäude/Ökonomie/Combat). Loop + Win/Lose in [src/core/game.ts](../src/core/game.ts). |
| **Win/Lose-Logik** | `game.ts checkEnd()`: eine Seite ist besiegt, wenn sie **kein `nexus` und keinen Builder** mehr hat. `victory = playerAlive`. Am Ende nur **`victory: boolean` + Zeit-String** → `showEndScreen`. `MissionDef.winCondition`/`loseCondition` sind aktuell nur deskriptive Strings. |
| **Persistenz / Accounts / Netzwerk** | **Keine.** Kein `fetch`/WebSocket/Firebase/Supabase im Gameplay. `localStorage` nur in Dev-Tools (`adminPanel`, `buildingApprovalViewer`) → **das Muster für das Commander Profile existiert technisch schon.** Kein Account-/Session-Konzept. |
| **Am Rundenende verfügbar** | Heute nur `victory` + `world.time`. **Leicht ergänzbar** (Counter in `TeamState`): credits/power liegen vor; buildingsBuilt/unitsProduced/kills/losses als Zähler ergänzen (siehe Scoring-Doc). |
| **Kampagnen-/Missionslogik** | [src/campaign/campaign.ts](../src/campaign/campaign.ts) lädt `public/campaigns/<id>/campaign.json` + Mission-JSONs. Difficulty: [src/data/difficulty.ts](../src/data/difficulty.ts) (`leicht|mittel|schwer|superschwer`). |
| **Sinnvolle Erweiterungspunkte** | (1) `MatchSummary` am Ende von `checkEnd()` einsammeln; (2) `src/platform/profile`-Schicht (lokales Commander Profile) hinter einem schmalen Store-Interface; (3) `MissionDef` um `environment`/`scoreModifier` erweitern (additiv, optional). |
| **Risiken bei zu frühem Backend/Multiplayer** | Sim ist single-player, frame-getrieben, nicht deterministisch-getrennt. Direkter Netzwerk-/DB-Code in der Sim zerstört Testbarkeit, blockiert die Render-Loop, schafft Sicherheitslücken (client-autoritär) und verteuert einen späteren authoritativen Rewrite. → **Plattform strikt als Adapter-Schicht; Spiel bleibt offline.** |

**Architektur-Leitprinzip:** Das Spiel spricht nur mit **schmalen Store-Interfaces**
(`CommanderProfileStore`, `LocalLeaderboardStore`). Der MVP-Adapter ist
**`localStorage`**. Ein späterer Online-Adapter ist optional und steckt hinter
demselben Interface — das Spiel bleibt dabei unverändert.

---

## 1. Was MVP 1 wirklich braucht (Klarstellung)

> **Für MVP 1 braucht das Spiel keine echte Authentifizierung. Es braucht ein
> lokales Commander Profile, gespeichert im Browser.**

Das Commander Profile ist eine **lokale Spieleridentität + Save-/Fortschritts-
Container**, wie bei klassischen Offline-Spielen — nicht ein sicheres Online-Konto.
Bewusst NICHT genannt/gebaut: secure login, authentication, account system, online
identity.

Es speichert:
- Commander-/Spielername
- optionale bevorzugte Fraktion
- Kampagnenfortschritt
- lokale Scores
- lokale Statistik
- optionale Settings

---

## 2. Optionsvergleich Speicherung (statt Auth-Provider)

| Kriterium | **localStorage (MVP 1)** | IndexedDB (später) | Online-Adapter (optional, später) |
|---|---|---|---|
| Aufwand | **Minimal** | Mittel | Hoch |
| Offline | **Voll** | Voll | Nein |
| Debugbar | **Sehr (DevTools → Application)** | Gut | Mittel |
| Datenmenge | Klein (~5 MB) reicht für Profil/Scores | Groß (Replays, Blobs) | Beliebig |
| Sicherheit/Anti-Cheat | Nicht nötig (lokal, kein Wettbewerb) | dito | Server-Validierung erst hier |
| Empfehlung | **JA — jetzt** | wenn Savedaten groß werden | nur bei echtem Online-Leaderboard |

> Die früher empfohlenen **Supabase/Firebase/JWT** sind **nicht** der nächste
> Schritt. Sie werden erst relevant, wenn ein echtes kompetitives Online-Leaderboard
> oder Multiplayer eingeführt wird (§6 / Multiplayer-Roadmap).

---

## 3. Datenmodell — Commander Profile

```ts
// src/platform/profile/types.ts (VORSCHLAG — noch nicht angelegt)
export interface CommanderProfile {
  id: string;                  // lokal generierte UUID (crypto.randomUUID)
  displayName: string;         // Commander-Name
  createdAt: string;           // ISO
  lastPlayedAt: string;        // ISO
  preferredFaction?: string;   // 'red' | 'blue' | 'green' | 'yellow'
  totalMatches: number;
  wins: number;
  losses: number;
  bestScore: number;
  schemaVersion?: number;      // Migrationssicherheit
}

export interface CampaignProgress {
  playerId: string;
  campaigns: Record<string, {                 // key = campaignId
    unlockedMissionIds: string[];
    completedMissionIds: string[];
    bestScoresByMission: Record<string, number>;
    bestDifficultyByMission: Record<string, string>;
    updatedAt: string;
  }>;
}

export interface LocalScoreEntry {
  id: string;                  // crypto.randomUUID
  playerId: string;
  playerName: string;          // denormalisiert (überlebt Rename-Historie)
  score: number;
  victory: boolean;
  factionId: string;
  campaignId?: string;
  missionId?: string;
  difficulty: string;          // 'leicht' | 'mittel' | 'schwer' | 'superschwer'
  durationSeconds: number;
  createdAt: string;
}

export interface LocalGameSettings {
  soundEnabled: boolean;
  musicEnabled: boolean;
  graphicsQuality: 'low' | 'medium' | 'high';
  cameraSpeed: number;
}
```

> Kein SQL/NoSQL-Schema nötig — alles sind JSON-Objekte im `localStorage`. (Das
> frühere Postgres/Firestore-Schema bleibt nur als *Zukunftsreferenz* in der
> Multiplayer-Roadmap erhalten, nicht als MVP-Plan.)

---

## 4. Storage-Design (MVP 1)

**Empfehlung: `localStorage`** — genügt für MVP, ist simpel, debugbar und offline.
Es wird hinter einem Adapter gekapselt, sodass später IndexedDB oder ein
Online-Adapter ohne Spieländerung dahinter geschoben werden kann. Export/Import als
JSON-Backup ist ein späterer Zusatz (MVP 2).

### Keys
```
vireon.commanderProfile   → CommanderProfile (JSON)
vireon.campaignProgress   → CampaignProgress (JSON)
vireon.localScores        → LocalScoreEntry[] (JSON)
vireon.settings           → LocalGameSettings (JSON)
```

### Store-Abstraktion
```ts
// src/platform/profile/CommanderProfileStore.ts (VORSCHLAG)
export interface CommanderProfileStore {
  getProfile(): CommanderProfile | null;
  createProfile(displayName: string, preferredFaction?: string): CommanderProfile;
  updateProfile(profile: CommanderProfile): void;
  renameCommander(displayName: string): void;
  deleteProfile(): void;
}

// src/platform/leaderboard/LocalLeaderboardStore.ts (VORSCHLAG)
export interface LocalLeaderboardStore {
  addScore(entry: LocalScoreEntry): void;
  getTopScores(limit?: number): LocalScoreEntry[];
  getTopScoresForMission(campaignId: string, missionId: string, limit?: number): LocalScoreEntry[];
  getPlayerBestScore(playerId: string): number;
  clearScores(): void;
}
```
Begleitend (optional, gleiche Schicht): `CampaignProgressStore`, `SettingsStore`.

**Warum Adapter trotz Einfachheit:** Das Spiel ruft nur die Interfaces. Heute steht
dahinter ein `LocalStorageCommanderProfileStore`. Ein späterer Online-Adapter
(MVP 3) implementiert dasselbe Interface → null Änderung am Spiel.

---

## 5. UX-Konzept

### Erststart
```
Welcome Commander
Enter Commander Name
[___________]
(optional) Preferred Faction: ( Crimson · Azure · Verdant · Solar )
[ Start Game ]
```

### Hauptmenü (wenn Profil existiert)
```
Continue as <CommanderName>
Campaign
Skirmish
Local Scores
Settings
```

### Settings / Profile
```
Commander Profile
- Rename Commander
- Reset Campaign Progress
- Clear Local Scores
- Delete Local Profile
- Export Savegame   (später, MVP 2)
- Import Savegame   (später, MVP 2)
```

### Reset-/Lösch-Optionen — was bleibt, was geht
| Option | Löscht | Behält |
|---|---|---|
| **Rename Commander** | nichts | Fortschritt + Scores; ändert nur `displayName` |
| **Reset Campaign Progress** | `vireon.campaignProgress` (Unlocks/Completions) | Commander-Name + lokale Scores |
| **Clear Local Scores** | `vireon.localScores` | Commander-Profil + Kampagnenfortschritt |
| **Delete Local Profile** | `vireon.commanderProfile` + `campaignProgress` + `localScores` (+ optional `settings`) | nichts — nächster Start = Erststart |
| **Export Savegame** (später) | nichts | exportiert Profil/Progress/Scores/Settings als JSON |
| **Import Savegame** (später) | überschreibt vorhandene Keys | — (aus JSON-Backup) |

---

## 6. Online/Auth — bewusst SPÄTER (kein MVP-1-Thema)
- Das `CommanderProfile`-Modell bleibt erhalten und wird nur **erweitert**, falls
  später ein Online-Leaderboard kommt.
- Ein Online-Adapter (`RemoteLeaderboardStore`) wird **nur bei Bedarf** und **nur
  nach Opt-in** ergänzt — Scores werden dann optional hochgeladen.
- **Echte Authentifizierung** (und erst dann die Evaluierung von
  Supabase/Firebase/Custom-Backend + serverseitige Validierung/Anti-Cheat) ist
  ausschließlich Thema, wenn **echtes Multiplayer** oder ein **globales
  kompetitives Leaderboard** startet — siehe [multiplayer-roadmap.md](multiplayer-roadmap.md).

---

## 7. Modul-Layout (neu, MVP 1)
```
src/platform/
  profile/      CommanderProfileStore.ts, LocalStorageCommanderProfileStore.ts, types.ts
  leaderboard/  LocalLeaderboardStore.ts, LocalStorageLeaderboardStore.ts
  storage/      keys.ts (zentrale Key-Konstanten), json.ts (safe parse/stringify)
src/ui/profile/ FirstLaunchScreen.ts, ProfileSettingsPanel.ts, LocalScoresScreen.ts
```
Minimal erweitert: `game.ts` (emit `MatchSummary` → lokal speichern), `main.ts`
(Erststart-Check + „Continue as"). **Keine** Änderung an Sim/Render/Assets/
Vegetation/Buildings.

## 8. Risiken & offene Entscheidungen
- `localStorage` ist pro Browser/Gerät → kein Cloud-Sync (akzeptabel für offline; Export/Import deckt Backup ab).
- Mehrere Profile pro Gerät: MVP 1 = **ein** Profil. Multi-Slot ist späterer Zusatz (Keys ließen sich auf `vireon.profiles.<id>.*` umstellen).
- `schemaVersion` von Anfang an mitführen → spätere Migration schmerzfrei.
- Bevorzugte Fraktion: nur Komfort-Default, kein Gameplay-Eingriff.
