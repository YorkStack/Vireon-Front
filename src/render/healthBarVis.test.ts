import { describe, it, expect } from 'vitest';
import { healthColor, healthBarVisible, HEALTH_BAR_FLASH_SEC } from './healthBarVis';

describe('healthColor tri-colour thresholds (green 100–50, yellow 49–25, red <25)', () => {
  it('is green from full health down to exactly 50%', () => {
    expect(healthColor(1.0)).toBe('green');
    expect(healthColor(0.5)).toBe('green');
  });
  it('is yellow just under 50% down to exactly 25%', () => {
    expect(healthColor(0.49)).toBe('yellow');
    expect(healthColor(0.25)).toBe('yellow');
  });
  it('is red below 25%', () => {
    expect(healthColor(0.24)).toBe('red');
    expect(healthColor(0)).toBe('red');
  });
  it('clamps out-of-range ratios', () => {
    expect(healthColor(1.5)).toBe('green');
    expect(healthColor(-1)).toBe('red');
  });
});

describe('healthBarVisible (selected OR damaged OR recently damaged/repaired)', () => {
  const full = { hp: 100, maxHp: 100, now: 10, flashUntil: 0 };

  it('hides idle, full-health, unselected objects', () => {
    expect(healthBarVisible({ ...full, selected: false })).toBe(false);
  });
  it('shows selected objects even at full health', () => {
    expect(healthBarVisible({ ...full, selected: true })).toBe(true);
  });
  it('shows visibly damaged objects (beyond the 0.5 epsilon)', () => {
    expect(healthBarVisible({ hp: 99, maxHp: 100, now: 10, flashUntil: 0, selected: false })).toBe(true);
  });
  it('treats a sub-epsilon dent as full health (no flicker)', () => {
    expect(healthBarVisible({ hp: 99.7, maxHp: 100, now: 10, flashUntil: 0, selected: false })).toBe(false);
  });
  it('keeps a just-healed full-HP bar visible inside the flash window', () => {
    const now = 10;
    expect(healthBarVisible({ hp: 100, maxHp: 100, now, flashUntil: now + HEALTH_BAR_FLASH_SEC, selected: false })).toBe(true);
  });
  it('hides the full-HP bar once the flash window has elapsed', () => {
    expect(healthBarVisible({ hp: 100, maxHp: 100, now: 12.01, flashUntil: 12, selected: false })).toBe(false);
  });
});
