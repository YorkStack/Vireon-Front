// Pure (THREE/DOM-free) helper for the building-repair UX: pick which friendly
// repair-capable unit a "Repair" button should dispatch, and whether one exists.
// Kept structural (duck-typed) so it is unit-testable without the full sim.

export interface RepairUnitLike {
  team: number;
  alive: boolean;
  x: number;
  z: number;
  def: { repairs?: boolean };
  order: { kind: string };
}

export interface RepairTargetLike { team: number; cx: number; cz: number }

/** Is at least one alive, friendly, repair-capable unit available? Drives the
 *  Repair button's enabled/disabled state. */
export function hasRepairUnit(units: readonly RepairUnitLike[], team: number): boolean {
  return units.some((u) => u.alive && u.team === team && !!u.def.repairs);
}

/**
 * Pick the best friendly repair-capable unit for a target building: idle units
 * are preferred over busy ones, and within each group the nearest wins. Returns
 * null when no alive, friendly, repair-capable unit exists. (Distances on the map
 * are far below the 1e12 idle/busy bias, so idle always sorts ahead.)
 */
export function nearestRepairUnit<U extends RepairUnitLike>(
  units: readonly U[], target: RepairTargetLike,
): U | null {
  let best: U | null = null;
  let bestKey = Infinity;
  for (const u of units) {
    if (!u.alive || u.team !== target.team || !u.def.repairs) continue;
    const d2 = (u.x - target.cx) ** 2 + (u.z - target.cz) ** 2;
    const key = (u.order.kind === 'idle' ? 0 : 1e12) + d2;
    if (key < bestKey) { bestKey = key; best = u; }
  }
  return best;
}
