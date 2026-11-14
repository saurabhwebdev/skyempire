import { describe, expect, it } from 'vitest';
import aircraft from './aircraft.json';
import airlines from './airlines.world.json';
import airports from './airports.world.json';
import { AirlineDataSchema } from './schema';

const list = airlines.map((a) => AirlineDataSchema.parse(a));
const typeIds = new Set(aircraft.map((a) => a.id));
const airportIds = new Set(airports.map((a) => a.id));
const continentOf: Record<string, string> = {
  US: 'NA', CA: 'NA', MX: 'NA', PA: 'NA', BR: 'SA', CL: 'SA', CO: 'SA', AR: 'SA', DE: 'EU', FR: 'EU', GB: 'EU',
  IN: 'AS', CN: 'AS', JP: 'AS', AE: 'AS', ZA: 'AF', ET: 'AF', KE: 'AF', EG: 'AF', AU: 'OC', NZ: 'OC', FJ: 'OC',
};

describe('airline database', () => {
  it('has 140–160 airlines', () => {
    expect(list.length).toBeGreaterThanOrEqual(140);
    expect(list.length).toBeLessThanOrEqual(160);
  });
  it('has unique IATA codes', () => expect(new Set(list.map((a) => a.iata)).size).toBe(list.length));
  it('covers every inhabited continent', () => {
    const c = new Set(list.map((a) => continentOf[a.country]).filter(Boolean));
    expect([...c].sort()).toEqual(['AF', 'AS', 'EU', 'NA', 'OC', 'SA']);
  });
  it('has all 7 personalities (5 passenger, 2 cargo)', () =>
    expect(new Set(list.map((a) => a.personality)).size).toBe(7));
  it('only flies known aircraft', () =>
    list.forEach((a) => a.fleetTypes.forEach((t) => expect(typeIds.has(t), `${a.name} ${t}`).toBe(true))));
  it('has every hub in the airport catalog', () =>
    list.forEach((a) => expect(airportIds.has(a.hubId), `${a.name} ${a.hubId}`).toBe(true)));
  it('pins test airlines', () => {
    expect(list.find((a) => a.iata === 'LH')).toMatchObject({ icao: 'DLH', wikidata: 'Q9325', hubId: 'FRA', personality: 'legacy' });
    expect(list.find((a) => a.iata === 'EK')).toMatchObject({ icao: 'UAE', hubId: 'DXB', personality: 'gulf' });
    expect(list.find((a) => a.iata === '6E')).toMatchObject({ icao: 'IGO', hubId: 'DEL', personality: 'budget' });
  });
});

describe('cargo airlines (v0.6)', () => {
  it('real cargo airlines fly freighters from real hubs', async () => {
    const { default: aircraft } = await import('./aircraft.json');
    const freighter = new Set(aircraft.filter((a) => (a as { kind?: string }).kind === 'freighter').map((a) => a.id));
    const cargo = list.filter((a) => a.kind === 'cargo');
    expect(cargo.map((a) => a.iata)).toEqual(expect.arrayContaining(['FX', '5X', 'CV', 'QY']));
    for (const a of cargo) {
      expect(['integrator', 'freightCarrier'], a.iata).toContain(a.personality);
      expect(a.fleetTypes.every((t) => freighter.has(t)), a.iata).toBe(true);
    }
    for (const a of list.filter((x) => x.kind === 'combination')) expect(a.fleetTypes.some((t) => freighter.has(t)), a.iata).toBe(true);
  });
});
