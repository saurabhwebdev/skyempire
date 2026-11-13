import type { Command, CommandResult } from '@skyempire/shared';
import { useToast } from '@skyempire/ui';
import { useCallback, useEffect } from 'react';
import { useGameStore, useUi } from '../store';

/** Subscribe to game pushes from the main process (mount once). */
export function useGameBridge(): void {
  useEffect(() => {
    const offTick = window.game.onTick((p) => useGameStore.getState().applyPush(p));
    const offSpeed = window.game.onSpeed((s) => useUi.getState().speedFromGame(s));
    void window.game.getSettings().then((s) => useGameStore.getState().setSettings(s));
    // Pick up a game that's already running (e.g. after a renderer reload).
    void window.game.view().then((v) => {
      if (!v) return;
      useGameStore.getState().setView(v);
      useUi.getState().setScreen(v.gameOver ? 'gameOver' : 'game');
    });
    return () => {
      offTick();
      offSpeed();
    };
  }, []);
}

/** Offer to restart when a downloaded update is ready (non-blocking). */
export function useUpdateNotice(): void {
  const toast = useToast();
  useEffect(
    () =>
      window.game.onUpdateReady((version) =>
        toast({ title: `Update ${version} ready`, body: 'Restart to install it. Your game is saved first.', tone: 'info',
          action: { label: 'Restart now', onClick: async () => { await window.game.save(); window.game.installUpdate(); } } }),
      ),
    [toast],
  );
}

/** Send a command; failures show their reason as a toast. */
export function useCommand(): (cmd: Command) => Promise<CommandResult> {
  const toast = useToast();
  return useCallback(
    async (cmd) => {
      const r = await window.game.command(cmd);
      if (!r.ok) toast({ title: r.reason, tone: 'danger' });
      return r;
    },
    [toast],
  );
}
