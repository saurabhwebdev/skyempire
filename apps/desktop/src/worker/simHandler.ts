import type { Catalog, ClientView, Command, CommandResult, GameState, NewGameOptions, PreviewResult, TickSummary } from '@skyempire/shared';
import { applyCommand, buildClientView, distanceKm, newGame, preview, tick } from '@skyempire/sim';
import { baseDemandBothWays } from './demandInfo';

export type SimRequest =
  | { kind: 'newGame'; opts: NewGameOptions }
  | { kind: 'load'; state: GameState }
  | { kind: 'tick' }
  | { kind: 'command'; cmd: Command }
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
  const need = (): GameState => {
    if (!state) throw new Error('No game loaded');
    return state;
  };
  const view = () => buildClientView(need(), need().playerId, catalog);

  const handlers: { [K in SimRequest['kind']]: (req: Extract<SimRequest, { kind: K }>) => SimResponses[K] } = {
    newGame: (r) => {
      state = newGame(r.opts, catalog);
      return view();
    },
    load: (r) => {
      // Build the view from the candidate first: a structurally broken save must not replace the running game.
      const v = buildClientView(r.state, r.state.playerId, catalog);
      state = r.state;
      return v;
    },
    tick: () => {
      const res = tick(need(), [], catalog);
      state = res.state;
      return { view: view(), summary: res.summary };
    },
    command: (r) => {
      // Commands apply at once (the worker is single-threaded), so the player sees the result immediately.
      const s = need();
      const result = applyCommand(s, s.playerId, r.cmd, catalog); // validates before mutating
      return { result, view: result.ok ? view() : null };
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
