import { describe, expect, it } from 'vitest';
import { offerQuality } from './quality';

const base = { comfort: 70, ageYears: 0, productScore: 60, onTime: 85 };

describe('offerQuality', () => {
  it('combines aircraft comfort, the cabin product and on-time', () =>
    expect(offerQuality(base)).toBeCloseTo(0.4 * 70 + 0.35 * 60 + 0.25 * 85, 6));
  it('caps the age penalty at 40%', () =>
    expect(offerQuality({ ...base, ageYears: 30 })).toBeCloseTo(0.4 * 70 * 0.6 + 0.35 * 60 + 0.25 * 85, 6));
  it('a better product means a better offer', () =>
    expect(offerQuality({ ...base, productScore: 90 })).toBeGreaterThan(offerQuality(base)));
});
