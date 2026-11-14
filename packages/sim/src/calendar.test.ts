import { describe, expect, it } from 'vitest';
import { dateOf, formatDate, isMonthStart } from './calendar';

describe('calendar (real Gregorian, day 0 = Jan 1 of the start year)', () => {
  it('day 0 is Jan 1', () =>
    expect(dateOf(0, 2026)).toEqual({ year: 2026, month: 1, dayOfMonth: 1, dayOfYear: 0, iso: '2026-01-01' }));
  it('day 59 of 2027 is Mar 1 (non-leap)', () => expect(dateOf(59, 2027)).toMatchObject({ month: 3, dayOfMonth: 1 }));
  it('day 59 of 2028 is Feb 29 (leap)', () => expect(dateOf(59, 2028)).toMatchObject({ month: 2, dayOfMonth: 29 }));
  it('day 365 of 2026 is Jan 1 2027', () => expect(dateOf(365, 2026)).toMatchObject({ year: 2027, dayOfYear: 0 }));
  it('formats dates', () => expect(formatDate(63, 2027)).toBe('Mar 5, 2027'));
  it('detects real month starts', () => {
    expect(isMonthStart(31, 2026)).toBe(true); // Feb 1
    expect(isMonthStart(30, 2026)).toBe(false);
    expect(isMonthStart(59, 2026)).toBe(true); // Mar 1
  });
});
