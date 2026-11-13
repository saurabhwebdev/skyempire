import { loadCatalog } from '@skyempire/data';

export const catalog = loadCatalog('world');
export const airportName = (id: string) => catalog.airports[id]?.city ?? id;
