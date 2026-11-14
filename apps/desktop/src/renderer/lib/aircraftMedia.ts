import { AIRCRAFT_DETAILS, AIRCRAFT_PHOTOS, type AircraftDetails, type AircraftPhoto } from '@skyempire/data';
import type { AircraftType, CabinConfig, CabinProduct } from '@skyempire/shared';
import { standardProduct, unitsPerSeat } from '@skyempire/sim';

// Real photos from Wikimedia Commons (packages/data/scripts/build-aircraft-photos.ts), bundled for offline play.
const files = import.meta.glob('../../../../../packages/data/src/photos/*.webp', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const urls = new Map(Object.entries(files).map(([path, url]) => [path.split('/').pop()!, url]));

export function photoOf(typeId: string): (AircraftPhoto & { url: string }) | null {
  const p = AIRCRAFT_PHOTOS[typeId];
  const url = p && urls.get(p.file);
  return p && url ? { ...p, url } : null;
}

export function detailsOf(typeId: string): AircraftDetails | null {
  return AIRCRAFT_DETAILS[typeId] ?? null;
}

/** Seats per row in each cabin, with aisles: e.g. [3, 3] is 3-aisle-3. */
export interface RowShape { business: number[]; premium: number[]; economy: number[] }

const GROUPS: Record<number, number[]> = { 3: [1, 2], 4: [2, 2], 5: [2, 3], 6: [3, 3], 7: [2, 3, 2], 8: [2, 4, 2], 9: [3, 3, 3], 10: [3, 4, 3], 11: [3, 5, 3] };
const groups = (n: number) => GROUPS[n] ?? [Math.ceil(n / 2), Math.floor(n / 2)];

/**
 * Typical seats-per-row for each cabin. Business follows the seat: recliners sit 2-2 / 2-3-2,
 * lie-flat seats 1-2-1 on widebodies, and suites 1-1 on narrowbodies.
 */
export function rowShape(abreast: number, product: CabinProduct = standardProduct(), economyAbreast = abreast): RowShape {
  const economy = groups(economyAbreast);
  const premium = abreast <= 4 ? groups(abreast) : abreast <= 6 ? (abreast === 5 ? [2, 2] : groups(abreast)) : abreast === 7 ? [2, 2, 2] : abreast >= 9 ? GROUPS[8]! : GROUPS[7]!;
  const seat = product.business.seat;
  let business: number[];
  if (abreast <= 4) business = seat === 'recliner' ? (abreast === 3 ? [1, 1] : [1, 2]) : [1, 1];
  else if (abreast <= 6) business = seat === 'suite' ? [1, 1] : [2, 2];
  else business = seat === 'recliner' ? (abreast === 7 ? [2, 2, 2] : [2, 3, 2]) : [1, 2, 1];
  return { economy, premium, business };
}

/** Economy seats across, with the denser row when the cabin uses it. */
export const economyAbreast = (t: AircraftType, dense: boolean) => (dense && t.denseAbreast ? t.denseAbreast : t.abreast ?? 6);

export interface CabinPreset { id: 'economy' | 'two' | 'three'; label: string; config: CabinConfig }

/**
 * Typical layouts on the standard fit that fit the aircraft. Business is rounded to full rows.
 * Turboprops are all-economy in real service.
 */
export function cabinPresets(t: AircraftType): CabinPreset[] {
  const units = t.maxSeats;
  const product = standardProduct();
  const shape = rowShape(t.abreast ?? 6, product);
  const perRow = (g: number[]) => g.reduce((a, b) => a + b, 0);
  const u = (c: 'business' | 'premium') => unitsPerSeat({ product, dense: false }, c, t);
  const fill = (businessShare: number, premiumShare: number): CabinConfig => {
    const jRow = perRow(shape.business), wRow = perRow(shape.premium);
    const business = Math.max(jRow, Math.round((units * businessShare) / u('business') / jRow) * jRow);
    const premium = premiumShare ? Math.max(wRow, Math.round((units * premiumShare) / u('premium') / wRow) * wRow) : 0;
    return { seats: { business, premium, economy: Math.max(0, Math.floor(units - business * u('business') - premium * u('premium'))) }, product: standardProduct(), dense: false };
  };
  const out: CabinPreset[] = [{ id: 'economy', label: 'All economy', config: { seats: { business: 0, premium: 0, economy: units }, product: standardProduct(), dense: false } }];
  if (t.class === 'turboprop') return out;
  const wide = t.class === 'widebody';
  out.push({ id: 'two', label: 'Two class', config: fill(wide ? 0.22 : 0.1, 0) });
  if (wide || t.class === 'longNarrowbody') out.push({ id: 'three', label: 'Three class', config: fill(wide ? 0.2 : 0.12, wide ? 0.12 : 0.1) });
  return out;
}
