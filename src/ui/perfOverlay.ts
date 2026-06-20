// Dev-only performance overlay, hidden behind `?perf=1`. Zero dependency, no
// gameplay effect, NOT shown in normal play. Updated a few times per second (not
// every frame) from the game loop. The line formatter is pure → unit-tested; the
// DOM wrapper is browser-only. Reading these numbers guides the Mac-M2 thermal
// work (FPS cap / quality modes) without changing any gameplay.

/** True only when the page URL carries `?perf=1`. SSR/test-safe (no window → false). */
export function perfEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('perf') === '1';
  } catch {
    return false;
  }
}

export interface PerfStats {
  fps: number;
  frameMs: number;      // avg total frame time over the sample window
  simMs: number;        // avg time in world/ai/effects/input/hud update
  renderMs: number;     // avg time in camera+render+minimap
  units: number;
  buildings: number;
  projectiles: number;  // active VFX (projectiles/explosions/sparks)
  crystals: number;     // crystal node groups
  drawCalls: number;
  triangles: number;
  textures: number;
  geometries: number;
  programs: number;
}

const n = (v: number) => (Number.isFinite(v) ? Math.round(v) : 0);
const ms = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : '0.0');

/** Pure formatter — turns stats into display lines (testable without a DOM). */
export function formatPerfLines(s: PerfStats): string[] {
  return [
    `FPS ${n(s.fps)}   frame ${ms(s.frameMs)}ms`,
    `sim ${ms(s.simMs)}ms   render ${ms(s.renderMs)}ms`,
    `units ${n(s.units)}  bld ${n(s.buildings)}  vfx ${n(s.projectiles)}  cry ${n(s.crystals)}`,
    `draws ${n(s.drawCalls)}  tris ${n(s.triangles).toLocaleString('en-US')}`,
    `tex ${n(s.textures)}  geo ${n(s.geometries)}  prog ${n(s.programs)}`,
  ];
}

/** Fixed corner panel. Created only when `perfEnabled()`. */
export class PerfOverlay {
  private el: HTMLElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'perf-overlay';
    this.el.style.cssText = [
      'position:fixed', 'top:8px', 'left:8px', 'z-index:9999', 'pointer-events:none',
      'font:11px/1.45 ui-monospace,Menlo,Consolas,monospace', 'color:#9effd8',
      'background:rgba(8,12,20,0.72)', 'border:1px solid rgba(120,200,255,0.25)',
      'border-radius:6px', 'padding:6px 9px', 'white-space:pre', 'text-shadow:0 0 6px rgba(0,0,0,0.6)',
    ].join(';');
    document.body.appendChild(this.el);
  }

  update(stats: PerfStats): void {
    this.el.textContent = formatPerfLines(stats).join('\n');
  }

  dispose(): void {
    this.el.remove();
  }
}
