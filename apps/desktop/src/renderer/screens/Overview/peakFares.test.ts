import type { Route, UpcomingPeakView } from '@skyempire/shared';
import { describe, expect, it } from 'vitest';
import { defaultPeakPct, peakFareCommands, routesForPeak } from './peakFares';

const r = (id: string, from: string, to: string, o: Partial<Route> = {}): Route => ({
  id, airlineId: 'p', from, to, fares: { economy: 100, premium: 1, business: 1 }, assignments: [], status: 'active', openedDay: 0, last: null, profit30: [], ...o,
});
const diwali: UpcomingPeakView = { name: 'Diwali', countries: ['IN'], startDay: 300, endDay: 306, peak: 0.6 };

describe('raising fares for a travel peak', () => {
  it('picks the routes that touch the peak countries, including stops', () => {
    const routes = [r('a', 'LHR', 'DEL'), r('b', 'LHR', 'CDG'), r('c', 'LHR', 'SIN', { stops: ['BOM'] }), r('d', 'LHR', 'BOM', { status: 'suspended' })];
    expect(routesForPeak(routes, diwali).map((x) => x.id)).toEqual(['a', 'c']);
  });
  it('defaults to a bigger rise for bigger peaks', () => {
    expect(defaultPeakPct(0.6)).toBe(19);
    expect(defaultPeakPct(0.2)).toBe(13);
  });
  it('adds the seasonal fare, keeps existing ones, and skips overlaps and full routes', () => {
    const existing = { startDay: 100, endDay: 110, pct: 10 };
    const routes = [
      r('a', 'LHR', 'DEL', { seasonalFares: [existing] }),
      r('b', 'LHR', 'BOM', { seasonalFares: [{ startDay: 304, endDay: 310, pct: 5 }] }),
      r('c', 'LHR', 'MAA', { seasonalFares: [1, 2, 3, 4].map((i) => ({ startDay: 200 + i * 10, endDay: 205 + i * 10, pct: 5 })) }),
      r('d', 'LHR', 'BLR', { seasonalFares: [{ startDay: 10, endDay: 20, pct: 5 }] }),
    ];
    const { commands, skipped } = peakFareCommands(routes, diwali, 20, 90);
    expect(commands).toEqual([
      { type: 'updateRoute', routeId: 'a', seasonalFares: [existing, { startDay: 300, endDay: 306, pct: 20 }] },
      { type: 'updateRoute', routeId: 'd', seasonalFares: [{ startDay: 300, endDay: 306, pct: 20 }] }, // the past one drops off
    ]);
    expect(skipped).toBe(2);
  });
  it('a peak already under way starts today', () => {
    const { commands } = peakFareCommands([r('a', 'LHR', 'DEL')], diwali, 15, 302);
    expect(commands[0]).toMatchObject({ seasonalFares: [{ startDay: 302, endDay: 306, pct: 15 }] });
  });
});
