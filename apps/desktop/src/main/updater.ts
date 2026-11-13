import { app, ipcMain, type BrowserWindow } from 'electron';
import electronUpdater from 'electron-updater';

export const UPDATE_READY = 'app:update-ready';
export const INSTALL_UPDATE = 'app:install-update';

/** Check GitHub Releases for a newer version; tell the renderer when one is downloaded. */
export function initUpdater(win: BrowserWindow): void {
  ipcMain.on(INSTALL_UPDATE, () => electronUpdater.autoUpdater.quitAndInstall());
  if (!app.isPackaged || process.env.SKYEMPIRE_USER_DATA) return; // dev builds and e2e runs never update
  const { autoUpdater } = electronUpdater;
  autoUpdater.autoDownload = true;
  autoUpdater.on('update-downloaded', (info) => {
    if (!win.isDestroyed()) win.webContents.send(UPDATE_READY, info.version);
  });
  autoUpdater.on('error', (e) => console.error('Update check failed', e));
  void autoUpdater.checkForUpdates().catch(() => {});
}
