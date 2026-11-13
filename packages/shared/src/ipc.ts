import type { Command, CommandResult } from './commands';
import type { NewGameOptions } from './types';
import type { AirlineDaily, ClientView, PreviewResult, TickSummary } from './view';

export type Speed = 0 | 1 | 2 | 4 | 8;

export interface SaveInfo {
  id: string;
  name: string;
  airlineName: string;
  day: number;
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
} as const;
