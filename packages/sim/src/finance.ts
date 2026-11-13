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

export function dailyInterest(al: Airline): Money {
  return Math.round(al.loans.reduce((s, l) => s + (l.principal * l.annualRate) / 360, 0));
}

export function creditRating(debtRatio: number, opMargin90: number): Airline['creditRating'] {
  if (debtRatio < 0.2 && opMargin90 > 0.05) return 'A';
  if (debtRatio < 0.4 && opMargin90 > 0) return 'B';
  if (debtRatio < 0.6) return 'C';
  return 'D';
}

export interface MonthlyCosts { leases: Money; overhead: Money; bases: Money; marketing: Money }

/** Month-start charges: leases, overhead, base upkeep, marketing. Deducts from cash. */
/** Monthly fixed costs without charging them. */
export function monthlyFixedCosts(state: GameState, airlineId: string, catalog: Catalog): MonthlyCosts {
  const al = state.airlines[airlineId]!;
  const fleet = Object.values(state.aircraft).filter((a) => a.ownerId === airlineId);
  const leases = fleet.filter((a) => a.ownership === 'leased').reduce((s, a) => s + catalog.aircraftTypes[a.typeId]!.leasePerMonth, 0);
  const overhead = BALANCE.overheadBase + BALANCE.overheadPerAircraft * fleet.length;
  const bases = al.baseIds.reduce((s, id) => s + BALANCE.baseUpkeepPerSize * (catalog.airports[id]?.sizeClass ?? 1), 0);
  return { leases, overhead, bases, marketing: al.marketingPerMonth };
}

export function applyMonthly(state: GameState, airlineId: string, catalog: Catalog): MonthlyCosts {
  const m = monthlyFixedCosts(state, airlineId, catalog);
  state.airlines[airlineId]!.cash -= m.leases + m.overhead + m.bases + m.marketing;
  return m;
}

/** Bankruptcy check (simulation-spec §9): cash < 0 with no credit for 30 consecutive days. */
export function updateSolvency(state: GameState, airlineId: string, catalog: Catalog): void {
  const al = state.airlines[airlineId]!;
  if (al.bankrupt) return;
  if (al.cash < 0 && availableCredit(state, airlineId, catalog) <= 0) al.daysInsolvent += 1;
  else al.daysInsolvent = 0;
  if (al.daysInsolvent >= BALANCE.bankruptcyDays) {
    al.bankrupt = true;
    if (al.isPlayer) state.gameOver = { reason: 'bankrupt', day: state.day };
  }
}
