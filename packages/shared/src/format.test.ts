import { describe, expect, it } from 'vitest';
import { formatMoney, formatPax, formatPct } from './format';

describe('formatMoney', () => {
  it('formats millions', () => expect(formatMoney(48_200_000)).toBe('$48.2M'));
  it('formats thousands', () => expect(formatMoney(312_400)).toBe('$312k'));
  it('formats small values', () => expect(formatMoney(950)).toBe('$950'));
  it('formats negatives with a minus sign', () => expect(formatMoney(-1_200_000)).toBe('−$1.2M'));
  it('formats billions', () => expect(formatMoney(2_500_000_000)).toBe('$2.5B'));
});
describe('formatPct / formatPax', () => {
  it('rounds percentages', () => expect(formatPct(0.861)).toBe('86%'));
  it('groups thousands', () => expect(formatPax(2400)).toBe('2,400'));
});
