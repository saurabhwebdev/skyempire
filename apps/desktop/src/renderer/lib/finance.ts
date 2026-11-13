import type { ClientView } from '@skyempire/shared';
import { BALANCE } from '@skyempire/sim';
import { catalog } from './catalog';

/** Next month's fixed bills (mirrors sim monthlyFixedCosts). */
export function monthlyCosts(view: ClientView): number {
  const leases = view.aircraft.filter((a) => a.ownership === 'leased').reduce((s, a) => s + (catalog.aircraftTypes[a.typeId]?.leasePerMonth ?? 0), 0);
  const overhead = BALANCE.overheadBase + BALANCE.overheadPerAircraft * view.aircraft.length;
  const bases = view.player.baseIds.reduce((s, id) => s + BALANCE.baseUpkeepPerSize * (catalog.airports[id]?.sizeClass ?? 1), 0);
  const interest = view.player.loans.reduce((s, l) => s + (l.principal * l.annualRate) / 12, 0);
  return Math.round(leases + overhead + bases + view.player.marketingPerMonth + interest);
}
