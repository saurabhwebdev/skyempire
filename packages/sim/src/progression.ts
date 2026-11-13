import type { Catalog, GameState, Notification } from '@skyempire/shared';

/** Tiers and objectives — implemented in Task 16. */
export function updateProgression(_state: GameState, _airlineId: string, _catalog: Catalog): Notification[] {
  return [];
}

export function objectivesView(_state: GameState, _airlineId: string, _catalog: Catalog): { id: string; title: string; done: boolean }[] {
  return [];
}
