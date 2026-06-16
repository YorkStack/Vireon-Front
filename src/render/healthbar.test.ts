// @vitest-environment happy-dom
// (models.ts loads textures via THREE.TextureLoader at import time → needs a DOM.)
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { makeHealthBar } from './models';

// The foreground bar is the renderOrder-21 child; read its material colour.
function fgColor(hb: ReturnType<typeof makeHealthBar>): string {
  const fg = hb.group.children.find((c) => c.renderOrder === 21) as THREE.Mesh;
  return (fg.material as THREE.MeshBasicMaterial).color.getHexString();
}

const GREEN = '43e860', YELLOW = 'ffce3a', RED = 'ff4545';

describe('makeHealthBar tri-colour thresholds (green 100–50, yellow 49–25, red <25)', () => {
  it('is green from full health down to exactly 50%', () => {
    const hb = makeHealthBar(2);
    hb.set(1.0); expect(fgColor(hb)).toBe(GREEN);
    hb.set(0.5); expect(fgColor(hb)).toBe(GREEN);
  });

  it('is yellow just under 50% down to exactly 25%', () => {
    const hb = makeHealthBar(2);
    hb.set(0.49); expect(fgColor(hb)).toBe(YELLOW);
    hb.set(0.25); expect(fgColor(hb)).toBe(YELLOW);
  });

  it('is red below 25%', () => {
    const hb = makeHealthBar(2);
    hb.set(0.24); expect(fgColor(hb)).toBe(RED);
    hb.set(0); expect(fgColor(hb)).toBe(RED);
  });

  it('scales the bar width by the health ratio', () => {
    const hb = makeHealthBar(2);
    hb.set(0.5);
    const fg = hb.group.children.find((c) => c.renderOrder === 21) as THREE.Mesh;
    expect(fg.scale.x).toBeCloseTo(1.0); // width 2 * 0.5
  });
});
