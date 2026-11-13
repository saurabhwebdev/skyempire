import type { Airport, Cabin, CabinClass, Money } from '@skyempire/shared';
import { BALANCE } from './config/balance';
import { distanceKm } from './geo';

/** Leisure seasonality: peaks mid-July; stronger for touristy pairs. Range 0.7–1.3. */
export function seasonality(dayOfYear: number, tourism: number): number {
  return 1 + (0.05 + 0.25 * tourism) * Math.cos((2 * Math.PI * (dayOfYear - 195)) / 360);
}

/** One-direction daily passenger demand A→B before price effects (gravity model, simulation-spec §3). */
export function baseDemand(a: Airport, b: Airport, dayOfYear: number, economyIndex: number): number {
  const dist = Math.max(distanceKm(a, b), 1);
  const gravity = (a.population ** BALANCE.alpha) * (b.population ** BALANCE.alpha);
  const wealth = Math.sqrt(a.wealth * b.wealth);
  const pull = 1 + 0.5 * (b.tourism + b.business);
  const season = seasonality(dayOfYear, (a.tourism + b.tourism) / 2);
  let f = dist ** BALANCE.distanceExponent;
  if (dist < BALANCE.shortHaulKm) f /= BALANCE.shortHaulFactor;
  return (BALANCE.demandK * gravity * wealth * pull * season * economyIndex) / f;
}

export function classSplit(a: Airport, b: Airport): Cabin {
  const business = BALANCE.businessShareBase + BALANCE.businessShareSlope * ((a.business + b.business) / 2);
  const premium = BALANCE.premiumShare;
  return { economy: 1 - business - premium, premium, business };
}

export function refFare(distKm: number, cls: CabinClass): Money {
  return Math.round((BALANCE.refFareBase + BALANCE.refFarePerKm * distKm) * BALANCE.classFareMultiplier[cls]);
}

/** Demand after the average offered fare; capped at demandCap × base. */
export function elasticDemand(base: number, avgFare: Money, ref: Money, cls: CabinClass): number {
  if (avgFare <= 0 || ref <= 0) return base * BALANCE.demandCap;
  return Math.min(base * BALANCE.demandCap, base * (avgFare / ref) ** -BALANCE.elasticity[cls]);
}
