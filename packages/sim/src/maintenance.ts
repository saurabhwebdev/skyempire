import type { Aircraft } from '@skyempire/shared';
import { BALANCE } from './config/balance';

/** Advance one aircraft by one day after it flew `hoursFlown` (simulation-spec §7). */
export function advanceAircraft(ac: Aircraft, hoursFlown: number): { checkCost: number; check: 'A' | 'C' | null } {
  ac.ageDays += 1;
  if (ac.status === 'maintenance') {
    ac.maintenanceDaysLeft = Math.max(0, ac.maintenanceDaysLeft - 1);
    if (ac.maintenanceDaysLeft === 0) ac.status = 'active';
    return { checkCost: 0, check: null };
  }
  ac.flightHours += hoursFlown;
  ac.hoursSinceA += hoursFlown;
  ac.hoursSinceC += hoursFlown;
  ac.condition = Math.max(0, ac.condition - BALANCE.wearPerHour * hoursFlown);
  if (ac.hoursSinceC >= BALANCE.cCheckHours) {
    ac.hoursSinceC = 0;
    ac.hoursSinceA = 0;
    ac.condition = 95;
    ac.status = 'maintenance';
    ac.maintenanceDaysLeft = BALANCE.cCheckDays;
    return { checkCost: BALANCE.cCheckCost, check: 'C' };
  }
  if (ac.hoursSinceA >= BALANCE.aCheckHours) {
    ac.hoursSinceA = 0;
    ac.condition = Math.min(100, ac.condition + 10);
    ac.status = 'maintenance';
    ac.maintenanceDaysLeft = BALANCE.aCheckDays;
    return { checkCost: BALANCE.aCheckCost, check: 'A' };
  }
  return { checkCost: 0, check: null };
}

export function onTimeFor(conditionAvg: number, congestion: number, utilisation: number, storm: boolean): number {
  let v = BALANCE.baseOnTime;
  if (conditionAvg < 60) v -= 0.5 * (60 - conditionAvg);
  if (congestion > 0.9) v -= 10;
  if (utilisation > 0.9) v -= 5;
  if (storm) v -= 10;
  return Math.min(98, Math.max(40, v));
}

export function incidentChance(condition: number): number {
  return condition < 40 ? 0.0005 : 0;
}
