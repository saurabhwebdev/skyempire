import { describe, expect, it } from 'vitest';
import { dateOf, formatDate, isMonthStart } from './calendar';

describe('calendar', () => {
  it('day 0 is 1 Jan Y1', () => expect(dateOf(0)).toEqual({ year: 1, month: 1, dayOfMonth: 1, dayOfYear: 0 }));
  it('day 46 is Feb 17', () => expect(dateOf(46)).toMatchObject({ month: 2, dayOfMonth: 17 }));
  it('day 360 is year 2', () => expect(dateOf(360).year).toBe(2));
  it('formats dates', () => expect(formatDate(76)).toBe('Mar 17 Y1'));
  it('detects month start', () => { expect(isMonthStart(30)).toBe(true); expect(isMonthStart(31)).toBe(false); });
});
