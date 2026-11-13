import type { GameState } from '@skyempire/shared';
import { describe, expect, it } from 'vitest';
import { refFare } from '../demand';
import { distanceKm } from '../geo';
import { newGame } from '../newGame';
import { aircraftHoursUsed, slotCapacity } from '../ops';
import { Rng } from '../rng';
import { catalog } from '../testing';
import { tick } from '../tick';
import { runAi } from './decide';

function world(seed: number, days: number): GameState {
  let s = newGame({ seed, regionId: 'world', difficulty: 'normal', homeBaseId: 'LHR',
    airline: { name: 'AI Test Air', code: 'A1T', colors: { primary: '#123456', secondary: '#ffffff' }, logoShape: 'circle' } }, catalog);
  for (let i = 0; i < days; i++) s = tick(s, [], catalog).state;
  return s;
}
const ais = (s: GameState) => Object.values(s.airlines).filter((a) => !a.isPlayer && !a.bankrupt);
const fareRatio = (s: GameState, id: string) => {
  const rs = Object.values(s.routes).filter((r) => r.airlineId === id && r.status === 'active');
  return rs.reduce((x, r) => x + r.fares.economy / refFare(distanceKm(catalog.airports[r.from]!, catalog.airports[r.to]!), 'economy'), 0) / Math.max(1, rs.length);
};

describe('AI airlines', () => {
  const s90 = world(3, 90);
  it('every AI builds a network within 90 days', () => {
    for (const al of ais(s90)) {
      expect(Object.values(s90.routes).filter((r) => r.airlineId === al.id).length, al.name).toBeGreaterThanOrEqual(2);
      expect(Object.values(s90.aircraft).filter((a) => a.ownerId === al.id).length, al.name).toBeGreaterThanOrEqual(3);
    }
  });
  it('never over-commits aircraft hours or airport slots', () => {
    for (const ac of Object.values(s90.aircraft)) expect(aircraftHoursUsed(ac.id, s90, catalog)).toBeLessThanOrEqual(126 + 1e-6);
    for (const [id, used] of Object.entries(s90.slotsUsed)) expect(used, id).toBeLessThanOrEqual(slotCapacity(s90, catalog, id));
  });
  it('budget airlines price below legacy airlines', () => {
    const avg = (p: string) => {
      const xs = ais(s90).filter((a) => a.personality === p).map((a) => fareRatio(s90, a.id));
      return xs.reduce((x, y) => x + y, 0) / xs.length;
    };
    expect(avg('budget')).toBeLessThan(avg('legacy'));
  });
  it('lowers fares on a weak route', () => {
    const s = structuredClone(s90);
    const al = ais(s)[0]!;
    const r = Object.values(s.routes).find((x) => x.airlineId === al.id && x.status === 'active')!;
    r.last = { ...r.last!, loadFactor: 0.4 };
    const before = r.fares.economy;
    runAi(s, al.id, catalog, new Rng(1));
    if (s.routes[r.id]) expect(s.routes[r.id]!.fares.economy).toBeLessThan(before);
  });
  it('is deterministic', () => expect(world(4, 30)).toEqual(world(4, 30)));
});

describe('AI in trouble', () => {
  it('stops expanding and returns idle aircraft when cash runs low', () => {
    const s = world(5, 30);
    const al = ais(s)[0]!;
    const fleetBefore = Object.values(s.aircraft).filter((a) => a.ownerId === al.id);
    // Leave one aircraft idle by removing it from all routes.
    const idle = fleetBefore[0]!;
    for (const r of Object.values(s.routes)) r.assignments = r.assignments.filter((a) => a.aircraftId !== idle.id);
    al.cash = 100_000;
    al.loans = [{ id: 'big', principal: 1e10, annualRate: 0.1, takenDay: 0 }]; // no credit left
    runAi(s, al.id, catalog, new Rng(2));
    const after = Object.values(s.aircraft).filter((a) => a.ownerId === al.id);
    expect(after.length).toBeLessThan(fleetBefore.length);
    expect(s.aircraft[idle.id]).toBeUndefined();
  });
});
