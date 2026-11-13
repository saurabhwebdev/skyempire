import { describe, expect, it } from 'vitest';
import { offerQuality } from './quality';

const base = { comfort: 70, ageYears: 0, seatUnitsRatio: 0.9, serviceLevel: 3 as const, onTime: 85 };

describe('offerQuality', () => {
  it('combines comfort, service and on-time', () =>
    expect(offerQuality(base)).toBeCloseTo(0.4 * 70 + 0.35 * 60 + 0.25 * 85, 6));
  it('caps the age penalty at 40%', () =>
    expect(offerQuality({ ...base, ageYears: 30 })).toBeCloseTo(0.4 * 70 * 0.6 + 0.35 * 60 + 0.25 * 85, 6));
  it('dense cabins lose comfort', () =>
    expect(offerQuality({ ...base, seatUnitsRatio: 1 })).toBeLessThan(offerQuality(base)));
});
