import { describe, expect, it } from 'vitest';
import { parseCommand } from './commands';

const fares = { economy: 100, premium: 180, business: 350 };

describe('parseCommand', () => {
  it('accepts a valid loan', () => {
    expect(parseCommand({ type: 'takeLoan', amount: 1_000_000 })).toEqual({ type: 'takeLoan', amount: 1_000_000 });
  });
  it('rejects a negative loan', () => {
    expect(() => parseCommand({ type: 'takeLoan', amount: -5 })).toThrow();
  });
  it('rejects a route from an airport to itself', () => {
    expect(() =>
      parseCommand({ type: 'openRoute', from: 'LHR', to: 'LHR', fares, assignments: [{ aircraftId: 'a1', roundTripsPerWeek: 7 }] }),
    ).toThrow();
  });
  it('accepts a valid route', () => {
    const cmd = parseCommand({ type: 'openRoute', from: 'LHR', to: 'CDG', fares, assignments: [{ aircraftId: 'a1', roundTripsPerWeek: 7 }] });
    expect(cmd.type).toBe('openRoute');
  });
  it('rejects negative cabin seats', () => {
    expect(() =>
      parseCommand({ type: 'leaseAircraft', typeId: 'A20N', cabin: { economy: -1, premium: 0, business: 0 } }),
    ).toThrow();
  });
  it('rejects unknown command types', () => {
    expect(() => parseCommand({ type: 'nope' })).toThrow();
  });
});
