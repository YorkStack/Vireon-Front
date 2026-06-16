import { describe, it, expect } from 'vitest';
import { phaseOf, attackTimingMul, waveMinReady, sendFraction, effectiveProfile, tickInterval, type AiProfile } from './decisions';
import { DIFFICULTIES } from '../data/difficulty';

const BASE: AiProfile = {
  name: 'standard', firstWaveAt: 210, waveInterval: 150, waveGrowth: 1.35,
  maxArmy: 26, harvesters: 2, rebuilds: true,
};

describe('phaseOf', () => {
  it('splits early / mid / late', () => {
    expect(phaseOf(0)).toBe('early');
    expect(phaseOf(239)).toBe('early');
    expect(phaseOf(240)).toBe('mid');
    expect(phaseOf(599)).toBe('mid');
    expect(phaseOf(600)).toBe('late');
  });
});

describe('doctrine knobs', () => {
  it('attackTimingMul: early earlier, late later', () => {
    expect(attackTimingMul('early')).toBeLessThan(1);
    expect(attackTimingMul('mid')).toBe(1);
    expect(attackTimingMul('late')).toBeGreaterThan(1);
  });
  it('aggressive doctrines need fewer units ready', () => {
    expect(waveMinReady(0.95)).toBeLessThan(waveMinReady(0.4));
    expect(waveMinReady(0.95)).toBeGreaterThanOrEqual(3);
  });
  it('defensive doctrines commit a smaller fraction', () => {
    expect(sendFraction(0.9)).toBeLessThan(sendFraction(0.15));
    expect(sendFraction(0.9)).toBeGreaterThanOrEqual(0.5);
    expect(sendFraction(0.15)).toBeLessThanOrEqual(0.9);
  });
});

describe('effectiveProfile (difficulty mapping, Schwer = baseline)', () => {
  it('Schwer leaves the base profile essentially unchanged (mid timing)', () => {
    const p = effectiveProfile(BASE, DIFFICULTIES.schwer, 'mid');
    expect(p.firstWaveAt).toBe(210);
    expect(p.waveInterval).toBe(150);
    expect(p.waveGrowth).toBeCloseTo(1.35);
    expect(p.maxArmy).toBe(26);
  });

  it('Leicht delays attacks, shrinks waves & army vs Schwer', () => {
    const easy = effectiveProfile(BASE, DIFFICULTIES.leicht, 'mid');
    const hard = effectiveProfile(BASE, DIFFICULTIES.schwer, 'mid');
    expect(easy.firstWaveAt).toBeGreaterThan(hard.firstWaveAt);
    expect(easy.waveInterval).toBeGreaterThan(hard.waveInterval);
    expect(easy.maxArmy).toBeLessThan(hard.maxArmy);
    expect(easy.waveGrowth).toBeLessThan(hard.waveGrowth);
  });

  it('Superschwer attacks sooner with bigger, faster-growing waves', () => {
    const sup = effectiveProfile(BASE, DIFFICULTIES.superschwer, 'mid');
    const hard = effectiveProfile(BASE, DIFFICULTIES.schwer, 'mid');
    expect(sup.firstWaveAt).toBeLessThan(hard.firstWaveAt);
    expect(sup.maxArmy).toBeGreaterThan(hard.maxArmy);
    expect(sup.waveGrowth).toBeGreaterThan(hard.waveGrowth);
  });

  it('waveGrowth never drops below 1 (waves never shrink)', () => {
    for (const d of Object.values(DIFFICULTIES)) {
      expect(effectiveProfile(BASE, d, 'mid').waveGrowth).toBeGreaterThan(1);
    }
  });

  it('early-timing doctrine attacks sooner than late-timing on the same difficulty', () => {
    const early = effectiveProfile(BASE, DIFFICULTIES.mittel, 'early');
    const late = effectiveProfile(BASE, DIFFICULTIES.mittel, 'late');
    expect(early.firstWaveAt).toBeLessThan(late.firstWaveAt);
  });
});

describe('tickInterval', () => {
  it('easier difficulties think less often', () => {
    expect(tickInterval(DIFFICULTIES.leicht)).toBeGreaterThan(tickInterval(DIFFICULTIES.schwer));
    expect(tickInterval(DIFFICULTIES.superschwer)).toBeLessThan(tickInterval(DIFFICULTIES.schwer));
  });
});
