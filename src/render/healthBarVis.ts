// Pure (THREE-free) helpers for health-bar colour + visibility, extracted so the
// rules are a single source of truth and unit-testable without a DOM/WebGL.
// Used by makeHealthBar (colour) and the per-frame sync in world.ts (visibility).

export type HealthTier = 'green' | 'yellow' | 'red';

/** Tri-colour by remaining-health ratio: green 100–50 %, yellow 49–25 %, red <25 %. */
export function healthColor(ratio: number): HealthTier {
  const r = Math.max(0, Math.min(1, ratio));
  return r >= 0.5 ? 'green' : r >= 0.25 ? 'yellow' : 'red';
}

/** How long (sim-seconds) a bar lingers after the last damage/repair event. */
export const HEALTH_BAR_FLASH_SEC = 2;

export interface HealthBarVisInput {
  selected: boolean;
  hp: number;
  maxHp: number;
  /** Current sim time (seconds). */
  now: number;
  /** Sim time until which the bar stays visible after recent damage/repair. */
  flashUntil: number;
}

/**
 * A health bar shows when the entity is selected, currently damaged, or was
 * damaged/repaired within the last HEALTH_BAR_FLASH_SEC. Idle full-health,
 * unselected objects stay hidden so the screen doesn't clutter. Ownership-
 * agnostic: a damaged or selected enemy is just as readable as a friendly.
 */
export function healthBarVisible(o: HealthBarVisInput): boolean {
  if (o.selected) return true;
  if (o.hp < o.maxHp - 0.5) return true; // visibly damaged
  return o.now < o.flashUntil; // recently damaged or repaired (decay)
}
