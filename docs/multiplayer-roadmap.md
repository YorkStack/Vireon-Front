# Multiplayer-Roadmap & Integrationsplan

> **Konzeptdokument.** Kein Code/Backend geändert. Bündelt Teil D (Module +
> Reihenfolge) und den Multiplayer-Ausblick. Querverweise:
> [platform-auth-leaderboard-architecture.md](platform-auth-leaderboard-architecture.md),
> [scoring-system-proposal.md](scoring-system-proposal.md).

---

## D — Integration ins bestehende Projekt

### 1. Neue Module
```
src/game/scoring/
  score.ts            calculateMatchScore + Interfaces (rein, vitest-testbar)
  matchSummary.ts     Sammler: TeamState-Counter → MatchSummary
  score.test.ts
src/game/campaigns/
  environment.ts      MissionEnvironment-Typen + Loader-Erweiterung
  modifiers.ts        ENVIRONMENT_MODIFIERS (Multiplikator-Registry, analog FACTION_MODIFIERS)
  desert/             (Daten/JSON liegen unter public/campaigns/desert/)
  jungle/
src/platform/
  profile/      CommanderProfileStore + LocalStorageCommanderProfileStore + types
  leaderboard/  LocalLeaderboardStore + LocalStorageLeaderboardStore
  storage/      keys.ts, json.ts           (zentrale localStorage-Keys + safe JSON)
src/ui/profile/
  FirstLaunchScreen.ts ProfileSettingsPanel.ts LocalScoresScreen.ts
# src/api/ (client/config) + Online-Adapter erst ab MVP 3 (optionales Online-Leaderboard)
```

### 2. Minimal zu erweiternde Bestandsdateien
| Datei | Erweiterung (additiv) |
|---|---|
| [src/sim/world.ts](../src/sim/world.ts) | `TeamState`-Counter (buildingsBuilt, unitsProduced, ownLosses, resourcesSpent); Kill/valueDestroyed in „on death"-Pfaden zählen |
| [src/core/game.ts](../src/core/game.ts) | in `checkEnd()` `MatchSummary` bauen → `calculateMatchScore` → `LocalLeaderboardStore.addScore` + `CommanderProfile`-Aggregate aktualisieren |
| [src/core/types.ts](../src/core/types.ts) | `MissionEnvironment` (optional in `MissionDef`); `parTimeSec`, `scoreModifier` |
| [src/campaign/campaign.ts](../src/campaign/campaign.ts) | `environment` mitladen (deklarativ); Kampagnenfortschritt aus `CampaignProgress` lesen |
| [src/main.ts](../src/main.ts) | Erststart-Check (Commander Profile vorhanden?) → `FirstLaunchScreen` bzw. „Continue as Commander" |
| `public/campaigns/index.json` | + `desert`, `jungle` |

> **Nicht angefasst:** Rendering, Assets/GLB, Vegetation, Buildings, Pathfinding,
> Balance-Werte. Alle Eingriffe sind additiv + store-gated.

### 3. Zuerst zu definierende Interfaces
1. `CommanderProfile`, `CampaignProgress`, `LocalScoreEntry`, `LocalGameSettings` (Plattform-Doc) — das lokale Save-Modell.
2. `CommanderProfileStore`, `LocalLeaderboardStore` — Store-Verträge (MVP-Adapter = `localStorage`).
3. `MatchSummary`, `ScoreResult` (Scoring-Doc) — Vertrag Spiel ↔ Scoring.
4. `MissionEnvironment` / `EnvironmentModifier` — Vertrag Mission ↔ Sim-Hooks.
> (Online-Ports wie `RemoteLeaderboardPort`/Auth erst ab MVP 3/4.)
> Interfaces zuerst, Adapter danach → das Spiel bleibt offline lauffähig und testbar.

### 4. Priorisierte Umsetzung (Commander-Profile-first)
| Stufe | Inhalt | Backend? |
|---|---|---|
| **MVP 1 — Offline Commander Profile** | lokales **Commander Profile**, Erststart-Namenseingabe, „Continue as Commander", lokaler Kampagnenfortschritt, lokale `LocalScoreEntry`-Einträge, **lokales Leaderboard**, `localStorage`-Adapter. `MatchSummary` + `calculateMatchScore` lokal. **Kein Login, kein Backend.** | **nein** |
| **MVP 2 — Savegame-Polish** | Rename Commander, Reset Campaign Progress, Clear Local Scores, Delete Local Profile, **Export/Import Savegame (JSON)**. Weiterhin offline. | **nein** |
| **MVP 3 — Optionales Online-Leaderboard (später)** | `CommanderProfile`-Modell **bleibt**; Online-Adapter **nur bei Bedarf** hinter demselben Interface; Score-Upload **nur nach Opt-in**. **Kein echtes Auth nötig**, solange kein globales kompetitives Leaderboard. | optional |
| **MVP 4 — Echtes Multiplayer (später)** | **erst hier** echte Authentifizierung; **erst hier** Supabase/Firebase/Custom-Backend evaluieren; **erst hier** serverseitige Validierung + Anti-Cheat; Lobby, Matchmaking, authoritatives/Lockstep-Modell, Reconnect/Resync, Ranked. | ja (Auth + Game-Server) |

> **Klarstellung:** Supabase/Firebase/JWT sind **Zukunftsoptionen ab MVP 3/4**,
> nicht der nächste Schritt. Der nächste Schritt ist das lokale Commander Profile.

---

## Multiplayer-Architektur (MVP 4) — Ausblick

### Modellwahl
| Modell | Eignung Vireon | Bewertung |
|---|---|---|
| **Lockstep (deterministisch, P2P/Relay, nur Inputs)** | RTS-klassisch, geringe Bandbreite (nur Befehle), viele Einheiten | **Bevorzugt** — aber **erfordert deterministische Sim** (heute nicht garantiert: `Math.random`, Float-Drift, frame-gekoppelt) |
| **Authoritativer Server (Server simuliert, sendet State/Snapshots)** | cheat-resistent, einfacher Reconnect | teurer (Server-CPU), höhere Bandbreite; gut für Ranked |
| Hybrid (Server-validiertes Lockstep) | Best of both | komplex, später |

**Voraussetzung für beide:** die Simulation muss **vom Rendering entkoppelt** und
**deterministisch** werden:
- Fixed-Timestep-Sim-Loop (entkoppelt von rAF), getrennt von der Render-Interpolation.
- Seeded PRNG **überall** statt `Math.random` (passt zur Projektregel: `Date.now`/`Math.random` werden bereits in Workflows vermieden; Sim braucht denselben Rigor).
- Befehls-/Input-Queue (alle Spieleraktionen als serialisierbare Commands).
- Deterministische Iterationsreihenfolge (keine `Set`/`Map`-Reihenfolgeabhängigkeit in der Sim).

### Inkrementeller Pfad zur Determinismus-Fähigkeit (vor MVP 4)
1. Sim-Loop auf Fixed-Timestep umstellen (Render interpoliert) — großer, isolierter Schritt, eigene Phase.
2. Seeded RNG-Service einführen, alle Sim-Zufälle darüber.
3. Command-Pattern für Spielerbefehle (auch single-player nützlich: Replays, der Anti-Cheat-Input-Log aus dem Scoring-Doc).
4. Replay-Determinismus-Test (gleiche Inputs → gleicher End-State-Hash) als CI-Gate.
> Erst wenn (4) grün ist, ist Lockstep-Multiplayer realistisch. Bis dahin liefern
> Replays + Input-Log bereits Anti-Cheat-Wert (MVP 3).

### Netzwerk-Transport
- **Supabase Realtime / WebSocket** für Lobby/Chat/Matchmaking-Signaling.
- Für die eigentliche Runde: dedizierter WS-Game-Server (Node) oder Relay; bei Lockstep reicht ein Input-Relay mit Tick-Barrier.

---

## Risiken (Multiplayer)
- **Determinismus ist das Kernrisiko** — ohne ihn kein Lockstep; Nachrüsten ist invasiv → früh die Sim-Entkopplung einplanen, aber **nicht** vor MVP 1–3 erzwingen.
- **Cheating** — Client-autoritärer Score/Sim ist angreifbar; Server-Re-Compute (MVP 2) + Re-Sim (MVP 4) nötig.
- **Scope-Creep** — Matchmaking/Ranked sind groß; MVP 1–2 liefern bereits Spielerwert (Profile, Leaderboards) ohne Echtzeit-Netcode.
- **Kosten** — authoritative Server kosten CPU; Lockstep-Relay ist günstiger → Modellwahl beeinflusst Betriebskosten.

## Offene Entscheidungen
- **Kein** Provider-/Auth-Thema für MVP 1–2 (lokal). Ein Online-Provider (Supabase/Firebase/Custom) wird **erst vor MVP 4** (echtes Multiplayer) bzw. für ein optionales Online-Leaderboard (MVP 3) evaluiert.
- Multiplayer-Modell (Lockstep vs. authoritativ) — vor MVP 4, abhängig vom Determinismus-Fortschritt.
- Wann Determinismus-Refactor? Empfehlung: eigene Phase **nach** dem lokalen Commander Profile (MVP 1–2), parallel zu MVP 3.
