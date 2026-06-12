// Balance validation — proves that the same vehicle class is balance-equal
// across all four factions, and makes every intentional deviation visible.
//
//   npm run validate:balance          (CLI report)
//   validateBalance()                 (called in dev at startup, warns in console)
//
// Three kinds of differences:
//   VIOLATION   — stats differ with no declared reason  -> fix the data!
//   intentional — explicit variant balanceOverride (has a reason)
//   faction perk— global faction modifier from factions.json (by design)

import { FACTION_DEFS } from '../core/defs';
import { UNIT_CLASS_TEMPLATES, VEHICLE_CLASS_IDS } from '../data/unitClasses';
import { resolveUnit, templateToDef } from './unitFactory';
import { getVariant } from '../vehicles';
import type { UnitDef } from '../core/types';

/** Balance-critical stats compared across factions (per class). */
const CRITICAL_FIELDS: { key: string; get: (d: UnitDef) => number | null }[] = [
  { key: 'cost', get: d => d.cost },
  { key: 'buildTime', get: d => d.buildTime },
  { key: 'speed', get: d => d.speed },
  { key: 'maxHitPoints', get: d => d.hp },
  { key: 'damage', get: d => d.weapon?.damage ?? null },
  { key: 'range', get: d => d.weapon?.range ?? null },
  { key: 'fireRate', get: d => (d.weapon ? 1 / d.weapon.cooldown : null) },
  { key: 'cargoCapacity', get: d => d.capacity ?? null },
  { key: 'gatherTime', get: d => d.gatherTime ?? null },
  { key: 'buildRange', get: d => d.buildRange ?? null },
  { key: 'repairRate', get: d => d.repairRate ?? null },
  { key: 'visionRange', get: d => d.vision },
  { key: 'autoAcquireRange', get: d => d.autoAcquireRange ?? null },
];

/** Faction modifier keys that legitimately shift unit stats (perks). */
const PERK_FIELDS: Record<string, string[]> = {
  cost: ['vehicleCost', 'infantryCost'],
  buildTime: ['buildTime'],
  speed: ['infantrySpeed'],
  maxHitPoints: ['hp', 'unitHp'],
  damage: ['vehicleDamage', 'energyDamage'],
};

export interface BalanceReport {
  violations: string[];
  intentional: string[];
}

export function validateBalance(): BalanceReport {
  const report: BalanceReport = { violations: [], intentional: [] };
  const factions = Object.values(FACTION_DEFS);

  for (const classId of VEHICLE_CLASS_IDS) {
    const template = UNIT_CLASS_TEMPLATES[classId];
    const baseline = templateToDef(template);

    for (const field of CRITICAL_FIELDS) {
      const baseVal = field.get(baseline);
      if (baseVal == null) continue;
      const values: { faction: string; value: number; viaPerks: boolean; viaOverride: string | null }[] = [];

      for (const f of factions) {
        const resolved = resolveUnit(classId, f);
        const v = field.get(resolved);
        if (v == null) continue;
        // Did a faction perk modifier touch this field?
        const perkKeys = PERK_FIELDS[field.key] ?? [];
        const viaPerks = perkKeys.some(k => (f.modifiers[k] ?? 1) !== 1 && f.modifiers[k] !== undefined);
        // Did the variant declare an explicit override?
        const variant = getVariant(f.id, classId);
        const ov = variant?.balanceOverrides?.find(o =>
          o.field === field.key || (field.key === 'damage' && o.field === 'weapon.damage'));
        values.push({ faction: f.id, value: v, viaPerks, viaOverride: ov?.reason ?? null });
      }

      for (const v of values) {
        if (Math.abs(v.value - baseVal) < 1e-6) continue;
        const detail = `${classId}.${field.key}: ${v.faction}=${round2(v.value)} vs template=${round2(baseVal)}`;
        if (v.viaOverride) report.intentional.push(`${detail}  [override: ${v.viaOverride}]`);
        else if (v.viaPerks) report.intentional.push(`${detail}  [faction perk]`);
        else report.violations.push(detail);
      }
    }
  }
  return report;
}

function round2(n: number) { return Math.round(n * 100) / 100; }

export function printBalanceReport(): boolean {
  const r = validateBalance();
  console.log(`Balance validation — ${VEHICLE_CLASS_IDS.length} classes x ${Object.keys(FACTION_DEFS).length} factions`);
  if (r.intentional.length) {
    console.log(`\nIntentional differences (${r.intentional.length}):`);
    for (const s of r.intentional) console.log(`  ~ ${s}`);
  }
  if (r.violations.length) {
    console.log(`\nVIOLATIONS (${r.violations.length}):`);
    for (const s of r.violations) console.log(`  ! ${s}`);
  } else {
    console.log('\nNo unexplained balance differences. ✔');
  }
  return r.violations.length === 0;
}

// CLI entry: scripts/validate-balance.mjs loads this module via Vite SSR and
// calls printBalanceReport() — no separate bundling step needed.
