import { describe, it, expect } from 'vitest';
import { resolvePerformanceSettings, hasPerfQueryOverride, performanceModeOptions } from './performanceSettings';

describe('resolvePerformanceSettings', () => {
  it('defaults to balanced / 60', () => {
    const s = resolvePerformanceSettings('');
    expect(s.mode).toBe('balanced');
    expect(s.fpsCap).toBe(60);
    expect(s.minFrameMs).toBeCloseTo(1000 / 60, 5);
  });

  it('battery mode is 30 FPS', () => {
    expect(resolvePerformanceSettings('?perfMode=battery')).toMatchObject({ mode: 'battery', fpsCap: 30 });
  });

  it('balanced mode is 60 FPS', () => {
    expect(resolvePerformanceSettings('?perfMode=balanced')).toMatchObject({ mode: 'balanced', fpsCap: 60 });
  });

  it('quality mode is 120 FPS', () => {
    expect(resolvePerformanceSettings('?perfMode=quality')).toMatchObject({ mode: 'quality', fpsCap: 120 });
  });

  it('?fps=30/60/120 overrides the mode', () => {
    expect(resolvePerformanceSettings('?fps=30')).toMatchObject({ mode: 'battery', fpsCap: 30 });
    expect(resolvePerformanceSettings('?fps=60')).toMatchObject({ mode: 'balanced', fpsCap: 60 });
    expect(resolvePerformanceSettings('?fps=120')).toMatchObject({ mode: 'quality', fpsCap: 120 });
  });

  it('?fps overrides perfMode when both are present', () => {
    expect(resolvePerformanceSettings('?perfMode=quality&fps=30')).toMatchObject({ mode: 'battery', fpsCap: 30 });
  });

  it('invalid perfMode falls back to balanced', () => {
    expect(resolvePerformanceSettings('?perfMode=turbo')).toMatchObject({ mode: 'balanced', fpsCap: 60 });
  });

  it('invalid / disallowed fps is ignored (keeps mode)', () => {
    expect(resolvePerformanceSettings('?fps=45')).toMatchObject({ mode: 'balanced', fpsCap: 60 });
    expect(resolvePerformanceSettings('?fps=abc')).toMatchObject({ mode: 'balanced', fpsCap: 60 });
    expect(resolvePerformanceSettings('?perfMode=battery&fps=999')).toMatchObject({ mode: 'battery', fpsCap: 30 });
  });

  it('ignores unrelated query params', () => {
    expect(resolvePerformanceSettings('?perf=1&buildings=textured')).toMatchObject({ mode: 'balanced', fpsCap: 60 });
  });

  // --- stored setting precedence ---
  it('uses the stored performance mode when no query override', () => {
    expect(resolvePerformanceSettings('', 'battery')).toMatchObject({ mode: 'battery', fpsCap: 30 });
    expect(resolvePerformanceSettings('', 'quality')).toMatchObject({ mode: 'quality', fpsCap: 120 });
  });

  it('falls back to balanced for an invalid / null stored mode', () => {
    expect(resolvePerformanceSettings('', 'turbo')).toMatchObject({ mode: 'balanced', fpsCap: 60 });
    expect(resolvePerformanceSettings('', null)).toMatchObject({ mode: 'balanced', fpsCap: 60 });
  });

  it('query overrides the stored mode (?perfMode and ?fps both win over storage)', () => {
    expect(resolvePerformanceSettings('?perfMode=quality', 'battery')).toMatchObject({ mode: 'quality', fpsCap: 120 });
    expect(resolvePerformanceSettings('?fps=60', 'battery')).toMatchObject({ mode: 'balanced', fpsCap: 60 });
  });
});

describe('hasPerfQueryOverride', () => {
  it('detects an active query override', () => {
    expect(hasPerfQueryOverride('?fps=30')).toBe(true);
    expect(hasPerfQueryOverride('?perfMode=quality')).toBe(true);
    expect(hasPerfQueryOverride('')).toBe(false);
    expect(hasPerfQueryOverride('?fps=45')).toBe(false);   // disallowed → not an override
    expect(hasPerfQueryOverride('?perf=1')).toBe(false);
  });
});

describe('performanceModeOptions', () => {
  it('has the three modes with correct caps', () => {
    const o = performanceModeOptions();
    expect(o.map((x) => x.mode)).toEqual(['battery', 'balanced', 'quality']);
    expect(o.find((x) => x.mode === 'battery')!.fpsCap).toBe(30);
    expect(o.find((x) => x.mode === 'balanced')!.fpsCap).toBe(60);
    expect(o.find((x) => x.mode === 'quality')!.fpsCap).toBe(120);
  });

  it('recommends ONLY balanced (never quality/120)', () => {
    const o = performanceModeOptions();
    expect(o.filter((x) => x.recommended).map((x) => x.mode)).toEqual(['balanced']);
    expect(o.find((x) => x.mode === 'quality')!.recommended).toBe(false);
  });
});
