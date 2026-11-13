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
  history(airlineId: string, fromDay: number, toDay: number): Promise<AirlineDaily[]>;
  routeDemand(from: string, to: string): Promise<PreviewResult>;
  getSettings(): Promise<Settings>;
  setSettings(s: Partial<Settings>): Promise<Settings>;
}
