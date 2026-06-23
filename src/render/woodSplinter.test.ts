// Wood-splinter burst for pioneer tree clearing. Visual-only: covers the pure
// particle spread (deterministic + valid ranges) and the Effects lifecycle
// (spawn → fall → expire → self-cleanup). The clear→callback-once wiring is the
// sim's (Slice 2C, covered in clearVegetation.test); core gameplay constants are
// re-asserted here to prove this effect changed none of them.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Effects, woodChipParticleInit, WOOD_CHIP_COLORS } from './effects';
import { UNIT_CLASS_TEMPLATES } from '../data/unitClasses';

/** Tiny deterministic LCG so two runs with the same seed produce identical data. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
}

describe('woodChipParticleInit (pure splinter spread)', () => {
  it('produces the requested count with valid, wood-like motion', () => {
    const specs = woodChipParticleInit(14, lcg(1));
    expect(specs).toHaveLength(14);
    for (const s of specs) {
      expect(s.vy).toBeGreaterThan(0);                       // always an upward kick
      expect(Math.hypot(s.vx, s.vz)).toBeGreaterThan(0);     // outward spread
      expect(s.py).toBeGreaterThan(0);                        // starts above the stump
      expect(s.mat).toBeGreaterThanOrEqual(0);
      expect(s.mat).toBeLessThan(WOOD_CHIP_COLORS.length);    // valid palette slot
      expect(s.scale).toBeGreaterThan(0);
    }
  });

  it('cycles through all brown palette slots', () => {
    const specs = woodChipParticleInit(8, lcg(2));
    expect(new Set(specs.map(s => s.mat))).toEqual(new Set([0, 1, 2, 3]));
    expect(WOOD_CHIP_COLORS).toHaveLength(4); // dark bark, reddish bark, wood, tan
  });

  it('is deterministic for a given rng seed', () => {
    expect(woodChipParticleInit(10, lcg(42))).toEqual(woodChipParticleInit(10, lcg(42)));
  });
});

describe('Effects.woodChips lifecycle', () => {
  it('spawns one burst group with `count` chips and tears it down at ttl', () => {
    const scene = new THREE.Scene();
    const fx = new Effects(scene);
    fx.woodChips(new THREE.Vector3(0, 0, 0), 12);
    expect(fx.active).toHaveLength(1);
    const group = fx.active[0].mesh as THREE.Group;
    expect(group.children).toHaveLength(12);
    expect(scene.children).toContain(group);

    // A chip lifts then falls under gravity; advance a couple frames and confirm motion.
    const y0 = group.children[0].position.y;
    fx.update(0.05);
    expect(group.children[0].position.y).not.toBe(y0);

    // Run past the 1.6s lifetime → the burst removes itself from active + scene.
    for (let t = 0; t < 2.0; t += 0.05) fx.update(0.05);
    expect(fx.active).toHaveLength(0);
    expect(scene.children).not.toContain(group);
  });

  it('lands chips on the ground (hidden) before the burst ends', () => {
    const scene = new THREE.Scene();
    const fx = new Effects(scene);
    fx.woodChips(new THREE.Vector3(0, 0, 0), 14);
    const group = fx.active[0].mesh as THREE.Group;
    for (let t = 0; t < 1.5; t += 0.05) fx.update(0.05);
    // By 1.5s, gravity has dropped chips to ground level and hidden them.
    const landed = group.children.filter(c => !c.visible).length;
    expect(landed).toBeGreaterThan(0);
  });
});

describe('wood-splinter effect leaves core gameplay constants unchanged', () => {
  it('clear range 1.5, clear time 3 (reward +30 is the sim default, tested in clearVegetation.test)', () => {
    expect(UNIT_CLASS_TEMPLATES.pioneer.clearVegetation).toEqual({ clearRange: 1.5, clearTime: 3 });
  });
});
