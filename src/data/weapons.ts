// Weapon definitions — single source for every weapon in the game.
//
// A WeaponSpec is the rich, forward-looking description (target types, splash,
// turret data, anti-air bonus …). The simulation consumes the legacy WeaponDef
// shape; unitFactory derives it via toLegacyWeapon() so combat math stays
// byte-identical for existing units.

import type { ProjectileKind, WeaponDef } from '../core/types';
import { LEGACY_DAMAGE_TYPE, type ExtendedDamageType } from './armor';

export type TargetType = 'ground' | 'air' | 'structure' | 'infantry' | 'vehicle' | 'naval';

export interface WeaponSpec {
  id: string;
  name: string;
  weaponType: ExtendedDamageType;
  damage: number;
  range: number;            // tiles
  cooldown: number;         // seconds between shots (fireRate = 1/cooldown)
  projectile: ProjectileKind;
  projectileSpeed?: number; // world units/s (visual; sim hits are cooldown-based)
  splashRadius?: number;    // world units, 0 = single target
  targetTypes: TargetType[];
  turreted: boolean;
  turretTurnRate?: number;  // rad/s (visual aim speed)
  lineOfSightRequired?: boolean;
  /** Extra multiplier vs air targets once aircraft exist. */
  antiAirBonus?: number;
  /** Optional per-armor-class damage multipliers (future fine-tuning). */
  damageVsArmorClasses?: Partial<Record<'light' | 'heavy' | 'structure', number>>;
}

export const WEAPONS: Record<string, WeaponSpec> = {
  // ---- infantry ----
  lancerRifle: {
    id: 'lancerRifle', name: 'Pulse Rifle', weaponType: 'ballistic',
    damage: 12, range: 7, cooldown: 1.0, projectile: 'bullet',
    targetTypes: ['ground', 'infantry', 'vehicle', 'structure'], turreted: false,
    lineOfSightRequired: true,
  },
  breacherRocket: {
    id: 'breacherRocket', name: 'Plasma Rocket', weaponType: 'explosive',
    damage: 42, range: 8.5, cooldown: 2.6, projectile: 'rocket', splashRadius: 0.6,
    targetTypes: ['ground', 'vehicle', 'structure'], turreted: false,
    lineOfSightRequired: true,
  },
  arcProjector: {
    id: 'arcProjector', name: 'Arc Projector', weaponType: 'electric',
    damage: 26, range: 8, cooldown: 1.6, projectile: 'laser',
    targetTypes: ['ground', 'infantry', 'vehicle', 'structure'], turreted: false,
    lineOfSightRequired: true,
  },
  // ---- vehicles ----
  scoutRepeater: {
    id: 'scoutRepeater', name: 'Light Repeater', weaponType: 'ballistic',
    damage: 10, range: 6.5, cooldown: 0.55, projectile: 'bullet',
    targetTypes: ['ground', 'infantry', 'vehicle'], turreted: false,
    lineOfSightRequired: true,
  },
  lightAutocannon: {
    id: 'lightAutocannon', name: 'Autocannon', weaponType: 'ballistic',
    damage: 16, range: 7, cooldown: 0.7, projectile: 'bullet',
    targetTypes: ['ground', 'infantry', 'vehicle'], turreted: true, turretTurnRate: 9,
    lineOfSightRequired: true,
  },
  tankCannon: {
    id: 'tankCannon', name: 'Smoothbore Cannon', weaponType: 'ballistic',
    damage: 48, range: 8, cooldown: 2.0, projectile: 'shell',
    targetTypes: ['ground', 'vehicle', 'structure'], turreted: true, turretTurnRate: 7,
    lineOfSightRequired: true,
  },
  siegeHowitzer: {
    id: 'siegeHowitzer', name: 'Siege Howitzer', weaponType: 'explosive',
    damage: 110, range: 11, cooldown: 4.2, projectile: 'shell', splashRadius: 1.2,
    targetTypes: ['ground', 'structure', 'vehicle'], turreted: true, turretTurnRate: 4,
    lineOfSightRequired: false,
  },
  flakBattery: {
    id: 'flakBattery', name: 'Flak Battery', weaponType: 'ballistic',
    damage: 10, range: 8, cooldown: 1.1, projectile: 'bullet',
    // Ground-capable but weak; the antiAirBonus activates once aircraft exist.
    targetTypes: ['ground', 'air', 'vehicle', 'infantry'], turreted: true, turretTurnRate: 11,
    antiAirBonus: 4.0,
    lineOfSightRequired: true,
  },
};

/** Derives the legacy sim weapon from a rich spec (combat math unchanged). */
export function toLegacyWeapon(spec: WeaponSpec): WeaponDef {
  return {
    damage: spec.damage,
    damageType: LEGACY_DAMAGE_TYPE[spec.weaponType],
    range: spec.range,
    cooldown: spec.cooldown,
    projectile: spec.projectile,
  };
}
