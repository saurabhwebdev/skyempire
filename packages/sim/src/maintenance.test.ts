import type { Aircraft } from '@skyempire/shared';
import { describe, expect, it } from 'vitest';
import { advanceAircraft, incidentChance, onTimeFor } from './maintenance';

const ac = (o: Partial<Aircraft> = {}): Aircraft => ({
  id: 'a', typeId: 'A20N', ownerId: 'x', ownership: 'leased', ageDays: 0, condition: 90, flightHours: 0,
  hoursSinceA: 0, hoursSinceC: 0, cabin: { economy: 194, premium: 0, business: 0 }, status: 'active', maintenanceDaysLeft: 0, bookValue: 0, ...o,
});

describe('maintenance', () => {
  it('wears condition with use and ages a day', () => {
    const a = ac();
    advanceAircraft(a, 10);
    expect(a.condition).toBeCloseTo(89.8, 6);
    expect(a.ageDays).toBe(1);
    expect(a.flightHours).toBe(10);
  });
  it('500 h triggers an A-check: 1 day out, $50k', () => {
    const a = ac({ hoursSinceA: 495 });
    const r = advanceAircraft(a, 10);
    expect(r.checkCost).toBe(50_000);
    expect(a.status).toBe('maintenance');
    expect(a.maintenanceDaysLeft).toBe(1);
    expect(a.hoursSinceA).toBe(0);
  });
  it('6,000 h triggers a C-check: 7 days, $1.5M, condition 95', () => {
    const a = ac({ hoursSinceC: 5995, condition: 50 });
    const r = advanceAircraft(a, 10);
    expect(r.checkCost).toBe(1_500_000);
    expect(a.maintenanceDaysLeft).toBe(7);
    expect(a.condition).toBe(95);
  });
  it('an aircraft in maintenance returns to service when done', () => {
    const a = ac({ status: 'maintenance', maintenanceDaysLeft: 1 });
    advanceAircraft(a, 0);
    expect(a.status).toBe('active');
  });
  it('on-time baseline is 85', () => expect(onTimeFor(100, 0.5, 0.5, false)).toBe(85));
  it('on-time suffers from poor condition, congestion and storms', () =>
    expect(onTimeFor(50, 0.95, 0.95, true)).toBe(85 - 5 - 10 - 5 - 10));
  it('incidents only happen to badly kept aircraft', () => {
    expect(incidentChance(50)).toBe(0);
    expect(incidentChance(30)).toBeGreaterThan(0);
  });
});
