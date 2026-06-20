// Pure performance-mode / FPS-cap resolver (no DOM, unit-testable). Lets the game
// loop pace frames to reduce sustained GPU/CPU duty cycle (Mac M2 thermals). This
// changes ONLY how often frames are processed — never simulation rules, balance,
// AI, or pathfinding. dt is still real wall-time between processed frames (clamped
// in the loop), so gameplay stays consistent at any cap.

import { LocalStorageSettingsStore, type LocalGameSettingsStore } from '../platform/profile/LocalGameSettingsStore';

export type PerformanceMode = 'battery' | 'balanced' | 'quality';

export interface PerformanceSettings {
  mode: PerformanceMode;
  fpsCap: number;     // 30 / 60 / 120
  minFrameMs: number; // 1000 / fpsCap — target spacing between processed frames
}

/** FPS per mode. Balanced (60) is the default; quality (120) only if explicitly chosen. */
export const MODE_FPS: Record<PerformanceMode, number> = {
  battery: 30,
  balanced: 60,
  quality: 120,
};

export const DEFAULT_MODE: PerformanceMode = 'balanced';

const ALLOWED_FPS = new Set([30, 60, 120]);
const FPS_TO_MODE: Record<number, PerformanceMode> = { 30: 'battery', 60: 'balanced', 120: 'quality' };

function isMode(v: string | null): v is PerformanceMode {
  return v === 'battery' || v === 'balanced' || v === 'quality';
}

/**
 * Resolve settings by precedence (highest first):
 *   1. `?fps=30|60|120`     (query, mapped 30→battery, 60→balanced, 120→quality)
 *   2. `?perfMode=…`        (query)
 *   3. `storedMode`         (persisted player setting)
 *   4. default `balanced`
 * Any invalid value at a level is ignored (falls through to the next level).
 */
export function resolvePerformanceSettings(search = '', storedMode?: string | null): PerformanceSettings {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    params = new URLSearchParams();
  }

  let mode: PerformanceMode = DEFAULT_MODE;
  // 3. persisted setting
  if (isMode(storedMode ?? null)) mode = storedMode as PerformanceMode;
  // 2. ?perfMode= overrides the stored setting
  const pm = params.get('perfMode');
  if (isMode(pm)) mode = pm;
  // 1. ?fps= overrides everything when it is one of the allowed values
  const fpsRaw = params.get('fps');
  if (fpsRaw != null) {
    const fps = Number(fpsRaw);
    if (ALLOWED_FPS.has(fps)) mode = FPS_TO_MODE[fps];
  }

  const fpsCap = MODE_FPS[mode];
  return { mode, fpsCap, minFrameMs: 1000 / fpsCap };
}

/** True when a query param is actively forcing the mode (overrides the saved setting). */
export function hasPerfQueryOverride(search = ''): boolean {
  let params: URLSearchParams;
  try { params = new URLSearchParams(search); } catch { return false; }
  if (isMode(params.get('perfMode'))) return true;
  const fps = Number(params.get('fps'));
  return ALLOWED_FPS.has(fps);
}

/**
 * Resolve from the live page URL + the persisted player setting. SSR/test-safe
 * (no window → '' search; store falls back to default on unavailable storage).
 */
export function currentPerformanceSettings(store: LocalGameSettingsStore = new LocalStorageSettingsStore()): PerformanceSettings {
  const search = typeof window !== 'undefined' ? window.location.search : '';
  const storedMode = store.getSettings().performanceMode ?? null;
  return resolvePerformanceSettings(search, storedMode);
}

/** Persist the player's chosen performance mode (merged into existing settings). */
export function savePerformanceMode(mode: PerformanceMode, store: LocalGameSettingsStore = new LocalStorageSettingsStore()): void {
  store.saveSettings({ ...store.getSettings(), performanceMode: mode });
}

export interface PerformanceModeOption {
  mode: PerformanceMode;
  label: string;
  fpsCap: number;
  recommended: boolean;
}

/** Player-facing menu options. Only Balanced is flagged recommended (never 120). */
export function performanceModeOptions(): PerformanceModeOption[] {
  return [
    { mode: 'battery', label: 'Battery Saver', fpsCap: MODE_FPS.battery, recommended: false },
    { mode: 'balanced', label: 'Balanced', fpsCap: MODE_FPS.balanced, recommended: true },
    { mode: 'quality', label: 'Quality', fpsCap: MODE_FPS.quality, recommended: false },
  ];
}
