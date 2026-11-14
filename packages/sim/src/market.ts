import type { Catalog, GameState } from '@skyempire/shared';
import { isMonthStart } from './calendar';
import { BALANCE } from './config/balance';
import { refreshUsedListings } from './newGame';
import type { Rng } from './rng';

export function fuelMultiplier(state: GameState): number {
  return state.events.filter((e) => e.kind === 'fuelSpike').reduce((m, e) => m * e.magnitude, 1);
}

/** Daily market step: fuel random walk (mean-reverting), economy drift, monthly used-aircraft refresh. */
export function stepMarket(state: GameState, catalog: Catalog, rng: Rng): void {
  const mult = fuelMultiplier(state);
  let base = state.market.fuelPricePerKg / mult;
  base *= 1 + rng.normal(0, 0.01);
  base += (BALANCE.fuelPriceStart - base) * 0.02;
  base = Math.min(BALANCE.fuelPriceMax, Math.max(BALANCE.fuelPriceMin, base));
  state.market.fuelPricePerKg = Math.round(base * mult * 10000) / 10000;

  const target = 1 + state.events.reduce((s, e) => s + (e.kind === 'boom' ? 0.2 : e.kind === 'recession' ? -0.2 : 0), 0);
  state.market.economyIndex += (target - state.market.economyIndex) / 60;

  if (isMonthStart(state.day, state.world.startYear) && state.day > 0) refreshUsedListings(state, catalog, rng);
}
