import { describe, expect, it } from 'vitest';
import { blockHours, maxRoundTripsPerWeek, roundTripHours, seatUnits, slotsNeeded } from './ops';
import { type } from './testing';

describe('ops math', () => {
  it('block time adds 0.5 h', () => expect(blockHours(830, 830)).toBe(1.5));
  it('round trip hours include turnaround', () =>
    expect(roundTripHours(655, type('A20N'))).toBeCloseTo(2 * (655 / 830 + 0.5 + 0.75), 6));
  it('max weekly round trips fits a 126 h week', () => expect(maxRoundTripsPerWeek(655, type('A20N'))).toBe(30));
  it('slots per airport per day', () => {
    expect(slotsNeeded(14)).toBe(4);
    expect(slotsNeeded(15)).toBe(6);
    expect(slotsNeeded(1)).toBe(2);
  });
  it('seat units weight premium cabins', () => expect(seatUnits({ economy: 150, premium: 0, business: 12 })).toBe(180));
});
