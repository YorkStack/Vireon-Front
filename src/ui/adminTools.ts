// Admin / Tools menu (start screen). One compact entry point so the start screen
// stays clean: player-facing Performance Mode selection + a few developer/diagnostic
// links. A fixed overlay → it never grows the start-screen height. Closable via the
// ✕ button, a backdrop click, or Escape. Read-only/settings-only — no gameplay,
// balance, AI, or render-asset change.
import {
  currentPerformanceSettings, savePerformanceMode, performanceModeOptions, hasPerfQueryOverride,
  type PerformanceMode,
} from '../core/performanceSettings';
import { LocalStorageSettingsStore } from '../platform/profile/LocalGameSettingsStore';

const root = () => document.getElementById('ui-root')!;
function el(html: string): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

/** Reload preserving existing query params, setting/removing the given ones. */
function reloadWith(params: Record<string, string | null>): void {
  if (typeof window === 'undefined') return;
  const u = new URL(window.location.href);
  for (const [k, v] of Object.entries(params)) {
    if (v === null) u.searchParams.delete(k);
    else u.searchParams.set(k, v);
  }
  window.location.href = u.toString();
}

/** Open the Admin / Tools overlay. */
export function showAdminTools(): void {
  const store = new LocalStorageSettingsStore();
  const queryOverride = typeof window !== 'undefined' && hasPerfQueryOverride(window.location.search);

  const overlay = el(`
    <div class="tools-overlay">
      <div class="tools-modal tac-panel">
        <div class="tm-head">
          <h3>⚙ Admin / Tools</h3>
          <button class="tm-close" type="button" aria-label="Schließen">✕</button>
        </div>

        <div class="tm-h">Performance</div>
        <div class="tm-modes" id="tm-modes"></div>
        <div class="tm-effective" id="tm-effective"></div>
        <div class="tm-note" id="tm-note" style="display:none;"></div>
        ${queryOverride ? `<div class="tm-warn">Query-Parameter (<code>?fps=</code>/<code>?perfMode=</code>) überschreiben aktuell die gespeicherte Einstellung.</div>` : ''}

        <div class="tm-h">Diagnostics</div>
        <div class="tm-row">Performance-Overlay: hänge <code>?perf=1</code> an die URL.</div>
        <button class="tm-link" id="tm-perf">Mit Perf-Overlay neu laden (?perf=1)</button>

        <div class="tm-h">Developer / Tools</div>
        <a class="tm-link" href="/building_textured_test.html" target="_blank" rel="noopener">Textured-Buildings-Viewer öffnen ↗</a>
        <button class="tm-link" id="tm-tex">Spiel mit Textured Buildings (?buildings=textured)</button>
        <button class="tm-link" id="tm-cur">Standard-Gebäude (?buildings=current)</button>
        <div class="tm-row tm-dim">Balance-Panel: <b>F8</b> im laufenden Spiel drücken.</div>
      </div>
    </div>
  `);

  // --- Performance mode buttons ---
  const modesHost = overlay.querySelector('#tm-modes') as HTMLElement;
  const effective = overlay.querySelector('#tm-effective') as HTMLElement;
  const note = overlay.querySelector('#tm-note') as HTMLElement;

  const renderEffective = () => {
    const eff = currentPerformanceSettings(store);
    effective.textContent = `Effektiv jetzt: ${eff.mode} · ${eff.fpsCap} FPS`;
  };
  const renderSelected = () => {
    const saved = store.getSettings().performanceMode ?? 'balanced';
    modesHost.querySelectorAll('.tm-mode').forEach((b) => {
      b.classList.toggle('selected', (b as HTMLElement).dataset.mode === saved);
    });
  };

  for (const opt of performanceModeOptions()) {
    const btn = el(`
      <button class="tm-mode" data-mode="${opt.mode}" type="button">
        <span class="tm-mode-name">${opt.label}${opt.recommended ? ' <em>· empfohlen</em>' : ''}</span>
        <span class="tm-mode-fps">${opt.fpsCap} FPS</span>
      </button>
    `);
    btn.addEventListener('click', () => {
      savePerformanceMode(opt.mode as PerformanceMode, store);
      renderSelected();
      renderEffective();
      note.style.display = '';
      note.textContent = queryOverride
        ? 'Gespeichert. Hinweis: Aktiver Query-Parameter überschreibt das Gespeicherte bis zum Entfernen.'
        : 'Gespeichert — gilt ab dem nächsten Match / Reload.';
    });
    modesHost.appendChild(btn);
  }
  renderSelected();
  renderEffective();

  // --- Diagnostics + developer reload links ---
  overlay.querySelector('#tm-perf')!.addEventListener('click', () => reloadWith({ perf: '1' }));
  overlay.querySelector('#tm-tex')!.addEventListener('click', () => reloadWith({ buildings: 'textured' }));
  overlay.querySelector('#tm-cur')!.addEventListener('click', () => reloadWith({ buildings: 'current' }));

  // --- Close behaviour ---
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('.tm-close')!.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  root().appendChild(overlay);
}
