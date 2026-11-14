import { BrowserWindow, dialog, shell } from 'electron';
import { join } from 'node:path';
import { crashAction, type Log } from './log';
import { APP_ORIGIN } from './protocol';

export function createMainWindow(log?: Log): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: 'SkyEmpire',
    backgroundColor: '#141821',
    // Shown at once (dark background, then the "Loading…" splash), so a double-click always gives a window.
    show: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  const url = process.env.ELECTRON_RENDERER_URL ?? `${APP_ORIGIN}/index.html`;
  const load = () => void win.loadURL(url).catch(() => {}); // failures are reported by did-fail-load
  // Never navigate away or open new windows inside the app; external links go to the browser.
  win.webContents.setWindowOpenHandler(({ url: link }) => {
    if (/^https:\/\//.test(link)) void shell.openExternal(link);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());

  const ask = async (message: string) => {
    if (win.isDestroyed()) return;
    const { response } = await dialog.showMessageBox(win, {
      type: 'error',
      title: 'SkyEmpire',
      message,
      detail: `Your saves are safe. If this keeps happening, send this file to the developer:\n${log?.file ?? ''}`,
      buttons: ['Try again', 'Quit'],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) load();
    else win.close();
  };
  win.webContents.on('did-finish-load', () => log?.info('game screen loaded'));
  win.webContents.on('did-fail-load', (_e, code, desc, failedUrl, isMainFrame) => {
    log?.error(`load failed ${code} ${desc} ${failedUrl}`);
    if (isMainFrame && code !== -3) void ask("SkyEmpire couldn't load its game screen."); // -3 = aborted by a reload
  });
  const crashes: number[] = [];
  win.webContents.on('render-process-gone', (_e, d) => {
    log?.error(`game screen stopped: ${d.reason} (exit ${d.exitCode})`);
    if (d.reason === 'clean-exit') return;
    const now = Date.now();
    const action = crashAction(crashes, now);
    crashes.push(now);
    if (action === 'reload') load();
    else void ask('The game screen stopped working.');
  });
  win.on('unresponsive', () => log?.error('window not responding'));
  win.on('responsive', () => log?.info('window responding again'));
  load();
  return win;
}
