// Local, offline leaderboard store. Scores live in `vireon.localScores`.
import type { StorageLike } from '../storage/keys';
import { STORAGE_KEYS, browserStorage } from '../storage/keys';
import { readJson, writeJson, removeKey } from '../storage/localStorageJson';
import type { LocalScoreEntry } from './types';

/** Cap stored scores so the key cannot grow unbounded. Lowest scores drop first. */
export const MAX_STORED_SCORES = 1000;

export interface LocalLeaderboardStore {
  addScore(entry: LocalScoreEntry): void;
  getTopScores(limit?: number): LocalScoreEntry[];
  getTopScoresForMission(campaignId: string, missionId: string, limit?: number): LocalScoreEntry[];
  getPlayerBestScore(playerId: string): number;
  clearScores(): void;
}

function isValidEntry(e: unknown): e is LocalScoreEntry {
  const v = e as Partial<LocalScoreEntry> | null;
  return !!v && typeof v.id === 'string' && typeof v.score === 'number' && typeof v.createdAt === 'string';
}

/** Descending by score; ties broken by newest `createdAt` first. Sorts in place. */
export function sortScores(entries: LocalScoreEntry[]): LocalScoreEntry[] {
  return entries.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // newer createdAt first
    return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
  });
}

export class LocalStorageLeaderboardStore implements LocalLeaderboardStore {
  constructor(private readonly storage: StorageLike | null = browserStorage()) {}

  private readAll(): LocalScoreEntry[] {
    const raw = readJson<unknown[]>(this.storage, STORAGE_KEYS.localScores, []);
    return Array.isArray(raw) ? raw.filter(isValidEntry) : [];
  }

  addScore(entry: LocalScoreEntry): void {
    const all = this.readAll();
    all.push(entry);
    sortScores(all);
    const capped = all.slice(0, MAX_STORED_SCORES);
    writeJson(this.storage, STORAGE_KEYS.localScores, capped);
  }

  getTopScores(limit = 10): LocalScoreEntry[] {
    return sortScores(this.readAll()).slice(0, Math.max(0, limit));
  }

  getTopScoresForMission(campaignId: string, missionId: string, limit = 10): LocalScoreEntry[] {
    const filtered = this.readAll().filter((e) => e.campaignId === campaignId && e.missionId === missionId);
    return sortScores(filtered).slice(0, Math.max(0, limit));
  }

  getPlayerBestScore(playerId: string): number {
    return this.readAll()
      .filter((e) => e.playerId === playerId)
      .reduce((max, e) => Math.max(max, e.score), 0);
  }

  /** Deletes ONLY the scores key — profile + campaign progress are untouched. */
  clearScores(): void {
    removeKey(this.storage, STORAGE_KEYS.localScores);
  }
}
