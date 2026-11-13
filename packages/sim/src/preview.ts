import type { Cabin, CabinClass, Catalog, Command, GameState, PreviewResult } from '@skyempire/shared';
import { CABIN_CLASSES } from '@skyempire/shared';
import { applyCommand } from './commands/apply';
import { BALANCE } from './config/balance';
import { hoursByAircraft, pairKey, revenueOf, routeOps, simulatePair, totalSeats } from './daySim';
import { refFare } from './demand';
import { routeDayCosts } from './economics';
import { distanceKm } from './geo';

const FARE_STEPS = [0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6];

function evaluate(s: GameState, routeId: string, catalog: Catalog) {
  const route = s.routes[routeId]!;
  const hours = hoursByAircraft(s, catalog);
  const key = pairKey(route.from, route.to);
  const all = Object.values(s.routes).filter((r) => r.status === 'active' && pairKey(r.from, r.to) === key);
  const opsList = all.map((r) => routeOps(r, s, catalog, hours, true));
  const res = simulatePair(opsList, s, catalog);
  const ops = opsList.find((o) => o.route.id === routeId)!;
  const pax: Cabin = res.pax.get(routeId)!;
  const legs = new Map([...ops.roundTrips].map(([k, v]) => [k, 2 * v]));
  const c = routeDayCosts(route, s, catalog, legs, pax, false);
  // Fixed-cost share: leases and per-aircraft overhead, pro-rated by the hours this route uses.
  let fixed = 0, upfront = 0;
  for (const asg of route.assignments) {
    const ac = s.aircraft[asg.aircraftId];
    if (!ac) continue;
    const t = catalog.aircraftTypes[ac.typeId]!;
    const share = Math.min(1, (hours.get(ac.id) ? (asg.roundTripsPerWeek * 2 * (ops.blockH + t.turnaroundMin / 60)) / BALANCE.weeklyHours : 0));
    fixed += ((ac.ownership === 'leased' ? t.leasePerMonth : 0) + BALANCE.overheadPerAircraft) / 30 * share;
    upfront += (ac.ownership === 'leased' ? t.leasePerMonth : ac.bookValue) * share;
  }
  const revenue = revenueOf(route, pax);
  const profit = Math.round(revenue - (c.fuel + c.crew + c.maintenance + c.fees + c.service) - fixed);
  const seats = totalSeats(ops);
  const paxTotal = CABIN_CLASSES.reduce((x, k) => x + pax[k], 0);
  return { profit, lf: seats ? paxTotal / seats : 0, demand: res.demand, competitors: all.length - 1, upfront, pax };
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
  if (route.status !== 'active') return { ok: true, expectedLoadFactor: 0, expectedProfitPerDay: 0, paybackDays: null };
  const dist = distanceKm(catalog.airports[route.from]!, catalog.airports[route.to]!);

  // Suggested fare per class: the step that maximizes that class's contribution (revenue − service cost).
  const suggested = { ...route.fares };
  for (const cls of CABIN_CLASSES) {
    const ref = refFare(dist, cls);
    let best = { fare: ref, value: -Infinity };
    const hasSeats = route.assignments.some((a) => (s.aircraft[a.aircraftId]?.cabin[cls] ?? 0) > 0);
    if (!hasSeats) {
      suggested[cls] = ref;
      continue;
    }
    for (const k of FARE_STEPS) {
      route.fares = { ...suggested, [cls]: Math.round(ref * k) } as Record<CabinClass, number>;
      const e = evaluate(s, routeId, catalog);
      const perPax = BALANCE.serviceCostPerPax[s.airlines[airlineId]!.serviceLevel]! * BALANCE.serviceClassMultiplier[cls];
      const value = e.pax[cls] * (route.fares[cls] - perPax);
      if (value > best.value + 1e-6) best = { fare: route.fares[cls], value };
    }
    suggested[cls] = best.fare;
  }
  route.fares = cmd.fares ? { ...cmd.fares } : route.fares;
  if (cmd.type === 'updateRoute' && !cmd.fares) route.fares = { ...state.routes[routeId]!.fares };
  const e = evaluate(s, routeId, catalog);
  return {
    ok: true,
    expectedLoadFactor: e.lf,
    expectedProfitPerDay: e.profit,
    paybackDays: e.profit > 0 ? Math.ceil(e.upfront / e.profit) : null,
    suggestedFares: suggested,
    demandPerDay: Math.round(e.demand),
    competitors: e.competitors,
    distanceKm: Math.round(dist),
  };
}
