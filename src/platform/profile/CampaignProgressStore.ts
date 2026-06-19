// Local campaign-progress store. Offline-only.
import type { StorageLike } from '../storage/keys';
import { STORAGE_KEYS, browserStorage } from '../storage/keys';
import { readJson, writeJson, removeKey } from '../storage/localStorageJson';
import type { CampaignProgress } from './types';

export interface CampaignProgressStore {
  getProgress(playerId: string): CampaignProgress;
  saveProgress(progress: CampaignProgress): void;
  resetProgress(playerId: string): void;
}

export class LocalStorageCampaignProgressStore implements CampaignProgressStore {
  constructor(private readonly storage: StorageLike | null = browserStorage()) {}

  /** Returns stored progress for `playerId`, or empty progress if none/foreign/corrupt. */
  getProgress(playerId: string): CampaignProgress {
    const p = readJson<CampaignProgress | null>(this.storage, STORAGE_KEYS.campaignProgress, null);
    if (p && p.playerId === playerId && p.campaigns && typeof p.campaigns === 'object') return p;
    return { playerId, campaigns: {} };
  }

  saveProgress(progress: CampaignProgress): void {
    writeJson(this.storage, STORAGE_KEYS.campaignProgress, progress);
  }

  /** Clears ONLY campaign progress — profile + scores are untouched. */
  resetProgress(_playerId: string): void {
    removeKey(this.storage, STORAGE_KEYS.campaignProgress);
  }
}
