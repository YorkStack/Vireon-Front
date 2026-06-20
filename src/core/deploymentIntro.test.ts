import { describe, it, expect, vi } from 'vitest';
import {
  DeploymentIntroController,
  resolveDeploymentIntroEnabled,
  hasIntroQueryOverride,
  createSkipListeners,
  introStateAt,
  INTRO_TOTAL_SEC,
  INTRO_UNLOAD_SEC,
  type ListenerTarget,
} from './deploymentIntro';

describe('resolveDeploymentIntroEnabled', () => {
  it('1. defaults to enabled when nothing is stored or overridden', () => {
    expect(resolveDeploymentIntroEnabled('')).toBe(true);
    expect(resolveDeploymentIntroEnabled('', null)).toBe(true);
    expect(resolveDeploymentIntroEnabled('', undefined)).toBe(true);
  });

  it('2. the saved Admin/Tools setting can disable it', () => {
    expect(resolveDeploymentIntroEnabled('', false)).toBe(false);
    expect(resolveDeploymentIntroEnabled('', true)).toBe(true);
  });

  it('3. a query override disables it (and can force it on over a saved off)', () => {
    expect(resolveDeploymentIntroEnabled('?intro=0')).toBe(false);
    expect(resolveDeploymentIntroEnabled('?intro=off')).toBe(false);
    expect(resolveDeploymentIntroEnabled('?skipIntro=1')).toBe(false);
    expect(resolveDeploymentIntroEnabled('?skipIntro')).toBe(false);
    // query wins over the saved setting in both directions
    expect(resolveDeploymentIntroEnabled('?intro=0', true)).toBe(false);
    expect(resolveDeploymentIntroEnabled('?intro=1', false)).toBe(true);
  });

  it('hasIntroQueryOverride reflects an active query flag', () => {
    expect(hasIntroQueryOverride('?intro=0')).toBe(true);
    expect(hasIntroQueryOverride('?intro=1')).toBe(true);
    expect(hasIntroQueryOverride('?skipIntro=1')).toBe(true);
    expect(hasIntroQueryOverride('')).toBe(false);
    expect(hasIntroQueryOverride('?foo=bar')).toBe(false);
  });
});

describe('DeploymentIntroController', () => {
  it('4. skip() finalizes exactly once (idempotent)', () => {
    const onComplete = vi.fn();
    const onReveal = vi.fn();
    const c = new DeploymentIntroController({ onComplete, onReveal });
    c.skip();
    c.skip();
    c.update(10); // further ticks after completion do nothing
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onReveal).toHaveBeenCalledTimes(1);
    expect(c.isComplete).toBe(true);
    expect(c.state).toBe('complete');
  });

  it('5. natural completion finalizes exactly once', () => {
    const onComplete = vi.fn();
    const onReveal = vi.fn();
    const c = new DeploymentIntroController({ onComplete, onReveal });
    // tick past the end in small steps, then keep ticking
    for (let i = 0; i < 200; i++) c.update(0.05);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onReveal).toHaveBeenCalledTimes(1);
    expect(c.isComplete).toBe(true);
  });

  it('reveals at the unload moment, completes at the end, walks the phases', () => {
    const order: string[] = [];
    const c = new DeploymentIntroController({
      onReveal: () => order.push('reveal'),
      onComplete: () => order.push('complete'),
    });
    expect(c.state).toBe('entering');
    c.update(2.0);
    expect(c.state).toBe('landing');
    expect(order).toEqual([]); // not revealed before the unload moment
    c.update(1.2); // elapsed 3.2 → past INTRO_UNLOAD_SEC
    expect(order).toEqual(['reveal']);
    expect(c.state).toBe('unloading');
    c.update(3.0); // elapsed 6.2 → past total
    expect(order).toEqual(['reveal', 'complete']);
    expect(INTRO_TOTAL_SEC).toBeGreaterThan(INTRO_UNLOAD_SEC);
    expect(introStateAt(INTRO_TOTAL_SEC + 1)).toBe('complete');
  });

  it('6. starting unit count is unchanged after skip (reveal only flips visibility)', () => {
    const units = [{ visible: false }, { visible: false }, { visible: false }];
    const before = units.length;
    const c = new DeploymentIntroController({
      onReveal: () => units.forEach((u) => (u.visible = true)),
    });
    c.skip();
    expect(units.length).toBe(before); // no spawn, no removal
    expect(units.every((u) => u.visible)).toBe(true);
  });

  it('7. starting unit count is unchanged after natural completion', () => {
    const units = [{ visible: false }, { visible: false }, { visible: false }];
    const before = units.length;
    let reveals = 0;
    const c = new DeploymentIntroController({
      onReveal: () => {
        reveals++;
        units.forEach((u) => (u.visible = true));
      },
    });
    for (let i = 0; i < 200; i++) c.update(0.05);
    expect(units.length).toBe(before);
    expect(units.every((u) => u.visible)).toBe(true);
    expect(reveals).toBe(1); // 9. no duplicate reveal → no duplicate units
  });

  it('9. the controller never spawns/duplicates units (no spawn capability, reveal fires once)', () => {
    const units = [{ id: 'fabricator' }, { id: 'lancer' }, { id: 'lancer' }];
    const snapshot = [...units];
    let reveals = 0;
    const c = new DeploymentIntroController({ onReveal: () => reveals++ });
    for (let i = 0; i < 50; i++) c.update(0.2);
    c.skip(); // late skip after completion is a no-op
    expect(units).toEqual(snapshot); // same references, same count
    expect(reveals).toBe(1);
  });
});

describe('createSkipListeners', () => {
  function fakeTarget() {
    const handlers: Record<string, ((e: unknown) => void)[]> = {};
    let adds = 0;
    let removes = 0;
    const target: ListenerTarget = {
      addEventListener(type, fn) {
        adds++;
        (handlers[type] ??= []).push(fn);
      },
      removeEventListener(type, fn) {
        removes++;
        handlers[type] = (handlers[type] ?? []).filter((h) => h !== fn);
      },
    };
    const fire = (type: string, e: unknown) => (handlers[type] ?? []).forEach((h) => h(e));
    return { target, fire, counts: () => ({ adds, removes }), handlers };
  }

  it('8. listeners are registered and cleaned up exactly once', () => {
    const { target, counts } = fakeTarget();
    const dispose = createSkipListeners(target, () => {});
    expect(counts().adds).toBe(2); // keydown + pointerdown
    dispose();
    expect(counts().removes).toBe(2);
    dispose(); // idempotent
    expect(counts().removes).toBe(2);
  });

  it('skips on Space, Escape and pointer-down', () => {
    const { target, fire } = fakeTarget();
    const onSkip = vi.fn();
    const dispose = createSkipListeners(target, onSkip);
    fire('keydown', { key: ' ' });
    fire('keydown', { key: 'Escape' });
    fire('keydown', { key: 'a' }); // ignored
    fire('pointerdown', {});
    expect(onSkip).toHaveBeenCalledTimes(3);
    dispose();
    fire('keydown', { key: ' ' }); // after dispose: nothing fires
    expect(onSkip).toHaveBeenCalledTimes(3);
  });
});
