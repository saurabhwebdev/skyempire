import type { Airport, CargoTonnes, CargoType, Catalog } from '@skyempire/shared';
import { CARGO_TYPES } from '@skyempire/shared';
import { distanceKm } from './geo';

/**
 * Air cargo demand (v0.6 spec §3–4): tonnes a day between airports, split into cargo types,
 * and how shippers pick a carrier.
 */

/** Share of every flow by cargo type. */
export const CARGO_SHARE: CargoTonnes = { general: 0.55, express: 0.2, mail: 0.05, perishable: 0.08, dangerous: 0.08, special: 0.04 };
/** Rate multiplier over the general rate. */
export const CARGO_RATE_MULT: CargoTonnes = { general: 1, express: 1.6, mail: 0.8, perishable: 1.8, dangerous: 1.4, special: 2.5 };
/** Flowers, fish, fruit and vegetables: countries that fly a lot of them out. */
const PERISHABLE_ORIGINS = new Set(['KE', 'CO', 'EC', 'CL', 'NO', 'NL', 'ZA', 'IN', 'VN', 'PE', 'ET', 'TZ', 'UG', 'NZ']);
const PERISHABLE_BOOST = 4;
const FLOW_K = 0.00085;
const DIST_EXP = 0.3;
const DOMESTIC = 0.8;

/** General cargo reference rate, $/kg. */
export const cargoRefRate = (km: number) => 0.8 + 0.00028 * km;

/** Airports outside the real top cargo list handle less than this. */
const ESTIMATE_CAP_T = 300_000;

/** Annual cargo tonnes: the real figure for the big cargo airports, else an estimate from size and wealth (capped). */
export function airportCargoT(catalog: Catalog, a: Airport): number {
  return catalog.cargo?.airportT[a.id] ?? Math.min(ESTIMATE_CAP_T, 12_000 * a.population ** 0.8 * a.wealth * a.sizeClass);
}

export const exportIndex = (catalog: Catalog, country: string) => catalog.cargo?.exportIndex[country] ?? 1;

/** Day of year (0 = Jan 1) of Lunar New Year, from the holiday tables. */
function lunarNewYearDoy(catalog: Catalog, year: number): number | null {
  const iso = catalog.holidays.anchors.lunarNewYear?.[String(year)];
  if (!iso) return null;
  return Math.round((Date.parse(iso) - Date.UTC(year, 0, 1)) / 86_400_000);
}

/** Seasonal factor: the pre-Christmas peak, a quieter January, the Lunar New Year factory shutdown. Mail is flat. */
export function cargoSeason(dayOfYear: number, originCountry: string, type: CargoType, year: number, catalog: Catalog): number {
  if (type === 'mail') return 1;
  let f = 1;
  if (dayOfYear >= 273) f *= 1.25; // Oct–Dec: Black Friday, Christmas
  else if (dayOfYear < 31) f *= 0.92;
  const lny = lunarNewYearDoy(catalog, year);
  if (lny !== null && ['CN', 'HK', 'TW'].includes(originCountry) && dayOfYear >= lny && dayOfYear < lny + 14) f *= 0.8;
  return f;
}

/** Tonnes a day from A to B (all types), before rates. Flows are one-sided: exporters send more than they get back. */
export function cargoFlow(a: Airport, b: Airport, dayOfYear: number, economyIndex: number, catalog: Catalog, year: number): number {
  const km = Math.max(distanceKm(a, b), 50);
  const mass = Math.sqrt(airportCargoT(catalog, a) * airportCargoT(catalog, b));
  const trade = exportIndex(catalog, a.country) / Math.sqrt(exportIndex(catalog, b.country));
  const domestic = a.country === b.country ? DOMESTIC : 1;
  return (FLOW_K * mass * trade * domestic * cargoSeason(dayOfYear, a.country, 'general', year, catalog) * economyIndex) / km ** DIST_EXP;
}

/** A flow split by cargo type; countries known for flowers, fish and fruit send more perishables. */
export function cargoFlowsByType(total: number, originCountry: string): CargoTonnes {
  const shares = { ...CARGO_SHARE };
  if (PERISHABLE_ORIGINS.has(originCountry)) shares.perishable *= PERISHABLE_BOOST;
  const sum = CARGO_TYPES.reduce((s, t) => s + shares[t], 0);
  return Object.fromEntries(CARGO_TYPES.map((t) => [t, (total * shares[t]) / sum])) as CargoTonnes;
}

export interface CargoOffer {
  routeId: string;
  /** General rate on offer, $/kg (other types use CARGO_RATE_MULT). */
  rate: number;
  weeklyFrequency: number;
  onTime: number;
  stops: number;
  /** Tonnes available today for this cargo type. */
  capacityT: number;
}

const BETA = { rate: 4, freq: 0.6, onTime: 3, stops: 0.8 };
const BACKGROUND = { weeklyFrequency: 14, onTime: 85 };
const ELASTICITY = 0.7;
const DEMAND_CAP = 1.3;

function utility(o: Pick<CargoOffer, 'rate' | 'weeklyFrequency' | 'onTime' | 'stops'>, ref: number, type: CargoType): number {
  const freqW = type === 'express' ? 2 : 1;
  const onTimeW = type === 'express' || type === 'perishable' ? 2 : 1;
  return -BETA.rate * (o.rate / ref) + freqW * BETA.freq * Math.log(1 + o.weeklyFrequency) + onTimeW * BETA.onTime * (o.onTime / 100) - BETA.stops * o.stops;
}

/**
 * Tonnes per route for one cargo type in one direction. Shippers compare rate, frequency, punctuality and stops
 * against each other and "other carriers" (real airlines outside the game); nobody ships more than its capacity.
 */
export function allocateCargo(demandT: number, offers: CargoOffer[], ref: number, type: CargoType): Map<string, number> {
  const out = new Map<string, number>();
  const live = offers.filter((o) => o.capacityT > 0 && o.weeklyFrequency > 0);
  if (!live.length || demandT <= 0) return out;
  const capSum = live.reduce((s, o) => s + o.capacityT, 0);
  const avgRate = (live.reduce((s, o) => s + o.rate * o.capacityT, 0) + ref * capSum) / (2 * capSum);
  const demand = Math.min(demandT * DEMAND_CAP, demandT * (avgRate / ref) ** -ELASTICITY);
  const u = live.map((o) => Math.exp(utility(o, ref, type)));
  const uOthers = Math.exp(utility({ rate: ref, stops: 0, ...BACKGROUND }, ref, type));
  const total = u.reduce((a, b) => a + b, 0) + uOthers;
  live.forEach((o, i) => out.set(o.routeId, Math.min(o.capacityT, (demand * u[i]!) / total)));
  return out;
}
