import { describe, expect, it } from 'vitest';
import { dayOf } from './calendar';
import { holidayDemandFactors, holidayLift } from './holidays';
import { seasonality } from './demand';
import { airport, catalog } from './testing';

const at = (y: number, m: number, d: number) => dayOf(y, m, d, 2026);

describe('holidays', () => {
  it('Chunyun lift for CN on Lunar New Year 2027 is 0.8', () => expect(holidayLift('CN', at(2027, 2, 6), 2026, catalog)).toBeCloseTo(0.8));
  it('Christmas lift for GB on Dec 26 is above 0.5', () => expect(holidayLift('GB', at(2026, 12, 26), 2026, catalog)).toBeGreaterThan(0.5));
  it('Diwali lifts IN demand around Oct 28 2027', () => expect(holidayLift('IN', at(2027, 10, 28), 2026, catalog)).toBeGreaterThanOrEqual(0.5));
  it('ordinary days have no lift', () => expect(holidayLift('GB', at(2027, 6, 9), 2026, catalog)).toBe(0));
  it('Ramadan lowers leisure demand in SA', () => expect(holidayLift('SA', at(2027, 2, 25), 2026, catalog)).toBeCloseTo(-0.15));
  it('a public holiday gives a small lift', () => expect(holidayLift('DE', at(2027, 10, 3), 2026, catalog)).toBeCloseTo(0.1));
  it('an unknown country gives 0', () => expect(holidayLift('ZZ', at(2027, 12, 25), 2026, catalog)).toBe(0));
  it('years beyond the table wrap without throwing', () => {
    expect(() => holidayLift('CN', at(2051, 2, 1), 2026, catalog)).not.toThrow();
    expect(holidayLift('GB', dayOf(2047, 12, 26, 2046), 2046, catalog)).toBeGreaterThan(0.5);
  });
  it('a holiday raises leisure demand and lowers business demand on a CN–CN pair', () => {
    const f = holidayDemandFactors(airport('PEK'), airport('PVG'), at(2027, 2, 6), 2026, catalog);
    expect(f.leisure).toBeGreaterThan(1.4);
    expect(f.business).toBeCloseTo(0.8);
    const normal = holidayDemandFactors(airport('PEK'), airport('PVG'), at(2027, 6, 9), 2026, catalog);
    expect(normal).toEqual({ leisure: 1, business: 1 });
  });
  it('southern airports peak in January', () => {
    expect(seasonality(10, 0.5, -33)).toBeGreaterThan(seasonality(190, 0.5, -33));
    expect(seasonality(190, 0.5, 51)).toBeGreaterThan(seasonality(10, 0.5, 51));
  });
});
