import type { Catalog, ClientView, Command, CommandResult, GameState, NewGameOptions, PreviewResult, TickSummary } from '@skyempire/shared';
import { applyCommand, buildClientView, distanceKm, newGame, preview, tick } from '@skyempire/sim';
import { baseDemandBothWays } from './demandInfo';

export type SimRequest =
  | { kind: 'newGame'; opts: NewGameOptions }
  | { kind: 'load'; state: GameState }
  | { kind: 'tick' }
  | { kind: 'command'; cmd: Command; immediate: boolean }
  | { kind: 'preview'; cmd: Command }
  | { kind: 'routeDemand'; from: string; to: string }
  | { kind: 'view' }
  | { kind: 'snapshot' };

export interface SimResponses {
  newGame: ClientView;
  load: ClientView;
  tick: { view: ClientView; summary: TickSummary };
  command: { result: CommandResult; view: ClientView | null };
  preview: PreviewResult;
  routeDemand: PreviewResult;
  view: ClientView;
  snapshot: GameState;
}

export interface SimHandler {
  handle<R extends SimRequest>(req: R): SimResponses[R['kind']];
}

/** Pure game host: owns the GameState and the player's queued commands. */
export function createSimHandler(catalog: Catalog): SimHandler {
  let state: GameState | null = null;
  let queue: Command[] = [];
  const need = (): GameState => {
    if (!state) throw new Error('No game loaded');
    return state;
  };
  const view = () => buildClientView(need(), need().playerId, catalog);

  const handlers: { [K in SimRequest['kind']]: (req: Extract<SimRequest, { kind: K }>) => SimResponses[K] } = {
    newGame: (r) => {
      state = newGame(r.opts, catalog);
      queue = [];
      return view();
    },
    load: (r) => {
      state = r.state;
      queue = [];
      return view();
    },
    tick: () => {
      const s = need();
      const res = tick(s, queue.map((cmd) => ({ airlineId: s.playerId, cmd })), catalog);
      state = res.state;
      queue = [];
      return { view: view(), summary: res.summary };
    },
    command: (r) => {
      const s = need();
      if (r.immediate) {
        const result = applyCommand(s, s.playerId, r.cmd, catalog); // validates before mutating
        return { result, view: result.ok ? view() : null };
      }
      const result = applyCommand(structuredClone(s), s.playerId, r.cmd, catalog); // dry run for instant feedback
      if (result.ok) queue.push(r.cmd);
      return { result, view: null };
    },
    preview: (r) => preview(need(), need().playerId, r.cmd, catalog),
    routeDemand: (r) => {
      const s = need();
      const a = catalog.airports[r.from], b = catalog.airports[r.to];
      if (!a || !b) return { ok: false, reason: 'Unknown airport' };
      const pair = [r.from, r.to].sort().join('-');
      return {
        ok: true,
        demandPerDay: Math.round(baseDemandBothWays(a, b, s)),
        distanceKm: Math.round(distanceKm(a, b)),
        competitors: Object.values(s.routes).filter((x) => x.status === 'active' && [x.from, x.to].sort().join('-') === pair).length,
      };
    },
    view: () => view(),
    snapshot: () => structuredClone(need()),
  };

  return {
    handle: (req) => (handlers[req.kind] as unknown as (r: typeof req) => never)(req),
  };
}
