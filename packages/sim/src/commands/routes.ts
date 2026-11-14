import type { SeasonalFare, Assignment, Catalog, Command, CommandResult, GameState } from '@skyempire/shared';
type Fares = Record<'economy' | 'premium' | 'business', number>;
/** Same airports in the same order, read either way. */
const chainKey = (c: string[]) => { const f = c.join('>'), b = [...c].reverse().join('>'); return f < b ? f : b; };
import { distanceKm } from '../geo';
import { flightDistanceKm, pairKey, routeChain, routeLegs, routeMarkets } from '../routing';
import { refFare } from '../demand';
import { banMessage, isBanned } from '../tensions';
import { nextId } from '../ids';
import { aircraftHoursUsed, chainRoundTripHours, slotCapacity, slotsNeeded } from '../ops';
import { BALANCE } from '../config/balance';
import { ERR } from './errors';
import { recomputeSlots } from './slots';

type Fail = { ok: false; reason: string };
const fail = (reason: string): Fail => ({ ok: false, reason });

/** Validate a set of assignments for from → stops → to. `excludeRouteId` = the route being edited. */
export function validateAssignments(
  state: GameState, airlineId: string, from: string, to: string, assignments: Assignment[], catalog: Catalog, excludeRouteId?: string, stops: string[] = [],
): Fail | null {
  const chain = [from, ...stops, to];
  for (const id of chain) if (!catalog.airports[id]) return fail(ERR.unknownAirport(id));
  const legs = routeLegs({ from, to, stops });
  // Tensions block new or bigger schedules only: a grounded route can still change fares or shed aircraft.
  const existing = excludeRouteId ? state.routes[excludeRouteId] : undefined;
  const shrinks = !!existing && assignments.every((x) => (existing.assignments.find((y) => y.aircraftId === x.aircraftId)?.roundTripsPerWeek ?? 0) >= x.roundTripsPerWeek);
  const flights = legs.map(([x, y]) => flightDistanceKm(state, catalog, x, y));
  if (!shrinks) {
    for (const [i, [x, y]] of legs.entries()) {
      const banned = isBanned(state, catalog.airports[x]!.country, catalog.airports[y]!.country);
      if (banned) return fail(banMessage(catalog, banned));
      if (flights[i]!.blocked) return fail(flights[i]!.blocked!);
    }
  }
  // Weekly hour budgets use great-circle planning distances; range uses the distance actually flown, per leg.
  const seen = new Set<string>();
  for (const asg of assignments) {
    if (seen.has(asg.aircraftId)) return fail(ERR.duplicateAssignment);
    seen.add(asg.aircraftId);
    const ac = state.aircraft[asg.aircraftId];
    if (!ac || ac.ownerId !== airlineId) return fail(ERR.unknownAircraft);
    const t = catalog.aircraftTypes[ac.typeId]!;
    for (const [i, [x, y]] of legs.entries()) {
      const dist = distanceKm(catalog.airports[x]!, catalog.airports[y]!);
      if (t.rangeKm < dist || (!shrinks && t.rangeKm < flights[i]!.km)) return fail(ERR.rangeTooShort(t.name, t.rangeKm));
    }
    for (const id of chain) if (catalog.airports[id]!.runwayM < t.minRunwayM) return fail(ERR.runwayTooShort(id, t.name));
    const used = aircraftHoursUsed(ac.id, state, catalog, excludeRouteId);
    const need = asg.roundTripsPerWeek * chainRoundTripHours(catalog, { from, to, stops }, t);
    if (used + need > BALANCE.weeklyHours + 1e-9) return fail(ERR.noHours(t.name, BALANCE.weeklyHours - used));
  }
  const total = assignments.reduce((s, x) => s + x.roundTripsPerWeek, 0);
  const current = excludeRouteId && state.routes[excludeRouteId]?.status === 'active'
    ? slotsNeeded(state.routes[excludeRouteId]!.assignments.reduce((s, x) => s + x.roundTripsPerWeek, 0)) : 0;
  const need = total > 0 ? slotsNeeded(total) : 0;
  for (const id of chain) {
    const mult = id === from || id === to ? 1 : 2; // a stop sees twice the movements
    const free = slotCapacity(state, catalog, id) - (state.slotsUsed[id] ?? 0) + mult * current;
    if (mult * need > free) return fail(ERR.noSlots(id));
  }
  return null;
}

/** Fares for every market other than end to end: what the player sent, else the reference fare for the distance. */
function fillLegFares(catalog: Catalog, from: string, to: string, stops: string[], given?: Record<string, Fares>): Record<string, Fares> | undefined {
  if (!stops.length) return undefined;
  const out: Record<string, Fares> = {};
  for (const m of routeMarkets({ from, to, stops })) {
    if (m.key === pairKey(from, to)) continue;
    const km = distanceKm(catalog.airports[m.a]!, catalog.airports[m.b]!);
    out[m.key] = given?.[m.key] ? { ...given[m.key]! } : { economy: refFare(km, 'economy'), premium: refFare(km, 'premium'), business: refFare(km, 'business') };
  }
  return out;
}

export function applyRoutes(state: GameState, airlineId: string, cmd: Command, catalog: Catalog): CommandResult {
  const al = state.airlines[airlineId]!;
  switch (cmd.type) {
    case 'openRoute': {
      const stops = cmd.stops ?? [];
      const chain = [cmd.from, ...stops, cmd.to];
      for (const ap of chain) if (!catalog.airports[ap]) return fail(ERR.unknownAirport(ap));
      if (stops.length > 2) return fail(ERR.tooManyStops);
      if (new Set(chain).size !== chain.length) return fail(ERR.repeatedStop);
      if (!al.baseIds.includes(cmd.from) && !al.baseIds.includes(cmd.to)) return fail(ERR.noBase);
      // The same chain (either way round) can't be flown twice; a nonstop and a one-stop between the same ends can.
      const key = chainKey(chain);
      if (Object.values(state.routes).some((r) => r.airlineId === airlineId && chainKey(routeChain(r)) === key)) return fail(ERR.duplicateRoute);
      const bad = validateAssignments(state, airlineId, cmd.from, cmd.to, cmd.assignments, catalog, undefined, stops);
      if (bad) return bad;
      const id = nextId(state, 'rt');
      const legFares = fillLegFares(catalog, cmd.from, cmd.to, stops, cmd.legFares);
      state.routes[id] = {
        id, airlineId, from: cmd.from, to: cmd.to, fares: { ...cmd.fares }, assignments: cmd.assignments.map((a) => ({ ...a })),
        status: 'active', openedDay: state.day, last: null, profit30: [],
        ...(stops.length ? { stops: [...stops], legFares } : {}),
      };
      recomputeSlots(state);
      return { ok: true };
    }
    case 'updateRoute': {
      const r = state.routes[cmd.routeId];
      if (!r || r.airlineId !== airlineId) return fail(ERR.unknownRoute);
      if (cmd.assignments && cmd.assignments.length > 0) {
        const bad = validateAssignments(state, airlineId, r.from, r.to, cmd.assignments, catalog, r.id, r.stops ?? []);
        if (bad) return bad;
      }
      if (cmd.seasonalFares) {
        // Periods already on the route may have started; anything new must start today or later.
        const kept = (f: SeasonalFare) => r.seasonalFares?.some((x) => x.startDay === f.startDay && x.endDay === f.endDay && x.pct === f.pct);
        if (cmd.seasonalFares.some((f) => f.startDay < state.day && !kept(f))) return fail(ERR.seasonalPast);
        r.seasonalFares = cmd.seasonalFares.map((f) => ({ ...f }));
      }
      if (cmd.fares) r.fares = { ...cmd.fares };
      if (cmd.legFares && r.stops?.length) r.legFares = fillLegFares(catalog, r.from, r.to, r.stops, { ...r.legFares, ...cmd.legFares });
      if (cmd.assignments) {
        r.assignments = cmd.assignments.map((a) => ({ ...a }));
        r.status = r.assignments.length ? 'active' : 'suspended';
        recomputeSlots(state);
      }
      return { ok: true };
    }
    case 'closeRoute': {
      const r = state.routes[cmd.routeId];
      if (!r || r.airlineId !== airlineId) return fail(ERR.unknownRoute);
      delete state.routes[r.id];
      recomputeSlots(state);
      return { ok: true };
    }
    case 'preCancel': {
      const r = state.routes[cmd.routeId];
      if (!r || r.airlineId !== airlineId) return fail(ERR.unknownRoute);
      if (cmd.day < state.day + 1 || cmd.day > state.day + 3) return fail(ERR.preCancelWindow);
      const days = state.world.preCancelled[r.id] ?? [];
      if (!days.includes(cmd.day)) state.world.preCancelled[r.id] = [...days, cmd.day].sort((x, y) => x - y);
      return { ok: true };
    }
    default:
      throw new Error(`not a route command: ${cmd.type}`);
  }
}
