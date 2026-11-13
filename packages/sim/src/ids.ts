import type { GameState } from '@skyempire/shared';

export function nextId(state: GameState, prefix: string): string {
  state.nextId += 1;
  return `${prefix}${state.nextId}`;
}
