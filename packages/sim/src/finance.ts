import type { Airline, Catalog, GameState, Money } from '@skyempire/shared';
import { BALANCE } from './config/balance';
import { aircraftMarketValue } from './fleet';

export const debtOf = (al: Airline): Money => al.loans.reduce((s, l) => s + l.principal, 0);

/** cash + aircraft market value (owned) + base value − debt (simulation-spec §9). */
export function companyValue(state: GameState, airlineId: string, catalog: Catalog): Money {
  const al = state.airlines[airlineId]!;
  let fleet = 0;
  for (const ac of Object.values(state.aircraft)) {
    if (ac.ownerId !== airlineId || ac.ownership !== 'owned') continue;
    fleet += aircraftMarketValue(catalog.aircraftTypes[ac.typeId]!, ac.ageDays, ac.condition);
  }
  const bases = al.baseIds.reduce((s, id) => s + baseSetupCost(catalog, id, 'startup') * 0.5, 0);
  return Math.round(al.cash + fleet + bases - debtOf(al));
}

export function availableCredit(state: GameState, airlineId: string, catalog: Catalog): Money {
  const limit = Math.max(BALANCE.minCredit, BALANCE.creditShare * companyValue(state, airlineId, catalog));
  return Math.max(0, Math.round(limit - debtOf(state.airlines[airlineId]!)));
}

export function baseSetupCost(catalog: Catalog, airportId: string, tier: Airline['tier']): Money {
  const size = catalog.airports[airportId]?.sizeClass ?? 1;
  return Math.round(BALANCE.baseSetupPerSize * size * (tier === 'startup' ? 1 : 0.5));
}
