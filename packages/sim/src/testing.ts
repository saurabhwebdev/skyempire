import { loadCatalog } from '@skyempire/data';
import type { AircraftType, Airport, Catalog } from '@skyempire/shared';

/** Test helpers (not exported from the package index). */
export const catalog: Catalog = loadCatalog('world');
export const airport = (id: string): Airport => {
  const a = catalog.airports[id];
  if (!a) throw new Error(`no airport ${id}`);
  return a;
};
export const type = (id: string): AircraftType => {
  const t = catalog.aircraftTypes[id];
  if (!t) throw new Error(`no aircraft type ${id}`);
  return t;
};

import type { Command, GameState } from '@skyempire/shared';
import { newGame } from './newGame';

export function playerGame(hub = 'FRA', aiCount = 3): GameState {
  return newGame(
    {
      seed: 11,
      regionId: 'world',
      difficulty: 'normal',
      airline: { name: 'Skyward Test Air', code: 'S9X', colors: { primary: '#3366ff', secondary: '#ffffff' }, logoShape: 'wing' },
      homeBaseId: hub,
      aiCount,
    },
    catalog,
  );
}

export const fares = { economy: 120, premium: 220, business: 420 };
export const allEconomy = (typeId: string) => ({ economy: type(typeId).maxSeats, premium: 0, business: 0 });
export const lease = (typeId: string): Command => ({ type: 'leaseAircraft', typeId, cabin: allEconomy(typeId) });
export const playerAircraft = (s: GameState) => Object.values(s.aircraft).filter((a) => a.ownerId === s.playerId);
