import { describe, it, expect } from 'vitest';
import { resolvePerformanceSettings } from './performanceSettings';

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
});
