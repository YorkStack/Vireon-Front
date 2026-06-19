// Browser glue for local savegame export/import. No packages, no network: a Blob +
// object URL for download, a transient <input type="file"> for upload. The pure
// build/parse/import logic lives in src/platform/savegame; this file is only the
// DOM plumbing (browser-smoke-verified). `savegameFilename` is unit-tested.
import { buildLocalSavegameExport, serializeLocalSavegame } from '../platform/savegame/exportSavegame';
import { importLocalSavegame } from '../platform/savegame/importSavegame';
import type { ImportSavegameResult } from '../platform/savegame/types';
import { nowIso } from '../platform/storage/id';

/** `vireon-savegame-YYYY-MM-DD.json` from an ISO timestamp (date portion only). */
export function savegameFilename(iso: string = nowIso()): string {
  const day = (iso || '').slice(0, 10);
  return `vireon-savegame-${day || 'export'}.json`;
}

/** Build + serialize the current local savegame and trigger a browser download. */
export function downloadCurrentSavegame(): void {
  const savegame = buildLocalSavegameExport();
  const json = serializeLocalSavegame(savegame);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = savegameFilename(savegame.exportedAt);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Open a file picker, read the chosen JSON, confirm (it overwrites local data),
 * import it, and report through `onResult`. Cancelling the picker or the confirm
 * is a silent no-op. Read/parse errors arrive as `{ ok: false }` — never thrown.
 */
export function pickAndImportSavegame(onResult: (r: ImportSavegameResult) => void): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.style.display = 'none';
  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    input.remove();
    if (!file) return; // picker cancelled
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const ok = typeof confirm === 'function'
        ? confirm('Savegame importieren? Lokale Daten (Profil, Scores, Fortschritt, Einstellungen) werden überschrieben.')
        : true;
      if (!ok) return; // user declined the overwrite
      onResult(importLocalSavegame(text));
    };
    reader.onerror = () => onResult({ ok: false, error: 'Datei konnte nicht gelesen werden.' });
    reader.readAsText(file);
  });
  document.body.appendChild(input);
  input.click();
}
