// ─────────────────────────────────────────────────────────────────────────
// F8 Admin / Balancing Panel — a DEV-ONLY tool (not a player feature).
//
// Governance rule (strict): ONLY genuinely live-wirksame faction modifiers may
// be edited here. Prepared and legacy-backed values are shown read-only with a
// clear label so nobody mistakes them for tunable. The single source of truth
// for "what is editable" is getAdminEditableFactionModifierPaths() — this panel
// never hard-codes its own editable list beyond the slider RANGES.
//
// Live edits flow through setFactionModifierOverrides(); world.ts reads the
// registry every frame via getPowerOutageEffects/getEconomyModifiers/
// getModifiedRepairRate, so an override takes effect on the next relevant
// simulation calculation — no entity rebuild needed.
// ─────────────────────────────────────────────────────────────────────────
import {
  FACTION_MODIFIERS, setFactionModifierOverrides, getFactionModifiers,
  getAdminEditableFactionModifierPaths, getPreparedButNotLiveModifierPaths,
  getLegacyBackedModifierPaths, getModifierMetadata, calculateFactionPowerScore,
  type FactionId, type FactionModifiers,
} from '../data/factionModifiers';
import { DOCTRINES_BY_FACTION, DEFAULT_DOCTRINE_BY_FACTION, doctrineById } from '../data/doctrines';

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };
type FactionOverrides = Partial<Record<FactionId, DeepPartial<FactionModifiers>>>;

export const TUNING_STORAGE_KEY = 'rts.balanceTuning.v1';
export const TUNING_PROFILE_VERSION = 1;

export interface BalancingTuningProfile {
  version: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  factionModifierOverrides: FactionOverrides;
}

export const FACTION_IDS: FactionId[] = ['red', 'blue', 'green', 'yellow'];
export const FACTION_LABELS: Record<FactionId, string> = {
  red: 'Crimson Pact', blue: 'Azure Concorde', green: 'Verdant Swarm', yellow: 'Solar Dominion',
};

// Sensible editing ranges for the six LIVE modifiers (per spec). The keys MUST
// be a superset of getAdminEditableFactionModifierPaths(); any editable path
// without a range here is treated as not-editable (fails safe).
export const SLIDER_RANGES: Record<string, { min: number; max: number; step: number }> = {
  'power.powerOutageSeverity': { min: 0.1, max: 2.0, step: 0.05 },
  'power.lowPowerProductionPenalty': { min: 0.1, max: 1.0, step: 0.01 },
  'power.lowPowerDefensePenalty': { min: 0.1, max: 1.0, step: 0.01 },
  'power.lowPowerRepairPenalty': { min: 0.1, max: 1.0, step: 0.01 },
  'economy.resourceGatherRate': { min: 0.5, max: 1.5, step: 0.01 },
  'repair.repairRate': { min: 0.3, max: 1.8, step: 0.01 },
  // Phase 4a — migrated economy/power cost dimensions (now live & editable):
  'economy.unitCost': { min: 0.5, max: 2.0, step: 0.05 },
  'economy.infantryCost': { min: 0.5, max: 2.0, step: 0.05 },
  'economy.vehicleCost': { min: 0.5, max: 2.0, step: 0.05 },
  'economy.buildingCost': { min: 0.5, max: 2.0, step: 0.05 },
  'power.powerUsage': { min: 0.5, max: 2.0, step: 0.05 },
  // Phase 4a.2 — build-time multiplier (higher = SLOWER):
  'production.buildTimeMultiplier': { min: 0.5, max: 2.0, step: 0.05 },
  // Phase 4b.1 — damage (multiplicative) + turret range (ADDITIVE, integer tiles):
  'combat.vehicleDamage': { min: 0.5, max: 2.0, step: 0.05 },
  'combat.energyWeaponDamage': { min: 0.5, max: 2.0, step: 0.05 },
  'defense.turretRangeBonus': { min: 0, max: 5, step: 1 },
};

// Short semantic hints shown inline next to a slider so the direction is
// unambiguous (especially where higher ≠ "better").
export const PATH_HINTS: Record<string, string> = {
  'production.buildTimeMultiplier': '↑ = langsamer',
  'power.powerUsage': '↑ = mehr Verbrauch',
  'economy.vehicleCost': '↑ = teurer',
  'economy.infantryCost': '↑ = teurer',
  'economy.unitCost': '↑ = teurer',
  'economy.buildingCost': '↑ = teurer',
  'power.powerOutageSeverity': '↑ = härtere Strafe',
  'economy.resourceGatherRate': '↑ = mehr Ertrag',
  'repair.repairRate': '↑ = schneller',
  'combat.vehicleDamage': '↑ = mehr Schaden',
  'combat.energyWeaponDamage': '↑ = mehr Schaden',
  'defense.turretRangeBonus': 'additiv: +Reichweite (Felder)',
};

// ── Editable-path governance ─────────────────────────────────────────────────
/** The live, admin-editable modifier paths — derived from the registry metadata. */
export function editablePaths(): string[] {
  return getAdminEditableFactionModifierPaths()
    .map((m) => m.path)
    .filter((p) => p in SLIDER_RANGES);
}
export function isEditablePath(path: string): boolean {
  return editablePaths().includes(path);
}

function isFactionId(x: string): x is FactionId {
  return (FACTION_IDS as string[]).includes(x);
}
function getPath(obj: FactionModifiers, path: string): number | undefined {
  const [g, k] = path.split('.');
  const grp = (obj as unknown as Record<string, Record<string, number>>)[g];
  return grp ? grp[k] : undefined;
}
function setPath(obj: Record<string, any>, path: string, value: number): void {
  const [g, k] = path.split('.');
  if (!obj[g]) obj[g] = {};
  obj[g][k] = value;
}
function clampToRange(path: string, value: number): number {
  const r = SLIDER_RANGES[path];
  if (!r) return value;
  return Math.max(r.min, Math.min(r.max, value));
}

// ── Override state (single source of truth for the live registry) ────────────
let currentOverrides: FactionOverrides = {};

function applyOverrides(): void {
  // deepMerge in the registry handles deep-partial shapes at runtime.
  setFactionModifierOverrides(currentOverrides as unknown as Partial<Record<FactionId, Partial<FactionModifiers>>>);
}

export function getCurrentOverrides(): FactionOverrides {
  return currentOverrides;
}

/** Is there an active override for this faction+path? */
export function hasOverride(faction: FactionId, path: string): boolean {
  const f = currentOverrides[faction];
  if (!f) return false;
  const [g, k] = path.split('.');
  const grp = (f as Record<string, Record<string, number>>)[g];
  return !!grp && grp[k] !== undefined;
}

/** Set one live override value (clamped to its slider range) and apply immediately. */
export function setOverrideValue(faction: FactionId, path: string, value: number): number {
  if (!isFactionId(faction) || !isEditablePath(path) || !Number.isFinite(value)) return NaN;
  const clamped = clampToRange(path, value);
  if (!currentOverrides[faction]) currentOverrides[faction] = {};
  setPath(currentOverrides[faction] as Record<string, any>, path, clamped);
  applyOverrides();
  return clamped;
}

/** Remove a single override (revert that value to its faction default). */
export function clearOverrideValue(faction: FactionId, path: string): void {
  const f = currentOverrides[faction] as Record<string, any> | undefined;
  if (!f) return;
  const [g, k] = path.split('.');
  if (f[g]) {
    delete f[g][k];
    if (Object.keys(f[g]).length === 0) delete f[g];
  }
  if (Object.keys(f).length === 0) delete currentOverrides[faction];
  applyOverrides();
}

/** Reset everything: clears runtime overrides AND removes the persisted profile. */
export function resetTuning(): void {
  currentOverrides = {};
  applyOverrides();
  removeStorage();
}

// ── Import sanitisation (the security gate) ──────────────────────────────────
export interface SanitizeResult { overrides: FactionOverrides; warnings: string[] }

/**
 * Validate a raw overrides object against the live-editable allow-list. Only the
 * six live paths with finite numeric values survive (clamped to range). Prepared
 * and legacy-backed paths are REJECTED with a warning; unknown factions/paths are
 * reported too. This is what makes import safe.
 */
export function sanitizeOverrides(raw: unknown): SanitizeResult {
  const warnings: string[] = [];
  const out: FactionOverrides = {};
  if (!raw || typeof raw !== 'object') return { overrides: out, warnings: ['Overrides fehlen oder sind kein Objekt.'] };

  for (const [factionKey, factionVal] of Object.entries(raw as Record<string, unknown>)) {
    if (!isFactionId(factionKey)) { warnings.push(`Unbekannte Fraktion ignoriert: "${factionKey}".`); continue; }
    if (!factionVal || typeof factionVal !== 'object') { warnings.push(`Ungültige Daten für Fraktion "${factionKey}".`); continue; }

    for (const [groupKey, groupVal] of Object.entries(factionVal as Record<string, unknown>)) {
      if (!groupVal || typeof groupVal !== 'object') { warnings.push(`Ungültige Gruppe ignoriert: ${factionKey}.${groupKey}.`); continue; }
      for (const [leafKey, leafVal] of Object.entries(groupVal as Record<string, unknown>)) {
        const path = `${groupKey}.${leafKey}`;
        if (isEditablePath(path)) {
          if (typeof leafVal !== 'number' || !Number.isFinite(leafVal)) {
            warnings.push(`Nicht-numerischer Wert ignoriert: ${factionKey}.${path}.`); continue;
          }
          const clamped = clampToRange(path, leafVal);
          if (clamped !== leafVal) warnings.push(`${factionKey}.${path} auf gültigen Bereich begrenzt: ${leafVal} → ${clamped}.`);
          if (!out[factionKey]) out[factionKey] = {};
          setPath(out[factionKey] as Record<string, any>, path, clamped);
        } else {
          const meta = getModifierMetadata(path);
          if (meta?.status === 'prepared') warnings.push(`Abgelehnt (prepared, nicht live): ${factionKey}.${path}.`);
          else if (meta?.status === 'legacy_backed') warnings.push(`Abgelehnt (legacy-backed, Migration nötig): ${factionKey}.${path}.`);
          else warnings.push(`Abgelehnt (unbekannt/nicht editierbar): ${factionKey}.${path}.`);
        }
      }
    }
  }
  return { overrides: out, warnings };
}

/** Replace all overrides with a sanitised set and apply live. Returns warnings. */
export function applySanitizedOverrides(raw: unknown): string[] {
  const { overrides, warnings } = sanitizeOverrides(raw);
  currentOverrides = overrides;
  applyOverrides();
  return warnings;
}

// ── Profiles · localStorage · export/import ──────────────────────────────────
function nowIso(): string { return new Date().toISOString(); }

export function currentProfile(name = 'unnamed-tuning'): BalancingTuningProfile {
  const ts = nowIso();
  return {
    version: TUNING_PROFILE_VERSION, name, createdAt: ts, updatedAt: ts,
    factionModifierOverrides: JSON.parse(JSON.stringify(currentOverrides)),
  };
}

export interface ImportResult { ok: boolean; profile?: BalancingTuningProfile; warnings: string[] }

/** Parse + validate a tuning profile JSON string, sanitise its overrides, and apply live. */
export function importTuningJSON(json: string): ImportResult {
  let parsed: unknown;
  try { parsed = JSON.parse(json); }
  catch { return { ok: false, warnings: ['Ungültiges JSON.'] }; }
  if (!parsed || typeof parsed !== 'object') return { ok: false, warnings: ['Profil ist kein Objekt.'] };

  const p = parsed as Partial<BalancingTuningProfile>;
  const warnings: string[] = [];
  if (typeof p.version !== 'number') warnings.push('version fehlt — als v1 behandelt.');
  else if (p.version !== TUNING_PROFILE_VERSION) warnings.push(`Abweichende version ${p.version} (erwartet ${TUNING_PROFILE_VERSION}).`);

  const san = sanitizeOverrides(p.factionModifierOverrides);
  warnings.push(...san.warnings);
  currentOverrides = san.overrides;
  applyOverrides();

  const ts = nowIso();
  const profile: BalancingTuningProfile = {
    version: TUNING_PROFILE_VERSION,
    name: typeof p.name === 'string' ? p.name : 'imported-tuning',
    createdAt: typeof p.createdAt === 'string' ? p.createdAt : ts,
    updatedAt: ts,
    factionModifierOverrides: san.overrides,
  };
  return { ok: true, profile, warnings };
}

export function exportTuningJSON(name = 'tuning-export'): string {
  return JSON.stringify(currentProfile(name), null, 2);
}

function storage(): Storage | null {
  // Prefer window.localStorage (the DOM one). A bare `localStorage` global can
  // resolve to Node's experimental, throw-on-use stub under the test runner.
  try {
    const w = (globalThis as { window?: { localStorage?: Storage } }).window;
    if (w?.localStorage && typeof w.localStorage.getItem === 'function') return w.localStorage;
    const g = (globalThis as { localStorage?: Storage }).localStorage;
    if (g && typeof g.getItem === 'function') return g;
    return null;
  } catch { return null; }
}

export function saveToStorage(name = 'saved-tuning'): boolean {
  const s = storage();
  if (!s) return false;
  try { s.setItem(TUNING_STORAGE_KEY, exportTuningJSON(name)); return true; } catch { return false; }
}

export function loadFromStorage(): ImportResult | null {
  const s = storage();
  if (!s) return null;
  const raw = s.getItem(TUNING_STORAGE_KEY);
  if (!raw) return null;
  return importTuningJSON(raw);
}

export function removeStorage(): void {
  const s = storage();
  try { s?.removeItem(TUNING_STORAGE_KEY); } catch { /* ignore */ }
}

// ── DOM panel ────────────────────────────────────────────────────────────────
const STYLE_ID = 'rts-admin-style';
const ADMIN_CSS = `
#rts-admin{position:fixed;inset:0;z-index:9999;display:none;font:13px/1.45 ui-monospace,Menlo,Consolas,monospace;color:#dfe7ef;}
#rts-admin.open{display:block;}
#rts-admin .scrim{position:absolute;inset:0;background:rgba(4,8,14,.55);}
#rts-admin .sheet{position:absolute;top:0;right:0;bottom:0;width:min(560px,96vw);background:#0e1620;border-left:2px solid #2b6cb0;box-shadow:-8px 0 30px rgba(0,0,0,.5);overflow-y:auto;padding:14px 16px 40px;}
#rts-admin h2{margin:0 0 2px;font-size:15px;color:#7cc4ff;letter-spacing:.5px;}
#rts-admin .sub{color:#7d8aa0;font-size:11px;margin:0 0 12px;}
#rts-admin h3{margin:18px 0 6px;font-size:13px;color:#9ad27a;border-bottom:1px solid #233246;padding-bottom:3px;}
#rts-admin h4{margin:12px 0 4px;font-size:12px;color:#cbd6e4;}
#rts-admin .close{position:absolute;top:10px;right:14px;background:#23344a;border:1px solid #3a567a;color:#dfe7ef;border-radius:4px;cursor:pointer;padding:3px 9px;font:inherit;}
#rts-admin .row{display:flex;align-items:center;gap:8px;padding:3px 0;}
#rts-admin .row label{flex:0 0 210px;font-size:11px;color:#b9c6d6;}
#rts-admin .row input[type=range]{flex:1;}
#rts-admin .row .num{flex:0 0 58px;background:#0a1018;border:1px solid #2b3b52;color:#fff;border-radius:3px;padding:1px 4px;font:inherit;text-align:right;}
#rts-admin .row .def{flex:0 0 70px;color:#6b7a90;font-size:10px;}
#rts-admin .row.ovr label{color:#ffd27c;font-weight:600;}
#rts-admin .row .reset{background:none;border:none;color:#ff8c8c;cursor:pointer;font-size:13px;padding:0 2px;}
#rts-admin .ro{display:flex;gap:8px;padding:2px 0;font-size:11px;color:#90a0b6;border-bottom:1px dotted #1c2838;}
#rts-admin .ro .p{flex:0 0 230px;color:#aab6c6;}
#rts-admin .ro .v{flex:0 0 60px;text-align:right;color:#cfd9e6;}
#rts-admin .tag{font-size:9px;padding:1px 5px;border-radius:8px;text-transform:uppercase;letter-spacing:.4px;}
#rts-admin .tag.prepared{background:#3a2c10;color:#e0b863;}
#rts-admin .tag.legacy{background:#2c1530;color:#d28adf;}
#rts-admin .tag.live{background:#10331c;color:#7ee0a0;}
#rts-admin .score{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:6px 0;}
#rts-admin .score .card{background:#101b27;border:1px solid #213347;border-radius:5px;padding:6px;}
#rts-admin .score .card .n{font-size:12px;color:#7cc4ff;font-weight:600;}
#rts-admin .score .card .big{font-size:18px;color:#fff;}
#rts-admin .score .card .g{font-size:10px;color:#8290a6;}
#rts-admin .warn{background:#2a1410;border:1px solid #5a2a20;color:#ffb0a0;border-radius:4px;padding:5px 8px;margin:4px 0;font-size:11px;white-space:pre-wrap;}
#rts-admin .ok{color:#7ee0a0;font-size:11px;}
#rts-admin .bar{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0;}
#rts-admin button.act{background:#1b2d44;border:1px solid #335182;color:#cfe2ff;border-radius:4px;cursor:pointer;padding:4px 10px;font:inherit;font-size:11px;}
#rts-admin button.act:hover{background:#244065;}
#rts-admin textarea{width:100%;height:130px;background:#0a1018;border:1px solid #2b3b52;color:#cfe2ff;border-radius:4px;font:11px ui-monospace,monospace;padding:6px;box-sizing:border-box;}
#rts-admin .note{color:#7d8aa0;font-size:10px;margin:4px 0;}
`;

function ensureStyle(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const s = doc.createElement('style');
  s.id = STYLE_ID;
  s.textContent = ADMIN_CSS;
  doc.head.appendChild(s);
}

export interface AdminPanelHandle {
  root: HTMLElement;
  show(): void;
  hide(): void;
  toggle(): void;
  isOpen(): boolean;
  refresh(): void;
  destroy(): void;
}

/** Build the panel DOM (hidden). Self-contained — no game dependency. */
export function createAdminPanel(doc: Document = document): AdminPanelHandle {
  ensureStyle(doc);
  const root = doc.createElement('div');
  root.id = 'rts-admin';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Admin Balancing Panel');

  const scrim = doc.createElement('div');
  scrim.className = 'scrim';
  scrim.addEventListener('click', () => hide());
  const sheet = doc.createElement('div');
  sheet.className = 'sheet';
  root.append(scrim, sheet);

  const isOpen = () => root.classList.contains('open');
  const show = () => { root.classList.add('open'); refresh(); };
  const hide = () => { root.classList.remove('open'); };
  const toggle = () => { isOpen() ? hide() : show(); };

  function el(tag: string, cls?: string, text?: string): HTMLElement {
    const e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  let warnBox: HTMLElement | null = null;
  let overviewSlot: HTMLElement | null = null;
  function flashWarnings(ws: string[], okMsg?: string) {
    if (!warnBox) return;
    warnBox.innerHTML = '';
    if (ws.length) {
      const w = el('div', 'warn', `${ws.length} Hinweis(e):\n• ${ws.join('\n• ')}`);
      warnBox.appendChild(w);
    } else if (okMsg) {
      warnBox.appendChild(el('div', 'ok', okMsg));
    }
  }

  function refresh(): void {
    sheet.innerHTML = '';
    sheet.appendChild(buildClose());
    sheet.appendChild(el('h2', undefined, 'F8 · Admin / Balancing Panel'));
    sheet.appendChild(el('p', 'sub', 'Dev-Tool. Nur live-wirksame Modifier sind editierbar. Live-Werte greifen bei der nächsten relevanten Simulationsberechnung; bestehende Einheiten werden nicht rückwirkend neu berechnet.'));

    warnBox = el('div');
    sheet.appendChild(warnBox);

    sheet.appendChild(buildToolbar());
    overviewSlot = buildOverview();
    sheet.appendChild(overviewSlot);
    sheet.appendChild(buildLiveSection());
    sheet.appendChild(buildReadOnlySection('Prepared Modifiers', getPreparedButNotLiveModifierPaths().map(m => m.path), 'prepared', 'Prepared — noch nicht live integriert'));
    sheet.appendChild(buildReadOnlySection('Legacy-backed Modifiers', getLegacyBackedModifierPaths().map(m => m.path), 'legacy', 'Legacy-backed — live via factions.json/unitStats/buildingStats, Migration nötig'));
    sheet.appendChild(buildDoctrineOverview());
    sheet.appendChild(buildImportExport());
  }

  function buildClose(): HTMLElement {
    const b = el('button', 'close', '✕ Schließen (Esc)') as HTMLButtonElement;
    b.addEventListener('click', () => hide());
    return b;
  }

  function buildToolbar(): HTMLElement {
    const bar = el('div', 'bar');
    const mk = (label: string, fn: () => void) => { const b = el('button', 'act', label) as HTMLButtonElement; b.addEventListener('click', fn); return b; };
    bar.append(
      mk('↺ Reset', () => { resetTuning(); refresh(); flashWarnings([], 'Alle Overrides entfernt.'); }),
      mk('💾 Save', () => { const ok = saveToStorage('panel-save'); flashWarnings([], ok ? 'In localStorage gespeichert.' : 'Speichern fehlgeschlagen.'); }),
      mk('📂 Load', () => { const r = loadFromStorage(); refresh(); flashWarnings(r?.warnings ?? [], r ? 'Aus localStorage geladen.' : 'Kein gespeichertes Profil.'); }),
    );
    return bar;
  }

  function buildOverview(): HTMLElement {
    const wrap = el('div');
    wrap.appendChild(el('h3', undefined, 'Overview · Faction Power Scores'));
    wrap.appendChild(el('p', 'note', 'Power Score = Balancing-Hinweis, keine absolute Wahrheit. Reference ≈ 1.0.'));
    const grid = el('div', 'score');
    const allWarnings: string[] = [];
    for (const id of FACTION_IDS) {
      const s = calculateFactionPowerScore(id);
      allWarnings.push(...s.warnings);
      const card = el('div', 'card');
      card.appendChild(el('div', 'n', FACTION_LABELS[id]));
      card.appendChild(el('div', 'big', s.overallPowerScore.toFixed(2)));
      card.appendChild(el('div', 'g', `E ${s.earlyGamePower.toFixed(2)} · M ${s.midGamePower.toFixed(2)} · L ${s.lateGamePower.toFixed(2)}`));
      card.appendChild(el('div', 'g', `eco ${s.economyPower.toFixed(2)} · atk ${s.attackPower.toFixed(2)} · def ${s.defensePower.toFixed(2)} · tech ${s.techPower.toFixed(2)}`));
      card.appendChild(el('div', 'g', `pen: res ${s.resourcePenalty.toFixed(2)} · energy ${s.energyPenalty.toFixed(2)} · vuln ${s.vulnerabilityPenalty.toFixed(2)}`));
      grid.appendChild(card);
    }
    wrap.appendChild(grid);
    if (allWarnings.length) {
      for (const w of allWarnings) wrap.appendChild(el('div', 'warn', `⚠ ${w}`));
    } else {
      wrap.appendChild(el('div', 'ok', '✓ Keine Balancing-Warnungen.'));
    }
    return wrap;
  }

  function buildLiveSection(): HTMLElement {
    const wrap = el('div');
    wrap.appendChild(el('h3', undefined, 'Live Faction Modifiers (editierbar)'));
    const paths = editablePaths();
    for (const id of FACTION_IDS) {
      wrap.appendChild(el('h4', undefined, `${FACTION_LABELS[id]} (${id})`));
      for (const path of paths) {
        wrap.appendChild(buildLiveRow(id, path));
      }
    }
    return wrap;
  }

  function buildLiveRow(id: FactionId, path: string): HTMLElement {
    const range = SLIDER_RANGES[path];
    const meta = getModifierMetadata(path);
    const def = getPath(FACTION_MODIFIERS[id], path) ?? 0;
    const live = getPath(getFactionModifiers(id), path) ?? def;

    const row = el('div', 'row');
    row.dataset.path = path;
    row.dataset.faction = id;
    const overridden = hasOverride(id, path);
    if (overridden) row.classList.add('ovr');

    const label = el('label');
    label.textContent = path;
    label.title = meta?.description ?? '';
    const slider = doc.createElement('input');
    slider.type = 'range';
    slider.min = String(range.min); slider.max = String(range.max); slider.step = String(range.step);
    slider.value = String(live);
    const num = doc.createElement('input');
    num.type = 'number'; num.className = 'num';
    num.min = String(range.min); num.max = String(range.max); num.step = String(range.step);
    num.value = String(round2(live));
    const hint = PATH_HINTS[path];
    const defSpan = el('span', 'def', hint ? `def ${round2(def)} · ${hint}` : `def ${round2(def)}`);
    const resetBtn = el('button', 'reset', '↺') as HTMLButtonElement;
    resetBtn.title = 'Auf Faction-Default zurücksetzen';

    const onInput = (v: number) => {
      const clamped = setOverrideValue(id, path, v);
      slider.value = String(clamped);
      num.value = String(round2(clamped));
      row.classList.add('ovr'); label.style.color = '';
      refreshOverviewOnly();
    };
    slider.addEventListener('input', () => onInput(parseFloat(slider.value)));
    num.addEventListener('change', () => onInput(parseFloat(num.value)));
    resetBtn.addEventListener('click', () => {
      clearOverrideValue(id, path);
      const d = getPath(FACTION_MODIFIERS[id], path) ?? 0;
      slider.value = String(d); num.value = String(round2(d));
      row.classList.remove('ovr');
      refreshOverviewOnly();
    });

    row.append(label, slider, num, defSpan, resetBtn);
    return row;
  }

  // Re-render only the overview grid (cheap) after a slider edit.
  function refreshOverviewOnly() {
    if (!overviewSlot || !overviewSlot.parentElement) return;
    const fresh = buildOverview();
    overviewSlot.parentElement.replaceChild(fresh, overviewSlot);
    overviewSlot = fresh;
  }

  function buildReadOnlySection(title: string, paths: string[], tagClass: string, labelText: string): HTMLElement {
    const wrap = el('div');
    const h = el('h3'); h.textContent = title;
    const tag = el('span', `tag ${tagClass}`, tagClass === 'prepared' ? 'prepared' : 'legacy-backed');
    tag.style.marginLeft = '8px';
    h.appendChild(tag);
    wrap.appendChild(h);
    wrap.appendChild(el('p', 'note', `${labelText} · read-only — im F8-Panel nicht editierbar.`));
    for (const path of paths) {
      const meta = getModifierMetadata(path);
      const ro = el('div', 'ro');
      ro.appendChild(el('span', 'p', path));
      // show the red faction's value as a representative reference
      const v = getPath(FACTION_MODIFIERS.red, path);
      ro.appendChild(el('span', 'v', v === undefined ? '—' : String(v)));
      ro.appendChild(el('span', undefined, meta?.description ?? ''));
      wrap.appendChild(ro);
    }
    return wrap;
  }

  function buildDoctrineOverview(): HTMLElement {
    const wrap = el('div');
    wrap.appendChild(el('h3', undefined, 'Doctrine / AI Overview (read-only)'));
    wrap.appendChild(el('p', 'note', 'Doctrine = KI-Persona-Variante. Hier nur zur Ansicht — nicht editierbar.'));
    for (const id of FACTION_IDS) {
      const defId = DEFAULT_DOCTRINE_BY_FACTION[id];
      const d = doctrineById(defId, id);
      const all = (DOCTRINES_BY_FACTION[id] ?? []).join(', ');
      const ro = el('div', 'ro');
      ro.appendChild(el('span', 'p', `${FACTION_LABELS[id]} · default`));
      ro.appendChild(el('span', 'v', d.uiName));
      const p = d.personality;
      ro.appendChild(el('span', undefined, `build ${p.buildAggression} · atk ${p.attackAggression} · def ${p.defensePriority} · timing ${d.preferredAttackTiming} · [${all}]`));
      wrap.appendChild(ro);
    }
    return wrap;
  }

  function buildImportExport(): HTMLElement {
    const wrap = el('div');
    wrap.appendChild(el('h3', undefined, 'Import / Export'));
    const ta = doc.createElement('textarea');
    ta.placeholder = 'Tuning-Profil JSON …';
    const bar = el('div', 'bar');
    const mk = (label: string, fn: () => void) => { const b = el('button', 'act', label) as HTMLButtonElement; b.addEventListener('click', fn); return b; };
    bar.append(
      mk('⬇ Export → Feld', () => { ta.value = exportTuningJSON('panel-export'); flashWarnings([], 'Exportiert (nur live Overrides).'); }),
      mk('⬆ Import ← Feld', () => {
        const r = importTuningJSON(ta.value);
        refresh();
        if (!r.ok) flashWarnings(r.warnings.length ? r.warnings : ['Import fehlgeschlagen.']);
        else flashWarnings(r.warnings, r.warnings.length ? undefined : 'Import übernommen (nur live Pfade).');
      }),
      mk('📋 Copy', async () => {
        ta.value = exportTuningJSON('panel-export');
        try { await navigator.clipboard?.writeText(ta.value); flashWarnings([], 'In Zwischenablage kopiert.'); }
        catch { flashWarnings([], 'Im Textfeld bereit (Clipboard nicht verfügbar).'); }
      }),
    );
    wrap.append(ta, bar);
    wrap.appendChild(el('p', 'note', 'Import-Sicherheit: nur die sechs live-editierbaren Pfade werden übernommen. Prepared/legacy-backed/unbekannte Pfade werden abgelehnt und als Hinweis gemeldet.'));
    return wrap;
  }

  function destroy(): void { root.remove(); }

  return { root, show, hide, toggle, isOpen, refresh, destroy };
}

function round2(n: number): number { return Math.round(n * 100) / 100; }

// ── Hotkey install (F8 toggle, ESC close) ────────────────────────────────────
let installed: AdminPanelHandle | null = null;

/** Create the panel, append to body, and wire the F8/ESC hotkeys. Idempotent. */
export function installAdminPanel(doc: Document = document): AdminPanelHandle {
  if (installed) return installed;
  const panel = createAdminPanel(doc);
  doc.body.appendChild(panel.root);

  // Restore any persisted tuning at startup (so dev edits survive reloads).
  loadFromStorage();

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'F8') { e.preventDefault(); panel.toggle(); return; }
    if (e.key === 'Escape' && panel.isOpen()) {
      // Close the panel and swallow ESC so it doesn't also open the pause menu.
      panel.hide();
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  };
  // capture phase + registered before the game's input listener → wins the ESC.
  (doc.defaultView ?? window).addEventListener('keydown', onKey, true);

  installed = panel;
  return panel;
}
