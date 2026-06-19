# Scoring-System & Leaderboard — Vorschlag

> **Konzeptdokument.** Kein Produktivcode geändert. Grundlage: `game.ts checkEnd()`
> liefert heute nur `victory: boolean` + `world.time`; `TeamState` kennt
> `credits/power`. Für Scoring werden **Match-Counter** ergänzt (siehe §7).

---

## 1. Score-Formel (mit Caps & Multiplikatoren)

Designziele: Sieg klar belohnen · Effizienz > Dauer · Endlos-Farmen begrenzen
(Caps) · Niederlage gibt Restpunkte · Kampagne/Schwierigkeit als Multiplikatoren.

### Schritt 1 — Basispunkte (jeweils **gecappt**, damit Farmen nichts bringt)
```
base =
    min(buildingsBuilt,        CAP_BUILD=20)  * 25
  + min(unitsProduced,         CAP_UNITS=60)  *  8
  + min(enemyUnitsDestroyed,   CAP_EKILL=80)  * 15
  + min(enemyBuildingsDestroyed,CAP_EBLD=24)  * 60
  + (commandCenterDestroyed ? 1500 : 0)            // klarer Sieg-Kern
```
Die Caps liegen bewusst über „normalem" Spiel und nur knapp über sehr aktivem
Spiel → Skill zählt, stundenlanges Farmen nicht.

### Schritt 2 — Effizienz- & Tempo-Boni (belohnen sauberes Spiel)
```
resourceEfficiency = clamp(valueDestroyed / max(1, resourcesSpent), 0, 2)   // 0..2
efficiencyBonus    = round(resourceEfficiency * 400)                        // 0..800

lossRatio    = ownUnitsLost / max(1, unitsProduced)                          // 0..1+
survivalBonus= round((1 - clamp(lossRatio,0,1)) * 500)                       // 0..500

// Tempo statt Dauer: schneller Sieg = mehr; Strafe für Zeit nur bei Sieg,
// damit „länger spielen" NICHT belohnt wird.
parTime   = mission.parTimeSec ?? 900
timeFactor= victory ? clamp(parTime / max(60, matchDurationSec), 0.5, 2.0) : 1
```

### Schritt 3 — Outcome- & Kontext-Multiplikatoren
```
outcomeMul    = victory ? 1.0 : 0.25                  // Niederlage: 25 % Restscore
difficultyMul = { leicht:0.8, mittel:1.0, schwer:1.3, superschwer:1.6 }[difficulty]
campaignMul   = mission.scoreModifier ?? 1.0          // z. B. Sandstorm-Defense 1.2
```

### Schritt 4 — Gesamtscore
```
raw   = (base + efficiencyBonus + survivalBonus)
score = round( raw * timeFactor * outcomeMul * difficultyMul * campaignMul )
score = max(score, victory ? 100 : 0)                 // Mindest-Siegscore
```

**Warum fair:** Counter sind gecappt (kein Farmen), Zeit wirkt nur als *Tempo*-
Faktor bei Sieg (nicht „länger = mehr"), Effizienz/Verluste belohnen Können,
Sieg dominiert über den CC-Bonus + `outcomeMul`. Schwierigkeit/Kampagne sind
saubere Multiplikatoren.

---

## 2. TypeScript-Implementierung (rein, testbar)

```ts
// src/game/scoring/score.ts  (VORSCHLAG — noch nicht angelegt)
import type { DifficultyId } from '../../data/difficulty';

export interface MatchSummary {
  matchId: string;
  missionId: string;
  campaignId?: string;
  mapId: string;                 // seed+size-Hash o. ä.
  difficulty: DifficultyId;
  victory: boolean;
  commandCenterDestroyed: boolean;
  matchDurationSec: number;
  parTimeSec?: number;
  scoreModifier?: number;        // Kampagnen-/Map-Multiplikator
  // Counter (gespiegelt aus TeamState des Spielers, team 0)
  buildingsBuilt: number;
  unitsProduced: number;
  enemyUnitsDestroyed: number;
  enemyBuildingsDestroyed: number;
  ownUnitsLost: number;
  ownBuildingsLost: number;
  resourcesSpent: number;
  valueDestroyed: number;        // Summe Kosten zerstörter Gegner-Assets
  playerFaction: string;
  startedAt: string;             // ISO (für wöchentliche Boards)
}

export interface ScoreBreakdown {
  base: number;
  efficiencyBonus: number;
  survivalBonus: number;
  timeFactor: number;
  outcomeMul: number;
  difficultyMul: number;
  campaignMul: number;
}

export interface ScoreResult {
  score: number;
  breakdown: ScoreBreakdown;
  version: number;               // Formel-Version (Migrationssicherheit)
}

const CAP = { build: 20, units: 60, eKill: 80, eBld: 24 } as const;
const DIFF_MUL: Record<DifficultyId, number> =
  { leicht: 0.8, mittel: 1.0, schwer: 1.3, superschwer: 1.6 };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const SCORE_VERSION = 1;

export function calculateMatchScore(s: MatchSummary): ScoreResult {
  const base =
    Math.min(s.buildingsBuilt, CAP.build) * 25 +
    Math.min(s.unitsProduced, CAP.units) * 8 +
    Math.min(s.enemyUnitsDestroyed, CAP.eKill) * 15 +
    Math.min(s.enemyBuildingsDestroyed, CAP.eBld) * 60 +
    (s.commandCenterDestroyed ? 1500 : 0);

  const eff = clamp(s.valueDestroyed / Math.max(1, s.resourcesSpent), 0, 2);
  const efficiencyBonus = Math.round(eff * 400);

  const lossRatio = s.ownUnitsLost / Math.max(1, s.unitsProduced);
  const survivalBonus = Math.round((1 - clamp(lossRatio, 0, 1)) * 500);

  const par = s.parTimeSec ?? 900;
  const timeFactor = s.victory ? clamp(par / Math.max(60, s.matchDurationSec), 0.5, 2.0) : 1;

  const outcomeMul = s.victory ? 1.0 : 0.25;
  const difficultyMul = DIFF_MUL[s.difficulty] ?? 1.0;
  const campaignMul = s.scoreModifier ?? 1.0;

  const raw = base + efficiencyBonus + survivalBonus;
  let score = Math.round(raw * timeFactor * outcomeMul * difficultyMul * campaignMul);
  score = Math.max(score, s.victory ? 100 : 0);

  return {
    score,
    version: SCORE_VERSION,
    breakdown: { base, efficiencyBonus, survivalBonus, timeFactor, outcomeMul, difficultyMul, campaignMul },
  };
}
```
> Diese Funktion ist **deterministisch & seiteneffektfrei** → ideal für Vitest
> (passt zur bestehenden Test-Kultur) und für **serverseitige Re-Berechnung**
> (identischer Code im Edge-Function-Build).

---

## 3. Speicherung

> **MVP 1 (aktuell): lokal.** Scores sind `LocalScoreEntry`-Objekte im
> `localStorage`-Key `vireon.localScores` (siehe
> [platform-auth-leaderboard-architecture.md](platform-auth-leaderboard-architecture.md)
> §3/§4). **Kein** SQL/NoSQL/Backend für MVP. Die folgenden DB-Schemata sind
> **reine Zukunftsreferenz** für ein späteres, optionales Online-Leaderboard
> (MVP 3+ / Multiplayer) — sie sind NICHT der nächste Schritt.

<details><summary>Zukunftsreferenz — Online-DB-Schema (erst bei Online-Leaderboard)</summary>

### A) SQL / Postgres (Supabase) — FUTURE ONLY
```sql
-- players: siehe platform-auth-leaderboard-architecture.md §3

create table matches (
  id            uuid primary key default gen_random_uuid(),
  player_id     uuid not null references players(id) on delete cascade,
  mission_id    text not null,
  campaign_id   text,
  map_id        text not null,
  difficulty    text not null,
  victory       boolean not null,
  duration_sec  int not null,
  summary       jsonb not null,         -- vollständige MatchSummary (Audit/Replay)
  created_at    timestamptz not null default now()
);

create table scores (
  id            uuid primary key default gen_random_uuid(),
  match_id      uuid not null references matches(id) on delete cascade,
  player_id     uuid not null references players(id) on delete cascade,
  score         int not null,
  breakdown     jsonb not null,
  score_version int not null,
  created_at    timestamptz not null default now()
);

-- Denormalisiert für schnelle Boards (1 Best-Eintrag pro Scope/Spieler)
create table leaderboard_entries (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references players(id) on delete cascade,
  scope       text not null,            -- 'global' | 'weekly:2026-W25' | 'campaign:desert' | 'mission:desert_03' | 'difficulty:schwer'
  score       int not null,
  match_id    uuid not null references matches(id),
  updated_at  timestamptz not null default now(),
  unique (player_id, scope)             -- nur Bestwert je Scope
);
create index on leaderboard_entries (scope, score desc);

create table campaign_progress (
  player_id     uuid not null references players(id) on delete cascade,
  campaign_id   text not null,
  highest_unlocked int not null default 0,
  completed     text[] not null default '{}',
  best_scores   jsonb not null default '{}',
  stars         jsonb not null default '{}',
  updated_at    timestamptz not null default now(),
  primary key (player_id, campaign_id)
);

-- RLS: SELECT offen für Board-Felder; INSERT/UPDATE auf scores/leaderboard NUR service role (Edge Function)
alter table scores enable row level security;
alter table leaderboard_entries enable row level security;
create policy "read boards" on leaderboard_entries for select using (true);
```

### B) NoSQL / Firestore
```jsonc
// matches/{matchId}       { playerId, missionId, campaignId, difficulty, victory, durationSec, summary, createdAt }
// scores/{scoreId}        { matchId, playerId, score, breakdown, scoreVersion, createdAt }
// leaderboards/{scope}/entries/{playerId}   { score, matchId, updatedAt }   // Doc-ID=playerId → Bestwert per Merge
// players/{uid}/campaignProgress/{campaignId} { highestUnlocked, completed[], bestScores{}, stars{} }
```
> Board-Query Firestore: `collection('leaderboards/global/entries').orderBy('score','desc').limit(100)`.

</details>

---

## 4. Leaderboard-Logik

> **MVP 1 (aktuell): lokales Leaderboard** über `LocalLeaderboardStore`
> (`localStorage`-Key `vireon.localScores`). Top-Scores global, pro Mission, pro
> Schwierigkeit lassen sich rein lokal aus den `LocalScoreEntry[]` filtern/sortieren
> — **kein Backend, kein Login**. Die Scope-Tabelle unten beschreibt das *spätere*
> Online-Leaderboard.

### MVP-1-API (lokal)
```ts
// src/platform/leaderboard/LocalLeaderboardStore.ts (VORSCHLAG)
export interface LocalLeaderboardStore {
  addScore(entry: LocalScoreEntry): void;
  getTopScores(limit?: number): LocalScoreEntry[];
  getTopScoresForMission(campaignId: string, missionId: string, limit?: number): LocalScoreEntry[];
  getPlayerBestScore(playerId: string): number;
  clearScores(): void;
}
// Beispielnutzung am Match-Ende:
//   store.addScore({ id: crypto.randomUUID(), playerId, playerName, score, victory, ... });
//   const top10 = store.getTopScores(10);
```

<details><summary>Zukunftsreferenz — Online-Leaderboard-Scopes & -API (erst bei Online-Leaderboard)</summary>

| Board | Quelle / Scope |
|---|---|
| **Global** | `scope='global'` (Lifetime-Bestwert je Spieler) |
| **Wöchentlich** | `scope='weekly:<ISO-Woche>'` — automatisch via `startedAt`; alte Wochen bleiben als Historie |
| **Kampagne** | `scope='campaign:<id>'` (Summe/Best über Kampagnen-Missionen) |
| **Pro Map/Mission** | `scope='mission:<missionId>'` |
| **Pro Schwierigkeit** | `scope='difficulty:<id>'` |
| **Freundesliste (optional)** | Filter `player_id in (...)` über eine `friends`-Relation |

```ts
// FUTURE — nur bei Online-Leaderboard, hinter demselben Adapter-Muster
export interface RemoteLeaderboardPort {
  submitScore(summary: MatchSummary): Promise<{ accepted: boolean; serverScore: number; rank?: number }>;
  getGlobalLeaderboard(opts?: { limit?: number; offset?: number }): Promise<LeaderboardRow[]>;
  getWeeklyLeaderboard(isoWeek?: string): Promise<LeaderboardRow[]>;
  getCampaignLeaderboard(campaignId: string): Promise<LeaderboardRow[]>;
  getMissionLeaderboard(missionId: string): Promise<LeaderboardRow[]>;
  getPlayerRank(playerId: string, scope?: string): Promise<{ rank: number; score: number; total: number }>;
}
export interface LeaderboardRow { rank: number; playerId: string; displayName: string; score: number; }
```
`submitScore` ruft serverseitig die Edge Function; der **server-berechnete** Score
zählt (Client-Wert nur „vorläufig").

### Anti-Cheat-Grundlogik
- **Server-Re-Compute**: `calculateMatchScore` läuft auch in der Edge Function über die übermittelte (validierte) `MatchSummary`.
- **Plausibilität**: Counter ≤ physikalisch mögliche Grenzen (z. B. `unitsProduced ≤ duration/buildTimeMin`); `valueDestroyed ≤ enemyBuildableValue`; `duration ≥ minMatch`.
- **Rate-Limit/Idempotenz**: `matchId` unique; max N Submits/Minute/User.
- **Signatur (später)**: HMAC der Summary mit serverseitigem Match-Token.
- **Goldstandard (MVP 3+)**: deterministischer **Input-Log** → authoritative Re-Simulation.

</details>

---

## 5. Wo wird gerechnet?

> **MVP 1 (aktuell, offline):** `calculateMatchScore` läuft **clientseitig**, der
> Score wird lokal angezeigt und als `LocalScoreEntry` im `localStorage`
> gespeichert. Kein Server, kein Cheat-Schutz nötig (rein lokal, kein Wettbewerb).

| | Clientseitig | Serverseitig (autoritativ) |
|---|---|---|
| **MVP 1 (offline, Commander Profile)** | `calculateMatchScore` lokal, Anzeige + `localStorage` | — (kein Backend) |
| **MVP 3 (optionales Online-Leaderboard, später)** | berechnet **vorläufig** für sofortige Anzeige | **Re-Compute + Validierung**; nur Server-Score wird geranked |
| **MVP 4 (Anti-Cheat / Multiplayer, später)** | sammelt + sendet Summary/Input-Log | Plausibilität + (optional) Re-Sim; verwirft unplausible Submits |

**Regel (sobald online):** Client darf Score **anzeigen**, aber niemals den
**geranketen** Wert bestimmen. Für rein lokale Scores ist das irrelevant.

---

## 6. Integration ins bestehende Spiel (minimal-invasiv)
1. `TeamState` (team 0) um Counter erweitern: `buildingsBuilt, unitsProduced, ownUnitsLost, ownBuildingsLost, resourcesSpent`. Gegner-Kills/-Buildings + `valueDestroyed` über die bestehenden „on death"-Pfade in `world.ts` zählen.
2. In `game.ts checkEnd()` eine `MatchSummary` zusammenstellen → `calculateMatchScore` → als `LocalScoreEntry` über den **`LocalLeaderboardStore`** speichern (Default-Adapter = `localStorage`); zugleich `CommanderProfile`-Aggregate (`totalMatches/wins/losses/bestScore`) aktualisieren.
3. `MissionDef` optional um `parTimeSec` + `scoreModifier` erweitern (additiv).
> Alles additiv, kein Balance-/Sim-/Render-Eingriff. `validate:balance` bleibt grün.

## 7. Offene Entscheidungen
- Gewichte/Caps final tunen (Playtests). Formel-`version` erlaubt spätere Anpassung ohne Board-Bruch.
- 3-Sterne-Missionsbewertung (Score-Schwellen) ja/nein.
- Wöchentliches Board: Rolling-7-Tage vs. Kalenderwoche.
