import { describe, expect, it } from 'vitest';
import aircraft from './aircraft.json';
import { AircraftTypeSchema } from './schema';

const list = aircraft.map((a) => AircraftTypeSchema.parse(a));

describe('aircraft catalog', () => {
  it('has 38 types (19 from v0.1 + 19 in v0.2)', () => expect(list).toHaveLength(38));
  it('has unique ids', () => expect(new Set(list.map((a) => a.id)).size).toBe(38));
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
    for (const id of ['A388', 'B748', 'B779', 'A35K']) expect(list.find((x) => x.id === id)!.tier).toBe('global');
  });
  it('marks out-of-production types used-only', () => {
    const used = list.filter((x) => x.usedOnly).map((x) => x.id).sort();
    expect(used).toEqual(['A319', 'A321', 'B737', 'B752', 'B763', 'B772']);
  });
});
