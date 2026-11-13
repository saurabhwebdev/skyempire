import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type GameApi, type Speed, type TickPush } from '@skyempire/shared';

const on = <T>(channel: string, cb: (v: T) => void) => {
  const listener = (_e: unknown, v: T) => cb(v);
  ipcRenderer.on(channel, listener);
  return () => void ipcRenderer.removeListener(channel, listener);
};

const api: GameApi = {
  newGame: (opts) => ipcRenderer.invoke(IPC.newGame, opts),
  loadSave: (id) => ipcRenderer.invoke(IPC.loadSave, id),
  listSaves: () => ipcRenderer.invoke(IPC.listSaves),
  save: () => ipcRenderer.invoke(IPC.save),
  saveAs: (name) => ipcRenderer.invoke(IPC.saveAs, name),
  command: (cmd) => ipcRenderer.invoke(IPC.command, cmd),
  preview: (cmd) => ipcRenderer.invoke(IPC.preview, cmd),
  setSpeed: (speed: Speed) => ipcRenderer.send(IPC.setSpeed, speed),
  onTick: (cb) => on<TickPush>(IPC.tick, cb),
  onSpeed: (cb) => on<Speed>(IPC.speed, cb),
  view: () => ipcRenderer.invoke(IPC.view),
  history: (airlineId, from, to) => ipcRenderer.invoke(IPC.history, airlineId, from, to),
  routeDemand: (from, to) => ipcRenderer.invoke(IPC.routeDemand, from, to),
  logos: {
    status: () => ipcRenderer.invoke(IPC.logoStatus),
    download: () => ipcRenderer.invoke(IPC.logoDownload),
    cancel: () => ipcRenderer.send(IPC.logoCancel),
    onProgress: (cb) => on<[number, number]>(IPC.logoProgress, ([d, t]) => cb(d, t)),
    setPlayerLogo: (data) => ipcRenderer.invoke(IPC.logoPlayer, data),
  },
  onUpdateReady: (cb) => on<string>('app:update-ready', cb),
  installUpdate: () => ipcRenderer.send('app:install-update'),
  getSettings: () => ipcRenderer.invoke(IPC.getSettings),
  setSettings: (s) => ipcRenderer.invoke(IPC.setSettings, s),
};

contextBridge.exposeInMainWorld('game', api);
