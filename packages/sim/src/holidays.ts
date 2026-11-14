import type { Airport, Catalog } from '@skyempire/shared';
import { dateOf } from './calendar';
import { FESTIVALS } from './config/festivals';

const MS_PER_DAY = 86_400_000;
const FIRST_YEAR = 2026;
const YEARS = 20;
const RAMP_DAYS = 3;

/** Holiday tables cover 2026–2045; other years reuse the matching year of that 20-year cycle. */
const wrapYear = (y: number) => FIRST_YEAR + ((((y - FIRST_YEAR) % YEARS) + YEARS) % YEARS);
const absDay = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d) / MS_PER_DAY;
const isoDay = (iso: string) => absDay(+iso.slice(0, 4), +iso.slice(5, 7), +iso.slice(8, 10));

const cache = new Map<string, number>();

/**
 * Travel-demand lift from public holidays and festivals for a country on a game day (v0.2 design §4).
 * The strongest positive lift wins; a negative lift (Ramadan) applies only when nothing positive does.
 * Range −0.15…1.0 (a 0.8 festival's last two days carry the ×1.25 return spike). Unknown country → 0.
 */
export function holidayLift(country: string, day: number, startYear: number, catalog: Catalog): number {
  const key = `${startYear}:${day}:${country}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  if (cache.size > 20_000) cache.clear();

  const date = dateOf(day, startYear);
  const wy = wrapYear(date.year);
  const today = absDay(wy, date.month, date.dayOfMonth);
  let pos = 0, neg = 0;

  const publicDays = catalog.holidays.public[country]?.[wy];
  if (publicDays) {
    const doy = today - absDay(wy, 1, 1);
    if (publicDays.includes(doy)) pos = 0.1;
    else if (publicDays.includes(doy - 1) || publicDays.includes(doy + 1)) pos = 0.05;
  }

  for (const f of FESTIVALS) {
    if (!f.countries.includes(country)) continue;
    for (const y of [wy - 1, wy, wy + 1]) {
      let anchor: number;
      if (typeof f.anchor === 'string') {
        const iso = catalog.holidays.anchors[f.anchor]?.[y];
        if (!iso) continue;
        anchor = isoDay(iso);
      } else anchor = absDay(y, f.anchor.month, f.anchor.day);
      const o = today - anchor;
      const start = -f.before, end = f.after;
      let v = 0;
      if (o >= start && o <= end) v = f.peak > 0 && end - start >= 3 && o >= end - 1 ? f.peak * 1.25 : f.peak;
      else if (f.peak > 0) {
        const dist = o < start ? start - o : o - end;
        if (dist < RAMP_DAYS) v = f.peak * (1 - dist / RAMP_DAYS);
      }
      if (v > pos) pos = v;
      else if (v < neg) neg = v;
    }
  }
  const lift = pos > 0 ? pos : neg;
  cache.set(key, lift);
  return lift;
}

/** Demand multipliers for one direction of a pair: leisure (economy, premium) and business. */
export function holidayDemandFactors(a: Airport, b: Airport, day: number, startYear: number, catalog: Catalog): { leisure: number; business: number } {
  const la = holidayLift(a.country, day, startYear, catalog);
  const lb = holidayLift(b.country, day, startYear, catalog);
  const lift = la > 0 || lb > 0 ? Math.max(la, lb) : Math.min(la, lb);
  if (lift === 0) return { leisure: 1, business: 1 };
  const tourism = (a.tourism + b.tourism) / 2;
  return { leisure: 1 + lift * (0.6 + 0.4 * tourism), business: 1 - 0.5 * Math.max(0, lift) };
}

export interface UpcomingPeak {
  name: string;
  countries: string[];
  startDay: number;
  endDay: number;
  peak: number;
}

/** Festivals (positive peaks only) touching `countries` whose window overlaps [fromDay, toDay], soonest first. */
export function upcomingPeaks(countries: string[], fromDay: number, toDay: number, startYear: number, catalog: Catalog): UpcomingPeak[] {
  const from = dateOf(fromDay, startYear);
  const wy = wrapYear(from.year);
  const fromAbs = absDay(wy, from.month, from.dayOfMonth);
  const out: UpcomingPeak[] = [];
  for (const f of FESTIVALS) {
    if (f.peak <= 0) continue;
    const hit = countries.filter((c) => f.countries.includes(c));
    if (hit.length === 0) continue;
    for (const y of [wy - 1, wy, wy + 1]) {
      let anchor: number;
      if (typeof f.anchor === 'string') {
        const iso = catalog.holidays.anchors[f.anchor]?.[y];
        if (!iso) continue;
        anchor = isoDay(iso);
      } else anchor = absDay(y, f.anchor.month, f.anchor.day);
      const anchorDay = fromDay + (anchor - fromAbs);
      const startDay = anchorDay - f.before, endDay = anchorDay + f.after;
      if (endDay < fromDay || startDay > toDay) continue;
      out.push({ name: f.name, countries: hit, startDay, endDay, peak: f.peak });
    }
  }
  return out.sort((a, b) => a.startDay - b.startDay);
}
