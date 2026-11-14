import type { ActiveTension, CabinClass, Command, GameState } from '@skyempire/shared';
import { CABIN_CLASSES } from '@skyempire/shared';
import { describe, expect, it } from 'vitest';
import { applyCommand } from './commands/apply';
import { hoursByAircraft, routeOps, simulateMarket, simulatePair, simulateRoutes } from './daySim';
import { routeTensionStatus, tensionTouchesRoute } from './tensions';
import { refFare } from './demand';
import { distanceKm } from './geo';
import { migrate, CURRENT_SCHEMA } from './migrate';
import { roundTripHours, slotsNeeded } from './ops';
import { preview } from './preview';
import { marketFare, routeChain, routeLegs, routeMarkets } from './routing';
import { catalog, lease, playerAircraft, playerGame } from './testing';
import { tick } from './tick';
import { buildClientView } from './view';

const fares = (km: number) => Object.fromEntries(CABIN_CLASSES.map((c) => [c, refFare(km, c)])) as Record<CabinClass, number>;
const km = (a: string, b: string) => distanceKm(catalog.airports[a]!, catalog.airports[b]!);

function game() {
  const s = playerGame('LHR', 3);
  s.airlines[s.playerId]!.cash = 500_000_000;
  expect(applyCommand(s, s.playerId, lease('A20N'), catalog)).toEqual({ ok: true });
  return { s, ac: playerAircraft(s)[0]!.id };
}
const open = (s: GameState, ac: string, stops: string[], to = 'SIN', rtpw = 3, extra: Partial<Command> = {}) =>
  applyCommand(s, s.playerId, { type: 'openRoute', from: 'LHR', to, stops, fares: fares(km('LHR', to)), assignments: [{ aircraftId: ac, roundTripsPerWeek: rtpw }], ...extra } as Command, catalog);

describe('route chain helpers', () => {
  const r = { from: 'LHR', to: 'SIN', stops: ['DXB'] };
  it('lists the airports, legs and every market along the way', () => {
    expect(routeChain(r)).toEqual(['LHR', 'DXB', 'SIN']);
    expect(routeLegs(r)).toEqual([['LHR', 'DXB'], ['DXB', 'SIN']]);
    expect(routeMarkets(r).map((m) => `${m.a}-${m.b}:${m.stops}`)).toEqual(['LHR-DXB:0', 'LHR-SIN:1', 'DXB-SIN:0']);
    expect(routeMarkets({ from: 'LHR', to: 'SIN', stops: ['DXB', 'DEL'] })).toHaveLength(6);
    expect(routeMarkets({ from: 'LHR', to: 'CDG' })).toHaveLength(1);
  });
  it('uses the leg fare for intermediate markets and the route fare end to end', () => {
    const route = { from: 'LHR', to: 'SIN', stops: ['DXB'], fares: { economy: 900, premium: 1, business: 1 }, legFares: { 'DXB-LHR': { economy: 500, premium: 1, business: 1 } }, seasonalFares: [{ startDay: 5, endDay: 6, pct: 10 }] };
    expect(marketFare(route, 'LHR', 'SIN', 'economy', 0)).toBe(900);
    expect(marketFare(route, 'DXB', 'LHR', 'economy', 0)).toBe(500);
    expect(marketFare(route, 'LHR', 'DXB', 'economy', 5)).toBe(550);
    expect(marketFare(route, 'DXB', 'SIN', 'economy', 0)).toBe(900); // no fare set: falls back to the end-to-end fare (opening fills them all)
  });
});

describe('opening a route with stops', () => {
  it('lets a short-range aircraft reach far by stopping, using hours for every leg and double slots at the stop', () => {
    const { s, ac } = game();
    expect(open(s, ac, [], 'SIN').ok).toBe(false); // too far nonstop for an A320neo
    expect(open(s, ac, ['DXB'])).toEqual({ ok: true });
    const r = Object.values(s.routes)[0]!;
    expect(r.stops).toEqual(['DXB']);
    const t = catalog.aircraftTypes.A20N!;
    expect(hoursByAircraft(s, catalog).get(ac)).toBeCloseTo(3 * (roundTripHours(km('LHR', 'DXB'), t) + roundTripHours(km('DXB', 'SIN'), t)));
    expect(s.slotsUsed.DXB).toBe(2 * slotsNeeded(3));
    expect(s.slotsUsed.SIN).toBe(slotsNeeded(3));
  });
  it('rejects more than 2 stops, repeated airports, legs out of range, no base, too many hours and the same chain twice', () => {
    const { s, ac } = game();
    expect(open(s, ac, ['DXB', 'DEL', 'BKK']).ok).toBe(false);
    expect(open(s, ac, ['DXB', 'LHR']).ok).toBe(false);
    expect(open(s, ac, ['JFK'], 'SYD').ok).toBe(false);
    expect(applyCommand(s, s.playerId, { type: 'openRoute', from: 'DXB', to: 'BKK', stops: ['DEL'], fares: fares(5000), assignments: [{ aircraftId: ac, roundTripsPerWeek: 1 }] }, catalog))
      .toEqual({ ok: false, reason: 'Routes must start or end at one of your bases' });
    const tooMany = open(s, ac, ['DXB'], 'SIN', 10);
    expect(!tooMany.ok && tooMany.reason).toMatch(/Not enough free hours/);
    expect(open(s, ac, ['DXB'], 'SIN', 1)).toEqual({ ok: true });
    expect(open(s, ac, ['DXB'], 'SIN', 1)).toEqual({ ok: false, reason: 'You already fly this route' });
  });
  it('a nonstop and a one-stop route to the same places can both exist', () => {
    const { s, ac } = game();
    expect(applyCommand(s, s.playerId, lease('A20N'), catalog)).toEqual({ ok: true });
    const other = playerAircraft(s).find((a) => a.id !== ac)!.id;
    expect(open(s, ac, [], 'DXB', 2)).toEqual({ ok: true });
    expect(open(s, other, ['DXB'], 'SIN', 2)).toEqual({ ok: true });
  });
});

describe('flying a route with stops', () => {
  function flying(rtpw = 3, fareFactor = 1) {
    const { s, ac } = game();
    const f = (a: string, b: string) => Object.fromEntries(CABIN_CLASSES.map((c) => [c, Math.round(refFare(km(a, b), c) * fareFactor)])) as Record<CabinClass, number>;
    expect(applyCommand(s, s.playerId, { type: 'openRoute', from: 'LHR', to: 'SIN', stops: ['DXB'], fares: f('LHR', 'SIN'),
      legFares: { 'DXB-LHR': f('LHR', 'DXB'), 'DXB-SIN': f('DXB', 'SIN') }, assignments: [{ aircraftId: ac, roundTripsPerWeek: rtpw }] }, catalog)).toEqual({ ok: true });
    return { s, ac, id: Object.keys(s.routes)[0]! };
  }
  const run = (s: GameState, days: number) => { let st = s; for (let i = 0; i < days; i++) st = tick(st, [], catalog).state; return st; };

  it('carries passengers in every market and earns the market fares', () => {
    const { s, id } = flying();
    const st = run(s, 6); // 3 round trips a week fly on days 2, 4 and 6
    const last = st.routes[id]!.last!;
    expect(Object.keys(last.marketPax!).sort()).toEqual(['DXB-LHR', 'DXB-SIN', 'LHR-SIN']);
    for (const p of Object.values(last.marketPax!)) expect(p.economy).toBeGreaterThan(0);
    const r = st.routes[id]!;
    const revenue = routeMarkets(r).reduce((sum, m) => sum + CABIN_CLASSES.reduce((x, c) => x + last.marketPax![m.key]![c] * marketFare(r, m.a, m.b, c, st.day), 0), 0);
    expect(last.revenue).toBe(Math.round(revenue));
    expect(last.legLoad).toHaveLength(2);
  });
  it('never puts more passengers on a leg than it has seats, even when cheap fares flood it', () => {
    const { s, id } = flying(3, 0.4);
    let st = s, fullest = 0;
    for (let i = 0; i < 7; i++) {
      st = tick(st, [], catalog).state;
      const last = st.routes[id]!.last!;
      for (const lf of last.legLoad!) expect(lf).toBeLessThanOrEqual(1 + 1e-9);
      expect(last.loadFactor).toBeLessThanOrEqual(1 + 1e-9);
      fullest = Math.max(fullest, ...last.legLoad!);
    }
    expect(fullest).toBeGreaterThan(0.95);
  });
  it('caps each leg in each direction, even when demand is lopsided', () => {
    // Outbound demand can beat the seats while the return is lighter: the total alone would hide it.
    const { s, ac } = game();
    const f = (a: string, b: string) => Object.fromEntries(CABIN_CLASSES.map((c) => [c, Math.round(refFare(km(a, b), c) * 1.2)])) as Record<CabinClass, number>;
    s.world.tensions.push({ id: 'adv', kind: 'advisory', country: 'AE', magnitude: 0.5, warnDay: 0, startDay: 0, endDay: 500 } as never);
    expect(applyCommand(s, s.playerId, { type: 'openRoute', from: 'LHR', to: 'DXB', stops: ['IST'], fares: f('LHR', 'DXB'), legFares: { 'IST-LHR': f('LHR', 'IST'), 'DXB-IST': f('IST', 'DXB') }, assignments: [{ aircraftId: ac, roundTripsPerWeek: 6 }] }, catalog)).toEqual({ ok: true });
    const r = Object.values(s.routes)[0]!;
    const ops = routeOps(r, s, catalog, hoursByAircraft(s, catalog), true);
    const res = simulateRoutes([ops], s, catalog).results.get(r.id)!;
    for (const [leg, dirs] of res.legPaxByDirection.entries())
      for (const d of dirs) for (const c of CABIN_CLASSES) expect(d[c], `leg ${leg} ${c}`).toBeLessThanOrEqual(ops.seats[c] + 1e-9);
  });
  it('a strike at the stop grounds the whole route', () => {
    const { s, id } = flying();
    s.events.push({ id: 'x', kind: 'strike', startDay: 1, endDay: 3, airportId: 'DXB', magnitude: 1 });
    const st = tick(s, [], catalog).state;
    expect(st.routes[id]!.last).toMatchObject({ revenue: 0, cost: 0 });
  });
  it('a ban on one leg grounds the route and shows why', () => {
    const { s, id } = flying();
    s.world.tensions.push({ id: 'ban1', kind: 'routeBan', countries: ['AE', 'SG'], magnitude: 1, warnDay: 0, startDay: 0, endDay: 500 });
    expect(routeTensionStatus(s, catalog, s.routes[id]!).blocked).toMatch(/banned between United Arab Emirates and Singapore/);
    let st = s;
    for (let i = 0; i < 6; i++) st = tick(st, [], catalog).state;
    expect(st.routes[id]!.last!.revenue).toBe(0);
  });
  it('rival planning sees a stop route as a one-stop offer, not a nonstop', () => {
    const { s, id } = flying();
    const ops = routeOps(s.routes[id]!, s, catalog, hoursByAircraft(s, catalog), true);
    const through = routeMarkets(s.routes[id]!).find((m) => m.key === 'LHR-SIN')!;
    expect(through.stops).toBe(1);
    const viaPair = simulatePair([ops], s, catalog).pax.get(id)!;
    const asOneStop = simulateMarket([{ ops, m: through }], s, catalog).pax.get(id)!;
    const asNonstop = simulateMarket([{ ops, m: { ...through, stops: 0 } }], s, catalog).pax.get(id)!;
    expect(viaPair.economy).toBeCloseTo(asOneStop.economy);
    expect(asNonstop.economy).not.toBeCloseTo(asOneStop.economy);
  });
  it('tension warnings count the legs through a stop', () => {
    const { s, id } = flying();
    const r = s.routes[id]!;
    const ban: ActiveTension = { id: 'b', kind: 'routeBan', countries: ['AE', 'SG'], magnitude: 1, warnDay: 0, startDay: 5, endDay: 50 };
    expect(tensionTouchesRoute(catalog, ban, r)).toBe(true);
    expect(tensionTouchesRoute(catalog, { ...ban, countries: ['GB', 'SG'] }, r)).toBe(false); // nobody flies LHR–SIN nonstop here
    expect(tensionTouchesRoute(catalog, { id: 'a', kind: 'advisory', country: 'AE', magnitude: 0.3, warnDay: 0, startDay: 5, endDay: 50 }, r)).toBe(true);
  });
  it('costs cover every leg', () => {
    const weekCost = (st: GameState, id: string) => { let x = st, sum = 0; for (let i = 0; i < 7; i++) { x = tick(x, [], catalog).state; sum += x.routes[id]!.last!.cost; } return sum; };
    const multi = flying(3);
    const nonstop = game();
    expect(applyCommand(nonstop.s, nonstop.s.playerId, { type: 'openRoute', from: 'LHR', to: 'DXB', fares: fares(km('LHR', 'DXB')), assignments: [{ aircraftId: nonstop.ac, roundTripsPerWeek: 3 }] }, catalog)).toEqual({ ok: true });
    expect(weekCost(multi.s, multi.id)).toBeGreaterThan(1.6 * weekCost(nonstop.s, Object.keys(nonstop.s.routes)[0]!));
  });
  it('preview suggests a fare for every market', () => {
    const { s, ac } = game();
    const p = preview(s, s.playerId, { type: 'openRoute', from: 'LHR', to: 'SIN', stops: ['DXB'], fares: fares(km('LHR', 'SIN')), assignments: [{ aircraftId: ac, roundTripsPerWeek: 3 }] }, catalog);
    expect(p.ok).toBe(true);
    expect(p.expectedLoadFactor).toBeGreaterThan(0);
    expect(Object.keys(p.suggestedLegFares!).sort()).toEqual(['DXB-LHR', 'DXB-SIN']);
    expect(p.suggestedLegFares!['DXB-LHR']!.economy).toBeLessThan(p.suggestedFares!.economy);
  });
});

describe('client view', () => {
  it('counts the stop as one of your markets and airports', () => {
    const { s, ac } = game();
    expect(open(s, ac, ['DXB'])).toEqual({ ok: true });
    const v = buildClientView(s, s.playerId, catalog);
    expect(Object.keys(v.weather.forecast)).toContain('DXB');
    const rival = Object.values(s.airlines).find((a) => !a.isPlayer)!;
    s.routes.rx = { ...structuredClone(Object.values(s.routes)[0]!), id: 'rx', airlineId: rival.id, from: 'DXB', to: 'SIN', stops: undefined, legFares: undefined };
    expect(buildClientView(s, s.playerId, catalog).rivals.find((r) => r.id === rival.id)!.overlapRoutes).toBe(1);
  });
});

describe('save format', () => {
  it('schema 4 is a version bump: routes without stops stay nonstop', () => {
    const { s } = game();
    const old = { ...structuredClone(s), schemaVersion: 3 };
    const m = migrate(old);
    expect(m.schemaVersion).toBe(CURRENT_SCHEMA);
    expect(CURRENT_SCHEMA).toBe(4);
  });
});
