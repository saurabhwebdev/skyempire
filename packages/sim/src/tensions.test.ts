import type { ActiveTension } from '@skyempire/shared';
import { describe, expect, it } from 'vitest';
import { applyCommand } from './commands/apply';
import { hoursByAircraft, routeOps } from './daySim';
import { Rng } from './rng';
import { rollTensions, tensionDemandFactor } from './tensions';
import { airport, catalog, fares, lease, playerAircraft, playerGame } from './testing';
import { buildClientView } from './view';

function withRoute(from = 'FRA', to = 'MAD') {
  const s = playerGame(from, 3);
  applyCommand(s, s.playerId, lease('A20N'), catalog);
  const ac = playerAircraft(s)[0]!.id;
  expect(applyCommand(s, s.playerId, { type: 'openRoute', from, to, fares, assignments: [{ aircraftId: ac, roundTripsPerWeek: 14 }] }, catalog)).toEqual({ ok: true });
  return { s, r: Object.values(s.routes).find((x) => x.airlineId === s.playerId)! };
}
const ban = (a: string, b: string, startDay = 0, endDay = 500): ActiveTension => ({ id: 'ban1', kind: 'routeBan', countries: [a, b], magnitude: 1, warnDay: 0, startDay, endDay });
const flown = (o: ReturnType<typeof routeOps>) => [...o.roundTrips.values()].reduce((x, y) => x + y, 0);

describe('route bans', () => {
  it('ground routes between the two countries and block new ones', () => {
    const { s, r } = withRoute();
    s.day = 3;
    s.world.tensions.push(ban('DE', 'ES'));
    const ops = routeOps(r, s, catalog, hoursByAircraft(s, catalog), false);
    expect(flown(ops)).toBe(0);
    expect(ops.blocked).toBe('Flights banned between Germany and Spain');
    applyCommand(s, s.playerId, lease('A20N'), catalog);
    const ac = playerAircraft(s)[1]!.id;
    expect(applyCommand(s, s.playerId, { type: 'openRoute', from: 'FRA', to: 'BCN', fares, assignments: [{ aircraftId: ac, roundTripsPerWeek: 7 }] }, catalog))
      .toEqual({ ok: false, reason: 'Flights banned between Germany and Spain' });
  });
  it('show in the client view', () => {
    const { s, r } = withRoute();
    s.day = 3;
    s.world.tensions.push(ban('DE', 'ES'));
    const v = buildClientView(s, s.playerId, catalog);
    expect(v.routeStatus[r.id]).toEqual({ detourKm: 0, blocked: 'Flights banned between Germany and Spain' });
    expect(v.tensions[0]).toMatchObject({ kind: 'routeBan', countries: ['DE', 'ES'], active: true, label: 'Flights banned between Germany and Spain' });
  });
});

describe('editing affected routes', () => {
  it('a banned route can still change fares or drop aircraft, but not grow', () => {
    const { s, r } = withRoute();
    s.day = 3;
    s.world.tensions.push(ban('DE', 'ES'));
    expect(applyCommand(s, s.playerId, { type: 'updateRoute', routeId: r.id, fares: { economy: 99, premium: 199, business: 399 }, assignments: r.assignments }, catalog)).toEqual({ ok: true });
    expect(applyCommand(s, s.playerId, { type: 'updateRoute', routeId: r.id, assignments: [{ aircraftId: r.assignments[0]!.aircraftId, roundTripsPerWeek: 7 }] }, catalog)).toEqual({ ok: true });
    expect(applyCommand(s, s.playerId, { type: 'updateRoute', routeId: r.id, assignments: [{ aircraftId: r.assignments[0]!.aircraftId, roundTripsPerWeek: 10 }] }, catalog))
      .toEqual({ ok: false, reason: 'Flights banned between Germany and Spain' });
  });
  it('a closure does not break an unchanged, fully used schedule (hours use planning distance)', async () => {
    const { maxRoundTripsPerWeek } = await import('./ops');
    const { distanceKm } = await import('./geo');
    const s = playerGame('FRA', 0);
    s.airlines[s.playerId]!.tier = 'national';
    applyCommand(s, s.playerId, lease('B789'), catalog);
    const ac = playerAircraft(s)[0]!.id;
    const rt = maxRoundTripsPerWeek(distanceKm(airport('FRA'), airport('PEK')), catalog.aircraftTypes.B789!);
    expect(applyCommand(s, s.playerId, { type: 'openRoute', from: 'FRA', to: 'PEK', fares, assignments: [{ aircraftId: ac, roundTripsPerWeek: rt }] }, catalog)).toEqual({ ok: true });
    const r = Object.values(s.routes)[0]!;
    s.day = 50;
    s.world.tensions.push({ id: 'c', kind: 'airspaceClosure', regionId: 'central-asia', magnitude: 1, warnDay: 0, startDay: 40, endDay: 400 }, { id: 'c2', kind: 'airspaceClosure', regionId: 'western-russia', magnitude: 1, warnDay: 0, startDay: 40, endDay: 400 });
    expect(applyCommand(s, s.playerId, { type: 'updateRoute', routeId: r.id, fares: { economy: 500, premium: 900, business: 2000 }, assignments: r.assignments }, catalog)).toEqual({ ok: true });
  });
});

describe('advisories and thaws', () => {
  it('a travel advisory cuts demand to that country only', () => {
    const s = playerGame('FRA', 0);
    s.world.tensions.push({ id: 'a', kind: 'advisory', country: 'ES', magnitude: 0.3, warnDay: 0, startDay: 0, endDay: 100 });
    expect(tensionDemandFactor(s, airport('FRA'), airport('MAD'))).toBeCloseTo(0.7);
    expect(tensionDemandFactor(s, airport('MAD'), airport('FRA'))).toBe(1);
  });
  it('a thaw bonus lifts demand between the pair', () => {
    const s = playerGame('FRA', 0);
    s.world.tensions.push({ id: 'b', kind: 'thawBonus', countries: ['DE', 'ES'], magnitude: 0.2, warnDay: 0, startDay: 0, endDay: 90 });
    expect(tensionDemandFactor(s, airport('MAD'), airport('FRA'))).toBeCloseTo(1.2);
  });
});

describe('rolling tensions', () => {
  it('warns 7–30 days ahead, never names a cause, and ends events on time', () => {
    const { s } = withRoute('FRA', 'IST');
    const rng = new Rng(3);
    const seen: ActiveTension[] = [];
    const titles: string[] = [];
    for (let d = 1; d < 3000; d++) {
      s.day = d;
      for (const n of rollTensions(s, catalog, rng)) titles.push(n.title + ' ' + n.body);
      for (const t of s.world.tensions) if (!seen.some((x) => x.id === t.id)) seen.push({ ...t });
      expect(s.world.tensions.every((t) => t.endDay >= d)).toBe(true);
    }
    const warned = seen.filter((t) => t.kind !== 'thawBonus');
    expect(warned.length).toBeGreaterThan(10);
    for (const t of warned) expect(t.startDay - t.warnDay).toBeGreaterThanOrEqual(7);
    for (const t of warned) expect(t.startDay - t.warnDay).toBeLessThanOrEqual(30);
    expect(titles.some((x) => x.startsWith('Rising tensions'))).toBe(true);
    for (const x of titles) expect(x).not.toMatch(/war|conflict|attack|military|terror/i);
  });
  it('a thaw ends a ban early and adds a demand bonus', () => {
    const s = playerGame('FRA', 0);
    s.world.tensions.push(ban('DE', 'ES', 0, 5000));
    const rng = new Rng(9);
    let d = 1;
    for (; d < 4000 && s.world.tensions.some((t) => t.kind === 'routeBan' && t.id === 'ban1'); d++) {
      s.day = d;
      rollTensions(s, catalog, rng);
      const b = s.world.tensions.find((t) => t.id === 'ban1');
      if (b && b.endDay < 5000) break;
    }
    const b = s.world.tensions.find((t) => t.id === 'ban1');
    expect(b === undefined || b.endDay < 5000).toBe(true);
    expect(s.world.tensions.some((t) => t.kind === 'thawBonus' && t.countries?.join() === 'DE,ES')).toBe(true);
  });
});

describe('AI and tensions', () => {
  it('an AI airline keeps a route when only some of its aircraft are out of range', async () => {
    const { aiShouldDrop } = await import('./ai/decide');
    expect(aiShouldDrop({ detourKm: 900, blocked: 'Detour exceeds Airbus A320neo range' }, [true, false])).toBe(false);
    expect(aiShouldDrop({ detourKm: 900, blocked: 'Detour exceeds Airbus A320neo range' }, [true, true])).toBe(true);
    expect(aiShouldDrop({ detourKm: 0, blocked: 'Flights banned between Germany and Spain' }, [false])).toBe(true);
    expect(aiShouldDrop({ detourKm: 0, blocked: null }, [false])).toBe(false);
  });
  it('an AI airline closes routes grounded by a ban', async () => {
    const { runAi } = await import('./ai/decide');
    const { tick } = await import('./tick');
    let s = playerGame('FRA', 3);
    const intl = () => Object.values(s.routes).find((x) => x.airlineId !== s.playerId && catalog.airports[x.from]!.country !== catalog.airports[x.to]!.country);
    for (let i = 0; i < 30 && !intl(); i++) s = tick(s, [], catalog).state;
    const r = intl()!;
    const a = catalog.airports[r.from]!.country, b = catalog.airports[r.to]!.country;
    s.world.tensions.push(ban(a, b));
    runAi(s, r.airlineId, catalog, new Rng(1));
    expect(Object.values(s.routes).filter((x) => x.airlineId === r.airlineId).some((x) => {
      const ca = catalog.airports[x.from]!.country, cb = catalog.airports[x.to]!.country;
      return (ca === a && cb === b) || (ca === b && cb === a);
    })).toBe(false);
  });
});
