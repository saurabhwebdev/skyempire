import { describe, expect, it } from 'vitest';
import { allocate, type Offer } from './allocation';

const offer = (routeId: string, o: Partial<Offer> = {}): Offer => ({
  airlineId: routeId, routeId, fare: 100, weeklyFrequency: 10, quality: 70, reputation: 50, stops: 0, seats: 10_000, ...o,
});
const total = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);

describe('allocate', () => {
  it('some passengers choose not to fly', () => {
    const m = allocate(1000, [offer('a')], 100, 'economy');
    expect(m.get('a')!).toBeGreaterThan(0);
    expect(m.get('a')!).toBeLessThan(1000);
  });
  it('identical offers split evenly', () => {
    const m = allocate(1000, [offer('a'), offer('b')], 100, 'economy');
    expect(Math.abs(m.get('a')! - m.get('b')!) / m.get('a')!).toBeLessThan(0.01);
  });
  it('cheaper offers win more passengers', () => {
    const m = allocate(1000, [offer('a', { fare: 80 }), offer('b')], 100, 'economy');
    expect(m.get('a')!).toBeGreaterThan(m.get('b')!);
  });
  it('full offers spill passengers to others', () => {
    const noSpill = allocate(1000, [offer('a'), offer('b')], 100, 'economy').get('b')!;
    const m = allocate(1000, [offer('a', { seats: 0 }), offer('b')], 100, 'economy');
    expect(m.get('a')).toBe(0);
    expect(m.get('b')!).toBeGreaterThan(noSpill);
  });
  it('never exceeds demand or seats', () => {
    const m = allocate(1000, [offer('a', { seats: 50 }), offer('b', { seats: 80, fare: 60 })], 100, 'economy');
    expect(total(m)).toBeLessThanOrEqual(1000);
    expect(m.get('a')!).toBeLessThanOrEqual(50);
    expect(m.get('b')!).toBeLessThanOrEqual(80);
  });
  it('returns zeros with no demand', () => expect(total(allocate(0, [offer('a')], 100, 'economy'))).toBe(0));
});
