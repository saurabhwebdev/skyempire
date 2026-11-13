import { BALANCE } from './config/balance';

const clamp = (x: number) => Math.min(100, Math.max(0, x));

export interface ReputationInputs {
  onTime: number;
  quality: number;
  priceFairness: number;
  fleetYouth: number;
  marketing: number;
  incidentPenalty: number;
}

export function reputationTarget(i: ReputationInputs): number {
  const w = BALANCE.reputationWeights;
  return clamp(
    w.onTime * i.onTime + w.quality * i.quality + w.priceFairness * i.priceFairness + w.fleetYouth * i.fleetYouth + w.marketing * i.marketing - i.incidentPenalty,
  );
}

/** EMA step with α = 2/(N+1), N = reputationEmaDays. */
export function stepReputation(current: number, target: number): number {
  const a = 2 / (BALANCE.reputationEmaDays + 1);
  return current + a * (target - current);
}

export const priceFairness = (avgFareRatio: number) => clamp(100 - (avgFareRatio - 1) * 100);
export const fleetYouth = (avgAgeYears: number) => clamp(100 - 5 * avgAgeYears);
export const marketingScore = (perMonth: number, fleetSize: number) => clamp((perMonth / Math.max(1, fleetSize * 50_000)) * 100);
