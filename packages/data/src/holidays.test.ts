import { describe, expect, it } from 'vitest';
import holidays from './holidays.json';

const days = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86_400_000;

/** Meeus mean new moon (JDE) near a date, converted to days since 1970. */
function nearestNewMoon(iso: string): number {
  const d = days(iso);
  const year = 1970 + d / 365.25;
  const k = Math.round((year - 2000) * 12.3685);
  const T = k / 1236.85;
  const jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T * T;
  return jde - 2440587.5;
}

describe('holiday tables', () => {
  it('cover 2026–2045', () => expect(holidays.years).toEqual(Array.from({ length: 20 }, (_, i) => 2026 + i)));
  it('Lunar New Year dates are each within 1 day of a new moon', () => {
    for (const iso of Object.values(holidays.anchors.lunarNewYear)) expect(Math.abs(days(iso) - nearestNewMoon(iso))).toBeLessThanOrEqual(1.2);
  });
  it('Diwali 2027 falls on Oct 28 ±1', () => expect(Math.abs(days(holidays.anchors.diwali['2027']!) - days('2027-10-28'))).toBeLessThanOrEqual(1));
  it('Eid al-Fitr 2027 falls on Mar 9 ±1', () => expect(Math.abs(days(holidays.anchors.eidFitr['2027']!) - days('2027-03-09'))).toBeLessThanOrEqual(1));
  it('Easter 2027 is Mar 28 and Thanksgiving 2027 is Nov 25', () => {
    expect(holidays.anchors.easter['2027']).toBe('2027-03-28');
    expect(holidays.anchors.thanksgiving['2027']).toBe('2027-11-25');
  });
  it('every anchor has all 20 years', () => {
    for (const a of Object.values(holidays.anchors)) expect(Object.keys(a)).toHaveLength(20);
  });
  it('has public holidays for GB and US (Christmas = day-of-year 358 in 2027)', () => {
    expect(holidays.public.GB!['2027']).toContain(358);
    expect(holidays.public.US!['2027']!.length).toBeGreaterThan(5);
  });
});
