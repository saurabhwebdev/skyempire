import type { ClientView, Notification, Settings, Speed, TickPush } from '@skyempire/shared';
import { DEFAULT_SETTINGS } from '@skyempire/shared';
import { create } from 'zustand';

export type Section = 'overview' | 'network' | 'fleet' | 'finance' | 'market' | 'airline' | 'news';
export const SECTIONS: Section[] = ['overview', 'network', 'fleet', 'finance', 'market', 'airline', 'news'];
export type Selection = { kind: 'airport' | 'route' | 'aircraft' | 'airline'; id: string } | null;
export interface RouteEditorState {
  routeId?: string;
  from?: string;
  to?: string;
}
export const SPEEDS: Speed[] = [0, 1, 2, 4, 8];

interface UiState {
  screen: 'title' | 'newAirline' | 'game' | 'gameOver';
  section: Section;
  selection: Selection;
  trayOpen: boolean;
  speed: Speed;
  lastSpeed: Exclude<Speed, 0>;
  menuOpen: boolean;
  shortcutsOpen: boolean;
  routeEditor: RouteEditorState | null;
  marketOpen: boolean;
  showRivals: boolean;
  setShowRivals(v: boolean): void;
  setScreen(s: UiState['screen']): void;
  setSection(s: Section): void;
  select(s: Selection): void;
  setTray(open: boolean): void;
  setSpeed(s: Speed): void;
  /** Speed changed by the game loop (e.g. auto-pause): update UI without echoing back. */
  speedFromGame(s: Speed): void;
  setMenu(open: boolean): void;
  setShortcuts(open: boolean): void;
  openRouteEditor(s: RouteEditorState | null): void;
  setMarketOpen(open: boolean): void;
}

export const useUi = create<UiState>()((set, get) => ({
  screen: 'title',
  section: 'overview',
  selection: null,
  trayOpen: true,
  speed: 0,
  lastSpeed: 1,
  menuOpen: false,
  shortcutsOpen: false,
  routeEditor: null,
  marketOpen: false,
  showRivals: true,
  setShowRivals: (showRivals) => set({ showRivals }),
  setScreen: (screen) => set({ screen }),
  setSection: (section) => set({ section }),
  select: (selection) => set({ selection }),
  setTray: (trayOpen) => set({ trayOpen }),
  setSpeed: (speed) => {
    set(speed === 0 ? { speed } : { speed, lastSpeed: speed });
    if (typeof window !== 'undefined') window.game?.setSpeed(speed);
  },
  speedFromGame: (speed) => set(speed === 0 ? { speed } : { speed, lastSpeed: speed }),
  setMenu: (menuOpen) => {
    if (menuOpen && get().speed !== 0) get().setSpeed(0);
    set({ menuOpen });
  },
  setShortcuts: (shortcutsOpen) => set({ shortcutsOpen }),
  openRouteEditor: (routeEditor) => set({ routeEditor }),
  setMarketOpen: (marketOpen) => set({ marketOpen }),
}));

interface GameStoreState {
  view: ClientView | null;
  notifications: Notification[];
  /** Notifications from the most recent tick (for toasts/modals). */
  latest: Notification[];
  unread: number;
  cashDelta: number | null;
  settings: Settings;
  /** Bumped after logos change so <img> URLs refresh. */
  logoVersion: number;
  bumpLogos(): void;
  applyPush(p: TickPush): void;
  setView(v: ClientView | null): void;
  markRead(): void;
  setSettings(s: Settings): void;
}

export const useGameStore = create<GameStoreState>()((set, get) => ({
  view: null,
  notifications: [],
  latest: [],
  unread: 0,
  cashDelta: null,
  settings: DEFAULT_SETTINGS,
  logoVersion: 0,
  bumpLogos: () => set({ logoVersion: get().logoVersion + 1 }),
  applyPush: (p) => {
    const prev = get().view;
    const fresh = p.summary?.notifications ?? [];
    set({
      view: p.view,
      cashDelta: p.summary && prev ? p.view.player.cash - prev.player.cash : get().cashDelta,
      notifications: [...fresh.slice().reverse(), ...get().notifications].slice(0, 200),
      latest: fresh,
      unread: get().unread + fresh.length,
    });
    if (p.view.gameOver && useUi.getState().screen === 'game') useUi.getState().setScreen('gameOver');
  },
  setView: (view) => set({ view, cashDelta: null, notifications: [], latest: [], unread: 0 }),
  markRead: () => set({ unread: 0 }),
  setSettings: (settings) => set({ settings }),
}));
