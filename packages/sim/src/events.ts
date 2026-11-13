import type { ActiveEvent, Catalog, EventKind, GameState, Notification } from '@skyempire/shared';
import { dateOf } from './calendar';
import { nextId } from './ids';
import type { Rng } from './rng';

export function isAirportClosed(state: GameState, airportId: string): boolean {
  return state.events.some(
    (e) => (e.kind === 'strike' || e.kind === 'storm') && e.airportId === airportId && state.day >= e.startDay && state.day <= e.endDay,
  );
}

export function isStormAffected(state: GameState, airportId: string): boolean {
  return state.events.some((e) => e.kind === 'storm' && e.airportId === airportId && state.day >= e.startDay && state.day <= e.endDay);
}

const playerBases = (state: GameState) => state.airlines[state.playerId]?.baseIds ?? [];

function note(state: GameState, level: Notification['level'], title: string, body: string, airportId?: string): Notification {
  return { id: nextId(state, 'n'), day: state.day, level, category: 'event', title, body, ...(airportId ? { link: { kind: 'airport' as const, id: airportId } } : {}) };
}

/** End expired events, then roll new ones (simulation-spec §11). Returns notifications. */
export function rollEvents(state: GameState, catalog: Catalog, rng: Rng): Notification[] {
  const out: Notification[] = [];
  const ended = state.events.filter((e) => state.day > e.endDay);
  state.events = state.events.filter((e) => state.day <= e.endDay);
  for (const e of ended) {
    const where = e.airportId ? ` at ${e.airportId}` : '';
    const titles: Record<EventKind, string> = {
      fuelSpike: 'Fuel prices ease', recession: 'Recession ends', boom: 'Boom cools off',
      strike: `Strike over${where}`, storm: `Storm clears${where}`, expansion: `Expansion complete${where}`,
    };
    out.push(note(state, 'info', titles[e.kind], 'Operations are back to normal.', e.airportId));
  }

  const airports = Object.values(catalog.airports);
  const month = dateOf(state.day).month;
  const winter = month === 11 || month === 12 || month === 1 || month === 2;
  const start = (kind: EventKind, days: number, magnitude: number, airportId?: string): ActiveEvent => {
    const e: ActiveEvent = { id: nextId(state, 'ev'), kind, startDay: state.day, endDay: state.day + days - 1, magnitude, ...(airportId ? { airportId } : {}) };
    state.events.push(e);
    return e;
  };

  if (rng.chance(1 / 360)) {
    const m = Math.round(rng.range(1.3, 1.8) * 100) / 100;
    const days = rng.int(30, 120);
    state.market.fuelPricePerKg = Math.round(state.market.fuelPricePerKg * m * 10000) / 10000;
    start('fuelSpike', days, m);
    out.push(note(state, 'major', 'Fuel prices spike', `Jet fuel is up ${Math.round((m - 1) * 100)}% for about ${days} days.`));
  }
  if (rng.chance(1 / 1080) && !state.events.some((e) => e.kind === 'recession' || e.kind === 'boom')) {
    start('recession', 180, 1);
    out.push(note(state, 'major', 'Recession hits', 'Travel demand will fall by up to 20% over the next six months.'));
  }
  if (rng.chance(1 / 1080) && !state.events.some((e) => e.kind === 'recession' || e.kind === 'boom')) {
    start('boom', 180, 1);
    out.push(note(state, 'info', 'Economic boom', 'Travel demand will rise by up to 20% over the next six months.'));
  }
  if (rng.chance(4 / 360)) {
    const ap = rng.pick(airports.filter((a) => a.sizeClass >= 3));
    const days = rng.int(1, 5);
    start('strike', days, 1, ap.id);
    const level = playerBases(state).includes(ap.id) ? 'major' : 'warning';
    out.push(note(state, level, `Strike at ${ap.id}`, `${ap.name} is closed for ${days} day${days > 1 ? 's' : ''}. Flights there are cancelled.`, ap.id));
  }
  if (rng.chance((winter ? 6 : 2) / 360)) {
    const ap = rng.pick(airports);
    const days = rng.int(1, 3);
    start('storm', days, 1, ap.id);
    out.push(note(state, 'warning', `Storm at ${ap.id}`, `${ap.name} is closed for ${days} day${days > 1 ? 's' : ''}.`, ap.id));
  }
  if (rng.chance(2 / 360)) {
    const ap = rng.pick(airports.filter((a) => a.sizeClass >= 3));
    const bonus = Math.round(rng.range(0.2, 0.5) * 100) / 100;
    state.airportSlotBonus[ap.id] = (state.airportSlotBonus[ap.id] ?? 0) + bonus;
    out.push(note(state, 'info', `${ap.id} expands`, `${ap.name} adds ${Math.round(bonus * 100)}% more slots.`, ap.id));
  }
  return out;
}
