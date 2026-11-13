import { describe, expect, it } from 'vitest';
import { isAirportClosed, rollEvents } from './events';
import { stepMarket } from './market';
import { Rng } from './rng';
import { catalog, playerGame } from './testing';

function simulate(days: number, seed: number) {
  const s = playerGame('FRA', 1);
  const rng = new Rng(seed);
  const started: Record<string, number> = {};
  let fuelOutOfRange = 0;
  for (let d = 0; d < days; d++) {
    s.day = d;
    const before = new Set(s.events.map((e) => e.id));
    rollEvents(s, catalog, rng);
    stepMarket(s, catalog, rng);
    for (const e of s.events) if (!before.has(e.id)) started[e.kind] = (started[e.kind] ?? 0) + 1;
    const spike = s.events.some((e) => e.kind === 'fuelSpike');
    if (!spike && (s.market.fuelPricePerKg < 0.7 || s.market.fuelPricePerKg > 1.4)) fuelOutOfRange++;
  }
  return { s, started, fuelOutOfRange };
}

describe('events and market', () => {
  const { started, fuelOutOfRange } = simulate(3600, 5);
  it('fuel spikes happen about once a year', () => {
    expect(started.fuelSpike ?? 0).toBeGreaterThanOrEqual(5);
    expect(started.fuelSpike ?? 0).toBeLessThanOrEqual(15);
  });
  it('strikes happen about 4 times a year', () => {
    expect(started.strike ?? 0).toBeGreaterThanOrEqual(25);
    expect(started.strike ?? 0).toBeLessThanOrEqual(55);
  });
  it('fuel stays in range without a spike', () => expect(fuelOutOfRange).toBe(0));
  it('a strike closes its airport only during its window', () => {
    const s = playerGame('FRA', 1);
    s.events.push({ id: 'e1', kind: 'strike', startDay: 10, endDay: 12, airportId: 'CDG', magnitude: 1 });
    s.day = 11;
    expect(isAirportClosed(s, 'CDG')).toBe(true);
    expect(isAirportClosed(s, 'FRA')).toBe(false);
    s.day = 13;
    expect(isAirportClosed(s, 'CDG')).toBe(false);
  });
  it('expired events are removed and notified', () => {
    const s = playerGame('FRA', 1);
    s.events.push({ id: 'e1', kind: 'storm', startDay: 1, endDay: 2, airportId: 'CDG', magnitude: 1 });
    s.day = 3;
    rollEvents(s, catalog, new Rng(1));
    expect(s.events.find((e) => e.id === 'e1')).toBeUndefined();
  });
});
