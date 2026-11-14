import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { registerIpc } from './ipc';
import { createLog } from './log';
import { SaveStore } from './saves/saves';
import { SimHost } from './simHost';
import { registerAppScheme, serveLogos, serveRenderer } from './protocol';
import { createMainWindow } from './window';
import { initUpdater } from './updater';

app.setAppUserModelId('com.skyempire.game');
// E2E runs use a throwaway profile so they never touch real saves.
if (process.env.SKYEMPIRE_USER_DATA) app.setPath('userData', process.env.SKYEMPIRE_USER_DATA);

// One copy at a time: a second launch (e.g. an impatient double-click) just brings the open game forward.
// Two copies would fight over the same saves and cache folders and could hang.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  start();
}

function start() {
  const log = createLog(join(app.getPath('userData'), 'logs'));
  log.info(`SkyEmpire ${app.getVersion()} starting (${process.platform} ${process.arch}, Electron ${process.versions.electron})`);
  for (const level of ['error', 'warn'] as const) {
    const orig = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      orig(...args);
      log.error(args.map((a) => (a instanceof Error ? (a.stack ?? a.message) : String(a))).join(' '));
    };
  }
  process.on('uncaughtException', (e) => log.error(`uncaught: ${e.stack ?? e.message}`));
  process.on('unhandledRejection', (e) => log.error(`unhandled: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`));

  registerAppScheme();
  let win: BrowserWindow | null = null;
  app.on('second-instance', () => {
    log.info('second launch: focusing the open window');
    if (!win || win.isDestroyed()) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });

  void app.whenReady().then(() => {
    log.info('electron ready');
    serveRenderer(join(import.meta.dirname, '../renderer'));
    const userData = app.getPath('userData');
    const logosDir = join(userData, 'logos');
    serveLogos(logosDir);
    const host = new SimHost(join(import.meta.dirname, 'simWorker.js'));
    win = createMainWindow(log);
    log.info('window shown');
    initUpdater(win);
    const session = registerIpc(win, host, new SaveStore(join(userData, 'saves')), userData, logosDir);

    let quitting = false;
    app.on('before-quit', (e) => {
      if (quitting) return;
      e.preventDefault();
      quitting = true;
      log.info('quitting');
      session.loop.stop();
      Promise.race([session.save('auto'), new Promise((_, reject) => setTimeout(() => reject(new Error('save timed out')), 5000))])
        .catch((err) => console.error('Save on quit failed', err))
        .finally(() => {
          host.kill();
          app.quit();
        });
    });
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) win = createMainWindow(log);
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
