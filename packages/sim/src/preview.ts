import type { CabinClass, Catalog, Command, GameState, PreviewResult } from '@skyempire/shared';
import { CABIN_CLASSES } from '@skyempire/shared';
import { applyCommand } from './commands/apply';
import { BALANCE } from './config/balance';
import { hoursByAircraft, routeOps, simulateRoutes } from './daySim';
import { refFare } from './demand';
import { routeDayCosts } from './economics';
import { perPaxServiceCost } from './cabin';
import { distanceKm } from './geo';
import { flightDistanceKm, pairKey, routeLegs, routeMarkets } from './routing';

/** Seat-weighted per-passenger service cost of a class across the given aircraft. */
function classServiceCost(s: GameState, aircraftIds: string[], cls: CabinClass): number {
  let cost = 0, seats = 0;
  for (const id of aircraftIds) {
    const ac = s.aircraft[id];
    if (!ac) continue;
    cost += perPaxServiceCost(ac.product, cls) * ac.cabin[cls];
    seats += ac.cabin[cls];
  }
  return seats > 0 ? cost / seats : 0;
}

const FARE_STEPS = [0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6];

function evaluate(s: GameState, routeId: string, catalog: Catalog) {
  const route = s.routes[routeId]!;
  const hours = hoursByAircraft(s, catalog);
  // Every route selling any market this route sells (a nonstop route: just its own airport pair).
  const keys = new Set(routeMarkets(route).map((m) => m.key));
  const all = Object.values(s.routes).filter((r) => r.status === 'active' && routeMarkets(r).some((m) => keys.has(m.key)));
  const opsList = all.map((r) => routeOps(r, s, catalog, hours, true));
  const { results, demand } = simulateRoutes(opsList, s, catalog);
  const ops = opsList.find((o) => o.route.id === routeId)!;
  const res = results.get(routeId)!;
  const legs = new Map([...ops.roundTrips].map(([k, v]) => [k, 2 * v]));
  const c = routeDayCosts(route, s, catalog, legs, res.pax, false, res.ticketRevenue);
  const legCount = routeLegs(route).length;
  // Fixed-cost share: leases and per-aircraft overhead, pro-rated by the hours this route uses.
  let fixed = 0, upfront = 0;
  for (const asg of route.assignments) {
    const ac = s.aircraft[asg.aircraftId];
    if (!ac) continue;
    const t = catalog.aircraftTypes[ac.typeId]!;
    const share = Math.min(1, (hours.get(ac.id) ? (asg.roundTripsPerWeek * 2 * (ops.blockH + legCount * t.turnaroundMin / 60)) / BALANCE.weeklyHours : 0));
    fixed += ((ac.ownership === 'leased' ? t.leasePerMonth : 0) + BALANCE.overheadPerAircraft) / 30 * share;
    upfront += (ac.ownership === 'leased' ? t.leasePerMonth : ac.bookValue) * share;
  }
  const endKey = pairKey(route.from, route.to);
  const profit = Math.round(res.revenue - (c.fuel + c.crew + c.maintenance + c.fees + c.service) - fixed);
  const competitors = all.filter((r) => r.id !== routeId && routeMarkets(r).some((m) => m.key === endKey)).length;
  return { profit, lf: res.loadFactor, demand: demand.get(endKey) ?? 0, competitors, upfront, pax: res.pax, marketPax: res.marketPax };
}

/** Projected effect of a route command without changing `state` (used for UI hints and AI scoring). */
export function preview(state: GameState, airlineId: string, cmd: Command, catalog: Catalog): PreviewResult {
  if (cmd.type !== 'openRoute' && cmd.type !== 'updateRoute') return { ok: true };
  const s = structuredClone(state);
  const before = new Set(Object.keys(s.routes));
  const res = applyCommand(s, airlineId, cmd, catalog);
  if (!res.ok) return { ok: false, reason: res.reason };
  const routeId = cmd.type === 'updateRoute' ? cmd.routeId : Object.keys(s.routes).find((id) => !before.has(id))!;
  const route = s.routes[routeId]!;
  // The stop fares the command set (applyCommand filled any missing ones); restored after trying alternatives.
  const chosenLegFares = route.legFares && structuredClone(route.legFares);
  if (route.status !== 'active') return { ok: true, expectedLoadFactor: 0, expectedProfitPerDay: 0, paybackDays: null };
  const dist = distanceKm(catalog.airports[route.from]!, catalog.airports[route.to]!);

  // Suggested fare per class and market: the step that maximizes that market's contribution (revenue − service cost).
  const ids = route.assignments.map((a) => a.aircraftId);
  const endKey = pairKey(route.from, route.to);
  const suggested = { ...route.fares };
  for (const cls of CABIN_CLASSES) {
    const ref = refFare(dist, cls);
    let best = { fare: ref, value: -Infinity };
    const hasSeats = route.assignments.some((a) => (s.aircraft[a.aircraftId]?.cabin[cls] ?? 0) > 0);
    if (!hasSeats) {
      suggested[cls] = ref;
      continue;
    }
    const perPax = classServiceCost(s, ids, cls);
    for (const k of FARE_STEPS) {
      route.fares = { ...suggested, [cls]: Math.round(ref * k) } as Record<CabinClass, number>;
      const e = evaluate(s, routeId, catalog);
      const value = (e.marketPax.get(endKey)?.[cls] ?? 0) * (route.fares[cls] - perPax);
      if (value > best.value + 1e-6) best = { fare: route.fares[cls], value };
    }
    suggested[cls] = best.fare;
  }
  route.fares = { ...suggested };
  let suggestedLegFares: Record<string, Record<CabinClass, number>> | undefined;
  if (route.stops?.length) {
    suggestedLegFares = {};
    for (const m of routeMarkets(route)) {
      if (m.key === endKey) continue;
      const km = distanceKm(catalog.airports[m.a]!, catalog.airports[m.b]!);
      const fares = { ...(route.legFares?.[m.key] ?? route.fares) };
      for (const cls of CABIN_CLASSES) {
        const ref = refFare(km, cls);
        if (!route.assignments.some((a) => (s.aircraft[a.aircraftId]?.cabin[cls] ?? 0) > 0)) { fares[cls] = ref; continue; }
        const perPax = classServiceCost(s, ids, cls);
        let best = { fare: ref, value: -Infinity };
        for (const k of FARE_STEPS) {
          fares[cls] = Math.round(ref * k);
          route.legFares = { ...route.legFares, [m.key]: { ...fares } };
          const e = evaluate(s, routeId, catalog);
          const value = (e.marketPax.get(m.key)?.[cls] ?? 0) * (fares[cls] - perPax);
          if (value > best.value + 1e-6) best = { fare: fares[cls], value };
        }
        fares[cls] = best.fare;
      }
      route.legFares = { ...route.legFares, [m.key]: { ...fares } };
      suggestedLegFares[m.key] = fares;
    }
  }
  route.fares = cmd.fares ? { ...cmd.fares } : route.fares;
  if (cmd.type === 'updateRoute' && !cmd.fares) route.fares = { ...state.routes[routeId]!.fares };
  // Evaluate with the fares the player chose, not the ones tried above.
  route.legFares = chosenLegFares;
  const e = evaluate(s, routeId, catalog);
  return {
    ok: true,
    expectedLoadFactor: e.lf,
    expectedProfitPerDay: e.profit,
    paybackDays: e.profit > 0 ? Math.ceil(e.upfront / e.profit) : null,
    suggestedFares: suggested,
    ...(suggestedLegFares ? { suggestedLegFares } : {}),
    demandPerDay: Math.round(e.demand),
    competitors: e.competitors,
    distanceKm: Math.round(routeLegs(route).reduce((x, [a, b]) => x + distanceKm(catalog.airports[a]!, catalog.airports[b]!), 0)),
    detourKm: routeLegs(route).reduce((x, [a, b]) => x + flightDistanceKm(s, catalog, a, b).detourKm, 0),
  };
}
