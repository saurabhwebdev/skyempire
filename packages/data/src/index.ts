import type { AircraftType, AirlineData, AirspaceRegion, Airport, Catalog, HolidayData } from '@skyempire/shared';
import aircraft from './aircraft.json';
import airlines from './airlines.world.json';
import airports from './airports.world.json';
import basemap from './basemap/countries-50m.json';
import airspace from './airspace.json';
import holidays from './holidays.json';
import reserved from './reserved.json';
import routes from './routes.world.json';

export * from './heuristics';
export * from './schema';

let cached: Catalog | null = null;

export function loadCatalog(regionId: 'world' = 'world'): Catalog {
  if (cached) return cached;
  cached = {
    regionId,
    airports: Object.fromEntries((airports as Airport[]).map((a) => [a.id, a])),
    aircraftTypes: Object.fromEntries((aircraft as unknown as AircraftType[]).map((a) => [a.id, a])),
    airlines: airlines as AirlineData[],
    realRoutes: routes,
    holidays: holidays as HolidayData,
  };
  return cached;
}

export interface BasemapCollection {
  type: 'FeatureCollection';
  features: { type: 'Feature'; properties: { name: string; iso: string }; geometry: { type: string; coordinates: unknown } }[];
}

export function loadBasemap(): BasemapCollection {
  return basemap as unknown as BasemapCollection;
}

const reservedNames = new Set(reserved.names);
const reservedCodes = new Set(reserved.codes);

/** True when the name or code belongs to a real airline. */
export function isReservedAirline(name: string, code: string): boolean {
  return reservedNames.has(name.trim().toLowerCase()) || reservedCodes.has(code.trim().toUpperCase());
}

/** Generic airspace regions used by tension events (closures and detours). */
export function loadAirspace(): AirspaceRegion[] {
  return airspace as AirspaceRegion[];
}
