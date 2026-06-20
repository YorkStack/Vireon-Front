// Pure performance-mode / FPS-cap resolver (no DOM, unit-testable). Lets the game
// loop pace frames to reduce sustained GPU/CPU duty cycle (Mac M2 thermals). This
// changes ONLY how often frames are processed — never simulation rules, balance,
// AI, or pathfinding. dt is still real wall-time between processed frames (clamped
// in the loop), so gameplay stays consistent at any cap.

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
 * Resolve settings from a URL query string (e.g. `window.location.search`).
 * - default → balanced / 60
 * - `?perfMode=battery|balanced|quality` selects the mode
 * - `?fps=30|60|120` overrides the mode (mapped 30→battery, 60→balanced, 120→quality)
 * - any invalid value falls back safely (to balanced, or ignores the bad override)
 */
export function resolvePerformanceSettings(search = ''): PerformanceSettings {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    params = new URLSearchParams();
  }

  let mode: PerformanceMode = DEFAULT_MODE;
  const pm = params.get('perfMode');
  if (isMode(pm)) mode = pm;

  // ?fps= takes precedence over the mode when it is one of the allowed values.
  const fpsRaw = params.get('fps');
  if (fpsRaw != null) {
    const fps = Number(fpsRaw);
    if (ALLOWED_FPS.has(fps)) mode = FPS_TO_MODE[fps];
  }

  const fpsCap = MODE_FPS[mode];
  return { mode, fpsCap, minFrameMs: 1000 / fpsCap };
}

/** Resolve from the live page URL (SSR/test-safe → default balanced). */
export function currentPerformanceSettings(): PerformanceSettings {
  const search = typeof window !== 'undefined' ? window.location.search : '';
  return resolvePerformanceSettings(search);
}
