// Minimap: baked terrain background + live unit/building/crystal dots and the
// camera view indicator. Left-click to look, right-click to order a move.
import { GameMap, TILE, F_ROCK, F_RAMP, F_CRYSTAL } from '../map/map';
import type { World } from '../sim/world';

const LEVEL_COLORS = ['#46425f', '#5e5a7d', '#7b769c'];

export class Minimap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private base: HTMLCanvasElement;
  private map: GameMap;
  private px: number; // pixels per tile

  onLook: (x: number, z: number) => void = () => {};
  onCommand: (x: number, z: number) => void = () => {};

  constructor(map: GameMap) {
    this.map = map;
    const root = document.getElementById('ui-root')!;
    const wrap = document.createElement('div');
    wrap.id = 'minimap-wrap';
    wrap.className = 'panel';
    wrap.innerHTML = `<canvas id="minimap" width="218" height="218"></canvas>`;
    root.appendChild(wrap);
    this.canvas = wrap.querySelector('#minimap')!;
    this.ctx = this.canvas.getContext('2d')!;
    this.px = this.canvas.width / map.size;

    // Bake terrain once.
    this.base = document.createElement('canvas');
    this.base.width = this.canvas.width;
    this.base.height = this.canvas.height;
    const bctx = this.base.getContext('2d')!;
    for (let tz = 0; tz < map.size; tz++) {
      for (let tx = 0; tx < map.size; tx++) {
        const i = map.idx(tx, tz);
        let c = LEVEL_COLORS[map.level[i]];
        if (map.flags[i] & F_RAMP) c = '#98a4c2';
        if (map.flags[i] & F_ROCK) c = '#15121f';
        bctx.fillStyle = c;
        bctx.fillRect(tx * this.px, tz * this.px, Math.ceil(this.px), Math.ceil(this.px));
      }
    }

    const toWorld = (e: MouseEvent): [number, number] => {
      const r = this.canvas.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * map.size * TILE;
      const z = ((e.clientY - r.top) / r.height) * map.size * TILE;
      return [x, z];
    };
    this.canvas.addEventListener('mousedown', (e) => {
      const [x, z] = toWorld(e);
      if (e.button === 0) this.onLook(x, z);
    });
    this.canvas.addEventListener('mousemove', (e) => {
      if (e.buttons & 1) { const [x, z] = toWorld(e); this.onLook(x, z); }
    });
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const [x, z] = toWorld(e);
      this.onCommand(x, z);
    });
  }

  render(world: World, camX: number, camZ: number, viewW: number, viewH: number) {
    const ctx = this.ctx;
    ctx.drawImage(this.base, 0, 0);
    const s = this.px / TILE; // world units -> pixels

    // Crystals (live, so depleted fields fade out).
    ctx.fillStyle = '#2ee6d0';
    for (const c of this.map.crystals) {
      if (c.amount <= 0) continue;
      ctx.fillRect(c.tx * this.px - 1, c.tz * this.px - 1, this.px + 2, this.px + 2);
    }
    // Buildings as squares, units as dots, in faction colors.
    for (const b of world.buildings) {
      ctx.fillStyle = world.teams[b.team].faction.color;
      ctx.fillRect(b.tx * this.px, b.tz * this.px, b.w * this.px, b.h * this.px);
    }
    for (const u of world.units) {
      ctx.fillStyle = world.teams[u.team].faction.color;
      ctx.beginPath();
      ctx.arc(u.x * s, u.z * s, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Camera view rectangle.
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1;
    ctx.strokeRect(camX * s - (viewW * s) / 2, camZ * s - (viewH * s) / 2, viewW * s, viewH * s);
  }
}
