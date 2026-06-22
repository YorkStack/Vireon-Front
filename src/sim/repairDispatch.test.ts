import { describe, it, expect } from 'vitest';
import { nearestRepairUnit, hasRepairUnit, type RepairUnitLike } from './repairDispatch';

const mk = (o: Partial<RepairUnitLike> & { x?: number; z?: number }): RepairUnitLike => ({
  team: 0, alive: true, x: 0, z: 0, def: { repairs: true }, order: { kind: 'idle' }, ...o,
});
const target = { team: 0, cx: 0, cz: 0 };

describe('hasRepairUnit', () => {
  it('false when no alive friendly repair-capable unit', () => {
    expect(hasRepairUnit([], 0)).toBe(false);
    expect(hasRepairUnit([mk({ def: { repairs: false } })], 0)).toBe(false);
    expect(hasRepairUnit([mk({ alive: false })], 0)).toBe(false);
    expect(hasRepairUnit([mk({ team: 1 })], 0)).toBe(false);
  });
  it('true when one exists', () => {
    expect(hasRepairUnit([mk({ def: { repairs: false } }), mk({})], 0)).toBe(true);
  });
});

describe('nearestRepairUnit', () => {
  it('returns null when no repair-capable friendly unit', () => {
    expect(nearestRepairUnit([], target)).toBeNull();
    expect(nearestRepairUnit([mk({ def: {} })], target)).toBeNull();
  });
  it('ignores non-repair, enemy, and dead units', () => {
    const good = mk({ x: 50 });
    const got = nearestRepairUnit([
      mk({ x: 1, def: { repairs: false } }),
      mk({ x: 1, team: 1 }),
      mk({ x: 1, alive: false }),
      good,
    ], target);
    expect(got).toBe(good);
  });
  it('picks the nearest among idle units', () => {
    const near = mk({ x: 3 }), far = mk({ x: 30 });
    expect(nearestRepairUnit([far, near], target)).toBe(near);
  });
  it('prefers an idle unit over a closer busy one', () => {
    const busyClose = mk({ x: 2, order: { kind: 'build' } });
    const idleFar = mk({ x: 20, order: { kind: 'idle' } });
    expect(nearestRepairUnit([busyClose, idleFar], target)).toBe(idleFar);
  });
  it('falls back to the nearest busy unit when none are idle', () => {
    const busyFar = mk({ x: 40, order: { kind: 'repair' } });
    const busyNear = mk({ x: 5, order: { kind: 'gather' } });
    expect(nearestRepairUnit([busyFar, busyNear], target)).toBe(busyNear);
  });
});
