import type { Command, CommandResult } from './commands';
import type { NewGameOptions } from './types';
import type { AirlineDaily, ClientView, PreviewResult, TickSummary } from './view';

export type Speed = 0 | 1 | 2 | 4 | 8;

export interface SaveInfo {
  id: string;
  name: string;
  airlineName: string;
  day: number;
  /** Real year of game day 0 (saves from v0.1: 2026). */
  startYear: number;
  updatedAt: number;
}

export interface Settings {
  reduceMotion: boolean;
  performanceMode: boolean;
  autoPauseMajor: boolean;
  autosaveDays: 30 | 60 | 90;
  units: 'km' | 'mi';
  volume: number;
  tutorialDone: boolean;
  colorBlindRivals: boolean;
  /** Show weather on the map. */
  mapWeather: boolean;
  /** Use real forecasts from Open-Meteo when online. */
  liveWeather: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  reduceMotion: false,
  performanceMode: false,
  autoPauseMajor: true,
  autosaveDays: 30,
  units: 'km',
  volume: 0.6,
  tutorialDone: false,
  colorBlindRivals: false,
  mapWeather: true,
  liveWeather: true,
};

export interface TickPush {
  view: ClientView;
  summary: TickSummary | null;
}

export interface GameApi {
  newGame(opts: NewGameOptions): Promise<ClientView>;
  loadSave(saveId: string): Promise<ClientView>;
  listSaves(): Promise<SaveInfo[]>;
  save(): Promise<void>;
  saveAs(name: string): Promise<SaveInfo>;
  command(cmd: Command): Promise<CommandResult>;
  preview(cmd: Command): Promise<PreviewResult>;
  setSpeed(speed: Speed): void;
  onTick(cb: (push: TickPush) => void): () => void;
  onSpeed(cb: (speed: Speed) => void): () => void;
  view(): Promise<ClientView | null>;
  history(airlineId: string, fromDay: number, toDay: number): Promise<AirlineDaily[]>;
  routeDemand(from: string, to: string): Promise<PreviewResult>;
  logos: {
    status(): Promise<{ have: number; total: number }>;
    download(): Promise<{ ok: number; failed: string[] }>;
    cancel(): void;
    onProgress(cb: (done: number, total: number) => void): () => void;
    setPlayerLogo(data: Uint8Array): Promise<void>;
  };
  onUpdateReady(cb: (version: string) => void): () => void;
  /** Messages from the main process (save failures, recovered saves, simulation errors). */
  onNotice(cb: (n: { title: string; body?: string; tone: 'info' | 'warning' | 'danger' }) => void): () => void;
  installUpdate(): void;
  getSettings(): Promise<Settings>;
  setSettings(s: Partial<Settings>): Promise<Settings>;
}

/** IPC channel names shared by main and preload. */
export const IPC = {
  newGame: 'game:newGame',
  loadSave: 'game:loadSave',
  listSaves: 'game:listSaves',
  save: 'game:save',
  saveAs: 'game:saveAs',
  command: 'game:command',
  preview: 'game:preview',
  setSpeed: 'game:setSpeed',
  tick: 'game:tick',
  speed: 'game:speed',
  history: 'game:history',
  routeDemand: 'game:routeDemand',
  getSettings: 'game:getSettings',
  setSettings: 'game:setSettings',
  view: 'game:view',
  notice: 'app:notice',
  logoStatus: 'logos:status',
  logoDownload: 'logos:download',
  logoCancel: 'logos:cancel',
  logoProgress: 'logos:progress',
  logoPlayer: 'logos:player',
} as const;
