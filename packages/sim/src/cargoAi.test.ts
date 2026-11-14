import type { AircraftType, Catalog, GameState } from '@skyempire/shared';
import { describe, expect, it } from 'vitest';
import { newGame, pickAiAirlines } from './newGame';
import { Rng } from './rng';
import { catalog as base } from './testing';
import { tick } from './tick';

const f = (id: string, from: AircraftType, o: Partial<AircraftType>): AircraftType => ({ ...from, id, name: id, kind: 'freighter', maxSeats: 0, payloadT: 100, comfort: 0, ...o });
const catalog: Catalog = {
  ...base,
  // Real annual tonnes for the big cargo hubs (the full table lands with the cargo data).
  cargo: { airportT: { HKG: 4_900_000, MEM: 4_000_000, PVG: 3_800_000, ANC: 3_400_000, ICN: 2_900_000, SDF: 2_900_000, DOH: 2_400_000, LAX: 2_700_000, ORD: 2_000_000, FRA: 1_900_000, DXB: 2_100_000, CDG: 1_900_000, LEJ: 1_400_000, LUX: 900_000, AMS: 1_400_000, JFK: 1_400_000, LHR: 1_400_000, CVG: 1_300_000, NRT: 2_000_000 },
    exportIndex: { CN: 1.6, HK: 1.5, KR: 1.3, DE: 1.2, US: 0.85, GB: 0.9 } },
  aircraftTypes: { ...base.aircraftTypes, TF77: f('TF77', base.aircraftTypes.B77W!, { tier: 'national', special: true }), TF76: f('TF76', base.aircraftTypes.B763!, { payloadT: 52, tier: 'regional' }) },
  airlines: [
    ...base.airlines.filter((a) => a.kind !== 'cargo').map((a) => (a.iata === 'LH' ? { ...a, kind: 'combination' as const, fleetTypes: [...a.fleetTypes, 'TF77'] } : a)),
    { iata: 'ZX', icao: 'ZXX', name: 'Test Express', country: 'DE', wikidata: 'Q1', hubId: 'LEJ', personality: 'integrator', sizeRank: 200, brandColor: '#ffcc00', fleetTypes: ['TF76', 'TF77'], sources: ['test'], kind: 'cargo' },
    { iata: 'ZY', icao: 'ZYY', name: 'Test Freight', country: 'LU', wikidata: 'Q2', hubId: 'LUX', personality: 'freightCarrier', sizeRank: 201, brandColor: '#0055aa', fleetTypes: ['TF77'], sources: ['test'], kind: 'cargo' },
  ],
};

describe('cargo rivals', () => {
  it('every game includes cargo airlines among the rivals', () => {
    const picked = pickAiAirlines(catalog, 'LHR', 19, new Rng(1));
    expect(picked.filter((a) => a.kind === 'cargo').map((a) => a.iata).sort()).toEqual(['ZX', 'ZY']);
    expect(picked).toHaveLength(19);
  });
  it('cargo rivals start with freighters and open profitable cargo routes', () => {
    let s: GameState = newGame({ seed: 4, regionId: 'world', difficulty: 'normal', homeBaseId: 'FRA',
      airline: { name: 'AI Cargo Test', code: 'A9C', colors: { primary: '#123456', secondary: '#ffffff' }, logoShape: 'circle' } }, catalog);
    const zx = s.airlines.al_ZX!;
    expect(zx).toMatchObject({ kind: 'cargo', personality: 'integrator' });
    expect(Object.values(s.aircraft).filter((a) => a.ownerId === zx.id).every((a) => catalog.aircraftTypes[a.typeId]!.kind === 'freighter')).toBe(true);
    for (let i = 0; i < 60; i++) s = tick(s, [], catalog).state;
    for (const id of ['al_ZX', 'al_ZY']) {
      const routes = Object.values(s.routes).filter((r) => r.airlineId === id);
      expect(routes.length, id).toBeGreaterThanOrEqual(2);
      expect(routes.every((r) => r.kind === 'cargo'), id).toBe(true);
      expect(s.airlines[id]!.bankrupt, id).toBe(false);
      expect(routes.reduce((x, r) => x + (r.last?.cargoT ?? 0), 0), id).toBeGreaterThan(0);
    }
    // A combination carrier flies its freighter on cargo routes, its airliners on passenger routes.
    const lhFreighters = Object.values(s.aircraft).filter((a) => a.ownerId === 'al_LH' && a.typeId === 'TF77');
    for (const ac of lhFreighters) for (const r of Object.values(s.routes).filter((x) => x.assignments.some((y) => y.aircraftId === ac.id))) expect(r.kind).toBe('cargo');
  }, 60_000);
});
