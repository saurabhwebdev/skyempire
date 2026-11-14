import { describe, expect, it } from 'vitest';
import { applyCommand } from './commands/apply';
import { BALANCE } from './config/balance';
import { hoursByAircraft, pairKey } from './daySim';
import { distanceKm } from './geo';
import { maxRoundTripsPerWeek } from './ops';
import { suggestRoutes } from './suggest';
import { catalog, lease, playerAircraft, playerGame } from './testing';

function withIdleA20N() {
  const s = playerGame('LHR', 3);
  expect(applyCommand(s, s.playerId, lease('A20N'), catalog)).toEqual({ ok: true });
  return { s, ac: playerAircraft(s)[0]!.id };
}

describe('route suggestions for free aircraft hours', () => {
  it('suggests up to 3 profitable routes from a base, within range', () => {
    const { s, ac } = withIdleA20N();
    const out = suggestRoutes(s, s.playerId, ac, catalog);
    expect(out.length).toBeGreaterThan(0);
    expect(out.length).toBeLessThanOrEqual(3);
    const t = catalog.aircraftTypes.A20N!;
    for (const x of out) {
      expect(x.from).toBe('LHR');
      expect(x.distanceKm).toBeLessThanOrEqual(t.rangeKm);
      expect(x.expectedProfitPerDay).toBeGreaterThan(0);
      expect(x.expectedLoadFactor).toBeGreaterThan(0);
      expect(x.fares.economy).toBeGreaterThan(0);
      expect(x.roundTripsPerWeek).toBeGreaterThanOrEqual(1);
    }
    expect(out[0]!.expectedProfitPerDay).toBeGreaterThanOrEqual(out.at(-1)!.expectedProfitPerDay);
  });
  it('each suggestion opens as-is and fits the free hours', () => {
    const { s, ac } = withIdleA20N();
    const [best] = suggestRoutes(s, s.playerId, ac, catalog);
    const r = applyCommand(s, s.playerId, { type: 'openRoute', from: best!.from, to: best!.to, fares: best!.fares, assignments: [{ aircraftId: ac, roundTripsPerWeek: best!.roundTripsPerWeek }] }, catalog);
    expect(r).toEqual({ ok: true });
    expect(hoursByAircraft(s, catalog).get(ac)!).toBeLessThanOrEqual(BALANCE.weeklyHours);
  });
  it('never repeats a route the airline already flies', () => {
    const { s, ac } = withIdleA20N();
    expect(applyCommand(s, s.playerId, lease('A20N'), catalog)).toEqual({ ok: true });
    const other = playerAircraft(s).find((a) => a.id !== ac)!.id;
    const [best] = suggestRoutes(s, s.playerId, ac, catalog);
    applyCommand(s, s.playerId, { type: 'openRoute', from: best!.from, to: best!.to, fares: best!.fares, assignments: [{ aircraftId: ac, roundTripsPerWeek: 2 }] }, catalog);
    const taken = new Set(Object.values(s.routes).map((r) => pairKey(r.from, r.to)));
    for (const x of suggestRoutes(s, s.playerId, other, catalog)) expect(taken.has(pairKey(x.from, x.to))).toBe(false);
  });
  it('an aircraft with no free hours gets no suggestions', () => {
    const { s, ac } = withIdleA20N();
    const dist = distanceKm(catalog.airports.LHR!, catalog.airports.CDG!);
    const max = maxRoundTripsPerWeek(dist, catalog.aircraftTypes.A20N!);
    const full = applyCommand(s, s.playerId, { type: 'openRoute', from: 'LHR', to: 'CDG', fares: { economy: 120, premium: 220, business: 420 }, assignments: [{ aircraftId: ac, roundTripsPerWeek: max }] }, catalog);
    expect(full).toEqual({ ok: true });
    expect(suggestRoutes(s, s.playerId, ac, catalog)).toEqual([]);
  });
});
