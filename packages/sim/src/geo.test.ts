import { describe, expect, it } from 'vitest';
import { distanceKm } from './geo';
import { airport } from './testing';

describe('distanceKm', () => {
  it('LHR–CDG is about 348 km', () => expect(Math.abs(distanceKm(airport('LHR'), airport('CDG')) - 348)).toBeLessThan(5));
  it('is symmetric', () =>
    expect(distanceKm(airport('JFK'), airport('LHR'))).toBeCloseTo(distanceKm(airport('LHR'), airport('JFK')), 6));
});
