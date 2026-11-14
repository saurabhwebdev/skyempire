import type { AircraftType, AirlineData, AirspaceRegion, Airport, Catalog, HolidayData } from '@skyempire/shared';
import aircraft from './aircraft.json';
import aircraftDetails from './aircraft-details.json';
import aircraftPhotos from './aircraft-photos.json';
import airlines from './airlines.world.json';
import airports from './airports.world.json';
import basemap from './basemap/countries-50m.json';
import airspace from './airspace.json';
import holidays from './holidays.json';
import reserved from './reserved.json';
import routes from './routes.world.json';
import cargo from './cargo.json';

export * from './heuristics';
export * from './schema';
import type { AircraftDetails, AircraftPhoto } from './schema';

/** Real-world specs per aircraft type id (Wikipedia). */
export const AIRCRAFT_DETAILS = aircraftDetails as Record<string, AircraftDetails>;
/** Photo credit per aircraft type id; the image itself is src/photos/<file>. */
export const AIRCRAFT_PHOTOS = aircraftPhotos as Record<string, AircraftPhoto>;

let cached: Catalog | null = null;

export function loadCatalog(regionId: 'world' = 'world'): Catalog {
  if (cached) return cached;
  cached = {
    regionId,
    airports: Object.fromEntries((airports as Airport[]).map((a) => [a.id, a])),
    // Seats-across comes from the real-world details file.
    aircraftTypes: Object.fromEntries((aircraft as unknown as AircraftType[]).map((a) => {
      const d = (aircraftDetails as Record<string, { abreast: number; denseAbreast?: number }>)[a.id];
      return [a.id, d ? { ...a, abreast: d.abreast, ...(d.denseAbreast ? { denseAbreast: d.denseAbreast } : {}) } : a];
    })),
    airlines: airlines as AirlineData[],
    realRoutes: routes,
    holidays: holidays as HolidayData,
    airspace: airspace as AirspaceRegion[],
    cargo: { airportT: cargo.airportT as Record<string, number>, exportIndex: cargo.exportIndex as Record<string, number> },
    countryNames: Object.fromEntries((basemap as { features: { properties: { iso: string; name: string } }[] }).features.filter((f) => f.properties.iso !== '-99').map((f) => [f.properties.iso, f.properties.name])),
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
