import type { Aircraft, ClientView } from '@skyempire/shared';
import { distanceKm, roundTripHours } from '@skyempire/sim';
import { catalog } from './catalog';

export const WEEKLY_HOURS = 126;

export const shortTypeName = (typeId: string) => (catalog.aircraftTypes[typeId]?.name ?? typeId).replace(/^(Airbus|Boeing|Embraer|De Havilland) /, '');
export const aircraftLabel = (ac: Aircraft) => `${shortTypeName(ac.typeId)} · ${ac.id.replace(/^ac/, '#')}`;

/** Weekly hours each player aircraft is committed to, optionally ignoring one route. */
export function hoursUsed(view: ClientView, excludeRouteId?: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of view.routes) {
    if (r.status !== 'active' || r.id === excludeRouteId) continue;
    const a = catalog.airports[r.from], b = catalog.airports[r.to];
    if (!a || !b) continue;
    const dist = distanceKm(a, b);
    for (const asg of r.assignments) {
      const ac = view.aircraft.find((x) => x.id === asg.aircraftId);
      const t = ac && catalog.aircraftTypes[ac.typeId];
      if (!t) continue;
      m.set(asg.aircraftId, (m.get(asg.aircraftId) ?? 0) + asg.roundTripsPerWeek * roundTripHours(dist, t));
    }
  }
  return m;
}

export const freeHoursPerDay = (used: number) => Math.max(0, (WEEKLY_HOURS - used) / 7);
