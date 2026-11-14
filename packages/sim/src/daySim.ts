import type { Cabin, CabinClass, Catalog, GameState, Route } from '@skyempire/shared';
import { CABIN_CLASSES } from '@skyempire/shared';
import { allocate, type Offer } from './allocation';
import { dateOf } from './calendar';
import { BALANCE, WEATHER } from './config/balance';
import { baseDemand, classSplit, elasticDemand, refFare } from './demand';
import { flightsToday } from './economics';
import { effectiveFare } from './fares';
import { holidayDemandFactors } from './holidays';
import { isAirportClosed, isStormAffected } from './events';
import { distanceKm } from './geo';
import { onTimeFor } from './maintenance';
import { blockHours, roundTripHours, slotCapacity } from './ops';
import { offerQuality } from './quality';
import { productScore } from './cabin';
import { weatherAt, weatherEffect, type WeatherEffect } from './weather';
import { flightDistanceKm } from './routing';
import { banMessage, isBanned, tensionDemandFactor } from './tensions';

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
  /** Offer quality per class (0–100), seat-weighted across the route's aircraft. */
  quality: Cabin;
  /** Seat-weighted mean of the class qualities (for reputation). */
  qualityMean: number;
  onTime: number;
  blockH: number;
  /** Weather extras today: de-icing plus passenger care for cancelled or pre-cancelled seats. */
  weatherFees: number;
  /** Extra km flown around closed airspace. */
  detourKm: number;
  /** Why the route (or some of its aircraft) can't fly today: a ban, no way around closed airspace, or out of range. */
  blocked: string | null;
}

/** What a route operates today. `average` = typical day (rtpw / 7) for previews. */
export function routeOps(route: Route, state: GameState, catalog: Catalog, hours: Map<string, number>, average: boolean): RouteOps {
  const a = catalog.airports[route.from]!, b = catalog.airports[route.to]!;
  const flight = flightDistanceKm(state, catalog, a.id, b.id);
  const dist = flight.km;
  const ban = isBanned(state, a.country, b.country);
  const blocked = ban ? banMessage(catalog, ban) : flight.blocked;
  // Weather applies to real days only; previews show a typical day.
  const wa = average ? 'clear' : weatherAt(state, catalog, a.id, state.day);
  const wb = average ? 'clear' : weatherAt(state, catalog, b.id, state.day);
  const preCancelled = !average && (state.world.preCancelled[route.id]?.includes(state.day) ?? false);
  const struck = isAirportClosed(state, a.id) || isAirportClosed(state, b.id);
  const cyclone = wa === 'cyclone' || wb === 'cyclone';
  const closed = struck || cyclone;
  const roundTrips = new Map<string, number>();
  const seats = emptyCabin();
  let rangeBlocked: string | null = null;
  let weeklyFrequency = 0, condSum = 0, utilSum = 0, penaltySum = 0, n = 0, blockH = 0, weatherFees = 0;
  // Share of flights the weather cancels at one end: its own cancellations, or what reduced capacity can't handle.
  const endCancel = (ap: typeof a, eff: WeatherEffect) => {
    if (eff.capacityCut <= 0) return eff.cancelShare;
    const used = state.slotsUsed[ap.id] ?? 0;
    const overflow = used > 0 ? 1 - ((1 - eff.capacityCut) * slotCapacity(state, catalog, ap.id)) / used : 0;
    return Math.min(1, Math.max(eff.cancelShare, overflow));
  };
  for (const asg of route.assignments) {
    const ac = state.aircraft[asg.aircraftId];
    if (!ac) continue;
    weeklyFrequency += asg.roundTripsPerWeek;
    const t = catalog.aircraftTypes[ac.typeId]!;
    blockH = blockHours(dist, t.cruiseKmh);
    const outOfRange = t.rangeKm < dist;
    // Flights a cyclone would cancel still count as scheduled (stranded passengers cost money); strikes ground everything.
    const flying = !struck && !blocked && !outOfRange && ac.status === 'active' && !(ac.refitDaysLeft > 0);
    if (outOfRange && !blocked && !rangeBlocked) rangeBlocked = `Detour exceeds ${t.name} range`;
    const scheduled = flying ? (average ? asg.roundTripsPerWeek / 7 : flightsToday(asg.roundTripsPerWeek, state.day)) : 0;
    const acSeats = CABIN_CLASSES.reduce((s, c) => s + ac.cabin[c], 0);
    const util = (hours.get(ac.id) ?? 0) / BALANCE.weeklyHours;
    let rt = scheduled;
    if (preCancelled || cyclone) {
      weatherFees += (preCancelled ? WEATHER.preCancelCostPerSeat : WEATHER.cancelCostPerSeat) * 2 * scheduled * acSeats;
      rt = 0;
    } else if (scheduled > 0) {
      const ea = weatherEffect(wa, a, t.class), eb = weatherEffect(wb, b, t.class);
      const cancel = Math.max(endCancel(a, ea), endCancel(b, eb));
      rt = scheduled * (1 - cancel);
      weatherFees += WEATHER.cancelCostPerSeat * 2 * (scheduled - rt) * acSeats;
      weatherFees += rt * (ea.deicePerDeparture + eb.deicePerDeparture);
      penaltySum += Math.max(ea.onTimePenalty, eb.onTimePenalty) * (util < WEATHER.spareUtilisation ? 0.5 : 1);
    }
    roundTrips.set(ac.id, rt);
    for (const c of CABIN_CLASSES) seats[c] += rt * ac.cabin[c];
    condSum += ac.condition;
    utilSum += util;
    n += 1;
  }
  const congestion = Math.max(
    (state.slotsUsed[a.id] ?? 0) / Math.max(1, slotCapacity(state, catalog, a.id)),
    (state.slotsUsed[b.id] ?? 0) / Math.max(1, slotCapacity(state, catalog, b.id)),
  );
  const onTime = closed
    ? 40 // flights cancelled: counts as a bad day for punctuality
    : n
    ? Math.max(40, onTimeFor(condSum / n, congestion, utilSum / n, isStormAffected(state, a.id) || isStormAffected(state, b.id)) - penaltySum / n)
    : BALANCE.baseOnTime;
  // Quality per class: each aircraft's offer, weighted by the seats it puts in that class.
  const quality = emptyCabin(), qualSeats = emptyCabin();
  for (const asg of route.assignments) {
    const ac = state.aircraft[asg.aircraftId];
    if (!ac) continue;
    const t = catalog.aircraftTypes[ac.typeId]!;
    for (const cls of CABIN_CLASSES) {
      const w = ac.cabin[cls] * asg.roundTripsPerWeek;
      if (w <= 0) continue;
      quality[cls] += w * offerQuality({ comfort: t.comfort, ageYears: ac.ageDays / 360, productScore: productScore(ac.product, cls, ac.dense, blockHours(dist, t.cruiseKmh)), onTime });
      qualSeats[cls] += w;
    }
  }
  for (const cls of CABIN_CLASSES) quality[cls] = qualSeats[cls] > 0 ? quality[cls] / qualSeats[cls] : 50;
  const allSeats = CABIN_CLASSES.reduce((s, c) => s + qualSeats[c], 0);
  const qualityMean = allSeats > 0 ? CABIN_CLASSES.reduce((s, c) => s + quality[c] * qualSeats[c], 0) / allSeats : 50;
  return {
    route, closed, roundTrips, seats, weeklyFrequency, quality, qualityMean, onTime, blockH, weatherFees: Math.round(weatherFees),
    detourKm: flight.detourKm, blocked: blocked ?? rangeBlocked,
  };
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
    const base = baseDemand(o, d, doy, state.market.economyIndex) * tensionDemandFactor(state, o, d);
    demandTotal += base;
    const split = classSplit(o, d);
    const hol = holidayDemandFactors(o, d, state.day, state.world.startYear, catalog);
    for (const cls of CABIN_CLASSES) {
      const ref = refFare(dist, cls);
      const classBase = base * split[cls] * (cls === 'business' ? hol.business : hol.leisure);
      const offers: Offer[] = ops
        .filter((x) => x.weeklyFrequency > 0)
        .map((x) => ({
          airlineId: x.route.airlineId, routeId: x.route.id, fare: effectiveFare(x.route, cls, state.day), weeklyFrequency: x.weeklyFrequency,
          quality: x.quality[cls], reputation: state.airlines[x.route.airlineId]!.reputation, stops: 0, seats: x.seats[cls],
        }));
      const withSeats = offers.filter((x) => x.seats > 0);
      if (withSeats.length === 0) continue;
      // "Other airlines": real carriers not in this world. They soak up demand the game's airlines don't serve,
      // so no player is ever a true monopolist on a big market.
      const classDemand = classBase;
      const gameSeats = withSeats.reduce((s, x) => s + x.seats, 0);
      const bgSeats = Math.max(BALANCE.backgroundMinShare * classDemand, BALANCE.backgroundShare * classDemand - gameSeats);
      offers.push({
        airlineId: '__others', routeId: '__others', fare: Math.round(ref * BALANCE.backgroundFareFactor),
        weeklyFrequency: Math.max(1, Math.round((bgSeats / BALANCE.backgroundSeatsPerFlight) * 7 / Math.max(split[cls], 0.05))),
        quality: BALANCE.backgroundQuality, reputation: BALANCE.backgroundReputation, stops: 0, seats: bgSeats,
      });
      const seatSum = withSeats.reduce((s, x) => s + x.seats, 0);
      const avgFare = (withSeats.reduce((s, x) => s + x.fare * x.seats, 0) + ref * BALANCE.backgroundFareFactor * Math.max(0, BALANCE.backgroundShare * classBase - seatSum)) / Math.max(seatSum, BALANCE.backgroundShare * classBase);
      const demand = elasticDemand(classBase, avgFare, ref, cls);
      for (const [routeId, n] of allocate(demand, offers, ref, cls)) if (routeId !== '__others') pax.get(routeId)![cls] += n;
    }
  }
  return { pax, demand: demandTotal };
}

export function revenueOf(route: Route, pax: Cabin, day: number): number {
  return Math.round(CABIN_CLASSES.reduce((s, c: CabinClass) => s + pax[c] * effectiveFare(route, c, day), 0));
}

export function totalSeats(ops: RouteOps): number {
  return 2 * CABIN_CLASSES.reduce((s, c) => s + ops.seats[c], 0);
}
