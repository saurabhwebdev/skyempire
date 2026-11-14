import type { GameState } from '@skyempire/shared';
import { describe, expect, it } from 'vitest';
import { applyCommand } from './commands/apply';
import { newGame } from './newGame';
import { preview } from './preview';
import { refFare } from './demand';
import { tick } from './tick';
import { catalog, lease, playerAircraft, playerGame } from './testing';

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

function withRoute(): { s: GameState; routeId: string } {
  const s = playerGame('LHR', 3);
  applyCommand(s, s.playerId, lease('A20N'), catalog);
  const ac = playerAircraft(s)[0]!.id;
  const cmd = { type: 'openRoute' as const, from: 'LHR', to: 'CDG', fares: { economy: 1, premium: 1, business: 1 }, assignments: [{ aircraftId: ac, roundTripsPerWeek: 14 }] };
  const p = preview(s, s.playerId, cmd, catalog);
  expect(applyCommand(s, s.playerId, { ...cmd, fares: p.suggestedFares! }, catalog)).toEqual({ ok: true });
  return { s, routeId: Object.keys(s.routes)[0]! };
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
