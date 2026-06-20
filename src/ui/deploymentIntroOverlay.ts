// Small, non-blocking skip prompt for the deployment intro. A compact bottom-centre
// label plus a "Überspringen" button. Skips on Space / Escape / mouse-click / the
// button — all routed through the unit-tested createSkipListeners so nothing leaks
// past the intro. Returns a handle whose dispose() removes the DOM + all listeners.
import { createSkipListeners } from '../core/deploymentIntro';

export interface DeploymentIntroOverlayHandle {
  dispose(): void;
}

/** Show the skip prompt. `onSkip` fires at most once per user action; safe to call again. */
export function showDeploymentIntroOverlay(onSkip: () => void): DeploymentIntroOverlayHandle {
  const root = document.getElementById('ui-root');
  const el = document.createElement('div');
  el.className = 'deploy-intro';
  el.innerHTML = `
    <span class="di-label">Anlandung läuft</span>
    <button class="di-skip" type="button">Überspringen <kbd>Leertaste</kbd></button>
  `;
  root?.appendChild(el);

  let disposed = false;
  // Space / Escape (keydown on window) + any pointer-down anywhere.
  const disposeKeys = createSkipListeners(window, () => onSkip());
  const skipBtn = el.querySelector('.di-skip') as HTMLButtonElement | null;
  const onBtn = (e: Event) => {
    e.stopPropagation();
    onSkip();
  };
  skipBtn?.addEventListener('click', onBtn);

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      disposeKeys();
      skipBtn?.removeEventListener('click', onBtn);
      el.remove();
    },
  };
}
