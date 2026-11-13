import { describe, expect, it } from 'vitest';
import { businessFor, landingFeeFor, paxFeeFor, sizeClassFor, slotCapacityFor, wealthFor } from './heuristics';

describe('airport heuristics', () => {
  it('big large airports are size 6', () => expect(sizeClassFor('large_airport', 9)).toBe(6));
  it('mid large airports are size 5', () => expect(sizeClassFor('large_airport', 5)).toBe(5));
  it('small large airports are size 4', () => expect(sizeClassFor('large_airport', 1)).toBe(4));
  it('small medium airports are size 1', () => expect(sizeClassFor('medium_airport', 0.5)).toBe(1));
  it('medium airports with 2M+ are size 3', () => expect(sizeClassFor('medium_airport', 2.5)).toBe(3));
  it('slot capacity by size', () => expect(slotCapacityFor(4)).toBe(400));
  it('fees by size', () => { expect(landingFeeFor(6)).toBe(12); expect(paxFeeFor(1)).toBe(6); });
  it('wealth clamps low', () => expect(wealthFor(10_000)).toBe(0.3));
  it('wealth clamps high', () => expect(wealthFor(100_000)).toBe(2.0));
  it('wealth mid', () => expect(wealthFor(40_000)).toBe(1));
  it('business grows with catchment and stays in 0..1', () => {
    expect(businessFor(10)).toBeGreaterThan(businessFor(1));
    expect(businessFor(100)).toBeLessThanOrEqual(1);
    expect(businessFor(0)).toBe(0);
  });
});
