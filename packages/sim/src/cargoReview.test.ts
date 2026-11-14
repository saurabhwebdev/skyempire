import type { Command, GameState } from '@skyempire/shared';
import { describe, expect, it } from 'vitest';
import { airportCargoT, cargoCatchmentT, cargoFlow, roadShare } from './cargo';
import { refFare } from './demand';
import { distanceKm } from './geo';
import { preview } from './preview';
import { applyCommand } from './commands/apply';
import { hoursByAircraft, routeOps } from './daySim';
import { monthlyFixedCosts } from './finance';
import { refreshUsedListings } from './newGame';
import { Rng } from './rng';
import { catalog, config, playerAircraft, playerGame } from './testing';
import { tick } from './tick';

const P = 'al_player';
const run = (s: GameState, cmd: Command) => applyCommand(s, P, cmd, catalog);
function airline(kind: 'passenger' | 'combination' | 'cargo', tier: 'startup' | 'global' = 'global', hub = 'LUX') {
  const s = playerGame(hub, 3);
  Object.assign(s.airlines[P]!, { kind, tier, cash: 2_000_000_000 });
  return s;
}

describe('future types (A350F 2027, 777-8F 2028)', () => {
  it('never show up on the used market before they exist, and can’t be bought used', () => {
    const s = airline('cargo');
    const rng = new Rng(3);
    for (let i = 0; i < 300; i++) {
      refreshUsedListings(s, catalog, rng);
      for (const l of s.market.usedListings) expect(['A35F', 'B78F'], l.typeId).not.toContain(l.typeId);
    }
    s.market.usedListings = [{ id: 'l1', typeId: 'A35F', ageDays: 900, condition: 90, price: 100_000_000 }];
    expect(run(s, { type: 'buyUsedAircraft', listingId: 'l1' }).ok).toBe(false);
  });
  it('are ordered by lease: nothing to pay, no ageing and no overhead until delivery, and no routes before it', () => {
    const s = airline('cargo');
    const cash = s.airlines[P]!.cash;
    const fixedBefore = monthlyFixedCosts(s, P, catalog);
    expect(run(s, { type: 'buyAircraft', typeId: 'B78F' })).toEqual({ ok: false, reason: 'Lease it now: you can buy one once it’s delivered' });
    expect(run(s, { type: 'leaseAircraft', typeId: 'B78F' })).toEqual({ ok: true });
    expect(s.airlines[P]!.cash).toBe(cash);
    const ac = playerAircraft(s)[0]!;
    expect(monthlyFixedCosts(s, P, catalog)).toEqual(fixedBefore);
    expect(run(s, { type: 'openRoute', kind: 'cargo', from: 'LUX', to: 'ORD', fares: { economy: 1, premium: 1, business: 1 }, assignments: [{ aircraftId: ac.id, roundTripsPerWeek: 3 }] }).ok).toBe(false);
    let st = s;
    for (let i = 0; i < 5; i++) st = tick(st, [], catalog).state;
    expect(st.aircraft[ac.id]!.ageDays).toBe(0);
  });
});

describe('conversions respect the airline tier', () => {
  it('a Startup airline can’t convert into a Regional-tier freighter', () => {
    const s = airline('cargo', 'startup');
    s.market.usedListings = [{ id: 'l1', typeId: 'B738', ageDays: 5000, condition: 80, price: 15_000_000 }];
    expect(run(s, { type: 'buyUsedAircraft', listingId: 'l1', convertTo: 'B38C' })).toEqual({ ok: false, reason: 'Unlocks at Regional tier' });
    const t = airline('combination', 'startup');
    expect(run(t, { type: 'buyAircraft', typeId: 'B738', config: config({ economy: 189, premium: 0, business: 0 }) })).toEqual({ ok: true });
    expect(run(t, { type: 'convertAircraft', aircraftId: playerAircraft(t)[0]!.id, toTypeId: 'B38C' })).toEqual({ ok: false, reason: 'Unlocks at Regional tier' });
  });
});

describe('belly holds on narrowbodies', () => {
  it('bags run out of room sooner on a narrowbody than on a widebody', () => {
    const q = (typeId: string, seats: number, holdShare: number) => {
      const s = airline('passenger', 'global', 'LHR');
      run(s, { type: 'leaseAircraft', typeId, config: config({ economy: seats, premium: 0, business: 0 }) });
      const ac = playerAircraft(s)[0]!.id;
      run(s, { type: 'openRoute', from: 'LHR', to: 'MAD', fares: { economy: 150, premium: 300, business: 600 }, assignments: [{ aircraftId: ac, roundTripsPerWeek: 7 }], belly: { mode: 'custom', rate: 1.2, accept: ['general'], holdShare } });
      const r = Object.values(s.routes)[0]!;
      return routeOps(r, s, catalog, hoursByAircraft(s, catalog), true).quality.economy;
    };
    expect(q('A20N', 194, 0.75)).toBeLessThan(q('A20N', 194, 0.4) - 3); // narrowbody: 75% leaves bags behind
    expect(q('B789', 360, 0.7)).toBeCloseTo(q('B789', 360, 0.6)); // widebody: still room
  });
});

describe('trucks feed the long-haul hubs', () => {
  it('a long-haul flow from Luxembourg draws on cargo trucked in from nearby airports', () => {
    const lux = catalog.airports.LUX!, ord = catalog.airports.ORD!, ath = catalog.airports.ATH!;
    expect(cargoCatchmentT(catalog, lux)).toBeGreaterThan(1.5 * airportCargoT(catalog, lux)); // FRA, AMS, CDG, LEJ… are near
    expect(cargoCatchmentT(catalog, ath)).toBeLessThan(cargoCatchmentT(catalog, lux));
    const plain = 0.00085 * Math.sqrt(airportCargoT(catalog, lux) * airportCargoT(catalog, ord));
    expect(cargoFlow(lux, ord, 150, 1, catalog, 2026)).toBeGreaterThan(plain / distanceKm(lux, ord) ** 0.3);
  });
});

describe('short hops go by truck', () => {
  it('most cargo under ~800 km travels by road', () => {
    expect(roadShare(174)).toBeGreaterThan(0.75);
    expect(roadShare(500)).toBeGreaterThan(0.3);
    expect(roadShare(1200)).toBe(0);
  });
  it('a 747-8F earns more on a long route than on a short hop', () => {
    const s = airline('cargo');
    run(s, { type: 'leaseAircraft', typeId: 'B48F' });
    const ac = playerAircraft(s)[0]!.id;
    const profit = (to: string, rtpw: number) => preview(s, P, { type: 'openRoute', kind: 'cargo', from: 'LUX', to, fares: { economy: 1, premium: 1, business: 1 }, assignments: [{ aircraftId: ac, roundTripsPerWeek: rtpw }] }, catalog).expectedProfitPerDay ?? 0;
    expect(profit('FRA', 7)).toBeLessThan(0);
  });
});

describe('cargo routes and AI reputation', () => {
  it('a combination airline’s fair-price score ignores its cargo routes’ placeholder fares', () => {
    const rep = (withCargo: boolean) => {
      let s = airline('combination', 'global', 'LEJ');
      run(s, { type: 'leaseAircraft', typeId: 'A20N', config: config({ economy: 194, premium: 0, business: 0 }) });
      const pax = playerAircraft(s)[0]!.id;
      // Expensive fares: the fair-price score should be low.
      const km = distanceKm(catalog.airports.LEJ!, catalog.airports.MUC!);
      const fares = { economy: Math.round(1.4 * refFare(km, 'economy')), premium: Math.round(1.4 * refFare(km, 'premium')), business: Math.round(1.4 * refFare(km, 'business')) };
      expect(run(s, { type: 'openRoute', from: 'LEJ', to: 'MUC', fares, assignments: [{ aircraftId: pax, roundTripsPerWeek: 7 }] })).toEqual({ ok: true });
      if (withCargo) {
        run(s, { type: 'leaseAircraft', typeId: 'B77F' });
        const f = playerAircraft(s).find((a) => a.typeId === 'B77F')!.id;
        expect(run(s, { type: 'openRoute', kind: 'cargo', from: 'LEJ', to: 'HKG', fares: { economy: 1, premium: 1, business: 1 }, assignments: [{ aircraftId: f, roundTripsPerWeek: 3 }] })).toEqual({ ok: true });
      }
      for (let i = 0; i < 60; i++) s = tick(s, [], catalog).state;
      return s.airlines[P]!.reputation;
    };
    expect(Math.abs(rep(true) - rep(false))).toBeLessThan(2);
  });
});
