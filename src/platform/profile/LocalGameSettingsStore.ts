// Local game settings store. Offline-only; merges stored values over defaults so
// a partial/corrupt object always yields a complete, valid settings object.
import type { StorageLike } from '../storage/keys';
import { STORAGE_KEYS, browserStorage } from '../storage/keys';
import { readJson, writeJson, removeKey } from '../storage/localStorageJson';
import type { LocalGameSettings } from './types';

export const DEFAULT_SETTINGS: LocalGameSettings = {
  soundEnabled: true,
  musicEnabled: true,
  graphicsQuality: 'medium',
  cameraSpeed: 1,
};

export interface LocalGameSettingsStore {
  getSettings(): LocalGameSettings;
  saveSettings(settings: LocalGameSettings): void;
  resetSettings(): void;
}

export class LocalStorageSettingsStore implements LocalGameSettingsStore {
  constructor(private readonly storage: StorageLike | null = browserStorage()) {}

  getSettings(): LocalGameSettings {
    const stored = readJson<Partial<LocalGameSettings>>(this.storage, STORAGE_KEYS.settings, {});
    return { ...DEFAULT_SETTINGS, ...(stored && typeof stored === 'object' ? stored : {}) };
  }

  saveSettings(settings: LocalGameSettings): void {
    writeJson(this.storage, STORAGE_KEYS.settings, settings);
  }

  resetSettings(): void {
    removeKey(this.storage, STORAGE_KEYS.settings);
  }
}
