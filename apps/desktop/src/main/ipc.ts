import { ipcMain, type BrowserWindow } from 'electron';
import { IPC, parseCommand, type NewGameOptions, type Settings, type Speed, type TickPush } from '@skyempire/shared';
import { GameLoop } from './gameLoop';
import { SaveLoadError, type SaveStore } from './saves/saves';
import { loadSettings, saveSettings } from './settings';
import type { SimHost } from './simHost';

export interface GameSession {
  loop: GameLoop;
  /** Save the current career (manual snapshot). No-op without a game. */
  save(kind?: 'auto' | 'manual'): Promise<void>;
}

export function registerIpc(win: BrowserWindow, host: SimHost, store: SaveStore, settingsDir: string): GameSession {
  let saveId: string | null = null;
  let settings: Settings = loadSettings(settingsDir);
  const send = (channel: string, payload: unknown) => {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  };

  const save = async (kind: 'auto' | 'manual' = 'manual') => {
    if (!saveId) return;
    const state = await host.request({ kind: 'snapshot' });
    store.writeSnapshot(saveId, state, kind);
  };

  const loop = new GameLoop(
    { tick: () => host.request({ kind: 'tick' }) },
    (push) => {
      send(IPC.tick, push);
      if (!saveId || !push.summary) return;
      try {
        store.appendDaily(saveId, push.summary.daily);
        if (push.view.day % settings.autosaveDays === 0) void save('auto');
      } catch (e) {
        console.error('Autosave failed', e);
      }
    },
    (speed) => send(IPC.speed, speed),
  );
  loop.autoPause = settings.autoPauseMajor;

  ipcMain.handle(IPC.newGame, async (_e, opts: NewGameOptions) => {
    loop.setSpeed(0);
    const view = await host.request({ kind: 'newGame', opts });
    const state = await host.request({ kind: 'snapshot' });
    saveId = store.createSave(opts.airline.name, state).id;
    return view;
  });
  ipcMain.handle(IPC.loadSave, async (_e, id: string) => {
    loop.setSpeed(0);
    try {
      const state = store.loadLatest(id);
      const view = await host.request({ kind: 'load', state });
      saveId = id;
      return view;
    } catch (e) {
      // Surface the reason as a stable message the renderer can map to friendly copy.
      throw new Error(e instanceof SaveLoadError ? `SaveLoadError:${e.reason}` : String(e), { cause: e });
    }
  });
  ipcMain.handle(IPC.listSaves, async () => store.listSaves());
  ipcMain.handle(IPC.save, async () => save('manual'));
  ipcMain.handle(IPC.saveAs, async (_e, name: string) => {
    const state = await host.request({ kind: 'snapshot' });
    const info = store.createSave(name, state);
    saveId = info.id;
    return info;
  });
  ipcMain.handle(IPC.history, async (_e, airlineId: string, from: number, to: number) =>
    saveId ? store.history(saveId, airlineId, from, to) : [],
  );
  ipcMain.handle(IPC.getSettings, async () => settings);
  ipcMain.handle(IPC.setSettings, async (_e, patch: Partial<Settings>) => {
    settings = saveSettings(settingsDir, patch);
    loop.autoPause = settings.autoPauseMajor;
    return settings;
  });
  ipcMain.handle(IPC.view, async () => (saveId ? host.request({ kind: 'view' }) : null));
  ipcMain.handle(IPC.command, async (_e, raw: unknown) => {
    const cmd = parseCommand(raw);
    const { result, view } = await host.request({ kind: 'command', cmd, immediate: loop.speed === 0 });
    if (view) send(IPC.tick, { view, summary: null } satisfies TickPush);
    return result;
  });
  ipcMain.handle(IPC.preview, async (_e, raw: unknown) => host.request({ kind: 'preview', cmd: parseCommand(raw) }));
  ipcMain.handle(IPC.routeDemand, async (_e, from: string, to: string) => host.request({ kind: 'routeDemand', from, to }));
  ipcMain.on(IPC.setSpeed, (_e, speed: Speed) => {
    if (saveId && [0, 1, 2, 4, 8].includes(speed)) loop.setSpeed(speed);
  });

  return { loop, save };
}
