import type { Catalog, Command, GameState } from '@skyempire/shared';
import type { Rng } from '../rng';

/** AI decisions — implemented in Task 15. */
export function runAi(_state: GameState, _airlineId: string, _catalog: Catalog, _rng: Rng): Command[] {
  return [];
}
