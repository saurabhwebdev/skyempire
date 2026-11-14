import type { Catalog, ClientView, Command, CommandResult, GameState, NewGameOptions, PreviewResult, RouteSuggestion, TickSummary, WeatherCondition } from '@skyempire/shared';
import { applyCommand, buildClientView, distanceKm, newGame, preview, suggestRoutes, tick } from '@skyempire/sim';
import { baseDemandBothWays } from './demandInfo';

export type SimRequest =
  | { kind: 'newGame'; opts: NewGameOptions }
  | { kind: 'load'; state: GameState }
  | { kind: 'tick' }
  | { kind: 'command'; cmd: Command }
  | { kind: 'preview'; cmd: Command }
  | { kind: 'routeDemand'; from: string; to: string }
  | { kind: 'suggestRoutes'; aircraftId: string }
  | { kind: 'view' }
  | { kind: 'snapshot' }
  | { kind: 'weatherPoints' }
  | { kind: 'setLiveWeather'; token: string; data: Record<number, Record<string, WeatherCondition>> };

export interface SimResponses {
  newGame: ClientView;
  load: ClientView;
  tick: { view: ClientView; summary: TickSummary };
  command: { result: CommandResult; view: ClientView | null };
  preview: PreviewResult;
  routeDemand: PreviewResult;
  suggestRoutes: RouteSuggestion[];
  view: ClientView;
  snapshot: GameState;
  weatherPoints: { day: number; token: string; points: { id: string; lat: number; lon: number }[] };
  setLiveWeather: { ok: boolean };
}

export interface SimHandler {
  handle<R extends SimRequest>(req: R): SimResponses[R['kind']];
}

/** Identifies a career (seed, calendar and player airline) so late async inputs can't land in a different one. */
const careerToken = (s: GameState) => `${s.seed}:${s.world.startYear}:${s.airlines[s.playerId]?.name ?? ''}`;

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
    suggestRoutes: (r) => suggestRoutes(need(), need().playerId, r.aircraftId, catalog),
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
    weatherPoints: () => {
      const s = need();
      const ids = new Set<string>(s.airlines[s.playerId]!.baseIds);
      for (const r of Object.values(s.routes)) if (r.status === 'active') ids.add(r.from).add(r.to);
      const points = [...ids].map((id) => catalog.airports[id]).filter((a) => !!a).map((a) => ({ id: a!.id, lat: a!.lat, lon: a!.lon }));
      return { day: s.day, token: careerToken(s), points };
    },
    setLiveWeather: (r) => {
      const s = need();
      // The fetch takes seconds: drop it if another career was loaded meanwhile, and never rewrite days already simulated.
      if (r.token !== careerToken(s)) return { ok: false };
      const live = s.world.liveWeather;
      for (const [day, byAirport] of Object.entries(r.data)) if (Number(day) > s.day) live[Number(day)] = { ...live[Number(day)], ...byAirport };
      for (const day of Object.keys(live)) if (Number(day) < s.day) delete live[Number(day)];
      return { ok: true };
    },
  };

  return {
    handle: (req) => (handlers[req.kind] as unknown as (r: typeof req) => never)(req),
  };
}
