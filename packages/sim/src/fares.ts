import type { CabinClass, Route } from '@skyempire/shared';

/** Fare actually charged on `day`, after any seasonal change. */
export function effectiveFare(route: Route, cls: CabinClass, day: number): number {
  const sf = route.seasonalFares?.find((f) => day >= f.startDay && day <= f.endDay);
  return sf ? Math.round(route.fares[cls] * (1 + sf.pct / 100)) : route.fares[cls];
}
