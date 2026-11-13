import { ipcMain, type BrowserWindow } from 'electron';
import { IPC, parseCommand, type ClientView, type NewGameOptions, type Speed, type TickPush } from '@skyempire/shared';
import { GameLoop } from './gameLoop';
import type { SimHost } from './simHost';

/** Hooks filled in by the save service (Task 19). */
export interface GameHooks {
  onNewGame?(view: ClientView): Promise<void>;
  onTick?(push: TickPush): Promise<void>;
}

export function registerIpc(win: BrowserWindow, host: SimHost, hooks: GameHooks = {}): GameLoop {
  let hasGame = false;
  const send = (channel: string, payload: unknown) => {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  };
  const loop = new GameLoop(
    { tick: () => host.request({ kind: 'tick' }) },
    (push) => {
      send(IPC.tick, push);
      void hooks.onTick?.(push);
    },
    (speed) => send(IPC.speed, speed),
  );

  ipcMain.handle(IPC.newGame, async (_e, opts: NewGameOptions) => {
    loop.setSpeed(0);
    const view = await host.request({ kind: 'newGame', opts });
    hasGame = true;
    await hooks.onNewGame?.(view);
    return view;
  });
  ipcMain.handle(IPC.view, async () => (hasGame ? host.request({ kind: 'view' }) : null));
  ipcMain.handle(IPC.command, async (_e, raw: unknown) => {
    const cmd = parseCommand(raw);
    const { result, view } = await host.request({ kind: 'command', cmd, immediate: loop.speed === 0 });
    if (view) send(IPC.tick, { view, summary: null } satisfies TickPush);
    return result;
  });
  ipcMain.handle(IPC.preview, async (_e, raw: unknown) => host.request({ kind: 'preview', cmd: parseCommand(raw) }));
  ipcMain.handle(IPC.routeDemand, async (_e, from: string, to: string) => host.request({ kind: 'routeDemand', from, to }));
  ipcMain.on(IPC.setSpeed, (_e, speed: Speed) => {
    if (hasGame && [0, 1, 2, 4, 8].includes(speed)) loop.setSpeed(speed);
  });
  return loop;
}
