import { describe, it, expect } from 'vitest';
import { powerSurplus, powerHudText, powerHudTitle } from './powerHud';

describe('powerHudText', () => {
  it('shows a positive surplus with an explicit +', () => {
    expect(powerHudText(0, 120)).toBe('⚡ +120');
  });

  it('shows 0 when balanced', () => {
    expect(powerHudText(120, 120)).toBe('⚡ 0');
  });

  it('shows a negative surplus (deficit)', () => {
    expect(powerHudText(140, 120)).toBe('⚡ -20');
  });
});

describe('powerHudTitle', () => {
  it('spells out surplus, used and produced', () => {
    expect(powerHudTitle(0, 120)).toBe('Power surplus: +120 | Used: 0 | Produced: 120');
    expect(powerHudTitle(140, 120)).toBe('Power surplus: -20 | Used: 140 | Produced: 120');
  });
});

describe('powerSurplus', () => {
  it('is produced − used, rounded', () => {
    expect(powerSurplus(0, 120)).toBe(120);
    expect(powerSurplus(120, 120)).toBe(0);
    expect(powerSurplus(140, 120)).toBe(-20);
    expect(powerSurplus(12.5, 120)).toBe(107); // 120 - 13
  });

  it('a deficit (negative surplus) lines up with the low-power condition used > produced', () => {
    // hud keeps toggling `.low` on team.lowPower (= used > produced); surplus<0 ⇔ lowPower
    expect(powerSurplus(140, 120) < 0).toBe(true);
    expect(powerSurplus(120, 120) < 0).toBe(false);
  });
});
