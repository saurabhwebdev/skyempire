import type { GameState } from '@skyempire/shared';
import { describe, expect, it } from 'vitest';
import { applyCommand } from './commands/apply';
import { newGame } from './newGame';
import { preview } from './preview';
import { refFare } from './demand';
import { tick } from './tick';
import { catalog, config, lease, playerAircraft, playerGame } from './testing';
import { routeOps, hoursByAircraft } from './daySim';
import { standardProduct } from './cabin';

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

function withRoute(): { s: GameState; routeId: string; ac: string } {
  const s = playerGame('LHR', 3);
  applyCommand(s, s.playerId, lease('A20N'), catalog);
  const ac = playerAircraft(s)[0]!.id;
  const cmd = { type: 'openRoute' as const, from: 'LHR', to: 'CDG', fares: { economy: 1, premium: 1, business: 1 }, assignments: [{ aircraftId: ac, roundTripsPerWeek: 14 }] };
  const p = preview(s, s.playerId, cmd, catalog);
  expect(applyCommand(s, s.playerId, { ...cmd, fares: p.suggestedFares! }, catalog)).toEqual({ ok: true });
  return { s, routeId: Object.keys(s.routes)[0]!, ac };
}

describe('tick', () => {
  it('does not mutate its input and advances the day', () => {
    const s = deepFreeze(playerGame('LHR', 3));
    const { state } = tick(s, [], catalog);
    expect(state.day).toBe(1);
    expect(s.day).toBe(0);
  });
  it('a player route carries passengers and earns revenue on day 1', () => {
    const { s, routeId } = withRoute();
    const { state, summary } = tick(s, [], catalog);
    const r = state.routes[routeId]!;
    expect(r.last!.pax.economy).toBeGreaterThan(0);
    expect(r.last!.revenue).toBeGreaterThan(0);
    expect(summary.daily.find((d) => d.airlineId === s.playerId)!.revenue).toBe(r.last!.revenue);
  });
  it('applies queued commands', () => {
    const s = playerGame('LHR', 3);
    const { state, results } = tick(s, [{ airlineId: s.playerId, cmd: lease('A20N') }], catalog);
    expect(results).toEqual([{ ok: true }]);
    expect(playerAircraft(state)).toHaveLength(1);
  });
  it('a strike cancels flights: no revenue, no variable cost, overhead still charged', () => {
    const { s, routeId } = withRoute();
    s.day = 30; // next tick is day 31 = Feb 1, a month start
    s.events.push({ id: 'x', kind: 'strike', startDay: 31, endDay: 32, airportId: 'CDG', magnitude: 1 });
    const { state, summary } = tick(s, [], catalog);
    expect(state.routes[routeId]!.last).toMatchObject({ revenue: 0, cost: 0 });
    expect(summary.daily.find((d) => d.airlineId === s.playerId)!.costs.overhead).toBeGreaterThan(0);
  });
  it('preview suggests fares within 0.6–1.6 × reference', () => {
    const { s } = withRoute();
    const r = Object.values(s.routes)[0]!;
    const p = preview(s, s.playerId, { type: 'updateRoute', routeId: r.id, fares: r.fares }, catalog);
    for (const c of ['economy', 'premium', 'business'] as const) {
      const ref = refFare(p.distanceKm!, c);
      expect(p.suggestedFares![c]).toBeGreaterThanOrEqual(Math.floor(ref * 0.6));
      expect(p.suggestedFares![c]).toBeLessThanOrEqual(Math.ceil(ref * 1.6));
    }
    expect(p.expectedLoadFactor).toBeGreaterThan(0);
  });
  it('preview reports validation errors', () => {
    const s = playerGame('LHR', 3);
    const p = preview(s, s.playerId, { type: 'openRoute', from: 'LHR', to: 'CDG', fares: { economy: 1, premium: 1, business: 1 }, assignments: [{ aircraftId: 'nope', roundTripsPerWeek: 7 }] }, catalog);
    expect(p.ok).toBe(false);
    expect(p.reason).toBeTruthy();
  });
});

describe('golden run', () => {
  it('seed 7, passive player, 365 days', () => {
    let s = newGame({ seed: 7, regionId: 'world', difficulty: 'normal', homeBaseId: 'LHR',
      airline: { name: 'Golden Test Air', code: 'G7T', colors: { primary: '#123456', secondary: '#ffffff' }, logoShape: 'circle' } }, catalog);
    let last;
    for (let i = 0; i < 365; i++) {
      const r = tick(s, [], catalog);
      s = r.state;
      last = r.summary;
    }
    expect(last!.daily.map((d) => ({ id: d.airlineId, cash: d.cash, revenue: d.revenue, pax: Math.round(d.pax) }))).toMatchSnapshot();
  }, 60_000);
});

describe('performance', () => {
  it('a 20-airline world ticks in under 200 ms (median)', () => {
    let s = newGame({ seed: 3, regionId: 'world', difficulty: 'normal', homeBaseId: 'LHR',
      airline: { name: 'Perf Test Air', code: 'P3T', colors: { primary: '#123456', secondary: '#ffffff' }, logoShape: 'circle' } }, catalog);
    for (let i = 0; i < 180; i++) s = tick(s, [], catalog).state;
    const times: number[] = [];
    for (let i = 0; i < 20; i++) {
      const t0 = performance.now();
      s = tick(s, [], catalog).state;
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    expect(times[10]!).toBeLessThan(200);
  }, 120_000);
});

describe('cabins in the daily simulation', () => {
  function widebody(business: 'recliner' | 'suite') {
    const s = playerGame('LHR', 3);
    s.airlines[s.playerId]!.tier = 'global';
    s.airlines[s.playerId]!.cash = 2_000_000_000;
    const p = standardProduct();
    const c = config({ economy: 230, premium: 0, business: 30 }, { ...p, business: { ...p.business, seat: business } });
    expect(applyCommand(s, s.playerId, { type: 'leaseAircraft', typeId: 'B789', config: c }, catalog)).toEqual({ ok: true });
    const ac = playerAircraft(s)[0]!.id;
    expect(applyCommand(s, s.playerId, { type: 'openRoute', from: 'LHR', to: 'JFK', fares: { economy: 600, premium: 1200, business: 3500 }, assignments: [{ aircraftId: ac, roundTripsPerWeek: 7 }] }, catalog)).toEqual({ ok: true });
    return { s, routeId: Object.keys(s.routes)[0]!, ac };
  }
  it('quality is per class: suites lift business, not economy', () => {
    const a = widebody('recliner'), b = widebody('suite');
    const qa = routeOps(a.s.routes[a.routeId]!, a.s, catalog, hoursByAircraft(a.s, catalog), true).quality;
    const qb = routeOps(b.s.routes[b.routeId]!, b.s, catalog, hoursByAircraft(b.s, catalog), true).quality;
    expect(qb.business).toBeGreaterThan(qa.business + 5);
    expect(qb.economy).toBeCloseTo(qa.economy);
  });
  it('an aircraft in a refit does not count towards the route quality', () => {
    const a = widebody('recliner');
    const before = routeOps(a.s.routes[a.routeId]!, a.s, catalog, hoursByAircraft(a.s, catalog), true).quality.business;
    const p = standardProduct();
    const c = config({ economy: 230, premium: 0, business: 30 }, { ...p, business: { ...p.business, seat: 'suite' } });
    expect(applyCommand(a.s, a.s.playerId, { type: 'leaseAircraft', typeId: 'B789', config: c }, catalog)).toEqual({ ok: true });
    const second = playerAircraft(a.s).find((x) => x.id !== a.ac)!;
    second.refitDaysLeft = 4;
    a.s.routes[a.routeId]!.assignments.push({ aircraftId: second.id, roundTripsPerWeek: 7 });
    const after = routeOps(a.s.routes[a.routeId]!, a.s, catalog, hoursByAircraft(a.s, catalog), true).quality.business;
    expect(after).toBeCloseTo(before);
  });
  it('suites win more business passengers at the same fare', () => {
    const run = (seat: 'recliner' | 'suite') => {
      const { s, routeId } = widebody(seat);
      let state = s, sum = 0;
      for (let i = 0; i < 7; i++) { state = tick(state, [], catalog).state; sum += state.routes[routeId]!.last!.pax.business; }
      return sum;
    };
    expect(run('suite')).toBeGreaterThan(run('recliner'));
  });
  it('an aircraft in a refit stays on the ground, then flies again on its routes', () => {
    const { s, routeId, ac } = withRoute();
    s.aircraft[ac]!.refitDaysLeft = 2;
    let state = tick(s, [], catalog).state;
    expect(state.routes[routeId]!.last!.pax.economy).toBe(0);
    expect(state.aircraft[ac]!.refitDaysLeft).toBe(1);
    const done = tick(state, [], catalog);
    state = done.state;
    expect(state.aircraft[ac]!.refitDaysLeft).toBe(0);
    expect(done.summary.notifications.some((n) => /refit done/i.test(n.title))).toBe(true);
    state = tick(state, [], catalog).state;
    expect(state.routes[routeId]!.status).toBe('active');
    expect(state.routes[routeId]!.last!.pax.economy).toBeGreaterThan(0);
  });
});
