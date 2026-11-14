import { IPC, type UpdateState } from '@skyempire/shared';
import { app, ipcMain, net, shell, type BrowserWindow } from 'electron';
import electronUpdater from 'electron-updater';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { canSelfUpdate, canStartDownload, isNewer, parseRelease, RELEASES_API, RELEASES_PAGE } from './updateLogic';

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

/**
 * In-app updates. We ask GitHub for the latest release ourselves (works for every build), show a banner,
 * and only download when the player clicks. The installed Windows build then installs and relaunches;
 * other builds open the release page.
 */
export function initUpdater(win: BrowserWindow): void {
  const installable = canSelfUpdate({
    packaged: app.isPackaged,
    platform: process.platform,
    uninstallerExists: existsSync(join(dirname(process.execPath), 'Uninstall SkyEmpire.exe')),
  });
  let state: UpdateState = { status: 'idle', current: app.getVersion(), canInstall: installable, url: RELEASES_PAGE };
  const set = (patch: Partial<UpdateState>) => {
    state = { ...state, ...patch };
    if (!win.isDestroyed()) win.webContents.send(IPC.updateState, state);
  };

  const { autoUpdater } = electronUpdater;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true; // "Later" still installs the next time the game closes
  autoUpdater.on('download-progress', (p) => set({ status: 'downloading', percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', () => set({ status: 'ready', percent: 100 }));
  autoUpdater.on('error', (e) => {
    console.error('Updater error', e);
    if (state.status === 'downloading') set({ status: 'error', error: 'The download failed. Check your connection and try again.' });
    // install() failed (e.g. the downloaded installer was removed): let the player download again.
    else if (state.status === 'ready') set({ status: 'error', error: "The update couldn't start. Download it again." });
  });

  let checking: Promise<UpdateState> | null = null;
  const check = (): Promise<UpdateState> => {
    if (state.status === 'downloading' || state.status === 'ready') return Promise.resolve(state);
    checking ??= (async () => {
      if (state.status !== 'available') set({ status: 'checking', error: undefined }); // background re-checks don't flash the banner
      try {
        const res = await net.fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': `SkyEmpire/${state.current}` } });
        if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
        const latest = parseRelease(await res.json());
        if (!latest || !isNewer(latest.version, state.current)) set({ status: 'none', version: latest?.version });
        else set({ status: 'available', version: latest.version, notes: latest.notes, url: latest.url });
      } catch (e) {
        console.error('Update check failed', e);
        // A failed check is not a failed update: clear `version` so the banner stays hidden (Settings shows the message).
        if (state.status !== 'available') set({ status: 'error', version: undefined, error: "Couldn't reach GitHub. Check your connection." });
      }
      return state;
    })().finally(() => { checking = null; });
    return checking;
  };

  ipcMain.handle(IPC.updateGet, () => state);
  ipcMain.handle(IPC.updateCheck, () => check());
  ipcMain.handle(IPC.updateDownload, async () => {
    if (!canStartDownload(state)) return;
    set({ status: 'downloading', percent: 0, error: undefined });
    try {
      await autoUpdater.checkForUpdates();
      await autoUpdater.downloadUpdate();
    } catch (e) {
      console.error('Update download failed', e);
      set({ status: 'error', error: 'The download failed. Check your connection and try again.' });
    }
  });
  // Silent install, then relaunch. Our before-quit handler saves the game first.
  ipcMain.on(IPC.updateInstall, () => { if (state.status === 'ready') autoUpdater.quitAndInstall(true, true); });
  ipcMain.on(IPC.updateOpenPage, () => void shell.openExternal(state.url.startsWith('https://github.com/') ? state.url : RELEASES_PAGE));

  if (process.env.SKYEMPIRE_USER_DATA) return; // e2e runs never call out
  if (!app.isPackaged && !process.env.SKYEMPIRE_CHECK_UPDATES) return; // dev: only when asked
  setTimeout(() => void check(), 8000);
  setInterval(() => void check(), CHECK_EVERY_MS).unref();
}
