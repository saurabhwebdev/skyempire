import type { Command, Route, SeasonalFare, UpcomingPeakView } from '@skyempire/shared';
import { catalog } from '../../lib/catalog';
import { routeChain } from '../../lib/routes';

/** Active routes with any airport (stops included) in the peak's countries. */
export function routesForPeak(routes: Route[], peak: UpcomingPeakView): Route[] {
  const countries = new Set(peak.countries);
  return routes.filter((r) => r.status === 'active' && routeChain(r).some((id) => countries.has(catalog.airports[id]?.country ?? '')));
}

/** The rise the AI would pick for a peak this strong. */
export const defaultPeakPct = (peak: number) => Math.round(10 + 15 * peak);

const MAX_SEASONAL = 4;

/**
 * updateRoute commands adding `pct` over the peak dates (from today if it's under way).
 * Past seasonal fares drop off; routes with an overlapping fare, or already 4, are skipped.
 */
export function peakFareCommands(routes: Route[], peak: UpcomingPeakView, pct: number, today: number): { commands: Command[]; skipped: number } {
  const fare: SeasonalFare = { startDay: Math.max(today, peak.startDay), endDay: peak.endDay, pct };
  const commands: Command[] = [];
  let skipped = 0;
  for (const r of routes) {
    const current = (r.seasonalFares ?? []).filter((f) => f.endDay >= today);
    if (current.length >= MAX_SEASONAL || current.some((f) => f.startDay <= fare.endDay && f.endDay >= fare.startDay)) {
      skipped++;
      continue;
    }
    commands.push({ type: 'updateRoute', routeId: r.id, seasonalFares: [...current, fare] });
  }
  return { commands, skipped };
}
