// Imports a portable studio bundle into the game: validates geometry.json,
// plans copies (spec -> src/vehicles/specs, textures -> public/assets) and a
// status flip, then applies them. Pure `planImport` is unit-tested; `applyImport`
// does the filesystem writes. CLI wrapper: scripts/import-vehicle.mjs.
import { readFileSync, existsSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { validateSpec } from '../src/vehicles/spec/validate';
import type { VehicleSpec } from '../src/vehicles/spec/vehicleSpec';

const CLASS_SNAKE: Record<string, string> = {
  harvester: 'harvester', builder: 'builder', scout: 'scout', lightAttack: 'light_attack',
  mediumTank: 'medium_tank', heavyTank: 'heavy_tank', antiAir: 'anti_air', support: 'support',
};

export interface CustomClassDef {
  id: string; displayName: string; role: string; tilesWide: number;
  subject?: string; techTier?: number; movementType?: string;
}

export interface ImportPlan {
  ok: boolean;
  errors: string[];
  faction: string;
  classId: string;
  statusId: string;
  classDef?: CustomClassDef;   // present when importing a studio-authored custom class
  actions: { copy: { from: string; to: string }[]; statusFlip: { id: string; to: string } };
}

const fail = (msg: string): ImportPlan => ({
  ok: false, errors: [msg], faction: '', classId: '', statusId: '',
  actions: { copy: [], statusFlip: { id: '', to: '' } },
});

const BUILTIN_CLASSES = new Set(Object.keys(CLASS_SNAKE));

/** Pure: validate the bundle and compute exact destinations. No writes. */
export function planImport(bundleDir: string): ImportPlan {
  const geomPath = join(bundleDir, 'geometry.json');
  if (!existsSync(geomPath)) return fail(`missing geometry.json in ${bundleDir}`);
  let spec: VehicleSpec;
  try { spec = JSON.parse(readFileSync(geomPath, 'utf8')); }
  catch (e) { return fail(`geometry.json is not valid JSON: ${(e as Error).message}`); }
  const v = validateSpec(spec);
  if (!v.ok) return { ...fail('invalid vehicle-spec'), errors: v.errors };

  const { faction, vehicleClass: classId } = spec;
  const snake = CLASS_SNAKE[classId] ?? classId;
  const id = `${faction}_${classId}`;
  const copy = [{ from: geomPath, to: `src/vehicles/specs/${faction}/${classId}.json` }];
  for (const tex of ['baseColor.png', 'emissive.png']) {
    const p = join(bundleDir, tex);
    if (existsSync(p)) copy.push({ from: p, to: `public/assets/vehicles/${faction}/${snake}/${tex}` });
  }

  // A custom (non-built-in) class carries its definition in meta.json so the game
  // can register it as a static unit.
  let classDef: CustomClassDef | undefined;
  if (!BUILTIN_CLASSES.has(classId)) {
    const metaPath = join(bundleDir, 'meta.json');
    if (existsSync(metaPath)) {
      try { classDef = JSON.parse(readFileSync(metaPath, 'utf8')).classDef; } catch { /* ignore */ }
    }
    if (!classDef) classDef = { id: classId, displayName: classId, role: 'attackVehicle', tilesWide: 3 };
  }

  return { ok: true, errors: [], faction, classId, statusId: id, classDef,
    actions: { copy, statusFlip: { id, to: 'generated' } } };
}

/** Applies a valid plan: copies files + merges importedStatus.json. */
export function applyImport(plan: ImportPlan, repoRoot = '.'): void {
  if (!plan.ok) throw new Error(`cannot apply invalid plan: ${plan.errors.join('; ')}`);
  for (const { from, to } of plan.actions.copy) {
    const dest = resolve(repoRoot, to);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(from, dest);
  }
  const sp = resolve(repoRoot, 'src/data/importedStatus.json');
  mkdirSync(dirname(sp), { recursive: true });
  const cur = existsSync(sp) ? JSON.parse(readFileSync(sp, 'utf8')) : {};
  cur[plan.actions.statusFlip.id] = plan.actions.statusFlip.to;
  writeFileSync(sp, JSON.stringify(cur, null, 2) + '\n');

  // Register a custom class (idempotent: replace by id) so it gets a balance
  // template + codex entry on next build.
  if (plan.classDef) {
    const cp = resolve(repoRoot, 'src/data/customClasses.json');
    const list: CustomClassDef[] = existsSync(cp) ? JSON.parse(readFileSync(cp, 'utf8')) : [];
    const i = list.findIndex((c) => c.id === plan.classDef!.id);
    if (i >= 0) list[i] = plan.classDef; else list.push(plan.classDef);
    writeFileSync(cp, JSON.stringify(list, null, 2) + '\n');
  }
}
