import type { AircraftType, TierId } from '@skyempire/shared';
import { BALANCE } from './config/balance';

const TIER_ORDER: TierId[] = ['startup', 'regional', 'national', 'global'];
export const tierAllows = (have: TierId, need: TierId): boolean => TIER_ORDER.indexOf(have) >= TIER_ORDER.indexOf(need);

/** Market value of an aircraft (simulation-spec §9). */
export function aircraftMarketValue(type: AircraftType, ageDays: number, condition: number): number {
  return Math.round(type.priceUsd * BALANCE.usedValueDecay ** (ageDays / 360) * Math.sqrt(Math.max(0, condition) / 100));
}
