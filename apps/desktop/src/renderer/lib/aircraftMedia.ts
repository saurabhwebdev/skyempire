import { AIRCRAFT_DETAILS, AIRCRAFT_PHOTOS, type AircraftDetails, type AircraftPhoto } from '@skyempire/data';
import type { AircraftType, Cabin } from '@skyempire/shared';

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

const GROUPS: Record<number, number[]> = { 3: [1, 2], 4: [2, 2], 5: [2, 3], 6: [3, 3], 7: [2, 3, 2], 8: [2, 4, 2], 9: [3, 3, 3], 10: [3, 4, 3] };

/** Typical seats-per-row for each cabin, from the economy layout (narrowbody business 2-2, widebody suites 1-2-1). */
export function rowShape(abreast: number): RowShape {
  const economy = GROUPS[abreast] ?? [Math.ceil(abreast / 2), Math.floor(abreast / 2)];
  if (abreast <= 4) return { economy, premium: economy, business: abreast === 3 ? [1, 1] : [1, 2] };
  if (abreast <= 6) return { economy, premium: abreast === 5 ? [2, 2] : economy, business: [2, 2] };
  if (abreast === 7) return { economy, premium: [2, 2, 2], business: [1, 2, 1] };
  return { economy, premium: abreast >= 9 ? GROUPS[8]! : GROUPS[7]!, business: [1, 2, 1] };
}

export interface CabinPreset { id: 'economy' | 'two' | 'three'; label: string; cabin: Cabin }

/**
 * Typical layouts that fit the aircraft's seat units (business 2.5, premium 1.5).
 * Business is rounded to full rows. Turboprops are all-economy in real service.
 */
export function cabinPresets(t: AircraftType, abreast: number): CabinPreset[] {
  const units = t.maxSeats;
  const shape = rowShape(abreast);
  const perRow = (g: number[]) => g.reduce((a, b) => a + b, 0);
  const fill = (businessShare: number, premiumShare: number): Cabin => {
    const jRow = perRow(shape.business), wRow = perRow(shape.premium);
    const business = Math.max(jRow, Math.round((units * businessShare) / 2.5 / jRow) * jRow);
    const premium = premiumShare ? Math.max(wRow, Math.round((units * premiumShare) / 1.5 / wRow) * wRow) : 0;
    return { business, premium, economy: Math.max(0, Math.floor(units - business * 2.5 - premium * 1.5)) };
  };
  const out: CabinPreset[] = [{ id: 'economy', label: 'All economy', cabin: { business: 0, premium: 0, economy: units } }];
  if (t.class === 'turboprop') return out;
  const wide = t.class === 'widebody';
  out.push({ id: 'two', label: 'Two class', cabin: fill(wide ? 0.22 : t.class === 'regional' ? 0.1 : 0.1, 0) });
  if (wide || t.class === 'longNarrowbody') out.push({ id: 'three', label: 'Three class', cabin: fill(wide ? 0.2 : 0.12, wide ? 0.12 : 0.1) });
  return out;
}
