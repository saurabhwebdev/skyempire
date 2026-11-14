import type { Catalog, GameState, Route, RouteSuggestion } from '@skyempire/shared';
import { CABIN_CLASSES } from '@skyempire/shared';
import { estimateRoute } from './ai/decide';
import { dateOf } from './calendar';
import { BALANCE } from './config/balance';
import { hoursByAircraft, pairKey } from './daySim';
import { baseDemand, refFare } from './demand';
import { distanceKm } from './geo';
import { maxRoundTripsPerWeek, roundTripHours } from './ops';
import { preview } from './preview';

export type { RouteSuggestion } from '@skyempire/shared';

const MIN_KM = 150;
const SHORTLIST = 40;
const CONFIRM = 6;
const MAX_RTPW = 21;
/** Below this share of free weekly hours an aircraft counts as busy. */
const MIN_FREE_SHARE = 0.15;

const refFares = (km: number) => Object.fromEntries(CABIN_CLASSES.map((c) => [c, refFare(km, c)])) as Route['fares'];

/**
 * Up to `limit` profitable new routes from the airline's bases that use the aircraft's free weekly hours.
 * Candidates are pre-ranked by demand, scored with the AI route estimate, then confirmed with `preview`
 * (which also gives the suggested fares).
 */
export function suggestRoutes(state: GameState, airlineId: string, aircraftId: string, catalog: Catalog, limit = 3): RouteSuggestion[] {
  const al = state.airlines[airlineId];
  const ac = state.aircraft[aircraftId];
  if (!al || !ac || ac.ownerId !== airlineId) return [];
  const t = catalog.aircraftTypes[ac.typeId]!;
  const hours = hoursByAircraft(state, catalog);
  const free = BALANCE.weeklyHours - (hours.get(ac.id) ?? 0);
  if (free < MIN_FREE_SHARE * BALANCE.weeklyHours) return [];

  const taken = new Set(Object.values(state.routes).filter((r) => r.airlineId === airlineId).map((r) => pairKey(r.from, r.to)));
  const doy = dateOf(state.day, state.world.startYear).dayOfYear;
  const shortlist: { from: string; to: string; km: number; demand: number }[] = [];
  for (const base of al.baseIds) {
    const A = catalog.airports[base]!;
    if (A.runwayM < t.minRunwayM) continue;
    for (const B of Object.values(catalog.airports)) {
      if (B.id === A.id || taken.has(pairKey(A.id, B.id)) || B.runwayM < t.minRunwayM) continue;
      const km = distanceKm(A, B);
      if (km < MIN_KM || km > t.rangeKm) continue;
      shortlist.push({ from: A.id, to: B.id, km, demand: baseDemand(A, B, doy, 1) + baseDemand(B, A, doy, 1) });
    }
  }
  shortlist.sort((x, y) => y.demand - x.demand);

  const scored = shortlist.slice(0, SHORTLIST).flatMap((c) => {
    const rtpw = Math.min(MAX_RTPW, Math.floor(free / roundTripHours(c.km, t)), maxRoundTripsPerWeek(c.km, t));
    if (rtpw < 1) return [];
    const e = estimateRoute(state, airlineId, c.from, c.to, ac.id, rtpw, refFares(c.km), catalog, hours);
    return e.profit > 0 ? [{ ...c, rtpw, profit: e.profit }] : [];
  }).sort((x, y) => y.profit - x.profit);

  const out: RouteSuggestion[] = [];
  for (const c of scored.slice(0, CONFIRM)) {
    const cmd = { type: 'openRoute' as const, from: c.from, to: c.to, fares: refFares(c.km), assignments: [{ aircraftId: ac.id, roundTripsPerWeek: c.rtpw }] };
    const first = preview(state, airlineId, cmd, catalog);
    if (!first.ok || !first.suggestedFares) continue;
    const p = preview(state, airlineId, { ...cmd, fares: first.suggestedFares }, catalog);
    if (!p.ok || (p.expectedProfitPerDay ?? 0) <= 0) continue;
    out.push({ from: c.from, to: c.to, roundTripsPerWeek: c.rtpw, fares: first.suggestedFares, expectedLoadFactor: p.expectedLoadFactor ?? 0,
      expectedProfitPerDay: p.expectedProfitPerDay ?? 0, distanceKm: Math.round(c.km) });
  }
  return out.sort((x, y) => y.expectedProfitPerDay - x.expectedProfitPerDay).slice(0, limit);
}
