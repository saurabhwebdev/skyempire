import type { AircraftType, Cabin, Catalog, GameState, Route } from '@skyempire/shared';
import { routeLegs } from './routing';
import { BALANCE } from './config/balance';
import { distanceKm } from './geo';

export function blockHours(distKm: number, cruiseKmh: number): number {
  return distKm / cruiseKmh + BALANCE.blockOverheadH;
}

export function roundTripHours(distKm: number, type: AircraftType): number {
  return 2 * (blockHours(distKm, type.cruiseKmh) + type.turnaroundMin / 60);
}

export function maxRoundTripsPerWeek(distKm: number, type: AircraftType): number {
  return Math.floor(BALANCE.weeklyHours / roundTripHours(distKm, type));
}

/** Slots used per airport per day by a route flying `rtpw` round trips a week (1 departure + 1 arrival each). */
export function slotsNeeded(roundTripsPerWeek: number): number {
  return 2 * Math.ceil(roundTripsPerWeek / 7);
}

export function seatUnits(cabin: Cabin): number {
  return (
    cabin.economy * BALANCE.seatUnits.economy +
    cabin.premium * BALANCE.seatUnits.premium +
    cabin.business * BALANCE.seatUnits.business
  );
}

export function routeDistance(state: Pick<GameState, 'routes'>, routeId: string, catalog: Catalog): number {
  const r = state.routes[routeId];
  if (!r) throw new Error(`no route ${routeId}`);
  return distanceKm(catalog.airports[r.from]!, catalog.airports[r.to]!);
}

/** Weekly hours an aircraft is already committed to across all active routes (optionally excluding one route). */
/** Hours for one round trip over every leg of a route (from → stops → to and back). */
export function chainRoundTripHours(catalog: Catalog, r: Pick<Route, 'from' | 'to' | 'stops'>, type: AircraftType): number {
  return routeLegs(r).reduce((h, [x, y]) => h + roundTripHours(distanceKm(catalog.airports[x]!, catalog.airports[y]!), type), 0);
}

export function aircraftHoursUsed(aircraftId: string, state: GameState, catalog: Catalog, excludeRouteId?: string): number {
  const ac = state.aircraft[aircraftId];
  if (!ac) return 0;
  const type = catalog.aircraftTypes[ac.typeId]!;
  let hours = 0;
  for (const r of Object.values(state.routes)) {
    if (r.status !== 'active' || r.id === excludeRouteId) continue;
    for (const a of r.assignments) {
      if (a.aircraftId !== aircraftId) continue;
      hours += a.roundTripsPerWeek * chainRoundTripHours(catalog, r, type);
    }
  }
  return hours;
}

export function slotCapacity(state: GameState, catalog: Catalog, airportId: string): number {
  const base = catalog.airports[airportId]?.slotCapacity ?? 0;
  return Math.round(base * (1 + (state.airportSlotBonus[airportId] ?? 0)));
}

export function slotsFree(state: GameState, catalog: Catalog, airportId: string): number {
  return slotCapacity(state, catalog, airportId) - (state.slotsUsed[airportId] ?? 0);
}
