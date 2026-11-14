export interface QualityInputs {
  comfort: number;
  ageYears: number;
  /** Cabin product score of the class, 0–100 (cabin.ts). */
  productScore: number;
  onTime: number;
}

/** Offer quality 0–100 for one cabin class (simulation-spec §4, v0.4: the product replaces the service level). */
export function offerQuality(q: QualityInputs): number {
  const agePenalty = Math.min(0.4, 0.02 * q.ageYears);
  return 0.4 * q.comfort * (1 - agePenalty) + 0.35 * q.productScore + 0.25 * q.onTime;
}
