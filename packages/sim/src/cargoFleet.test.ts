import type { AircraftType, Catalog, Command, GameState } from '@skyempire/shared';
import { describe, expect, it } from 'vitest';
import { applyCommand } from './commands/apply';
import { monthlyFixedCosts } from './finance';
import { catalog as base, config, playerAircraft, playerGame } from './testing';
import { tick } from './tick';

// Stand-in freighters until the real catalogue lands; the rules don't depend on the exact figures.
const f = (id: string, from: AircraftType, o: Partial<AircraftType>): AircraftType => ({ ...from, id, name: id, kind: 'freighter', maxSeats: 0, payloadT: 100, comfort: 0, ...o });
const B77W = base.aircraftTypes.B77W!, A20N = base.aircraftTypes.A20N!;
const catalog: Catalog = {
  ...base,
  aircraftTypes: {
    ...base.aircraftTypes,
    TF77: f('TF77', B77W, { tier: 'startup' }),
    TFSF: f('TFSF', B77W, { tier: 'startup', conversion: { from: ['B77W'], costUsd: 20_000_000, days: 90 } }),
    TF35: f('TF35', B77W, { tier: 'startup', entryYear: 2027 }),
    TF20: f('TF20', A20N, { tier: 'startup', payloadT: 21, conversion: { from: ['A20N'], costUsd: 5_000_000, days: 60 } }),
  },
};
const P = 'al_player';
const run = (s: GameState, cmd: Command) => applyCommand(s, P, cmd, catalog);
function airline(kind: 'passenger' | 'combination' | 'cargo') {
  const s = playerGame('FRA', 3);
  const al = s.airlines[P]!;
  al.kind = kind;
  al.tier = 'global';
  al.cash = 2_000_000_000;
  return s;
}
const leasePax = (typeId: string): Command => ({ type: 'leaseAircraft', typeId, config: config({ economy: base.aircraftTypes[typeId]!.maxSeats, premium: 0, business: 0 }) });

describe('airline types decide what you can fly', () => {
  it('a cargo airline can never take a passenger aircraft', () => {
    const s = airline('cargo');
    expect(run(s, leasePax('A20N'))).toEqual({ ok: false, reason: 'A cargo airline can’t fly passengers' });
    expect(run(s, { type: 'leaseAircraft', typeId: 'TF77' })).toEqual({ ok: true });
  });
  it('a passenger airline can’t fly freighters; a combination airline flies both', () => {
    expect(run(airline('passenger'), { type: 'leaseAircraft', typeId: 'TF77' })).toEqual({ ok: false, reason: 'Passenger airlines don’t fly freighters' });
    const s = airline('combination');
    expect(run(s, { type: 'leaseAircraft', typeId: 'TF77' })).toEqual({ ok: true });
    expect(run(s, leasePax('A20N'))).toEqual({ ok: true });
  });
  it('a passenger aircraft needs a cabin; a freighter has none', () => {
    const s = airline('combination');
    expect(run(s, { type: 'leaseAircraft', typeId: 'A20N' })).toEqual({ ok: false, reason: 'Choose a cabin for this aircraft' });
    run(s, { type: 'leaseAircraft', typeId: 'TF77' });
    const ac = playerAircraft(s)[0]!;
    expect(ac.cabin).toEqual({ economy: 0, premium: 0, business: 0 });
    expect(run(s, { type: 'setCabin', aircraftId: ac.id, config: config({ economy: 10, premium: 0, business: 0 }) })).toEqual({ ok: false, reason: 'Freighters have no cabin' });
  });
});

describe('freighter conversions', () => {
  function owned(kind: 'combination' | 'cargo' = 'combination') {
    const s = airline(kind);
    s.airlines[P]!.kind = 'combination';
    expect(run(s, { type: 'buyAircraft', typeId: 'B77W', config: config({ economy: 450, premium: 0, business: 0 }) })).toEqual({ ok: true });
    s.airlines[P]!.kind = kind;
    return { s, ac: playerAircraft(s)[0]!.id };
  }
  it('turns an owned passenger aircraft into a freighter: paid, out of service, same age', () => {
    const { s, ac } = owned();
    s.aircraft[ac]!.ageDays = 3000;
    const cash = s.airlines[P]!.cash;
    expect(run(s, { type: 'convertAircraft', aircraftId: ac, toTypeId: 'TFSF' })).toEqual({ ok: true });
    expect(s.aircraft[ac]).toMatchObject({ typeId: 'TFSF', refitDaysLeft: 90, ageDays: 3000, cabin: { economy: 0, premium: 0, business: 0 } });
    expect(s.airlines[P]!.cash).toBe(cash - 20_000_000);
  });
  it('refuses leased, busy, wrong-type or passenger-airline conversions', () => {
    const { s, ac } = owned();
    expect(run(s, { type: 'convertAircraft', aircraftId: ac, toTypeId: 'TF20' })).toEqual({ ok: false, reason: 'This aircraft can’t become that freighter' });
    s.aircraft[ac]!.ownership = 'leased';
    expect(run(s, { type: 'convertAircraft', aircraftId: ac, toTypeId: 'TFSF' })).toEqual({ ok: false, reason: 'Only aircraft you own can be converted' });
    s.aircraft[ac]!.ownership = 'owned';
    s.routes.r1 = { id: 'r1', airlineId: P, from: 'FRA', to: 'JFK', fares: { economy: 1, premium: 1, business: 1 }, assignments: [{ aircraftId: ac, roundTripsPerWeek: 3 }], status: 'active', openedDay: 0, last: null, profit30: [] };
    expect(run(s, { type: 'convertAircraft', aircraftId: ac, toTypeId: 'TFSF' })).toEqual({ ok: false, reason: 'Take it off its routes first' });
    delete s.routes.r1;
    s.aircraft[ac]!.refitDaysLeft = 4;
    expect(run(s, { type: 'convertAircraft', aircraftId: ac, toTypeId: 'TFSF' })).toEqual({ ok: false, reason: 'This aircraft is already being refitted (4 days left)' });
    s.aircraft[ac]!.refitDaysLeft = 0;
    s.airlines[P]!.kind = 'passenger';
    expect(run(s, { type: 'convertAircraft', aircraftId: ac, toTypeId: 'TFSF' })).toEqual({ ok: false, reason: 'Passenger airlines don’t fly freighters' });
  });
  it('a cargo airline can buy a used passenger aircraft only together with its conversion', () => {
    const s = airline('cargo');
    s.market.usedListings = [{ id: 'l1', typeId: 'A20N', ageDays: 4000, condition: 80, price: 20_000_000 }];
    expect(run(s, { type: 'buyUsedAircraft', listingId: 'l1', config: config({ economy: 194, premium: 0, business: 0 }) })).toEqual({ ok: false, reason: 'A cargo airline can’t fly passengers' });
    const cash = s.airlines[P]!.cash;
    expect(run(s, { type: 'buyUsedAircraft', listingId: 'l1', convertTo: 'TF20' })).toEqual({ ok: true });
    expect(playerAircraft(s)[0]).toMatchObject({ typeId: 'TF20', refitDaysLeft: 60, ageDays: 4000 });
    expect(s.airlines[P]!.cash).toBe(cash - 25_000_000);
  });
});

describe('ordering a type before its first deliveries', () => {
  it('arrives on Jan 1 of its entry year: no flights and no lease before then', () => {
    const s = airline('cargo');
    expect(s.world.startYear).toBe(2026);
    expect(run(s, { type: 'leaseAircraft', typeId: 'TF35' })).toEqual({ ok: true });
    const ac = playerAircraft(s)[0]!;
    expect(ac.deliveryDay).toBe(365);
    expect(monthlyFixedCosts(s, P, catalog).leases).toBe(0);
    s.day = 365;
    expect(monthlyFixedCosts(s, P, catalog).leases).toBe(catalog.aircraftTypes.TF35!.leasePerMonth);
  });
});

describe('dangerous-goods licence and belly cargo switch', () => {
  it('the licence costs $250k, once', () => {
    const s = airline('cargo');
    const cash = s.airlines[P]!.cash;
    expect(run(s, { type: 'buyDgLicence' })).toEqual({ ok: true });
    expect(s.airlines[P]!).toMatchObject({ dgLicence: true, cash: cash - 250_000 });
    expect(run(s, { type: 'buyDgLicence' })).toEqual({ ok: false, reason: 'You already hold a dangerous-goods licence' });
  });
  it('belly cargo can be switched off', () => {
    const s = airline('passenger');
    expect(run(s, { type: 'setBellyCargo', on: false })).toEqual({ ok: true });
    expect(s.airlines[P]!.bellyCargo).toBe(false);
  });
  it('the game keeps ticking with freighters in the fleet', () => {
    const s = airline('cargo');
    run(s, { type: 'leaseAircraft', typeId: 'TF77' });
    expect(() => tick(s, [], catalog)).not.toThrow();
  });
});
