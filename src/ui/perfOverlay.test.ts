import { describe, it, expect } from 'vitest';
import { formatPerfLines, type PerfStats } from './perfOverlay';

function stats(p: Partial<PerfStats> = {}): PerfStats {
  return {
    mode: 'balanced', fpsCap: 60,
    fps: 60, frameMs: 16.7, simMs: 3.2, renderMs: 9.1,
    units: 12, buildings: 5, projectiles: 8, crystals: 35,
    drawCalls: 99, triangles: 441845, textures: 45, geometries: 41, programs: 16, ...p,
  };
}

describe('formatPerfLines', () => {
  it('renders the expected metric lines incl. mode + cap', () => {
    const lines = formatPerfLines(stats());
    expect(lines).toHaveLength(5);
    expect(lines[0]).toContain('balanced');
    expect(lines[0]).toContain('cap 60');
    expect(lines[0]).toContain('FPS 60');
    expect(lines[1]).toContain('frame 16.7ms');
    expect(lines[1]).toContain('sim 3.2ms');
    expect(lines[1]).toContain('render 9.1ms');
    expect(lines[2]).toContain('units 12');
    expect(lines[2]).toContain('cry 35');
    expect(lines[3]).toContain('draws 99');
    expect(lines[3]).toContain('441,845'); // thousands separator on triangles
  });

  it('shows the active mode + cap (battery / 30)', () => {
    const lines = formatPerfLines(stats({ mode: 'battery', fpsCap: 30, fps: 30 }));
    expect(lines[0]).toContain('battery');
    expect(lines[0]).toContain('cap 30');
  });

  it('sanitizes non-finite values to 0 (never NaN/Infinity in the UI)', () => {
    const lines = formatPerfLines(stats({ fps: NaN, frameMs: Infinity, simMs: NaN }));
    expect(lines[0]).toContain('FPS 0');
    expect(lines[1]).toContain('frame 0.0ms');
    expect(lines[1]).toContain('sim 0.0ms');
  });
});
