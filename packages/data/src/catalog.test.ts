import { describe, expect, it } from 'vitest';
import { AirportSchema } from './schema';
import { isReservedAirline, loadBasemap, loadCatalog } from './index';

describe('loadCatalog', () => {
  const cat = loadCatalog('world');
  const ids = Object.keys(cat.airports);
  it('has ~1,000 airports', () => {
    expect(ids.length).toBeGreaterThanOrEqual(950);
    expect(ids.length).toBeLessThanOrEqual(1050);
  });
  it('contains major airports on every continent', () => {
    for (const id of ['LHR', 'JFK', 'DXB', 'DEL', 'NRT', 'SYD', 'GRU', 'JNB']) expect(cat.airports[id]).toBeDefined();
  });
  it('every airport passes the schema and has a 1,200 m+ runway', () => {
    for (const a of Object.values(cat.airports)) {
      AirportSchema.parse(a);
      expect(a.runwayM).toBeGreaterThanOrEqual(1200);
    }
  });
  it('includes aircraft, airlines and real routes', () => {
    expect(Object.keys(cat.aircraftTypes)).toHaveLength(38);
    expect(cat.airlines.length).toBeGreaterThan(140);
    expect(cat.realRoutes.length).toBeGreaterThan(1000);
  });
  it('every airline hub is present', () => cat.airlines.forEach((a) => expect(cat.airports[a.hubId]).toBeDefined()));
  it('loads the basemap', () => expect(loadBasemap().features.length).toBeGreaterThan(200));
  it('flags real airline names and codes', () => {
    expect(isReservedAirline('Lufthansa', 'XQ')).toBe(true);
    expect(isReservedAirline('My New Air', 'LH')).toBe(true);
    expect(isReservedAirline('Skyward Test Air', '9Q9')).toBe(false);
  });
});
