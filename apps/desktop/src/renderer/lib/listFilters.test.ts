import type { Aircraft, Notification, Route, SaveInfo, UsedListing } from '@skyempire/shared';
import { standardProduct } from '@skyempire/sim';
import { describe, expect, it } from 'vitest';
import { catalog } from './catalog';
import {
  filterAircraftTypes, filterFleet, filterNews, filterRoutes, filterSaves, fleetStatus, routeHealth, sortAircraftTypes, sortListings, sortSaves, textMatch,
} from './listFilters';

const TYPES = Object.values(catalog.aircraftTypes).filter((t) => t.kind !== 'freighter');
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe('text search', () => {
  it('matches every word, ignoring case and accents', () => {
    expect(textMatch('boeing 787', 'Boeing 787-9 Dreamliner')).toBe(true);
    expect(textMatch('sao', 'São Paulo')).toBe(true);
    expect(textMatch('airbus 787', 'Boeing 787-9')).toBe(false);
    expect(textMatch('  ', 'anything')).toBe(true);
  });
});

describe('aircraft market', () => {
  const base = { query: '', aircraftClass: 'all', manufacturer: 'all', availableOnly: false, tier: 'global', minRange: 0, minSeats: 0 } as const;
  it('searches by name or maker', () => {
    expect(ids(filterAircraftTypes(TYPES, { ...base, query: '787' })).sort()).toEqual(['B788', 'B789', 'B78X']);
    expect(filterAircraftTypes(TYPES, { ...base, query: 'embraer' }).every((t) => t.manufacturer === 'Embraer')).toBe(true);
  });
  it('filters by class, maker, range, seats and what you can fly now', () => {
    expect(filterAircraftTypes(TYPES, { ...base, aircraftClass: 'turboprop' }).every((t) => t.class === 'turboprop')).toBe(true);
    expect(filterAircraftTypes(TYPES, { ...base, manufacturer: 'Airbus' }).every((t) => t.manufacturer === 'Airbus')).toBe(true);
    expect(filterAircraftTypes(TYPES, { ...base, minRange: 12000, minSeats: 300 }).every((t) => t.rangeKm >= 12000 && t.maxSeats >= 300)).toBe(true);
    const startup = filterAircraftTypes(TYPES, { ...base, availableOnly: true, tier: 'startup' });
    expect(startup.length).toBeGreaterThan(0);
    expect(startup.every((t) => t.tier === 'startup' && !t.usedOnly)).toBe(true);
  });
  it('sorts by price, range, seats or fuel per seat', () => {
    const byRange = sortAircraftTypes(TYPES, 'range');
    expect(byRange[0]!.rangeKm).toBeGreaterThanOrEqual(byRange.at(-1)!.rangeKm);
    const byPrice = sortAircraftTypes(TYPES, 'price');
    expect(byPrice[0]!.priceUsd).toBeLessThanOrEqual(byPrice.at(-1)!.priceUsd);
    const byFuel = sortAircraftTypes(TYPES, 'fuel');
    expect(byFuel[0]!.fuelKgPerH / byFuel[0]!.maxSeats).toBeLessThanOrEqual(byFuel.at(-1)!.fuelKgPerH / byFuel.at(-1)!.maxSeats);
    expect(sortAircraftTypes(TYPES, 'name')[0]!.name <= sortAircraftTypes(TYPES, 'name')[1]!.name).toBe(true);
  });
  it('sorts used aircraft by age, condition or price', () => {
    const l = (id: string, ageDays: number, condition: number, price: number): UsedListing => ({ id, typeId: 'A20N', ageDays, condition, price } as UsedListing);
    const xs = [l('a', 3000, 80, 20e6), l('b', 500, 95, 40e6), l('c', 1500, 70, 30e6)];
    expect(ids(sortListings(xs, 'age'))).toEqual(['b', 'c', 'a']);
    expect(ids(sortListings(xs, 'condition'))).toEqual(['b', 'a', 'c']);
    expect(ids(sortListings(xs, 'price'))).toEqual(['a', 'c', 'b']);
  });
});

describe('fleet', () => {
  const ac = (id: string, typeId: string, o: Partial<Aircraft> = {}): Aircraft => ({
    id, typeId, ownerId: 'p', ownership: 'leased', ageDays: 0, condition: 90, flightHours: 0, hoursSinceA: 0, hoursSinceC: 0,
    cabin: { economy: 100, premium: 0, business: 0 }, product: standardProduct(), dense: false, refitDaysLeft: 0, status: 'active', maintenanceDaysLeft: 0, bookValue: 0, ...o,
  });
  const fleet = [ac('a1', 'A20N'), ac('a2', 'AT76', { ownership: 'owned' }), ac('a3', 'B738', { status: 'maintenance', maintenanceDaysLeft: 2 }), ac('a4', 'A20N', { refitDaysLeft: 3 })];
  const used = new Map([['a1', 40]]);
  it('knows each aircraft status', () => {
    expect(fleet.map((a) => fleetStatus(a, used.get(a.id) ?? 0))).toEqual(['flying', 'idle', 'maintenance', 'refit']);
  });
  it('filters by search, status and ownership', () => {
    expect(ids(filterFleet(fleet, { query: 'atr', status: 'all', ownership: 'all' }, used))).toEqual(['a2']);
    expect(ids(filterFleet(fleet, { query: '', status: 'refit', ownership: 'all' }, used))).toEqual(['a4']);
    expect(ids(filterFleet(fleet, { query: '', status: 'all', ownership: 'owned' }, used))).toEqual(['a2']);
    expect(ids(filterFleet(fleet, { query: 'a320neo', status: 'idle', ownership: 'all' }, used))).toEqual([]);
  });
});

describe('routes', () => {
  const r = (id: string, from: string, to: string, o: Partial<Route> = {}): Route => ({
    id, airlineId: 'p', from, to, fares: { economy: 100, premium: 1, business: 1 }, assignments: [], status: 'active', openedDay: 0, last: null, profit30: [], ...o,
  });
  const last = (profit: number) => ({ pax: { economy: 1, premium: 0, business: 0 }, loadFactor: 0.8, revenue: 1, cost: 1, profit });
  const routes = [r('r1', 'LHR', 'CDG', { last: last(500) }), r('r2', 'LHR', 'JFK', { last: last(-200) }), r('r3', 'LHR', 'DXB', { status: 'suspended' }), r('r4', 'LHR', 'TLV', { last: last(100) })];
  const status = { r4: { blocked: 'Route ban', detourKm: 0 } };
  it('sorts each route into a health group', () => {
    expect(routes.map((x) => routeHealth(x, status[x.id as 'r4']))).toEqual(['profitable', 'losing', 'suspended', 'grounded']);
  });
  it('a route whose aircraft are all in refit or maintenance is grounded', () => {
    const ac = { id: 'x', refitDaysLeft: 3, status: 'active' } as Aircraft;
    const grounded = r('r5', 'LHR', 'MAD', { assignments: [{ aircraftId: 'x', roundTripsPerWeek: 7 }], last: last(0) });
    expect(routeHealth(grounded, undefined, new Map([['x', ac]]))).toBe('grounded');
    expect(routeHealth(grounded, undefined, new Map([['x', { ...ac, refitDaysLeft: 0 }]]))).toBe('profitable');
  });
  it('filters by airport code or city and by health', () => {
    expect(ids(filterRoutes(routes, { query: 'paris', health: 'all' }, status))).toEqual(['r1']);
    expect(ids(filterRoutes(routes, { query: 'jfk', health: 'all' }, status))).toEqual(['r2']);
    expect(ids(filterRoutes(routes, { query: '', health: 'losing' }, status))).toEqual(['r2']);
    expect(ids(filterRoutes(routes, { query: '', health: 'grounded' }, status))).toEqual(['r4']);
  });
});

describe('news and saves', () => {
  it('searches news titles and text', () => {
    const n = (id: string, title: string, body: string) => ({ id, day: 1, level: 'info', category: 'event', title, body } as Notification);
    expect(ids(filterNews([n('1', 'Fuel prices spike', 'Jet fuel is up'), n('2', 'Strike over at CDG', 'Back to normal')], 'fuel'))).toEqual(['1']);
  });
  it('searches and sorts saves', () => {
    const s = (id: string, name: string, airlineName: string, day: number, updatedAt: number) => ({ id, name, airlineName, day, updatedAt, startYear: 2026 } as unknown as SaveInfo);
    const saves = [s('a', 'Career 1', 'Saffron Air', 300, 10), s('b', 'Hard mode', 'Blue Sky', 50, 30), s('c', 'Career 2', 'Arctic Wings', 900, 20)];
    expect(ids(filterSaves(saves, 'sky'))).toEqual(['b']);
    expect(ids(sortSaves(saves, 'recent'))).toEqual(['b', 'c', 'a']);
    expect(ids(sortSaves(saves, 'name'))).toEqual(['c', 'b', 'a']);
    expect(ids(sortSaves(saves, 'progress'))).toEqual(['c', 'a', 'b']);
  });
});

describe('routes with stops', () => {
  it('search finds a route by its stop', async () => {
    const { filterRoutes: fr } = await import('./listFilters');
    const r = { id: 'r9', airlineId: 'p', from: 'LHR', to: 'SIN', stops: ['DXB'], fares: { economy: 1, premium: 1, business: 1 }, assignments: [], status: 'active', openedDay: 0, last: null, profit30: [] } as Route;
    expect(fr([r], { query: 'dubai', health: 'all' }, {}).map((x) => x.id)).toEqual(['r9']);
  });
  it('free hours count every leg', async () => {
    const { hoursUsed } = await import('./fleet');
    const { fakeView } = await import('../testing');
    const { roundTripHours, distanceKm: dk } = await import('@skyempire/sim');
    const ac = { id: 'a1', typeId: 'A20N', ownerId: 'al_player', ownership: 'leased', ageDays: 0, condition: 90, flightHours: 0, hoursSinceA: 0, hoursSinceC: 0,
      cabin: { economy: 194, premium: 0, business: 0 }, product: standardProduct(), dense: false, refitDaysLeft: 0, status: 'active', maintenanceDaysLeft: 0, bookValue: 0 } as Aircraft;
    const r = { id: 'r9', airlineId: 'al_player', from: 'LHR', to: 'SIN', stops: ['DXB'], fares: { economy: 1, premium: 1, business: 1 }, assignments: [{ aircraftId: 'a1', roundTripsPerWeek: 2 }], status: 'active', openedDay: 0, last: null, profit30: [] } as Route;
    const t = catalog.aircraftTypes.A20N!;
    const ap = catalog.airports;
    const expected = 2 * (roundTripHours(dk(ap.LHR!, ap.DXB!), t) + roundTripHours(dk(ap.DXB!, ap.SIN!), t));
    expect(hoursUsed(fakeView({}, { aircraft: [ac], routes: [r] })).get('a1')).toBeCloseTo(expected);
  });
});
