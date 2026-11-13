import type { GameApi } from '@skyempire/shared';

declare global {
  interface Window {
    game: GameApi;
  }
}
export {};
