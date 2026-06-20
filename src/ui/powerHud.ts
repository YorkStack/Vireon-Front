// Pure formatter for the power HUD (DOM-free, unit-testable). Presentation only —
// reads the already-computed `powerUsed` / `powerProduced` and shows the SURPLUS
// (produced − used) so players don't misread "used/produced" as "available energy".
// No simulation/balance/power-calc change; the numbers come straight from the team.

/** Surplus = produced − used. Positive = headroom, 0 = balanced, negative = deficit. */
export function powerSurplus(powerUsed: number, powerProduced: number): number {
  return Math.round(powerProduced) - Math.round(powerUsed);
}

/** HUD text: `⚡ +120` / `⚡ 0` / `⚡ -20` (positive sign explicit, negative kept). */
export function powerHudText(powerUsed: number, powerProduced: number): string {
  const s = powerSurplus(powerUsed, powerProduced);
  return `⚡ ${s > 0 ? '+' : ''}${s}`;
}

/** Hover/aria detail: `Power surplus: +120 | Used: 0 | Produced: 120`. */
export function powerHudTitle(powerUsed: number, powerProduced: number): string {
  const used = Math.round(powerUsed), produced = Math.round(powerProduced);
  const s = produced - used;
  return `Power surplus: ${s > 0 ? '+' : ''}${s} | Used: ${used} | Produced: ${produced}`;
}
