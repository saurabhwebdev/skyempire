import type { Catalog, ClientView, GameState, WeatherCondition } from '@skyempire/shared';
import { pairKey } from './daySim';
import { slotsFree } from './ops';
import { availableCredit, companyValue, monthlyFixedCosts } from './finance';
import { upcomingPeaks } from './holidays';
import { weatherAt } from './weather';
import { routeTensionStatus, tensionLabel } from './tensions';
import { objectivesView } from './progression';

/** Player-scoped snapshot for the UI. Rival finances stay hidden. */
export function buildClientView(state: GameState, playerId: string, catalog: Catalog): ClientView {
  const player = state.airlines[playerId]!;
  const routes = Object.values(state.routes);
  const mine = routes.filter((r) => r.airlineId === playerId);
  const myPairs = new Set(mine.map((r) => pairKey(r.from, r.to)));
  const rivals = Object.values(state.airlines)
    .filter((a) => a.id !== playerId && !a.bankrupt)
    .map((a) => {
      const theirs = routes.filter((r) => r.airlineId === a.id && r.status === 'active');
      return {
        id: a.id, name: a.name, code: a.code, color: a.colors.primary, personality: a.personality!,
        fleetSize: Object.values(state.aircraft).filter((x) => x.ownerId === a.id).length,
        routeCount: theirs.length, reputation: Math.round(a.reputation),
        overlapRoutes: theirs.filter((r) => myPairs.has(pairKey(r.from, r.to))).length,
      };
    });
  const markets = new Set<string>();
  for (const id of player.baseIds) markets.add(catalog.airports[id]!.country);
  for (const r of mine) for (const id of [r.from, r.to]) markets.add(catalog.airports[id]!.country);
  const today: Record<string, WeatherCondition> = {};
  for (const r of routes) {
    if (r.status !== 'active') continue;
    for (const id of [r.from, r.to]) {
      if (id in today) continue;
      const w = weatherAt(state, catalog, id, state.day);
      if (w !== 'clear') today[id] = w;
    }
  }
  const forecast: Record<string, WeatherCondition[]> = {};
  const playerAirports = new Set<string>(player.baseIds);
  for (const r of mine) playerAirports.add(r.from).add(r.to);
  for (const id of playerAirports) forecast[id] = [1, 2, 3].map((k) => weatherAt(state, catalog, id, state.day + k));
  const routeStatus: ClientView['routeStatus'] = {};
  for (const r of mine) routeStatus[r.id] = routeTensionStatus(state, catalog, r);
  const tensions = state.world.tensions
    .filter((t) => t.kind !== 'thawBonus' || state.day >= t.startDay)
    .map((t) => ({
      id: t.id, kind: t.kind, startDay: t.startDay, endDay: t.endDay, active: state.day >= t.startDay && state.day <= t.endDay, label: tensionLabel(catalog, t),
      ...(t.regionId ? { regionId: t.regionId } : {}), ...(t.countries ? { countries: t.countries } : {}), ...(t.country ? { country: t.country } : {}),
    }));
  const free: Record<string, number> = {};
  for (const id of Object.keys(catalog.airports)) free[id] = slotsFree(state, catalog, id);
  return {
    day: state.day,
    startYear: state.world.startYear,
    player,
    aircraft: Object.values(state.aircraft).filter((a) => a.ownerId === playerId),
    routes: mine,
    rivals,
    rivalRoutes: routes.filter((r) => r.airlineId !== playerId && r.status === 'active').map((r) => ({ airlineId: r.airlineId, from: r.from, to: r.to })),
    market: state.market,
    events: state.events,
    slotsFree: free,
    objectives: objectivesView(state, playerId, catalog),
    weather: { today, forecast },
    tensions,
    routeStatus,
    upcomingPeaks: upcomingPeaks([...markets], state.day, state.day + 60, state.world.startYear, catalog),
    gameOver: state.gameOver,
    finance: (() => {
      const m = monthlyFixedCosts(state, playerId, catalog);
      return {
        companyValue: companyValue(state, playerId, catalog),
        availableCredit: availableCredit(state, playerId, catalog),
        monthlyFixed: m.leases + m.overhead + m.bases + m.marketing,
      };
    })(),
  };
}
