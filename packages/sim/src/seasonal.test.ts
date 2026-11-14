import { CommandSchema } from '@skyempire/shared';
import { describe, expect, it } from 'vitest';
import { dayOf } from './calendar';
import { applyCommand } from './commands/apply';
import { revenueOf } from './daySim';
import { catalog, fares, lease, playerAircraft, playerGame } from './testing';
import { buildClientView } from './view';

function withRoute(hub = 'FRA', to = 'MAD') {
  const s = playerGame(hub, 0);
  applyCommand(s, s.playerId, lease('A20N'), catalog);
  const ac = playerAircraft(s)[0]!.id;
  expect(applyCommand(s, s.playerId, { type: 'openRoute', from: hub, to, fares, assignments: [{ aircraftId: ac, roundTripsPerWeek: 7 }] }, catalog)).toEqual({ ok: true });
  return { s, r: Object.values(s.routes)[0]! };
}

describe('seasonal fares', () => {
  it('a +20% seasonal fare raises revenue per passenger on its days only', () => {
    const { s, r } = withRoute();
    expect(applyCommand(s, s.playerId, { type: 'updateRoute', routeId: r.id, seasonalFares: [{ startDay: 10, endDay: 12, pct: 20 }] }, catalog)).toEqual({ ok: true });
    const pax = { economy: 100, premium: 0, business: 0 };
    expect(revenueOf(s.routes[r.id]!, pax, 11)).toBe(100 * fares.economy * 1.2);
    expect(revenueOf(s.routes[r.id]!, pax, 13)).toBe(100 * fares.economy);
  });
  it('rejects seasonal fares that start in the past', () => {
    const { s, r } = withRoute();
    s.day = 20;
    expect(applyCommand(s, s.playerId, { type: 'updateRoute', routeId: r.id, seasonalFares: [{ startDay: 5, endDay: 30, pct: 10 }] }, catalog))
      .toEqual({ ok: false, reason: 'Seasonal fares must start today or later' });
  });
  it('allows at most four periods, −50% to +100%, ending on or after they start', () => {
    const base = { type: 'updateRoute', routeId: 'r' } as const;
    const p = { startDay: 1, endDay: 2, pct: 10 };
    expect(CommandSchema.safeParse({ ...base, seasonalFares: [p, p, p, p] }).success).toBe(true);
    expect(CommandSchema.safeParse({ ...base, seasonalFares: [p, p, p, p, p] }).success).toBe(false);
    expect(CommandSchema.safeParse({ ...base, seasonalFares: [{ ...p, pct: 150 }] }).success).toBe(false);
    expect(CommandSchema.safeParse({ ...base, seasonalFares: [{ startDay: 5, endDay: 4, pct: 10 }] }).success).toBe(false);
  });
});

describe('upcoming peaks', () => {
  it('a Beijing-based player sees Lunar New Year coming within 60 days', () => {
    const s = playerGame('PEK', 0);
    s.day = dayOf(2027, 1, 1, 2026);
    const peaks = buildClientView(s, s.playerId, catalog).upcomingPeaks;
    const lny = peaks.find((p) => p.name === 'Lunar New Year');
    expect(lny).toMatchObject({ countries: ['CN'], startDay: dayOf(2027, 1, 27, 2026), endDay: dayOf(2027, 2, 16, 2026), peak: 0.8 });
  });
  it('only lists festivals in the player’s markets, soonest first', () => {
    const s = playerGame('FRA', 0);
    s.day = dayOf(2026, 11, 20, 2026);
    const peaks = buildClientView(s, s.playerId, catalog).upcomingPeaks;
    expect(peaks.map((p) => p.name)).toEqual(['Christmas & New Year']);
  });
});
