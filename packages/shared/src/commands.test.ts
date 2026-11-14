import { describe, expect, it } from 'vitest';
import { parseCommand } from './commands';

const fares = { economy: 100, premium: 180, business: 350 };
const product = {
  economy: { seat: 'standard', ife: 'wifi', meal: 'snack', amenityKit: false, lounge: false },
  premium: { seat: 'recliner', ife: 'seatback', meal: 'hot', amenityKit: true, lounge: false },
  business: { seat: 'flat', ife: 'premium', meal: 'dining', amenityKit: true, lounge: true },
};
const config = { seats: { economy: 150, premium: 0, business: 12 }, product, dense: false };

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
      parseCommand({ type: 'leaseAircraft', typeId: 'A20N', config: { ...config, seats: { economy: -1, premium: 0, business: 0 } } }),
    ).toThrow();
  });
  it('accepts a cabin config with products', () => {
    const cmd = parseCommand({ type: 'setCabin', aircraftId: 'ac1', config });
    expect(cmd).toEqual({ type: 'setCabin', aircraftId: 'ac1', config });
  });
  it('rejects an unknown meal or seat', () => {
    const bad = { ...product, economy: { ...product.economy, meal: 'caviar' } };
    expect(() => parseCommand({ type: 'setCabin', aircraftId: 'ac1', config: { ...config, product: bad } })).toThrow();
    const badSeat = { ...product, business: { ...product.business, seat: 'bed' } };
    expect(() => parseCommand({ type: 'leaseAircraft', typeId: 'A20N', config: { ...config, product: badSeat } })).toThrow();
  });
  it('accepts saving and deleting a cabin layout', () => {
    expect(parseCommand({ type: 'saveCabinTemplate', name: 'Long haul', typeId: 'B789', config }).type).toBe('saveCabinTemplate');
    expect(() => parseCommand({ type: 'saveCabinTemplate', name: '', typeId: 'B789', config })).toThrow();
    expect(parseCommand({ type: 'deleteCabinTemplate', templateId: 'ct1' }).type).toBe('deleteCabinTemplate');
  });
  it('no longer has an airline-wide service level', () => {
    expect(() => parseCommand({ type: 'setServiceLevel', level: 3 })).toThrow();
  });
  it('rejects unknown command types', () => {
    expect(() => parseCommand({ type: 'nope' })).toThrow();
  });
});
