import type { AircraftType, Catalog, Command, GameState } from '@skyempire/shared';
import { describe, expect, it } from 'vitest';
import { cargoRefRate } from './cargo';
import { applyCommand } from './commands/apply';
import { hoursByAircraft, routeOps } from './daySim';
import { distanceKm } from './geo';
import { preview } from './preview';
import { catalog as base, config, playerAircraft, playerGame } from './testing';
import { tick } from './tick';

const f = (id: string, from: AircraftType, o: Partial<AircraftType>): AircraftType => ({ ...from, id, name: id, kind: 'freighter', maxSeats: 0, payloadT: 100, comfort: 0, tier: 'startup', ...o });
const catalog: Catalog = {
  ...base,
  aircraftTypes: {
    ...base.aircraftTypes,
    TF77: f('TF77', base.aircraftTypes.B77W!, { special: true }),
    TF20: f('TF20', base.aircraftTypes.A20N!, { payloadT: 21, rangeKm: 13_000 }),
  },
  cargo: { airportT: { HKG: 4_900_000, LAX: 2_700_000, LHR: 1_400_000, JFK: 1_300_000 }, exportIndex: { HK: 1.5, US: 0.85, GB: 0.9 } },
};
const P = 'al_player';
const km = (a: string, b: string) => distanceKm(catalog.airports[a]!, catalog.airports[b]!);
const run = (s: GameState, cmd: Command) => applyCommand(s, P, cmd, catalog);
const days = (s: GameState, n: number) => { let st = s; for (let i = 0; i < n; i++) st = tick(st, [], catalog).state; return st; };

function cargoAirline(typeId = 'TF77', rtpw = 4, extra: Partial<Extract<Command, { type: 'openRoute' }>> = {}) {
  const s = playerGame('HKG', 3);
  Object.assign(s.airlines[P]!, { kind: 'cargo', tier: 'global', cash: 1_000_000_000 });
  expect(run(s, { type: 'leaseAircraft', typeId })).toEqual({ ok: true });
  const ac = playerAircraft(s)[0]!.id;
  expect(run(s, { type: 'openRoute', kind: 'cargo', from: 'HKG', to: 'LAX', fares: { economy: 1, premium: 1, business: 1 }, assignments: [{ aircraftId: ac, roundTripsPerWeek: rtpw }], ...extra } as Command)).toEqual({ ok: true });
  return { s, ac, id: Object.keys(s.routes)[0]! };
}

describe('cargo routes', () => {
  it('carry tonnes up to the payload and earn cargo revenue', () => {
    const { s, id } = cargoAirline();
    const r = s.routes[id]!;
    expect(r).toMatchObject({ kind: 'cargo', cargoRate: expect.any(Number) });
    expect(r.cargoRate).toBeCloseTo(cargoRefRate(km('HKG', 'LAX')), 1);
    let st = s, flown = 0;
    for (let i = 0; i < 7; i++) {
      st = tick(st, [], catalog).state;
      const last = st.routes[id]!.last!;
      expect(last.cargoT!).toBeLessThanOrEqual(2 * 100 * 1 + 1e-6); // at most one round trip a day at 4/wk
      if (last.cargoT! > 0) {
        flown++;
        expect(last.cargoRevenue).toBeGreaterThan(0);
        expect(last.revenue).toBe(last.cargoRevenue);
        expect(last.pax).toEqual({ economy: 0, premium: 0, business: 0 });
        expect(last.loadFactor).toBeGreaterThan(0.3);
      }
    }
    expect(flown).toBeGreaterThan(3);
  });
  it('a passenger airline can’t open a cargo route, and freighters can’t fly passenger routes', () => {
    const { s, ac } = cargoAirline();
    expect(run(s, { type: 'openRoute', from: 'HKG', to: 'JFK', fares: { economy: 500, premium: 900, business: 2000 }, assignments: [{ aircraftId: ac, roundTripsPerWeek: 1 }] }))
      .toEqual({ ok: false, reason: 'A cargo airline can’t fly passengers' });
    s.airlines[P]!.kind = 'combination';
    expect(run(s, { type: 'openRoute', from: 'HKG', to: 'JFK', fares: { economy: 500, premium: 900, business: 2000 }, assignments: [{ aircraftId: ac, roundTripsPerWeek: 1 }] }))
      .toEqual({ ok: false, reason: 'Freighters fly cargo routes only' });
    s.airlines[P]!.kind = 'passenger';
    expect(run(s, { type: 'openRoute', kind: 'cargo', from: 'HKG', to: 'JFK', fares: { economy: 1, premium: 1, business: 1 }, assignments: [{ aircraftId: ac, roundTripsPerWeek: 1 }] }))
      .toEqual({ ok: false, reason: 'Passenger airlines don’t fly freighters' });
  });
  it('dangerous goods need the licence; special cargo needs a main-deck freighter', () => {
    const week = (st: GameState) => { let x = st, sum = 0; for (let i = 0; i < 7; i++) { x = tick(x, [], catalog).state; sum += Object.values(x.routes)[0]!.last!.cargoT ?? 0; } return sum; };
    expect(week(cargoAirline('TF77', 4, { cargoAccept: ['dangerous', 'special'] }).s)).toBeGreaterThan(0); // special only, no licence
    expect(week(cargoAirline('TF20', 4, { cargoAccept: ['special'] }).s)).toBe(0); // no main deck
    const { s } = cargoAirline('TF77', 4, { cargoAccept: ['dangerous'] });
    expect(week(s)).toBe(0);
    s.airlines[P]!.dgLicence = true;
    expect(week(s)).toBeGreaterThan(0);
  });
  it('preview shows expected tonnes, load and a suggested rate', () => {
    const s = playerGame('HKG', 3);
    Object.assign(s.airlines[P]!, { kind: 'cargo', tier: 'global', cash: 1_000_000_000 });
    run(s, { type: 'leaseAircraft', typeId: 'TF77' });
    const ac = playerAircraft(s)[0]!.id;
    const p = preview(s, P, { type: 'openRoute', kind: 'cargo', from: 'HKG', to: 'LAX', fares: { economy: 1, premium: 1, business: 1 }, assignments: [{ aircraftId: ac, roundTripsPerWeek: 4 }] }, catalog);
    expect(p.ok).toBe(true);
    expect(p.expectedCargoT).toBeGreaterThan(0);
    expect(p.expectedLoadFactor).toBeGreaterThan(0);
    expect(p.suggestedCargoRate).toBeGreaterThan(0);
  });
});

describe('belly cargo on passenger routes', () => {
  function pax(bellyOn = true, belly?: Extract<Command, { type: 'openRoute' }>['belly']) {
    const s = playerGame('LHR', 3);
    s.airlines[P]!.bellyCargo = bellyOn;
    s.airlines[P]!.tier = 'global';
    s.airlines[P]!.cash = 1_000_000_000;
    run(s, { type: 'leaseAircraft', typeId: 'B789', config: config({ economy: 360, premium: 0, business: 0 }) });
    const ac = playerAircraft(s)[0]!.id;
    expect(run(s, { type: 'openRoute', from: 'LHR', to: 'JFK', fares: { economy: 450, premium: 900, business: 2500 }, assignments: [{ aircraftId: ac, roundTripsPerWeek: 7 }], ...(belly ? { belly } : {}) })).toEqual({ ok: true });
    return { s, id: Object.keys(s.routes)[0]! };
  }
  it('carries cargo in the hold by default and adds its revenue', () => {
    const { s, id } = pax();
    expect(s.routes[id]!.belly).toEqual({ mode: 'default' });
    const last = days(s, 2).routes[id]!.last!;
    expect(last.cargoT!).toBeGreaterThan(0);
    expect(last.cargoRevenue!).toBeGreaterThan(0);
    expect(last.revenue).toBeGreaterThan(last.cargoRevenue!);
  });
  it('switching belly cargo off carries none', () => {
    const { s, id } = pax(false);
    expect(days(s, 2).routes[id]!.last!.cargoT ?? 0).toBe(0);
  });
  it('giving bags too little room makes passengers unhappy', () => {
    const q = (holdShare: number) => {
      const { s, id } = pax(true, { mode: 'custom', rate: 2, accept: ['general', 'express'], holdShare });
      return routeOps(s.routes[id]!, s, catalog, hoursByAircraft(s, catalog), true).quality.economy;
    };
    expect(q(0.9)).toBeLessThan(q(0.6) - 3);
    expect(q(0.7)).toBeCloseTo(q(0.6));
  });
});
