import type { AircraftType, Airport, Cabin, Catalog, GameState, Route } from '@skyempire/shared';
import { CABIN_CLASSES } from '@skyempire/shared';
import { BALANCE } from './config/balance';
import { flightDistanceKm, routeChain, routeLegs } from './routing';
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
  route: Route, state: GameState, catalog: Catalog, legsByAircraft: Map<string, number>, pax: Cabin, closed: boolean, ticketRevenue?: number,
): RouteCosts {
  const zero = { fuel: 0, crew: 0, maintenance: 0, fees: 0, service: 0 };
  if (closed) return zero;
  const al = state.airlines[route.airlineId]!;
  // Every leg of the chain is flown out and back (`legsByAircraft` = 2 × round trips); a nonstop route is one leg.
  const legs = routeLegs(route).map(([x, y]) => {
    const a = catalog.airports[x]!, b = catalog.airports[y]!;
    return { a, b, km: flightDistanceKm(state, catalog, x, y).km, factor: al.baseIds.includes(x) && al.baseIds.includes(y) ? BALANCE.basePairDiscount : 1 };
  });
  const chain = routeChain(route).map((id) => catalog.airports[id]!);
  const style = al.personality ? PERSONALITIES[al.personality] : null;
  const out = { ...zero };
  // Per-passenger service cost per class, averaged over the seats each aircraft flies today.
  const svc = { economy: { cost: 0, seats: 0 }, premium: { cost: 0, seats: 0 }, business: { cost: 0, seats: 0 } };
  let connectivity = 0;
  for (const [acId, n] of legsByAircraft) {
    const ac = state.aircraft[acId];
    if (!ac || n <= 0) continue;
    const t = catalog.aircraftTypes[ac.typeId]!;
    const config = { seats: ac.cabin, product: ac.product, dense: ac.dense };
    for (const c of CABIN_CLASSES) {
      svc[c].cost += perPaxServiceCost(ac.product, c) * ac.cabin[c] * n;
      svc[c].seats += ac.cabin[c] * n;
    }
    const fuelMul = fuelFactor(config, t);
    for (const leg of legs) {
      connectivity += ifeCostPerBlockHour(config) * blockHours(leg.km, t.cruiseKmh) * n;
      // Flights alternate direction: half land at b, half at a.
      const toB = Math.ceil(n / 2), toA = n - toB;
      for (const [arrival, k] of [[leg.b, toB], [leg.a, toA]] as const) {
        if (k === 0) continue;
        const c = legCost(t, ac.ageDays / 360, leg.km, state.market.fuelPricePerKg, arrival, leg.factor, style?.crewCost ?? 1, style?.maintCost ?? 1);
        out.fuel += Math.round(c.fuel * fuelMul) * k;
        out.crew += c.crew * k;
        out.maintenance += c.maintenance * k;
        out.fees += c.fees * k;
      }
    }
  }
  const totalPax = CABIN_CLASSES.reduce((s, c) => s + pax[c], 0);
  out.fees += Math.round((chain.reduce((x, ap) => x + ap.paxFee, 0) / chain.length) * totalPax * BALANCE.paxFeeShare);
  const tickets = ticketRevenue ?? CABIN_CLASSES.reduce((s, c) => s + pax[c] * effectiveFare(route, c, state.day), 0);
  out.fees += Math.round(BALANCE.distributionShare * tickets);
  out.service = Math.round(CABIN_CLASSES.reduce((s, c) => s + pax[c] * (svc[c].seats > 0 ? svc[c].cost / svc[c].seats : 0), 0) + connectivity);
  return out;
}
