import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { registerIpc } from './ipc';
import { SimHost } from './simHost';
import { createMainWindow } from './window';

app.setAppUserModelId('com.skyempire.game');

void app.whenReady().then(() => {
  const host = new SimHost(join(import.meta.dirname, 'simWorker.js'));
  const win = createMainWindow();
  const loop = registerIpc(win, host);
  app.on('before-quit', () => {
    loop.stop();
    host.kill();
  });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
