import type { Assignment, Catalog, Command, CommandResult, GameState } from '@skyempire/shared';
import { flightDistanceKm } from '../routing';
import { banMessage, isBanned } from '../tensions';
import { nextId } from '../ids';
import { aircraftHoursUsed, roundTripHours, slotCapacity, slotsNeeded } from '../ops';
import { BALANCE } from '../config/balance';
import { ERR } from './errors';
import { recomputeSlots } from './slots';

type Fail = { ok: false; reason: string };
const fail = (reason: string): Fail => ({ ok: false, reason });

/** Validate a set of assignments for from→to. `excludeRouteId` = the route being edited. */
export function validateAssignments(
  state: GameState, airlineId: string, from: string, to: string, assignments: Assignment[], catalog: Catalog, excludeRouteId?: string,
): Fail | null {
  const a = catalog.airports[from], b = catalog.airports[to];
  if (!a) return fail(ERR.unknownAirport(from));
  if (!b) return fail(ERR.unknownAirport(to));
  const banned = isBanned(state, a.country, b.country);
  if (banned) return fail(banMessage(catalog, banned));
  const flight = flightDistanceKm(state, catalog, a.id, b.id);
  if (flight.blocked) return fail(flight.blocked);
  const dist = flight.km;
  const seen = new Set<string>();
  for (const asg of assignments) {
    if (seen.has(asg.aircraftId)) return fail(ERR.duplicateAssignment);
    seen.add(asg.aircraftId);
    const ac = state.aircraft[asg.aircraftId];
    if (!ac || ac.ownerId !== airlineId) return fail(ERR.unknownAircraft);
    const t = catalog.aircraftTypes[ac.typeId]!;
    if (t.rangeKm < dist) return fail(ERR.rangeTooShort(t.name, t.rangeKm));
    for (const ap of [a, b]) if (ap.runwayM < t.minRunwayM) return fail(ERR.runwayTooShort(ap.id, t.name));
    const used = aircraftHoursUsed(ac.id, state, catalog, excludeRouteId);
    const need = asg.roundTripsPerWeek * roundTripHours(dist, t);
    if (used + need > BALANCE.weeklyHours + 1e-9) return fail(ERR.noHours(t.name, BALANCE.weeklyHours - used));
  }
  const total = assignments.reduce((s, x) => s + x.roundTripsPerWeek, 0);
  const current = excludeRouteId && state.routes[excludeRouteId]?.status === 'active'
    ? slotsNeeded(state.routes[excludeRouteId]!.assignments.reduce((s, x) => s + x.roundTripsPerWeek, 0)) : 0;
  const need = total > 0 ? slotsNeeded(total) : 0;
  for (const id of [from, to]) {
    const free = slotCapacity(state, catalog, id) - (state.slotsUsed[id] ?? 0) + current;
    if (need > free) return fail(ERR.noSlots(id));
  }
  return null;
}

export function applyRoutes(state: GameState, airlineId: string, cmd: Command, catalog: Catalog): CommandResult {
  const al = state.airlines[airlineId]!;
  switch (cmd.type) {
    case 'openRoute': {
      if (!catalog.airports[cmd.from]) return fail(ERR.unknownAirport(cmd.from));
      if (!catalog.airports[cmd.to]) return fail(ERR.unknownAirport(cmd.to));
      if (!al.baseIds.includes(cmd.from) && !al.baseIds.includes(cmd.to)) return fail(ERR.noBase);
      const pair = [cmd.from, cmd.to].sort().join('-');
      if (Object.values(state.routes).some((r) => r.airlineId === airlineId && [r.from, r.to].sort().join('-') === pair))
        return fail(ERR.duplicateRoute);
      const bad = validateAssignments(state, airlineId, cmd.from, cmd.to, cmd.assignments, catalog);
      if (bad) return bad;
      const id = nextId(state, 'rt');
      state.routes[id] = {
        id, airlineId, from: cmd.from, to: cmd.to, fares: { ...cmd.fares }, assignments: cmd.assignments.map((a) => ({ ...a })),
        status: 'active', openedDay: state.day, last: null, profit30: [],
      };
      recomputeSlots(state);
      return { ok: true };
    }
    case 'updateRoute': {
      const r = state.routes[cmd.routeId];
      if (!r || r.airlineId !== airlineId) return fail(ERR.unknownRoute);
      if (cmd.assignments && cmd.assignments.length > 0) {
        const bad = validateAssignments(state, airlineId, r.from, r.to, cmd.assignments, catalog, r.id);
        if (bad) return bad;
      }
      if (cmd.seasonalFares) {
        if (cmd.seasonalFares.some((f) => f.startDay < state.day)) return fail(ERR.seasonalPast);
        r.seasonalFares = cmd.seasonalFares.map((f) => ({ ...f }));
      }
      if (cmd.fares) r.fares = { ...cmd.fares };
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
