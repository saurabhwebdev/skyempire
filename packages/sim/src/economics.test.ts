import { describe, expect, it } from 'vitest';
import { flightsToday, legCost, routeDayCosts } from './economics';
import { applyCommand } from './commands/apply';
import { airport, catalog, fares, lease, playerAircraft, playerGame, type } from './testing';

describe('flightsToday', () => {
  for (const rtpw of [1, 7, 10, 21]) {
    it(`spreads ${rtpw} weekly round trips over 7 days`, () => {
      let sum = 0;
      for (let d = 30; d < 37; d++) sum += flightsToday(rtpw, d);
      expect(sum).toBe(rtpw);
    });
  }
});

describe('legCost', () => {
  it('fuel = burn × block hours × price', () => {
    const c = legCost(type('A20N'), 0, 655, 1.0, airport('CDG'), 1);
    expect(c.fuel).toBe(Math.round(type('A20N').fuelKgPerH * (655 / 830 + 0.5)));
  });
  it('older aircraft cost more to maintain', () =>
    expect(legCost(type('A20N'), 10, 655, 1, airport('CDG'), 1).maintenance).toBeGreaterThan(legCost(type('A20N'), 0, 655, 1, airport('CDG'), 1).maintenance));
});

describe('routeDayCosts', () => {
  function setup(secondBase: boolean) {
    const s = playerGame();
    applyCommand(s, s.playerId, lease('A20N'), catalog);
    const ac = playerAircraft(s)[0]!;
    if (secondBase) applyCommand(s, s.playerId, { type: 'openBase', airportId: 'CDG' }, catalog);
    applyCommand(s, s.playerId, { type: 'openRoute', from: 'FRA', to: 'CDG', fares, assignments: [{ aircraftId: ac.id, roundTripsPerWeek: 7 }] }, catalog);
    const route = Object.values(s.routes)[0]!;
    return { s, route, legs: new Map([[ac.id, 2]]) };
  }
  const pax = { economy: 200, premium: 0, business: 0 };
  it('discounts crew and maintenance when both ends are bases', () => {
    const a = setup(false), b = setup(true);
    const ca = routeDayCosts(a.route, a.s, catalog, a.legs, pax, false);
    const cb = routeDayCosts(b.route, b.s, catalog, b.legs, pax, false);
    expect(Math.abs(cb.crew - ca.crew * 0.9)).toBeLessThanOrEqual(2); // per-leg rounding
    expect(cb.fuel).toBe(ca.fuel);
  });
  it('a closed airport means no variable costs', () => {
    const a = setup(false);
    expect(routeDayCosts(a.route, a.s, catalog, a.legs, pax, true)).toEqual({ fuel: 0, crew: 0, maintenance: 0, fees: 0, service: 0 });
  });
});
