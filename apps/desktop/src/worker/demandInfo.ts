import type { Airport, GameState } from '@skyempire/shared';
import { baseDemand, dateOf } from '@skyempire/sim';

export function baseDemandBothWays(a: Airport, b: Airport, s: GameState): number {
  const doy = dateOf(s.day).dayOfYear;
  return baseDemand(a, b, doy, s.market.economyIndex) + baseDemand(b, a, doy, s.market.economyIndex);
}
