import type { AircraftClass, PersonalityId, TierId } from '@skyempire/shared';

export interface Personality {
  priceAggressiveness: number;
  expansionRate: number;
  riskTolerance: number;
  premiumFocus: number;
  preferredClasses: AircraftClass[];
  cadenceDays: number;
  startTier: TierId;
  startReputation: number;
}

/** simulation-spec §10. */
export const PERSONALITIES: Record<PersonalityId, Personality> = {
  budget: { priceAggressiveness: 0.9, expansionRate: 0.6, riskTolerance: 0.5, premiumFocus: 0, preferredClasses: ['narrowbody'], cadenceDays: 7, startTier: 'regional', startReputation: 55 },
  legacy: { priceAggressiveness: 0.3, expansionRate: 0.4, riskTolerance: 0.3, premiumFocus: 0.7, preferredClasses: ['narrowbody', 'widebody', 'regional'], cadenceDays: 14, startTier: 'national', startReputation: 65 },
  gulf: { priceAggressiveness: 0.4, expansionRate: 0.5, riskTolerance: 0.6, premiumFocus: 0.9, preferredClasses: ['widebody'], cadenceDays: 14, startTier: 'national', startReputation: 70 },
  regional: { priceAggressiveness: 0.5, expansionRate: 0.4, riskTolerance: 0.3, premiumFocus: 0.2, preferredClasses: ['turboprop', 'regional'], cadenceDays: 10, startTier: 'regional', startReputation: 60 },
  expander: { priceAggressiveness: 0.7, expansionRate: 0.9, riskTolerance: 0.9, premiumFocus: 0.3, preferredClasses: ['narrowbody'], cadenceDays: 7, startTier: 'regional', startReputation: 55 },
};

export function cadenceFor(p: PersonalityId, difficulty: 'easy' | 'normal' | 'hard'): number {
  const base = PERSONALITIES[p].cadenceDays;
  return difficulty === 'hard' ? Math.max(3, Math.round(base * 0.7)) : base;
}
