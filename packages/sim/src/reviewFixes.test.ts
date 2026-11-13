import { describe, expect, it } from 'vitest';
import { applyCommand } from './commands/apply';
import { hoursByAircraft, routeOps } from './daySim';
import { rollEvents } from './events';
import { updateSolvency } from './finance';
import { stepMarket } from './market';
import { Rng } from './rng';
import { catalog, fares, lease, playerAircraft, playerGame } from './testing';

describe('review fixes', () => {
  it('an airline with no loans and −$50M cash goes bankrupt after 30 days', () => {
    const s = playerGame('LHR', 1);
    const al = s.airlines[s.playerId]!;
    al.cash = -50_000_000;
    for (let i = 0; i < 29; i++) updateSolvency(s, al.id, catalog);
    expect(al.bankrupt).toBe(false);
    updateSolvency(s, al.id, catalog);
    expect(al.bankrupt).toBe(true);
  });

  it('fuel prices fall back when a spike ends', () => {
    const s = playerGame('LHR', 1);
    s.market.fuelPricePerKg = 0.8 * 1.5;
    s.events.push({ id: 'f', kind: 'fuelSpike', startDay: 0, endDay: 9, magnitude: 1.5 });
    s.day = 10; // spike expired
    rollEvents(s, catalog, new Rng(1));
    stepMarket(s, catalog, new Rng(1));
    expect(s.market.fuelPricePerKg).toBeLessThan(0.9);
  });

  it('a closed airport hurts on-time performance', () => {
    const s = playerGame('LHR', 1);
    applyCommand(s, s.playerId, lease('A20N'), catalog);
    const ac = playerAircraft(s)[0]!.id;
    applyCommand(s, s.playerId, { type: 'openRoute', from: 'LHR', to: 'MAD', fares, assignments: [{ aircraftId: ac, roundTripsPerWeek: 7 }] }, catalog);
    const r = Object.values(s.routes)[0]!;
    const normal = routeOps(r, s, catalog, hoursByAircraft(s, catalog), false).onTime;
    s.events.push({ id: 'x', kind: 'strike', startDay: 0, endDay: 5, airportId: 'MAD', magnitude: 1 });
    const closed = routeOps(r, s, catalog, hoursByAircraft(s, catalog), false).onTime;
    expect(closed).toBeLessThan(normal);
  });
});
