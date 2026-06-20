// Deployment-intro controller: a short RTS-style "dropship lands and unloads the
// starting units" opener that plays before normal control begins. Pure logic only
// (no DOM, no THREE) so the state machine + skip wiring are unit-testable; the
// visual dropship and the overlay live in separate modules and are driven via the
// callbacks below.
//
// IMPORTANT: this never spawns or removes units. The starting units are spawned
// exactly as before (same count, same positions); the controller only flips their
// visibility (reveal) and hands control back. So the final gameplay state is
// identical whether the intro plays out, is skipped, or is disabled — no balance,
// economy, AI, pathfinding, scoring, or unit-count change.

import { LocalStorageSettingsStore, type LocalGameSettingsStore } from '../platform/profile/LocalGameSettingsStore';

export type IntroState = 'entering' | 'landing' | 'unloading' | 'departing' | 'complete';

/** Total sequence length (seconds). Kept short/snappy, well within the 4–8 s target. */
export const INTRO_TOTAL_SEC = 6;
/** The "unload" moment — when the starting units are revealed under the dropship. */
export const INTRO_UNLOAD_SEC = 3;

// Phase boundaries (cumulative seconds). Anything past the last boundary = complete.
const PHASES: { name: Exclude<IntroState, 'complete'>; until: number }[] = [
  { name: 'entering', until: 1.5 }, // dropship descends in from above / off-screen
  { name: 'landing', until: 3.0 }, // settles onto the landing zone
  { name: 'unloading', until: 4.5 }, // ramp down, units revealed
  { name: 'departing', until: 6.0 }, // lifts off and exits
];

/** Pure phase lookup for a given elapsed time. */
export function introStateAt(elapsed: number): IntroState {
  for (const p of PHASES) if (elapsed < p.until) return p.name;
  return 'complete';
}

/** Normalised 0..1 progress within the current phase (for smooth visual lerps). */
export function phaseProgressAt(elapsed: number): number {
  let from = 0;
  for (const p of PHASES) {
    if (elapsed < p.until) {
      const span = p.until - from;
      return span > 0 ? Math.min(1, Math.max(0, (elapsed - from) / span)) : 1;
    }
    from = p.until;
  }
  return 1;
}

export interface DeploymentIntroCallbacks {
  /** Fired exactly once at the unload moment (or immediately on skip): reveal units. */
  onReveal?: () => void;
  /** Fired exactly once when the sequence ends (natural completion OR skip): hand back control. */
  onComplete?: () => void;
}

/**
 * Pure, frame-driven state machine for the deployment intro. Drive it with
 * `update(dt)` each frame; call `skip()` to jump straight to the end. Both
 * `onReveal` and `onComplete` are guaranteed to fire at most once.
 */
export class DeploymentIntroController {
  elapsed = 0;
  private revealed = false;
  private completed = false;

  constructor(
    private readonly cb: DeploymentIntroCallbacks = {},
    private readonly total = INTRO_TOTAL_SEC,
    private readonly revealAt = INTRO_UNLOAD_SEC,
  ) {}

  /** Current phase. Once finished it stays 'complete'. */
  get state(): IntroState {
    return this.completed ? 'complete' : introStateAt(this.elapsed);
  }

  get isComplete(): boolean {
    return this.completed;
  }

  /** Advance the timeline. Triggers reveal at the unload moment and completion at the end. */
  update(dt: number): void {
    if (this.completed) return;
    this.elapsed += dt;
    if (this.elapsed >= this.revealAt) this.reveal();
    if (this.elapsed >= this.total) this.finish();
  }

  /** Skip immediately: reveal units (if not yet) and finalize — idempotent. */
  skip(): void {
    if (this.completed) return;
    this.elapsed = this.total;
    this.finish();
  }

  private reveal(): void {
    if (this.revealed) return;
    this.revealed = true;
    this.cb.onReveal?.();
  }

  private finish(): void {
    if (this.completed) return;
    this.reveal(); // guarantee units are visible before control returns
    this.completed = true;
    this.cb.onComplete?.();
  }
}

// --- Enable resolution (query override > saved setting > default ON) ---

function truthyFlag(v: string | null): boolean {
  return v === '1' || v === 'true' || v === 'on' || v === '';
}
function falsyFlag(v: string | null): boolean {
  return v === '0' || v === 'false' || v === 'off';
}

/**
 * Should the deployment intro play? Precedence (highest first):
 *   1. `?intro=0|off|false` → off, `?intro=1|on|true` → on
 *   2. `?skipIntro=1` (any truthy) → off
 *   3. saved player setting (`deploymentIntroEnabled`)
 *   4. default ON
 */
export function resolveDeploymentIntroEnabled(search = '', storedEnabled?: boolean | null): boolean {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    params = new URLSearchParams();
  }
  const intro = params.get('intro');
  if (intro !== null) {
    if (falsyFlag(intro)) return false;
    if (truthyFlag(intro)) return true;
  }
  if (params.has('skipIntro') && truthyFlag(params.get('skipIntro'))) return false;
  if (typeof storedEnabled === 'boolean') return storedEnabled;
  return true;
}

/** True when a query param is actively forcing the intro on/off (overrides the saved setting). */
export function hasIntroQueryOverride(search = ''): boolean {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return false;
  }
  const intro = params.get('intro');
  if (intro !== null && (falsyFlag(intro) || truthyFlag(intro))) return true;
  return params.has('skipIntro') && truthyFlag(params.get('skipIntro'));
}

/** Resolve from the live page URL + the persisted player setting (SSR/test-safe). */
export function currentDeploymentIntroEnabled(store: LocalGameSettingsStore = new LocalStorageSettingsStore()): boolean {
  const search = typeof window !== 'undefined' ? window.location.search : '';
  const stored = store.getSettings().deploymentIntroEnabled;
  return resolveDeploymentIntroEnabled(search, typeof stored === 'boolean' ? stored : null);
}

/** Persist the player's deployment-intro preference (merged into existing settings). */
export function saveDeploymentIntroEnabled(enabled: boolean, store: LocalGameSettingsStore = new LocalStorageSettingsStore()): void {
  store.saveSettings({ ...store.getSettings(), deploymentIntroEnabled: enabled });
}

// --- Skip-input wiring (pure; works with any add/removeEventListener target) ---

export interface ListenerTarget {
  addEventListener(type: string, fn: (e: unknown) => void): void;
  removeEventListener(type: string, fn: (e: unknown) => void): void;
}

/**
 * Wire Space / Escape / pointer-down to a skip handler on the given target.
 * Returns a disposer that removes every listener exactly once (idempotent), so
 * no input handlers leak past the intro.
 */
export function createSkipListeners(target: ListenerTarget, onSkip: () => void): () => void {
  const onKey = (e: unknown) => {
    const ev = e as { key?: string; code?: string; preventDefault?: () => void };
    if (ev.key === ' ' || ev.key === 'Spacebar' || ev.code === 'Space' || ev.key === 'Escape') {
      ev.preventDefault?.();
      onSkip();
    }
  };
  const onPointer = () => onSkip();
  target.addEventListener('keydown', onKey);
  target.addEventListener('pointerdown', onPointer);
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    target.removeEventListener('keydown', onKey);
    target.removeEventListener('pointerdown', onPointer);
  };
}
