import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { registerIpc } from './ipc';
import { SaveStore } from './saves/saves';
import { SimHost } from './simHost';
import { registerAppScheme, serveLogos, serveRenderer } from './protocol';
import { createMainWindow } from './window';

app.setAppUserModelId('com.skyempire.game');
registerAppScheme();
// E2E runs use a throwaway profile so they never touch real saves.
if (process.env.SKYEMPIRE_USER_DATA) app.setPath('userData', process.env.SKYEMPIRE_USER_DATA);

void app.whenReady().then(() => {
  serveRenderer(join(import.meta.dirname, '../renderer'));
  const userData = app.getPath('userData');
  const logosDir = join(userData, 'logos');
  serveLogos(logosDir);
  const host = new SimHost(join(import.meta.dirname, 'simWorker.js'));
  const win = createMainWindow();
  const session = registerIpc(win, host, new SaveStore(join(userData, 'saves')), userData, logosDir);

  let quitting = false;
  app.on('before-quit', (e) => {
    if (quitting) return;
    e.preventDefault();
    quitting = true;
    session.loop.stop();
    session
      .save('auto')
      .catch((err) => console.error('Save on quit failed', err))
      .finally(() => {
        host.kill();
        app.quit();
      });
  });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
