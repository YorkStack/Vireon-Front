// Local savegame export/import model (MVP 1, Step 4). A plain JSON snapshot of the
// offline Commander data — NOT a backend, NOT auth, NO secrets/tokens. Lets a
// player back up and restore their local profile/progress/scores/settings as a
// single file. See docs/local-savegame-export-import.md.
import type { CommanderProfile, CampaignProgress, LocalGameSettings } from '../profile/types';
import type { LocalScoreEntry } from '../leaderboard/types';

/** Magic string identifying a Vireon local savegame file. */
export const SAVEGAME_FORMAT = 'vireon-local-savegame' as const;
/** Bump only on a breaking change to the export shape; import rejects others. */
export const SAVEGAME_VERSION = 1 as const;

/** The four local data slices, exactly as stored under STORAGE_KEYS. */
export interface LocalSavegameData {
  commanderProfile: CommanderProfile | null;
  campaignProgress: CampaignProgress | null;
  localScores: LocalScoreEntry[];
  settings: LocalGameSettings | null;
}

export interface LocalSavegameExport {
  format: typeof SAVEGAME_FORMAT;
  version: typeof SAVEGAME_VERSION;
  exportedAt: string;            // ISO timestamp
  app?: { name: 'Vireon Front' };
  data: LocalSavegameData;
}

/** Result of an import attempt — never throws into the UI. */
export type ImportSavegameResult =
  | { ok: true; imported: { profile: boolean; campaignProgress: boolean; scores: number; settings: boolean } }
  | { ok: false; error: string };
