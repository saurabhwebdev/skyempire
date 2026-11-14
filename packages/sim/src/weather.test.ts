import { describe, expect, it } from 'vitest';
import { dateOf } from './calendar';
import { applyCommand } from './commands/apply';
import { hoursByAircraft, routeOps } from './daySim';
import { airport, catalog, fares, lease, playerAircraft, playerGame } from './testing';
import { tick } from './tick';
import { simulatedWeather, weatherAt, weatherEffect } from './weather';

const DAYS = 3650; // ten years from Jan 1 2026
function share(id: string, cond: string, months: number[]) {
  let hit = 0, n = 0;
  for (let d = 0; d < DAYS; d++) {
    if (!months.includes(dateOf(d, 2026).month)) continue;
    n++;
    if (simulatedWeather(42, airport(id), d, 2026) === cond) hit++;
  }
  return hit / n;
}

function withRoute(from = 'FRA', to = 'MAD', typeId = 'A20N', rtpw = 14) {
  const s = playerGame(from, 0);
  applyCommand(s, s.playerId, lease(typeId), catalog);
  const ac = playerAircraft(s)[0]!.id;
  expect(applyCommand(s, s.playerId, { type: 'openRoute', from, to, fares, assignments: [{ aircraftId: ac, roundTripsPerWeek: rtpw }] }, catalog)).toEqual({ ok: true });
  return { s, r: Object.values(s.routes)[0]! };
}
const flown = (o: ReturnType<typeof routeOps>) => [...o.roundTrips.values()].reduce((a, b) => a + b, 0);

describe('simulated weather', () => {
  it('is deterministic for the same inputs', () => {
    for (let d = 0; d < 50; d++) expect(simulatedWeather(7, airport('LHR'), d, 2026)).toBe(simulatedWeather(7, airport('LHR'), d, 2026));
  });
  it('Helsinki gets snow on 4–12% of January days, none in July', () => {
    const jan = share('HEL', 'snow', [1]);
    expect(jan).toBeGreaterThan(0.04);
    expect(jan).toBeLessThan(0.12);
    expect(share('HEL', 'snow', [7])).toBe(0);
  });
  it('Singapore never gets snow', () => expect(share('SIN', 'snow', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).toBe(0));
  it('Manila gets typhoon days in Aug–Oct, none in February', () => {
    expect(share('MNL', 'cyclone', [8, 9, 10])).toBeGreaterThan(0);
    expect(share('MNL', 'cyclone', [2])).toBe(0);
  });
  it('mostly clear skies', () => expect(share('MAD', 'clear', [5])).toBeGreaterThan(0.5));
  it('live weather overrides simulated weather', () => {
    const s = playerGame('FRA', 0);
    s.world.liveWeather[5] = { FRA: 'fog' };
    expect(weatherAt(s, catalog, 'FRA', 5)).toBe('fog');
  });
});

describe('weather effects', () => {
  it('follow the design table', () => {
    expect(weatherEffect('snow', airport('FRA'), 'narrowbody')).toMatchObject({ capacityCut: 0.4, onTimePenalty: 20, cancelShare: 0.1, deicePerDeparture: 300, closed: false });
    expect(weatherEffect('thunderstorm', airport('FRA'), 'turboprop').cancelShare).toBeCloseTo(0.075);
    expect(weatherEffect('fog', { ...airport('FRA'), runwayM: 2000 }, 'narrowbody').cancelShare).toBeCloseTo(0.15);
    expect(weatherEffect('cyclone', airport('MNL'), 'widebody').closed).toBe(true);
    expect(weatherEffect('clear', airport('FRA'), 'narrowbody')).toMatchObject({ capacityCut: 0, onTimePenalty: 0, cancelShare: 0, closed: false });
  });
  it('snow at the origin cancels ~10% of flights and adds de-icing and passenger-care costs', () => {
    const { s, r } = withRoute();
    s.day = 3;
    const base = routeOps(r, s, catalog, hoursByAircraft(s, catalog), false);
    s.world.liveWeather[3] = { FRA: 'snow' };
    const snow = routeOps(r, s, catalog, hoursByAircraft(s, catalog), false);
    expect(flown(snow)).toBeCloseTo(flown(base) * 0.9);
    expect(snow.weatherFees).toBeGreaterThan(300);
    expect(snow.onTime).toBeLessThan(base.onTime);
    expect(base.weatherFees).toBe(0);
  });
  it('spare aircraft (under 85% busy) halve the punctuality hit', () => {
    const { s, r } = withRoute('FRA', 'MAD', 'A20N', 7);
    s.day = 3;
    const base = routeOps(r, s, catalog, hoursByAircraft(s, catalog), false);
    s.world.liveWeather[3] = { FRA: 'snow' };
    expect(base.onTime - routeOps(r, s, catalog, hoursByAircraft(s, catalog), false).onTime).toBeCloseTo(10);
  });
  it('a tropical cyclone closes the airport', () => {
    const { s, r } = withRoute();
    s.day = 3;
    s.world.liveWeather[3] = { MAD: 'cyclone' };
    expect(routeOps(r, s, catalog, hoursByAircraft(s, catalog), false).closed).toBe(true);
  });
});

describe('cancel ahead', () => {
  it('a cyclone closure strands passengers ($20/seat) unless flights were cancelled ahead ($5/seat)', () => {
    const { s, r } = withRoute();
    s.day = 3;
    s.world.liveWeather[3] = { MAD: 'cyclone' };
    const onDay = routeOps(r, s, catalog, hoursByAircraft(s, catalog), false);
    expect(onDay.weatherFees).toBe(20 * 2 * 2 * 194);
    s.world.preCancelled[r.id] = [3];
    expect(routeOps(r, s, catalog, hoursByAircraft(s, catalog), false).weatherFees).toBe(5 * 2 * 2 * 194);
  });
  it('cancelling 2 days ahead grounds the route that day for $5 a seat', () => {
    const { s, r } = withRoute();
    expect(applyCommand(s, s.playerId, { type: 'preCancel', routeId: r.id, day: s.day + 2 }, catalog)).toEqual({ ok: true });
    const res = tick(tick(s, [], catalog).state, [], catalog);
    expect(res.state.day).toBe(s.day + 2);
    const ops = routeOps(res.state.routes[r.id]!, res.state, catalog, hoursByAircraft(res.state, catalog), false);
    expect(flown(ops)).toBe(0);
    expect(ops.weatherFees).toBe(5 * 2 * 2 * 194);
    expect(res.state.routes[r.id]!.last!.revenue).toBe(0);
  });
  it('rejects cancelling today or more than 3 days ahead', () => {
    const { s, r } = withRoute();
    const err = { ok: false, reason: 'You can cancel flights 1–3 days ahead' };
    expect(applyCommand(s, s.playerId, { type: 'preCancel', routeId: r.id, day: s.day }, catalog)).toEqual(err);
    expect(applyCommand(s, s.playerId, { type: 'preCancel', routeId: r.id, day: s.day + 4 }, catalog)).toEqual(err);
  });
  it('past cancellations are pruned', () => {
    const { s, r } = withRoute();
    applyCommand(s, s.playerId, { type: 'preCancel', routeId: r.id, day: s.day + 1 }, catalog);
    let st = s;
    for (let i = 0; i < 3; i++) st = tick(st, [], catalog).state;
    expect(st.world.preCancelled[r.id] ?? []).toEqual([]);
  });
});

describe('weather in the client view', () => {
  it('forecasts 3 days for each player airport', async () => {
    const { buildClientView } = await import('./view');
    const { s } = withRoute();
    const v = buildClientView(s, s.playerId, catalog);
    expect(Object.keys(v.weather.forecast).sort()).toEqual(['FRA', 'MAD']);
    expect(v.weather.forecast.FRA).toHaveLength(3);
    s.world.liveWeather[s.day] = { MAD: 'thunderstorm' };
    expect(buildClientView(s, s.playerId, catalog).weather.today.MAD).toBe('thunderstorm');
  });
});
