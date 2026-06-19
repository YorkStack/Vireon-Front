// Local Commander Profile store. Offline-only; no auth, no network.
import type { StorageLike } from '../storage/keys';
import { STORAGE_KEYS, browserStorage } from '../storage/keys';
import { readJson, writeJson, removeKey } from '../storage/localStorageJson';
import { newId, nowIso } from '../storage/id';
import type { CommanderProfile } from './types';

export const PROFILE_SCHEMA_VERSION = 1;
const MAX_NAME_LEN = 24;
const DEFAULT_NAME = 'Commander';

export interface CommanderProfileStore {
  getProfile(): CommanderProfile | null;
  createProfile(displayName: string, preferredFaction?: string): CommanderProfile;
  updateProfile(profile: CommanderProfile): void;
  renameCommander(displayName: string): void;
  deleteProfile(): void;
}

/** Trim, clamp to MAX_NAME_LEN; empty/whitespace → DEFAULT_NAME (consistent). */
export function normalizeCommanderName(raw: string): string {
  const trimmed = (raw ?? '').trim().slice(0, MAX_NAME_LEN);
  return trimmed.length > 0 ? trimmed : DEFAULT_NAME;
}

export class LocalStorageCommanderProfileStore implements CommanderProfileStore {
  constructor(private readonly storage: StorageLike | null = browserStorage()) {}

  getProfile(): CommanderProfile | null {
    const p = readJson<CommanderProfile | null>(this.storage, STORAGE_KEYS.commanderProfile, null);
    // Minimal shape-guard so corrupted/partial data behaves like "no profile".
    return p && typeof p.id === 'string' && typeof p.displayName === 'string' ? p : null;
  }

  createProfile(displayName: string, preferredFaction?: string): CommanderProfile {
    const now = nowIso();
    const profile: CommanderProfile = {
      id: newId('local'),
      displayName: normalizeCommanderName(displayName),
      createdAt: now,
      lastPlayedAt: now,
      preferredFaction: preferredFaction || undefined,
      totalMatches: 0,
      wins: 0,
      losses: 0,
      bestScore: 0,
      schemaVersion: PROFILE_SCHEMA_VERSION,
    };
    writeJson(this.storage, STORAGE_KEYS.commanderProfile, profile);
    return profile;
  }

  updateProfile(profile: CommanderProfile): void {
    writeJson(this.storage, STORAGE_KEYS.commanderProfile, profile);
  }

  /** Keeps campaign progress + scores untouched; only changes the display name. */
  renameCommander(displayName: string): void {
    const p = this.getProfile();
    if (!p) return;
    p.displayName = normalizeCommanderName(displayName);
    p.lastPlayedAt = nowIso();
    writeJson(this.storage, STORAGE_KEYS.commanderProfile, p);
  }

  /** Deletes ONLY the commander profile key. Progress/scores are cleared by their
   *  own stores (CampaignProgressStore.resetProgress / LeaderboardStore.clearScores). */
  deleteProfile(): void {
    removeKey(this.storage, STORAGE_KEYS.commanderProfile);
  }
}
