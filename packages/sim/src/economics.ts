import type { AircraftType, Airport, Cabin, Catalog, GameState, Route } from '@skyempire/shared';
import { CABIN_CLASSES } from '@skyempire/shared';
import { BALANCE } from './config/balance';
import { flightDistanceKm } from './routing';
import { effectiveFare } from './fares';
import { blockHours } from './ops';
import { PERSONALITIES } from './ai/personalities';
import { fuelFactor, ifeCostPerBlockHour, perPaxServiceCost } from './cabin';

/** Round trips flown today: weekly round trips spread deterministically across the 7-day week. */
export function flightsToday(rtpw: number, day: number): number {
  const base = Math.floor(rtpw / 7);
  const rem = rtpw % 7;
  // Spread the remainder evenly through the week (Bresenham-style).
  const dow = day % 7;
  const extra = Math.floor(((dow + 1) * rem) / 7) - Math.floor((dow * rem) / 7);
  return base + extra;
}

export interface LegCost { fuel: number; crew: number; maintenance: number; fees: number }

/** Cost of one flight leg (simulation-spec §6), excluding per-passenger fees. */
export function legCost(
  type: AircraftType, ageYears: number, distKm: number, fuelPrice: number, arrival: Airport, crewMaintFactor: number, crewFactor = 1, maintFactor = 1,
): LegCost {
  const block = blockHours(distKm, type.cruiseKmh);
  return {
    fuel: Math.round(type.fuelKgPerH * block * fuelPrice),
    crew: Math.round(type.crewPerH * block * crewMaintFactor * crewFactor),
    maintenance: Math.round(type.maintPerH * block * (1 + ageYears * 0.03) * crewMaintFactor * maintFactor),
    fees: Math.round(arrival.landingFeePerTonne * type.mtowT + BALANCE.navFeePerKm * distKm * Math.sqrt(type.mtowT / 50)),
  };
}

export interface RouteCosts { fuel: number; crew: number; maintenance: number; fees: number; service: number }

/** Variable costs of a route for one day. `legsByAircraft` = legs flown today per aircraft; `pax` = all passengers carried today. */
export function routeDayCosts(
  route: Route, state: GameState, catalog: Catalog, legsByAircraft: Map<string, number>, pax: Cabin, closed: boolean,
): RouteCosts {
  const zero = { fuel: 0, crew: 0, maintenance: 0, fees: 0, service: 0 };
  if (closed) return zero;
  const al = state.airlines[route.airlineId]!;
  const a = catalog.airports[route.from]!, b = catalog.airports[route.to]!;
  const dist = flightDistanceKm(state, catalog, a.id, b.id).km;
  const factor = al.baseIds.includes(a.id) && al.baseIds.includes(b.id) ? BALANCE.basePairDiscount : 1;
  const style = al.personality ? PERSONALITIES[al.personality] : null;
  const out = { ...zero };
  // Per-passenger service cost per class, averaged over the seats each aircraft flies today.
  const svc = { economy: { cost: 0, seats: 0 }, premium: { cost: 0, seats: 0 }, business: { cost: 0, seats: 0 } };
  let connectivity = 0;
  for (const [acId, legs] of legsByAircraft) {
    const ac = state.aircraft[acId];
    if (!ac || legs <= 0) continue;
    const t = catalog.aircraftTypes[ac.typeId]!;
    const config = { seats: ac.cabin, product: ac.product, dense: ac.dense };
    for (const c of CABIN_CLASSES) {
      svc[c].cost += perPaxServiceCost(ac.product, c) * ac.cabin[c] * legs;
      svc[c].seats += ac.cabin[c] * legs;
    }
    connectivity += ifeCostPerBlockHour(config) * blockHours(dist, t.cruiseKmh) * legs;
    const fuelMul = fuelFactor(config, t);
    // Legs alternate direction: half land at b, half at a.
    const toB = Math.ceil(legs / 2), toA = legs - toB;
    for (const [arrival, n] of [[b, toB], [a, toA]] as const) {
      if (n === 0) continue;
      const c = legCost(t, ac.ageDays / 360, dist, state.market.fuelPricePerKg, arrival, factor, style?.crewCost ?? 1, style?.maintCost ?? 1);
      out.fuel += Math.round(c.fuel * fuelMul) * n;
      out.crew += c.crew * n;
      out.maintenance += c.maintenance * n;
      out.fees += c.fees * n;
    }
  }
  const totalPax = CABIN_CLASSES.reduce((s, c) => s + pax[c], 0);
  out.fees += Math.round(((a.paxFee + b.paxFee) / 2) * totalPax * BALANCE.paxFeeShare);
  const ticketRevenue = CABIN_CLASSES.reduce((s, c) => s + pax[c] * effectiveFare(route, c, state.day), 0);
  out.fees += Math.round(BALANCE.distributionShare * ticketRevenue);
  out.service = Math.round(CABIN_CLASSES.reduce((s, c) => s + pax[c] * (svc[c].seats > 0 ? svc[c].cost / svc[c].seats : 0), 0) + connectivity);
  return out;
}
