// Pure export helpers: read the four local keys and wrap them in a versioned,
// serializable savegame. Offline-only; reads through the same StorageLike +
// safe-JSON layer the stores use (no raw localStorage, no network). `storage` and
// `now` are injectable so the result is fully deterministic in tests.
import type { StorageLike } from '../storage/keys';
import { STORAGE_KEYS, browserStorage } from '../storage/keys';
import { readJson } from '../storage/localStorageJson';
import { nowIso } from '../storage/id';
import type { CommanderProfile, CampaignProgress, LocalGameSettings } from '../profile/types';
import type { LocalScoreEntry } from '../leaderboard/types';
import { SAVEGAME_FORMAT, SAVEGAME_VERSION, type LocalSavegameExport } from './types';

/**
 * Snapshot the current local data into a `LocalSavegameExport`. Missing keys
 * become `null` (scores → `[]`), so a brand-new player still produces a valid
 * file. Reading at the storage level keeps every slice's true value (e.g. "no
 * settings stored" stays `null`) instead of a store's merged defaults.
 */
export function buildLocalSavegameExport(
  storage: StorageLike | null = browserStorage(),
  now: () => string = nowIso,
): LocalSavegameExport {
  const commanderProfile = readJson<CommanderProfile | null>(storage, STORAGE_KEYS.commanderProfile, null);
  const campaignProgress = readJson<CampaignProgress | null>(storage, STORAGE_KEYS.campaignProgress, null);
  const rawScores = readJson<unknown>(storage, STORAGE_KEYS.localScores, []);
  const localScores: LocalScoreEntry[] = Array.isArray(rawScores) ? (rawScores as LocalScoreEntry[]) : [];
  const settings = readJson<LocalGameSettings | null>(storage, STORAGE_KEYS.settings, null);

  return {
    format: SAVEGAME_FORMAT,
    version: SAVEGAME_VERSION,
    exportedAt: now(),
    app: { name: 'Vireon Front' },
    data: { commanderProfile, campaignProgress, localScores, settings },
  };
}

/** Pretty-print a savegame as 2-space-indented JSON (the downloaded file body). */
export function serializeLocalSavegame(savegame: LocalSavegameExport): string {
  return JSON.stringify(savegame, null, 2);
}
