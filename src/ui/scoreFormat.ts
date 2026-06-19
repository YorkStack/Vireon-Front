// Pure formatting + view-model helpers for the local score UI. No DOM, no stores
// → unit-testable. The screens (screens.ts / localScores.ts) render from these.
import type { ScoreBreakdown } from '../game/scoring/types';
import type { LocalScoreEntry } from '../platform/leaderboard/types';

/** Thousands-separated integer, e.g. 3600 → "3,600". Deterministic (en-US). */
export function formatScore(n: number): string {
  return Math.round(Number.isFinite(n) ? n : 0).toLocaleString('en-US');
}

/** Seconds → "m:ss" (e.g. 754 → "12:34", 0.2 → "0:00"). */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

const FACTION_LABEL: Record<string, string> = { red: 'Crimson', blue: 'Azure', green: 'Verdant', yellow: 'Solar' };
export function factionLabel(id: string): string {
  return FACTION_LABEL[id] ?? (id ? id[0].toUpperCase() + id.slice(1) : '—');
}

export function difficultyLabel(id: string): string {
  return id ? id[0].toUpperCase() + id.slice(1) : '—';
}

/** ISO date → short local date "YYYY-MM-DD" (deterministic, no time-zone surprises). */
export function formatDate(iso: string): string {
  return typeof iso === 'string' && iso.length >= 10 ? iso.slice(0, 10) : '';
}

// ── Match-result (end screen) ───────────────────────────────────────────────
export interface MatchResultView {
  victory: boolean;
  commanderName: string;
  score: number;
  difficulty: string;
  durationSeconds: number;
  breakdown: ScoreBreakdown;
}

export interface BreakdownRow { label: string; value: number }

/** Signed, human-labelled breakdown rows (zero rows omitted to stay compact). */
export function breakdownRows(b: ScoreBreakdown): BreakdownRow[] {
  const rows: BreakdownRow[] = [
    { label: 'Base', value: b.buildingsBuiltPoints + b.unitsProducedPoints + b.enemyUnitsDestroyedPoints + b.enemyBuildingsDestroyedPoints },
    { label: 'Command Center Bonus', value: b.commandCenterBonus },
    { label: 'Efficiency Bonus', value: b.efficiencyBonus },
    { label: 'Survival Bonus', value: b.survivalBonus },
    { label: 'Time Bonus', value: b.timeBonus },
    { label: 'Loss Penalty', value: -b.ownLossPenalty },
  ];
  return rows.filter((r) => r.value !== 0);
}

/** "+2,500" / "-120" / "0". */
export function formatSigned(n: number): string {
  const v = Math.round(Number.isFinite(n) ? n : 0);
  return (v > 0 ? '+' : v < 0 ? '−' : '') + formatScore(Math.abs(v));
}

// ── Local leaderboard rows ──────────────────────────────────────────────────
export interface LeaderboardRowView {
  rank: number;
  score: string;
  outcome: 'Victory' | 'Defeat';
  faction: string;
  difficulty: string;
  duration: string;
  date: string;
  missionId?: string;
}

/** Map stored entries (already sorted by the store) into display rows. */
export function leaderboardRows(entries: LocalScoreEntry[], limit = 10): LeaderboardRowView[] {
  return entries.slice(0, limit).map((e, i) => ({
    rank: i + 1,
    score: formatScore(e.score),
    outcome: e.victory ? 'Victory' : 'Defeat',
    faction: factionLabel(e.factionId),
    difficulty: difficultyLabel(e.difficulty),
    duration: formatDuration(e.durationSeconds),
    date: formatDate(e.createdAt),
    missionId: e.missionId,
  }));
}
