import type { Cabin, CabinClass, Catalog, GameState, Route } from '@skyempire/shared';
import { CABIN_CLASSES } from '@skyempire/shared';
import { allocate, type Offer } from './allocation';
import { dateOf } from './calendar';
import { BALANCE } from './config/balance';
import { baseDemand, classSplit, elasticDemand, refFare } from './demand';
import { flightsToday } from './economics';
import { isAirportClosed, isStormAffected } from './events';
import { distanceKm } from './geo';
import { onTimeFor } from './maintenance';
import { blockHours, roundTripHours, seatUnits, slotCapacity } from './ops';
import { offerQuality } from './quality';

export const emptyCabin = (): Cabin => ({ economy: 0, premium: 0, business: 0 });
export const pairKey = (a: string, b: string) => (a < b ? `${a}-${b}` : `${b}-${a}`);

/** Weekly hours each aircraft is committed to across active routes. */
export function hoursByAircraft(state: GameState, catalog: Catalog): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of Object.values(state.routes)) {
    if (r.status !== 'active') continue;
    const dist = distanceKm(catalog.airports[r.from]!, catalog.airports[r.to]!);
    for (const a of r.assignments) {
      const ac = state.aircraft[a.aircraftId];
      if (!ac) continue;
      m.set(ac.id, (m.get(ac.id) ?? 0) + a.roundTripsPerWeek * roundTripHours(dist, catalog.aircraftTypes[ac.typeId]!));
    }
  }
  return m;
}

export interface RouteOps {
  route: Route;
  closed: boolean;
  /** Round trips flown today per aircraft (fractional in "average day" mode). */
  roundTrips: Map<string, number>;
  /** Seats per direction per class today. */
  seats: Cabin;
  weeklyFrequency: number;
  quality: number;
  onTime: number;
  blockH: number;
}

/** What a route operates today. `average` = typical day (rtpw / 7) for previews. */
export function routeOps(route: Route, state: GameState, catalog: Catalog, hours: Map<string, number>, average: boolean): RouteOps {
  const a = catalog.airports[route.from]!, b = catalog.airports[route.to]!;
  const dist = distanceKm(a, b);
  const closed = isAirportClosed(state, a.id) || isAirportClosed(state, b.id);
  const al = state.airlines[route.airlineId]!;
  const roundTrips = new Map<string, number>();
  const seats = emptyCabin();
  let weeklyFrequency = 0, condSum = 0, utilSum = 0, qualSum = 0, n = 0, blockH = 0;
  for (const asg of route.assignments) {
    const ac = state.aircraft[asg.aircraftId];
    if (!ac) continue;
    weeklyFrequency += asg.roundTripsPerWeek;
    const t = catalog.aircraftTypes[ac.typeId]!;
    blockH = blockHours(dist, t.cruiseKmh);
    const flying = !closed && ac.status === 'active';
    const rt = flying ? (average ? asg.roundTripsPerWeek / 7 : flightsToday(asg.roundTripsPerWeek, state.day)) : 0;
    roundTrips.set(ac.id, rt);
    for (const c of CABIN_CLASSES) seats[c] += rt * ac.cabin[c];
    condSum += ac.condition;
    utilSum += (hours.get(ac.id) ?? 0) / BALANCE.weeklyHours;
    n += 1;
  }
  const congestion = Math.max(
    (state.slotsUsed[a.id] ?? 0) / Math.max(1, slotCapacity(state, catalog, a.id)),
    (state.slotsUsed[b.id] ?? 0) / Math.max(1, slotCapacity(state, catalog, b.id)),
  );
  const onTime = closed
    ? 40 // flights cancelled: counts as a bad day for punctuality
    : n
    ? onTimeFor(condSum / n, congestion, utilSum / n, isStormAffected(state, a.id) || isStormAffected(state, b.id))
    : BALANCE.baseOnTime;
  for (const asg of route.assignments) {
    const ac = state.aircraft[asg.aircraftId];
    if (!ac) continue;
    const t = catalog.aircraftTypes[ac.typeId]!;
    qualSum += offerQuality({
      comfort: t.comfort, ageYears: ac.ageDays / 360, seatUnitsRatio: seatUnits(ac.cabin) / t.maxSeats,
      serviceLevel: al.serviceLevel, onTime,
    });
  }
  return { route, closed, roundTrips, seats, weeklyFrequency, quality: n ? qualSum / n : 50, onTime, blockH };
}

export interface PairResult {
  /** Passengers per route per class, both directions combined. */
  pax: Map<string, Cabin>;
  /** Unconstrained daily demand both directions (before price effects). */
  demand: number;
}

/** Demand and passenger allocation for one airport pair, both directions, all classes. */
export function simulatePair(ops: RouteOps[], state: GameState, catalog: Catalog): PairResult {
  const pax = new Map<string, Cabin>(ops.map((o) => [o.route.id, emptyCabin()]));
  if (ops.length === 0) return { pax, demand: 0 };
  const first = ops[0]!.route;
  const A = catalog.airports[first.from]!, B = catalog.airports[first.to]!;
  const dist = distanceKm(A, B);
  const doy = dateOf(state.day, state.world.startYear).dayOfYear;
  let demandTotal = 0;
  for (const [o, d] of [[A, B], [B, A]] as const) {
    const base = baseDemand(o, d, doy, state.market.economyIndex);
    demandTotal += base;
    const split = classSplit(o, d);
    for (const cls of CABIN_CLASSES) {
      const ref = refFare(dist, cls);
      const offers: Offer[] = ops
        .filter((x) => x.weeklyFrequency > 0)
        .map((x) => ({
          airlineId: x.route.airlineId, routeId: x.route.id, fare: x.route.fares[cls], weeklyFrequency: x.weeklyFrequency,
          quality: x.quality, reputation: state.airlines[x.route.airlineId]!.reputation, stops: 0, seats: x.seats[cls],
        }));
      const withSeats = offers.filter((x) => x.seats > 0);
      if (withSeats.length === 0) continue;
      // "Other airlines": real carriers not in this world. They soak up demand the game's airlines don't serve,
      // so no player is ever a true monopolist on a big market.
      const classDemand = base * split[cls];
      const gameSeats = withSeats.reduce((s, x) => s + x.seats, 0);
      const bgSeats = Math.max(BALANCE.backgroundMinShare * classDemand, BALANCE.backgroundShare * classDemand - gameSeats);
      offers.push({
        airlineId: '__others', routeId: '__others', fare: Math.round(ref * BALANCE.backgroundFareFactor),
        weeklyFrequency: Math.max(1, Math.round((bgSeats / BALANCE.backgroundSeatsPerFlight) * 7 / Math.max(split[cls], 0.05))),
        quality: BALANCE.backgroundQuality, reputation: BALANCE.backgroundReputation, stops: 0, seats: bgSeats,
      });
      const seatSum = withSeats.reduce((s, x) => s + x.seats, 0);
      const avgFare = (withSeats.reduce((s, x) => s + x.fare * x.seats, 0) + ref * BALANCE.backgroundFareFactor * Math.max(0, BALANCE.backgroundShare * base * split[cls] - seatSum)) / Math.max(seatSum, BALANCE.backgroundShare * base * split[cls]);
      const demand = elasticDemand(base * split[cls], avgFare, ref, cls);
      for (const [routeId, n] of allocate(demand, offers, ref, cls)) if (routeId !== '__others') pax.get(routeId)![cls] += n;
    }
  }
  return { pax, demand: demandTotal };
}

export function revenueOf(route: Route, pax: Cabin): number {
  return Math.round(CABIN_CLASSES.reduce((s, c: CabinClass) => s + pax[c] * route.fares[c], 0));
}

export function totalSeats(ops: RouteOps): number {
  return 2 * CABIN_CLASSES.reduce((s, c) => s + ops.seats[c], 0);
}
