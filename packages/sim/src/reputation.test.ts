import { describe, expect, it } from 'vitest';
import { fleetYouth, marketingScore, priceFairness, reputationTarget, stepReputation } from './reputation';

describe('reputation', () => {
  it('moves toward its target without overshooting', () => {
    let r = 50;
    for (let i = 0; i < 90; i++) {
      r = stepReputation(r, 80);
      expect(r).toBeLessThanOrEqual(80);
    }
    expect(r).toBeGreaterThan(75);
  });
  it('weights inputs per the spec', () =>
    expect(reputationTarget({ onTime: 100, quality: 100, priceFairness: 100, fleetYouth: 100, marketing: 100, incidentPenalty: 0 })).toBeCloseTo(100, 6));
  it('input scores', () => {
    expect(priceFairness(1)).toBe(100);
    expect(priceFairness(1.5)).toBe(50);
    expect(fleetYouth(4)).toBe(80);
    expect(marketingScore(250_000, 5)).toBe(100);
    expect(marketingScore(0, 5)).toBe(0);
  });
});
