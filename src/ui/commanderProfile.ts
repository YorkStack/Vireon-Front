// First-launch Commander Profile UI flow (LOCAL, offline-only — no login, no
// network). Thin UI over the tested LocalStorageCommanderProfileStore: it creates
// and reads the profile through the store only — no direct localStorage access,
// no second profile model. Pure controller helpers are split out so they can be
// unit-tested with an injected in-memory store (the DOM render fns are browser-
// smoke-verified instead).
import { LocalStorageCommanderProfileStore, type CommanderProfileStore } from '../platform/profile/CommanderProfileStore';
import type { CommanderProfile } from '../platform/profile/types';
import { downloadCurrentSavegame, pickAndImportSavegame } from './savegameUi';

/** Default store used by the game (browser localStorage). Tests inject their own. */
export const profileStore: CommanderProfileStore = new LocalStorageCommanderProfileStore();

const MAX_NAME_LEN = 24; // aligns with the store's normalizeCommanderName

// ── Pure controller helpers (unit-tested) ───────────────────────────────────

export interface NameValidation { ok: boolean; name: string; error?: string }

/** Trim + clamp to 24; empty/whitespace → not ok with an inline error message. */
export function validateCommanderName(raw: string): NameValidation {
  const trimmed = (raw ?? '').trim().slice(0, MAX_NAME_LEN);
  if (!trimmed) return { ok: false, name: '', error: 'Bitte einen Commander-Namen eingeben.' };
  return { ok: true, name: trimmed };
}

export function currentCommander(store: CommanderProfileStore = profileStore): CommanderProfile | null {
  return store.getProfile();
}

/** Create a profile from a raw name; returns null (no write) if the name is invalid. */
export function createCommander(raw: string, store: CommanderProfileStore = profileStore): CommanderProfile | null {
  const v = validateCommanderName(raw);
  if (!v.ok) return null;
  return store.createProfile(v.name);
}

/** Rename; returns false (no write) for an invalid name. Progress/scores untouched. */
export function renameCommander(raw: string, store: CommanderProfileStore = profileStore): boolean {
  const v = validateCommanderName(raw);
  if (!v.ok) return false;
  store.renameCommander(v.name);
  return true;
}

/** Delete ONLY the commander profile key (scores/progress untouched by this store). */
export function deleteCommander(store: CommanderProfileStore = profileStore): void {
  store.deleteProfile();
}

// ── DOM helpers (browser-smoke-verified) ────────────────────────────────────

const root = () => document.getElementById('ui-root')!;
function el(html: string): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

/**
 * First-launch screen: ask for a Commander name, create the local profile, resolve.
 * Shown only when no profile exists yet. No password, no email, no network.
 */
export function showFirstLaunchScreen(store: CommanderProfileStore = profileStore): Promise<CommanderProfile> {
  return new Promise<CommanderProfile>((resolve) => {
    const screen = el(`
      <div class="screen cinematic">
        <div class="subtitle">Vireon Front</div>
        <h1>Welcome Commander</h1>
        <h2 style="letter-spacing:6px;">COMMANDER PROFILE</h2>
        <div class="menu-box tac-panel" style="max-width:480px;margin:0 auto;">
          <div class="menu-head">ENTER COMMANDER NAME</div>
          <input id="cmdr-name" type="text" maxlength="${MAX_NAME_LEN}" autocomplete="off"
            placeholder="Commander"
            style="width:100%;margin-top:10px;padding:11px 12px;border-radius:6px;border:1px solid #2c2f3d;
                   background:#23252f;color:#e7e8ee;font-size:16px;letter-spacing:1px;text-align:center;" />
          <div id="cmdr-err" style="color:#ff7a7a;font-size:12px;min-height:16px;margin-top:6px;text-align:center;"></div>
          <div class="menu-sub" style="margin-top:2px;text-align:center;">Lokales Profil im Browser · kein Login, kein Konto.</div>
        </div>
        <div class="screen-cta" style="margin-top:16px;">
          <button class="primary" id="cmdr-start" style="font-size:18px;padding:13px 52px;letter-spacing:3px;">⬢ START GAME</button>
          <button id="cmdr-import-first" style="padding:12px 24px;letter-spacing:1px;">Savegame importieren</button>
        </div>
        <div id="cmdr-first-msg" style="font-size:12px;min-height:16px;margin-top:8px;text-align:center;color:#ff7a7a;"></div>
      </div>
    `);
    root().appendChild(screen);

    const input = screen.querySelector('#cmdr-name') as HTMLInputElement;
    const err = screen.querySelector('#cmdr-err') as HTMLElement;
    // Restore-without-profile path: import a previously exported savegame, then
    // reload so the restored commander flows straight into the start screen.
    screen.querySelector('#cmdr-import-first')!.addEventListener('click', () => {
      pickAndImportSavegame((r) => {
        const msg = screen.querySelector('#cmdr-first-msg') as HTMLElement;
        if (r.ok) {
          msg.style.color = '#7ad19a'; msg.textContent = 'Savegame importiert — lädt neu …';
          if (typeof location !== 'undefined') location.reload();
        } else {
          msg.style.color = '#ff7a7a'; msg.textContent = `Import fehlgeschlagen: ${r.error}`;
        }
      });
    });
    const submit = () => {
      const v = validateCommanderName(input.value);
      if (!v.ok) { err.textContent = v.error ?? 'Ungültiger Name.'; input.focus(); return; }
      const profile = store.createProfile(v.name);
      screen.remove();
      resolve(profile);
    };
    screen.querySelector('#cmdr-start')!.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') submit(); });
    input.addEventListener('input', () => { err.textContent = ''; });
    setTimeout(() => input.focus(), 0);
  });
}

/** Resolve the active commander, showing the first-launch screen only if none exists. */
export async function ensureCommanderProfile(store: CommanderProfileStore = profileStore): Promise<CommanderProfile> {
  const existing = store.getProfile();
  if (existing) return existing;
  return showFirstLaunchScreen(store);
}

/**
 * A small "Continue as <Commander>" banner with Rename / Delete actions, for the
 * start screen. `onAfterChange` re-renders the host after a rename. Delete clears
 * the profile and reloads (→ first-launch on next boot), preserving query params.
 */
export function buildCommanderBanner(onAfterChange: () => void, store: CommanderProfileStore = profileStore): HTMLElement {
  const profile = store.getProfile();
  const name = profile?.displayName ?? 'Commander';
  const box = el(`
    <div class="menu-box tac-panel" id="cmdr-banner" style="max-width:520px;margin:0 auto 10px;">
      <div class="menu-head">WEITER ALS COMMANDER</div>
      <div style="display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;margin-top:4px;">
        <span id="cmdr-banner-name" style="font-size:17px;font-weight:700;letter-spacing:1px;">${escapeHtml(name)}</span>
        <button id="cmdr-rename" style="padding:6px 12px;">Umbenennen</button>
        <button id="cmdr-delete" style="padding:6px 12px;">Profil löschen</button>
      </div>
      <div style="display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:8px;">
        <button id="cmdr-export" style="padding:6px 12px;">Export Savegame</button>
        <button id="cmdr-import" style="padding:6px 12px;">Import Savegame</button>
      </div>
      <div id="cmdr-savegame-msg" style="font-size:12px;min-height:16px;margin-top:6px;text-align:center;color:#9aa0b0;"></div>
    </div>
  `);

  const setSaveMsg = (text: string, isError: boolean) => {
    const m = box.querySelector('#cmdr-savegame-msg') as HTMLElement | null;
    if (m) { m.textContent = text; m.style.color = isError ? '#ff7a7a' : '#7ad19a'; }
  };

  box.querySelector('#cmdr-export')!.addEventListener('click', () => {
    try { downloadCurrentSavegame(); setSaveMsg('Savegame exportiert — Download gestartet.', false); }
    catch { setSaveMsg('Export fehlgeschlagen.', true); }
  });

  box.querySelector('#cmdr-import')!.addEventListener('click', () => {
    pickAndImportSavegame((r) => {
      if (r.ok) {
        setSaveMsg('Savegame importiert — lädt neu …', false);
        if (typeof location !== 'undefined') location.reload();
      } else {
        setSaveMsg(`Import fehlgeschlagen: ${r.error}`, true);
      }
    });
  });

  box.querySelector('#cmdr-rename')!.addEventListener('click', () => {
    const row = box.querySelector('#cmdr-banner-name')!.parentElement!;
    row.innerHTML = `
      <input id="cmdr-rename-input" type="text" maxlength="${MAX_NAME_LEN}" value="${escapeHtml(name)}"
        style="padding:7px 10px;border-radius:6px;border:1px solid #2c2f3d;background:#23252f;color:#e7e8ee;text-align:center;" />
      <button id="cmdr-rename-save" class="primary" style="padding:6px 14px;">Speichern</button>
      <button id="cmdr-rename-cancel" style="padding:6px 12px;">Abbrechen</button>`;
    const inp = row.querySelector('#cmdr-rename-input') as HTMLInputElement;
    inp.focus();
    row.querySelector('#cmdr-rename-save')!.addEventListener('click', () => {
      if (renameCommander(inp.value, store)) onAfterChange();
    });
    row.querySelector('#cmdr-rename-cancel')!.addEventListener('click', onAfterChange);
    inp.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') { if (renameCommander(inp.value, store)) onAfterChange(); } });
  });

  box.querySelector('#cmdr-delete')!.addEventListener('click', () => {
    const ok = typeof confirm === 'function' ? confirm('Lokales Commander-Profil löschen? (Scores/Fortschritt bleiben separat erhalten.)') : true;
    if (!ok) return;
    deleteCommander(store);
    if (typeof location !== 'undefined') location.reload();
  });

  return box;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
