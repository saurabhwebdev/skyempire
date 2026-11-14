import type { CargoTonnes, CargoType, Catalog, GameState, Route } from '@skyempire/shared';
import { CARGO_TYPES } from '@skyempire/shared';
import { allocateCargo, CARGO_RATE_MULT, cargoFlow, cargoFlowsByType, cargoRefRate, type CargoOffer } from './cargo';
import { dateOf } from './calendar';
import type { RouteOps } from './daySim';
import { distanceKm } from './geo';
import { routeMarkets, type RouteMarket } from './routing';

/** Handling at both ends, $ per tonne carried. */
export const HANDLING_PER_T = 180;
/** Share of perishable revenue lost per unit of lateness (1 − on-time). */
const SPOILAGE = 0.5;
/** Belly cargo on the default setting sells just under the market rate. */
const BELLY_DEFAULT_RATE = 0.95;

export interface CargoResult {
  /** Tonnes carried today, both directions. */
  tonnes: number;
  byType: CargoTonnes;
  /** Revenue after spoilage. */
  revenue: number;
  /** Handling cost. */
  handling: number;
  /** Tonnes ÷ capacity over every leg and direction. */
  load: number;
}

const zero = (): CargoTonnes => ({ general: 0, express: 0, mail: 0, perishable: 0, dangerous: 0, special: 0 });

/** Cargo types a route will take today: its own list (belly: never special), minus what the airline isn't allowed to fly. */
function accepts(r: Route, ops: RouteOps, state: GameState): Set<CargoType> {
  const al = state.airlines[r.airlineId]!;
  const list = r.kind === 'cargo' ? (r.cargoAccept ?? CARGO_TYPES) : r.belly?.mode === 'custom' ? r.belly.accept : CARGO_TYPES;
  return new Set(list.filter((t) => (t !== 'dangerous' || al.dgLicence) && (t !== 'special' || (r.kind === 'cargo' && ops.special))));
}

/** General cargo rate ($/kg) a route charges in one market. A cargo route's rate is for its end-to-end distance; other markets scale by distance. */
function generalRate(r: Route, m: RouteMarket, catalog: Catalog): number {
  const km = distanceKm(catalog.airports[m.a]!, catalog.airports[m.b]!);
  if (r.kind === 'cargo') {
    const endKm = distanceKm(catalog.airports[r.from]!, catalog.airports[r.to]!);
    return (r.cargoRate ?? cargoRefRate(endKm)) * (cargoRefRate(km) / cargoRefRate(endKm));
  }
  return r.belly?.mode === 'custom' ? r.belly.rate : BELLY_DEFAULT_RATE * cargoRefRate(km);
}

/**
 * Cargo for every route with cargo capacity (freighters, or passenger holds): each market's flows, both ways,
 * by cargo type, shared between the routes selling it and "other carriers"; legs capped at capacity per direction.
 */
export function simulateCargo(opsList: RouteOps[], state: GameState, catalog: Catalog): Map<string, CargoResult> {
  const { dayOfYear, year } = dateOf(state.day, state.world.startYear);
  const carriers = opsList.filter((o) => o.cargoCapT > 0);
  const byMarket = new Map<string, { ops: RouteOps; m: RouteMarket; ok: Set<CargoType> }[]>();
  for (const ops of carriers) {
    const ok = accepts(ops.route, ops, state);
    if (!ok.size) continue;
    for (const m of routeMarkets(ops.route)) {
      if (!byMarket.has(m.key)) byMarket.set(m.key, []);
      byMarket.get(m.key)!.push({ ops, m, ok });
    }
  }
  // routeId → market key → [forward, back] tonnes by type (forward = the route's own chain order).
  const carried = new Map<string, Map<string, [CargoTonnes, CargoTonnes]>>();
  for (const [key, entries] of byMarket) {
    const A = catalog.airports[entries[0]!.m.a]!, B = catalog.airports[entries[0]!.m.b]!;
    const ref = cargoRefRate(distanceKm(A, B));
    for (const [dir, [o, d]] of ([[A, B], [B, A]] as const).entries()) {
      const flows = cargoFlowsByType(cargoFlow(o, d, dayOfYear, state.market.economyIndex, catalog, year), o.country);
      for (const type of CARGO_TYPES) {
        const offers: CargoOffer[] = entries.filter((e) => e.ok.has(type)).map(({ ops, m }) => ({
          routeId: ops.route.id, rate: generalRate(ops.route, m, catalog), weeklyFrequency: ops.weeklyFrequency, onTime: ops.onTime, stops: m.stops, capacityT: ops.cargoCapT,
        }));
        for (const [routeId, t] of allocateCargo(flows[type], offers, ref, type)) {
          const e = entries.find((x) => x.ops.route.id === routeId)!;
          if (!carried.has(routeId)) carried.set(routeId, new Map());
          const perRoute = carried.get(routeId)!;
          if (!perRoute.has(key)) perRoute.set(key, [zero(), zero()]);
          // Direction 0 runs A→B; flip it for routes whose chain runs B→A.
          const fwd = e.m.a === A.id ? dir : 1 - dir;
          perRoute.get(key)![fwd]![type] += t;
        }
      }
    }
  }
  const out = new Map<string, CargoResult>();
  for (const ops of carriers) {
    const r = ops.route;
    const per = carried.get(r.id);
    if (!per) continue;
    const markets = routeMarkets(r);
    const legs = markets.reduce((n, m) => Math.max(n, m.last + 1), 0);
    // Every leg, each way: no more than the capacity (all cargo types share it).
    for (let leg = 0; leg < legs; leg++) for (const d of [0, 1] as const) {
      const on = markets.filter((m) => m.first <= leg && leg <= m.last && per.has(m.key));
      const load = on.reduce((x, m) => x + CARGO_TYPES.reduce((y, t) => y + per.get(m.key)![d][t], 0), 0);
      if (load > ops.cargoCapT + 1e-9) for (const m of on) for (const t of CARGO_TYPES) per.get(m.key)![d][t] *= ops.cargoCapT / load;
    }
    const byType = zero();
    let revenue = 0, legTonnes = 0;
    for (const m of markets) {
      const mt = per.get(m.key);
      if (!mt) continue;
      const rate = generalRate(r, m, catalog);
      for (const t of CARGO_TYPES) {
        const tonnes = mt[0][t] + mt[1][t];
        byType[t] += tonnes;
        let rev = tonnes * 1000 * rate * CARGO_RATE_MULT[t];
        if (t === 'perishable') rev *= 1 - SPOILAGE * (1 - ops.onTime / 100); // late flights spoil shipments
        revenue += rev;
        legTonnes += tonnes * (m.last - m.first + 1);
      }
    }
    const tonnes = CARGO_TYPES.reduce((x, t) => x + byType[t], 0);
    out.set(r.id, { tonnes, byType, revenue: Math.round(revenue), handling: Math.round(tonnes * HANDLING_PER_T), load: legTonnes / (2 * legs * ops.cargoCapT) });
  }
  return out;
}
