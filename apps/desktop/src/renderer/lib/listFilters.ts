import { routeChain } from '@skyempire/sim';
import type { Aircraft, AircraftClass, AircraftType, Notification, Route, SaveInfo, TierId, UsedListing } from '@skyempire/shared';
import { tierAllows } from '@skyempire/sim';
import { catalog } from './catalog';

/** Search, filter and sort rules for every list in the game (pure, so they are easy to test). */

const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** True when every word of the query appears somewhere in the fields (case- and accent-insensitive). */
export function textMatch(query: string, ...fields: (string | undefined)[]): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = fold(fields.filter(Boolean).join(' '));
  return words.every((w) => hay.includes(w));
}

// ── Aircraft market ──────────────────────────────────────────────────────────
export interface AircraftFilter {
  query: string;
  aircraftClass: AircraftClass | 'all';
  manufacturer: string | 'all';
  /** Only types this airline can lease or buy new today. */
  availableOnly: boolean;
  tier: TierId;
  minRange: number;
  minSeats: number;
}

export function filterAircraftTypes(types: AircraftType[], f: AircraftFilter): AircraftType[] {
  return types.filter((t) =>
    textMatch(f.query, t.name, t.manufacturer, t.id)
    && (f.aircraftClass === 'all' || t.class === f.aircraftClass)
    && (f.manufacturer === 'all' || t.manufacturer === f.manufacturer)
    && (!f.availableOnly || (tierAllows(f.tier, t.tier) && !t.usedOnly))
    && t.rangeKm >= f.minRange && t.maxSeats >= f.minSeats);
}

export type AircraftSort = 'price' | 'lease' | 'seats' | 'range' | 'fuel' | 'name';
export const AIRCRAFT_SORTS: { id: AircraftSort; label: string }[] = [
  { id: 'price', label: 'Price: low to high' }, { id: 'lease', label: 'Lease: low to high' }, { id: 'seats', label: 'Seats: most first' },
  { id: 'range', label: 'Range: longest first' }, { id: 'fuel', label: 'Fuel per seat: lowest first' }, { id: 'name', label: 'Name: A–Z' },
];
const aircraftKey: Record<AircraftSort, (t: AircraftType) => number | string> = {
  price: (t) => t.priceUsd, lease: (t) => t.leasePerMonth, seats: (t) => -t.maxSeats, range: (t) => -t.rangeKm,
  fuel: (t) => t.fuelKgPerH / t.maxSeats, name: (t) => t.name,
};
const by = <T,>(key: (x: T) => number | string) => (a: T, b: T) => {
  const x = key(a), y = key(b);
  return x < y ? -1 : x > y ? 1 : 0;
};
export const sortAircraftTypes = (types: AircraftType[], s: AircraftSort) => [...types].sort(by(aircraftKey[s]));

export type ListingSort = 'price' | 'age' | 'condition' | 'seats' | 'range' | 'name';
export const LISTING_SORTS: { id: ListingSort; label: string }[] = [
  { id: 'price', label: 'Price: low to high' }, { id: 'age', label: 'Age: youngest first' }, { id: 'condition', label: 'Condition: best first' },
  { id: 'seats', label: 'Seats: most first' }, { id: 'range', label: 'Range: longest first' }, { id: 'name', label: 'Name: A–Z' },
];
const typeOf = (l: UsedListing) => catalog.aircraftTypes[l.typeId]!;
const listingKey: Record<ListingSort, (l: UsedListing) => number | string> = {
  price: (l) => l.price, age: (l) => l.ageDays, condition: (l) => -l.condition, seats: (l) => -typeOf(l).maxSeats,
  range: (l) => -typeOf(l).rangeKm, name: (l) => typeOf(l).name,
};
export const sortListings = (xs: UsedListing[], s: ListingSort) => [...xs].sort(by(listingKey[s]));

// ── Fleet ────────────────────────────────────────────────────────────────────
export type FleetStatus = 'flying' | 'idle' | 'maintenance' | 'refit';
export function fleetStatus(ac: Aircraft, hoursUsed: number): FleetStatus {
  if (ac.refitDaysLeft > 0) return 'refit';
  if (ac.status === 'maintenance') return 'maintenance';
  return hoursUsed > 0 ? 'flying' : 'idle';
}
export interface FleetFilter { query: string; status: FleetStatus | 'all'; ownership: 'owned' | 'leased' | 'all' }
export function filterFleet(fleet: Aircraft[], f: FleetFilter, used: Map<string, number>): Aircraft[] {
  return fleet.filter((a) => {
    const t = catalog.aircraftTypes[a.typeId];
    return textMatch(f.query, t?.name, t?.manufacturer, a.typeId, a.id)
      && (f.status === 'all' || fleetStatus(a, used.get(a.id) ?? 0) === f.status)
      && (f.ownership === 'all' || a.ownership === f.ownership);
  });
}

// ── Routes ───────────────────────────────────────────────────────────────────
export type RouteHealth = 'profitable' | 'losing' | 'suspended' | 'grounded' | 'new';
/** `aircraft`: the player's fleet by id; a route whose aircraft are all in a refit or check is grounded too. */
export function routeHealth(r: Route, status?: { blocked: string | null }, aircraft?: Map<string, Aircraft>): RouteHealth {
  if (r.status === 'suspended') return 'suspended';
  if (status?.blocked) return 'grounded';
  if (aircraft && r.assignments.length && r.assignments.every((x) => {
    const ac = aircraft.get(x.aircraftId);
    return ac && (ac.refitDaysLeft > 0 || ac.status === 'maintenance');
  })) return 'grounded';
  if (!r.last) return 'new';
  return r.last.profit >= 0 ? 'profitable' : 'losing';
}
export interface RouteFilter { query: string; health: RouteHealth | 'all' }
export function filterRoutes(routes: Route[], f: RouteFilter, status: Record<string, { blocked: string | null }>, aircraft?: Map<string, Aircraft>): Route[] {
  return routes.filter((r) => {
    const airports = routeChain(r).map((id) => catalog.airports[id]);
    return textMatch(f.query, ...routeChain(r), ...airports.flatMap((a) => [a?.city, a?.name]))
      && (f.health === 'all' || routeHealth(r, status[r.id], aircraft) === f.health);
  });
}

// ── News, rivals, saves ──────────────────────────────────────────────────────
export const filterNews = (notes: Notification[], query: string) => notes.filter((n) => textMatch(query, n.title, n.body));

export const filterSaves = (saves: SaveInfo[], query: string) => saves.filter((s) => textMatch(query, s.name, s.airlineName));
export type SaveSort = 'recent' | 'name' | 'progress';
const saveKey: Record<SaveSort, (s: SaveInfo) => number | string> = { recent: (s) => -s.updatedAt, name: (s) => s.airlineName || s.name, progress: (s) => -s.day };
export const sortSaves = (saves: SaveInfo[], s: SaveSort) => [...saves].sort(by(saveKey[s]));
