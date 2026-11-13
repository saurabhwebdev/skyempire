import { app, BrowserWindow } from 'electron';
import { createMainWindow } from './window';

app.setAppUserModelId('com.skyempire.game');

void app.whenReady().then(() => {
  createMainWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
