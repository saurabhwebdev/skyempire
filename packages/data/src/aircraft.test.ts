import { describe, expect, it } from 'vitest';
import aircraft from './aircraft.json';
import { AircraftTypeSchema } from './schema';

const all = aircraft.map((a) => AircraftTypeSchema.parse(a));
const list = all.filter((a) => a.kind !== 'freighter');
const freighters = all.filter((a) => a.kind === 'freighter');

describe('aircraft catalog', () => {
  it('has 38 airliners (19 from v0.1 + 19 in v0.2)', () => expect(list).toHaveLength(38));
  it('has unique ids', () => expect(new Set(all.map((a) => a.id)).size).toBe(all.length));
  it('cites at least one source per type', () => all.forEach((a) => expect(a.sources.length).toBeGreaterThan(0)));
  it('leases cost under 1% of price per month', () => all.forEach((a) => expect(a.leasePerMonth, a.id).toBeLessThan(a.priceUsd / 100)));
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

  it('every airliner has a belly hold', () => list.forEach((a) => expect(a.bellyT, a.id).toBeGreaterThan(0)));
});

describe('freighters (v0.6)', () => {
  it('has 34 real freighter types with a payload and no seats', () => {
    expect(freighters).toHaveLength(34);
    for (const f of freighters) {
      expect(f.payloadT, f.id).toBeGreaterThan(1);
      expect(f.maxSeats, f.id).toBe(0);
    }
  });
  it('conversions come from passenger types in the game', () => {
    const ids = new Set(list.map((a) => a.id));
    const conv = freighters.filter((f) => f.conversion);
    expect(conv.length).toBe(10);
    for (const f of conv) for (const from of f.conversion!.from) expect(ids.has(from), `${f.id} ← ${from}`).toBe(true);
    expect(freighters.find((f) => f.id === 'B7SF')!.conversion!.from).toEqual(['B77W']);
  });
  it('the A350F and 777-8F arrive on their real entry dates', () => {
    expect(freighters.find((f) => f.id === 'A35F')!.entryYear).toBe(2027);
    expect(freighters.find((f) => f.id === 'B78F')!.entryYear).toBe(2028);
  });
  it('the biggest freighters carry over 100 t', () => {
    for (const id of ['B48F', 'B77F', 'A124']) expect(freighters.find((f) => f.id === id)!.payloadT).toBeGreaterThan(100);
  });
});
