import type { Airport, Cabin, CabinClass, Money } from '@skyempire/shared';
import { BALANCE } from './config/balance';
import { distanceKm } from './geo';

/** Leisure seasonality: peaks mid-July in the north, mid-January in the south; stronger for touristy pairs. Range 0.7–1.3. */
export function seasonality(dayOfYear: number, tourism: number, lat = 0): number {
  const peak = lat < 0 ? 197 - 182.5 : 197;
  return 1 + (0.05 + 0.25 * tourism) * Math.cos((2 * Math.PI * (dayOfYear - peak)) / 365);
}

/** One-direction daily passenger demand A→B before price effects (gravity model, simulation-spec §3). */
export function baseDemand(a: Airport, b: Airport, dayOfYear: number, economyIndex: number): number {
  const dist = Math.max(distanceKm(a, b), 1);
  const gravity = (a.population ** BALANCE.alpha) * (b.population ** BALANCE.alpha);
  const wealth = (a.wealth * b.wealth) ** BALANCE.wealthExponent;
  const domestic = a.country === b.country ? BALANCE.domesticFactor : 1;
  const pull = 1 + 0.5 * (b.tourism + b.business);
  const t = (a.tourism + b.tourism) / 2;
  const season = (seasonality(dayOfYear, t, a.lat) + seasonality(dayOfYear, t, b.lat)) / 2;
  let f = dist ** BALANCE.distanceExponent;
  if (dist < BALANCE.shortHaulKm) f /= BALANCE.shortHaulFactor;
  return (BALANCE.demandK * gravity * wealth * domestic * pull * season * economyIndex) / f;
}

export function classSplit(a: Airport, b: Airport): Cabin {
  const business = BALANCE.businessShareBase + BALANCE.businessShareSlope * ((a.business + b.business) / 2);
  const premium = BALANCE.premiumShare;
  return { economy: 1 - business - premium, premium, business };
}

export function refFare(distKm: number, cls: CabinClass): Money {
  const short = Math.min(distKm, BALANCE.refFareTaperKm);
  const long = Math.max(0, distKm - BALANCE.refFareTaperKm);
  return Math.round(
    (BALANCE.refFareBase + BALANCE.refFarePerKm * short + BALANCE.refFarePerKmLong * long) * BALANCE.classFareMultiplier[cls],
  );
}

/** Demand after the average offered fare; capped at demandCap × base. */
export function elasticDemand(base: number, avgFare: Money, ref: Money, cls: CabinClass): number {
  if (avgFare <= 0 || ref <= 0) return base * BALANCE.demandCap;
  return Math.min(base * BALANCE.demandCap, base * (avgFare / ref) ** -BALANCE.elasticity[cls]);
}
