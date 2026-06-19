// Safe import: parse + validate a savegame string BEFORE touching local storage,
// then write the four keys. Validation always runs first, so a malformed file can
// never partially overwrite existing data. Offline-only; writes through the same
// safe-JSON layer the stores use (no raw localStorage, no network).
import type { StorageLike } from '../storage/keys';
import { STORAGE_KEYS, browserStorage } from '../storage/keys';
import { writeJson } from '../storage/localStorageJson';
import type { CommanderProfile, CampaignProgress, LocalGameSettings } from '../profile/types';
import type { LocalScoreEntry } from '../leaderboard/types';
import { SAVEGAME_FORMAT, SAVEGAME_VERSION, type ImportSavegameResult, type LocalSavegameData } from './types';

type ParseResult = { ok: true; data: LocalSavegameData } | { ok: false; error: string };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}
/** A slice is acceptable if it is absent/null or a plain object (rough shape-guard). */
function objectOrNullish(v: unknown): boolean {
  return v == null || isPlainObject(v);
}

/**
 * Parse + validate a savegame string. Rejects bad JSON, wrong format, unsupported
 * version, missing `data`, or grossly malformed slices. Tolerates missing slices
 * (→ null / empty array). Never writes; never throws.
 */
export function parseLocalSavegame(json: string): ParseResult {
  let obj: unknown;
  try {
    obj = JSON.parse(json);
  } catch {
    return { ok: false, error: 'Datei ist kein gültiges JSON.' };
  }
  if (!isPlainObject(obj)) return { ok: false, error: 'Savegame-Inhalt ist leer oder ungültig.' };
  if (obj.format !== SAVEGAME_FORMAT) return { ok: false, error: 'Unbekanntes Dateiformat — kein Vireon-Savegame.' };
  if (obj.version !== SAVEGAME_VERSION) return { ok: false, error: `Nicht unterstützte Savegame-Version: ${String(obj.version)}.` };
  if (!isPlainObject(obj.data)) return { ok: false, error: 'Savegame enthält keine Daten.' };

  const d = obj.data;
  if (!objectOrNullish(d.commanderProfile)) return { ok: false, error: 'Commander-Profil im Savegame ist beschädigt.' };
  if (!objectOrNullish(d.campaignProgress)) return { ok: false, error: 'Kampagnenfortschritt im Savegame ist beschädigt.' };
  if (!objectOrNullish(d.settings)) return { ok: false, error: 'Einstellungen im Savegame sind beschädigt.' };
  if (d.localScores != null && !Array.isArray(d.localScores)) return { ok: false, error: 'Score-Liste im Savegame ist beschädigt.' };

  return {
    ok: true,
    data: {
      commanderProfile: (d.commanderProfile ?? null) as CommanderProfile | null,
      campaignProgress: (d.campaignProgress ?? null) as CampaignProgress | null,
      localScores: Array.isArray(d.localScores) ? (d.localScores as LocalScoreEntry[]) : [],
      settings: (d.settings ?? null) as LocalGameSettings | null,
    },
  };
}

/**
 * Import a savegame string into local storage. Validation runs first; only on
 * success is anything written. Scores are always replaced (empty array if none);
 * profile/progress/settings are written only when present (absent slices leave the
 * existing local value untouched). Returns a structured result — never throws.
 */
export function importLocalSavegame(json: string, storage: StorageLike | null = browserStorage()): ImportSavegameResult {
  const parsed = parseLocalSavegame(json);
  if (!parsed.ok) return parsed;

  const { commanderProfile, campaignProgress, localScores, settings } = parsed.data;

  if (commanderProfile) writeJson(storage, STORAGE_KEYS.commanderProfile, commanderProfile);
  if (campaignProgress) writeJson(storage, STORAGE_KEYS.campaignProgress, campaignProgress);
  writeJson(storage, STORAGE_KEYS.localScores, localScores);
  if (settings) writeJson(storage, STORAGE_KEYS.settings, settings);

  return {
    ok: true,
    imported: {
      profile: !!commanderProfile,
      campaignProgress: !!campaignProgress,
      scores: localScores.length,
      settings: !!settings,
    },
  };
}
