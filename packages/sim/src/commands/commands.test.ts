import { formatMoney } from '@skyempire/shared';
import { describe, expect, it } from 'vitest';
import { refreshUsedListings } from '../newGame';
import { Rng } from '../rng';
import { applyCommand } from './apply';
import { catalog, fares, lease, playerAircraft, playerGame } from '../testing';

const P = 'al_player';
const run = (s: ReturnType<typeof playerGame>, cmd: Parameters<typeof applyCommand>[2]) => applyCommand(s, P, cmd, catalog);
function withA20N() {
  const s = playerGame();
  expect(run(s, lease('A20N'))).toEqual({ ok: true });
  return { s, ac: playerAircraft(s)[0]!.id };
}

describe('fleet commands', () => {
  it('leasing charges a one-month deposit', () => {
    const s = playerGame();
    const before = s.airlines[P]!.cash;
    run(s, lease('A20N'));
    expect(s.airlines[P]!.cash).toBe(before - catalog.aircraftTypes.A20N!.leasePerMonth);
    expect(playerAircraft(s)).toHaveLength(1);
  });
  it('locks widebodies at startup tier', () =>
    expect(run(playerGame(), lease('B789'))).toEqual({ ok: false, reason: 'Unlocks at Regional tier' }));
  it('rejects leasing or buying new a used-only type', () => {
    const s = playerGame();
    s.airlines[P]!.tier = 'national';
    expect(run(s, lease('B752'))).toEqual({ ok: false, reason: 'Only available used' });
    expect(run(s, { type: 'buyAircraft', typeId: 'B763', cabin: { economy: 200, premium: 0, business: 0 } })).toEqual({ ok: false, reason: 'Only available used' });
  });
  it('the used market can list used-only types', () => {
    const s = playerGame();
    const seen = new Set<string>();
    const rng = new Rng(5);
    for (let i = 0; i < 40; i++) {
      refreshUsedListings(s, catalog, rng);
      for (const l of s.market.usedListings) seen.add(l.typeId);
    }
    expect(seen.has('B752')).toBe(true);
  });
  it('rejects too many seats', () => {
    const r = run(playerGame(), { type: 'leaseAircraft', typeId: 'A20N', cabin: { economy: 180, premium: 0, business: 12 } });
    expect(r).toEqual({ ok: false, reason: 'Too many seats — max 194 seat units' });
  });
  it('reports the exact cash shortfall', () => {
    const s = playerGame();
    s.airlines[P]!.cash = 1_000_000;
    const price = catalog.aircraftTypes.A20N!.priceUsd;
    expect(run(s, { type: 'buyAircraft', typeId: 'A20N', cabin: { economy: 194, premium: 0, business: 0 } })).toEqual({
      ok: false,
      reason: `Not enough cash — you need ${formatMoney(price - 1_000_000)} more`,
    });
  });
  it('a rejected command leaves the state untouched', () => {
    const s = playerGame();
    const before = structuredClone(s);
    run(s, lease('B77W'));
    expect(s).toEqual(before);
  });
});

describe('route commands', () => {
  it('opens a route and uses slots at both ends', () => {
    const { s, ac } = withA20N();
    expect(run(s, { type: 'openRoute', from: 'FRA', to: 'CDG', fares, assignments: [{ aircraftId: ac, roundTripsPerWeek: 14 }] })).toEqual({ ok: true });
    expect(s.slotsUsed.FRA).toBe(4);
    expect(s.slotsUsed.CDG).toBe(4);
  });
  it('rejects routes beyond range', () => {
    const { s, ac } = withA20N();
    expect(run(s, { type: 'openRoute', from: 'FRA', to: 'SIN', fares, assignments: [{ aircraftId: ac, roundTripsPerWeek: 1 }] })).toEqual({
      ok: false,
      reason: 'Range too short — Airbus A320neo flies max 6,300 km',
    });
  });
  it('rejects routes that touch no base', () => {
    const { s, ac } = withA20N();
    expect(run(s, { type: 'openRoute', from: 'CDG', to: 'MAD', fares, assignments: [{ aircraftId: ac, roundTripsPerWeek: 7 }] })).toEqual({
      ok: false,
      reason: 'Routes must start or end at one of your bases',
    });
  });
  it('enforces the weekly hour budget across routes', () => {
    const { s, ac } = withA20N();
    expect(run(s, { type: 'openRoute', from: 'FRA', to: 'LHR', fares, assignments: [{ aircraftId: ac, roundTripsPerWeek: 20 }] }).ok).toBe(true);
    const r = run(s, { type: 'openRoute', from: 'FRA', to: 'MAD', fares, assignments: [{ aircraftId: ac, roundTripsPerWeek: 15 }] });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toMatch(/free hours/);
  });
  it('rejects routes when slots run out', () => {
    const { s, ac } = withA20N();
    s.airportSlotBonus.CDG = -1 + 4 / catalog.airports.CDG!.slotCapacity; // capacity 4
    s.slotsUsed.CDG = 3;
    expect(run(s, { type: 'openRoute', from: 'FRA', to: 'CDG', fares, assignments: [{ aircraftId: ac, roundTripsPerWeek: 7 }] })).toEqual({
      ok: false,
      reason: 'No free slots at CDG',
    });
  });
  it('rejects a duplicate route', () => {
    const { s, ac } = withA20N();
    run(s, { type: 'openRoute', from: 'FRA', to: 'CDG', fares, assignments: [{ aircraftId: ac, roundTripsPerWeek: 7 }] });
    expect(run(s, { type: 'openRoute', from: 'CDG', to: 'FRA', fares, assignments: [{ aircraftId: ac, roundTripsPerWeek: 7 }] })).toEqual({
      ok: false,
      reason: 'You already fly this route',
    });
  });
  it('closing a route releases its slots', () => {
    const { s, ac } = withA20N();
    run(s, { type: 'openRoute', from: 'FRA', to: 'CDG', fares, assignments: [{ aircraftId: ac, roundTripsPerWeek: 14 }] });
    const routeId = Object.keys(s.routes)[0]!;
    expect(run(s, { type: 'closeRoute', routeId })).toEqual({ ok: true });
    expect(s.slotsUsed.FRA ?? 0).toBe(0);
    expect(s.routes[routeId]).toBeUndefined();
  });
  it('selling an assigned aircraft suspends its routes and frees slots', () => {
    const { s, ac } = withA20N();
    run(s, { type: 'openRoute', from: 'FRA', to: 'CDG', fares, assignments: [{ aircraftId: ac, roundTripsPerWeek: 14 }] });
    expect(run(s, { type: 'sellAircraft', aircraftId: ac })).toEqual({ ok: true });
    const route = Object.values(s.routes)[0]!;
    expect(route.status).toBe('suspended');
    expect(route.assignments).toHaveLength(0);
    expect(s.slotsUsed.CDG ?? 0).toBe(0);
    expect(s.aircraft[ac]).toBeUndefined();
  });
  it('assigning an aircraft to a suspended route reactivates it', () => {
    const { s, ac } = withA20N();
    run(s, { type: 'openRoute', from: 'FRA', to: 'CDG', fares, assignments: [{ aircraftId: ac, roundTripsPerWeek: 7 }] });
    run(s, { type: 'sellAircraft', aircraftId: ac });
    run(s, lease('A20N'));
    const ac2 = playerAircraft(s)[0]!.id;
    const routeId = Object.keys(s.routes)[0]!;
    expect(run(s, { type: 'updateRoute', routeId, assignments: [{ aircraftId: ac2, roundTripsPerWeek: 7 }] })).toEqual({ ok: true });
    expect(s.routes[routeId]!.status).toBe('active');
    expect(s.slotsUsed.CDG).toBe(2);
  });
});

describe('airline and finance commands', () => {
  it('opens a base for a price and allows routes from it', () => {
    const { s, ac } = withA20N();
    const cash = s.airlines[P]!.cash;
    expect(run(s, { type: 'openBase', airportId: 'CDG' })).toEqual({ ok: true });
    expect(s.airlines[P]!.cash).toBeLessThan(cash);
    expect(run(s, { type: 'openRoute', from: 'CDG', to: 'MAD', fares, assignments: [{ aircraftId: ac, roundTripsPerWeek: 7 }] }).ok).toBe(true);
  });
  it('cannot close the home base', () =>
    expect(run(playerGame(), { type: 'closeBase', airportId: 'FRA' })).toEqual({ ok: false, reason: 'You can’t close your home base' }));
  it('takes and repays a loan', () => {
    const s = playerGame();
    const cash = s.airlines[P]!.cash;
    expect(run(s, { type: 'takeLoan', amount: 10_000_000 })).toEqual({ ok: true });
    expect(s.airlines[P]!.cash).toBe(cash + 10_000_000);
    const loanId = s.airlines[P]!.loans[0]!.id;
    expect(run(s, { type: 'repayLoan', loanId, amount: 10_000_000 })).toEqual({ ok: true });
    expect(s.airlines[P]!.loans).toHaveLength(0);
  });
  it('rejects loans above the credit limit', () => {
    const r = run(playerGame(), { type: 'takeLoan', amount: 900_000_000 });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toMatch(/^Credit limit reached/);
  });
  it('sets service level and marketing', () => {
    const s = playerGame();
    run(s, { type: 'setServiceLevel', level: 5 });
    run(s, { type: 'setMarketing', perMonth: 250_000 });
    expect(s.airlines[P]).toMatchObject({ serviceLevel: 5, marketingPerMonth: 250_000 });
  });
});
