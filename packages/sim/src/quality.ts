import { BALANCE } from './config/balance';

export interface QualityInputs {
  comfort: number;
  ageYears: number;
  seatUnitsRatio: number;
  serviceLevel: 1 | 2 | 3 | 4 | 5;
  onTime: number;
}

/** Offer quality 0–100 (simulation-spec §4). */
export function offerQuality(q: QualityInputs): number {
  const agePenalty = Math.min(0.4, 0.02 * q.ageYears);
  const density = q.seatUnitsRatio > 0.95 ? 0.85 : 1;
  const aircraftComfort = q.comfort * (1 - agePenalty) * density;
  return 0.4 * aircraftComfort + 0.35 * BALANCE.serviceScore[q.serviceLevel]! + 0.25 * q.onTime;
}
