import type { Airport } from '@skyempire/shared';
import { describe, expect, it } from 'vitest';
import { baseDemand, classSplit, elasticDemand, refFare, seasonality } from './demand';
import { airport } from './testing';

const JULY = 195, JANUARY = 15;
const synthetic = (id: string, lat: number, lon: number): Airport => ({
  ...airport('LHR'), id, lat, lon, population: 5, wealth: 1, tourism: 0.3, business: 0.5,
});

describe('demand', () => {
  it('LHR–CDG mid-July is 1,500–4,000 pax/day (real ≈ 2,000)', () => {
    const d = baseDemand(airport('LHR'), airport('CDG'), JULY, 1.0);
    expect(d).toBeGreaterThanOrEqual(1500);
    expect(d).toBeLessThanOrEqual(4000);
  });
  it('domestic pairs get a boost', () => {
    const intl = baseDemand(airport('DEL'), airport('DXB'), JULY, 1);
    const dom = baseDemand(airport('DEL'), airport('BOM'), JULY, 1);
    expect(dom).toBeGreaterThan(intl);
  });
  it('summer beats winter', () =>
    expect(baseDemand(airport('LHR'), airport('CDG'), JANUARY, 1)).toBeLessThan(baseDemand(airport('LHR'), airport('CDG'), JULY, 1)));
  it('very short routes lose most demand to rail/road', () => {
    const a = synthetic('AAA', 50, 0);
    const near = synthetic('BBB', 50 + 120 / 111.2, 0); // ~120 km
    const far = synthetic('CCC', 50 + 151 / 111.2, 0); // ~151 km
    expect(baseDemand(a, near, JULY, 1)).toBeLessThanOrEqual(0.25 * baseDemand(a, far, JULY, 1) * 1.2);
  });
  it('a recession lowers demand', () =>
    expect(baseDemand(airport('LHR'), airport('CDG'), JULY, 0.8)).toBeLessThan(baseDemand(airport('LHR'), airport('CDG'), JULY, 1)));
  it('class split sums to 1', () => {
    const s = classSplit(airport('LHR'), airport('JFK'));
    expect(s.economy + s.premium + s.business).toBeCloseTo(1, 9);
    expect(s.business).toBeGreaterThan(0.05);
  });
  it('reference fare', () => {
    expect(refFare(655, 'economy')).toBe(68);
    expect(refFare(655, 'business')).toBe(Math.round(67.575 * 3.5));
    expect(refFare(5540, 'economy')).toBe(Math.round(25 + 97.5 + 0.04 * 4040));
  });
  it('cheap fares raise demand but are capped at 1.5×', () => expect(elasticDemand(1000, 50, 100, 'economy')).toBe(1500));
  it('doubling the fare cuts economy demand by 2^-1.2', () =>
    expect(elasticDemand(1000, 200, 100, 'economy')).toBeCloseTo(1000 * 2 ** -1.2, 6));
  it('seasonality stays within 0.7–1.3', () => {
    for (let d = 0; d < 360; d += 5) {
      const s = seasonality(d, 1);
      expect(s).toBeGreaterThanOrEqual(0.7);
      expect(s).toBeLessThanOrEqual(1.3);
    }
  });
});
