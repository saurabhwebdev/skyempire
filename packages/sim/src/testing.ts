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
