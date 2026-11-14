import type { AircraftType, Cabin, PersonalityId, TierId } from '@skyempire/shared';
import { BALANCE } from './config/balance';

const TIER_ORDER: TierId[] = ['startup', 'regional', 'national', 'global'];
export const tierAllows = (have: TierId, need: TierId): boolean => TIER_ORDER.indexOf(have) >= TIER_ORDER.indexOf(need);

/** Market value of an aircraft (simulation-spec §9). */
export function aircraftMarketValue(type: AircraftType, ageDays: number, condition: number): number {
  return Math.round(type.priceUsd * BALANCE.usedValueDecay ** (ageDays / 360) * Math.sqrt(Math.max(0, condition) / 100));
}

/** Sensible cabin for a type and airline style. Player default (null) = all economy. */
export function defaultCabin(type: AircraftType, personality: PersonalityId | null): Cabin {
  const max = type.maxSeats;
  const fill = (business: number, premium: number): Cabin => ({
    business,
    premium,
    economy: Math.max(0, Math.floor(max - business * 2.5 - premium * 1.5)),
  });
  if (personality === null || personality === 'budget' || personality === 'expander') return fill(0, 0);
  if (type.class === 'widebody') return personality === 'gulf' ? fill(40, 28) : fill(30, 24);
  if (type.class === 'turboprop' || personality === 'regional') return fill(0, 0);
  return fill(Math.round(max * 0.06), 0);
}
