import { describe, expect, it } from 'vitest';
import aircraft from './aircraft.json';
import { AircraftTypeSchema } from './schema';

const list = aircraft.map((a) => AircraftTypeSchema.parse(a));

describe('aircraft catalog', () => {
  it('has the 19 v0.1 types', () => expect(list).toHaveLength(19));
  it('has unique ids', () => expect(new Set(list.map((a) => a.id)).size).toBe(19));
  it('cites at least one source per type', () => list.forEach((a) => expect(a.sources.length).toBeGreaterThan(0)));
  it('leases cost under 1% of price per month', () => list.forEach((a) => expect(a.leasePerMonth).toBeLessThan(a.priceUsd / 100)));
  it('widebodies fly long range', () =>
    list.filter((a) => a.class === 'widebody').forEach((a) => expect(a.rangeKm).toBeGreaterThan(11000)));
  it('pins A320neo values used by sim tests', () => {
    const a = list.find((x) => x.id === 'A20N')!;
    expect(a).toMatchObject({ cruiseKmh: 830, turnaroundMin: 45, rangeKm: 6300, maxSeats: 194 });
  });
  it('gates bigger types by tier', () => {
    expect(list.find((x) => x.id === 'B789')!.tier).toBe('regional');
    expect(list.find((x) => x.id === 'A359')!.tier).toBe('national');
  });
});
