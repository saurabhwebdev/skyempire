import type { AirlineDaily, CostBreakdown } from '@skyempire/shared';
import { dateOf, formatMonth } from '@skyempire/sim';

export interface MonthRow {
  month: string;
  revenue: number;
  cost: number;
  profit: number;
  costs: CostBreakdown;
}

export const totalCost = (c: CostBreakdown) => Object.values(c).reduce((a, b) => a + b, 0);

/** Group daily rows into calendar months, oldest first. */
export function aggregateMonthly(daily: AirlineDaily[], startYear: number): MonthRow[] {
  const byMonth = new Map<number, MonthRow>();
  for (const d of daily) {
    const date = dateOf(d.day, startYear);
    const key = date.year * 12 + date.month;
    let row = byMonth.get(key);
    if (!row) {
      row = { month: formatMonth(d.day, startYear), revenue: 0, cost: 0, profit: 0, costs: { fuel: 0, crew: 0, maintenance: 0, fees: 0, service: 0, leases: 0, interest: 0, overhead: 0, bases: 0, marketing: 0 } };
      byMonth.set(key, row);
    }
    row.revenue += d.revenue;
    for (const k of Object.keys(d.costs) as (keyof CostBreakdown)[]) row.costs[k] += d.costs[k];
    row.cost += totalCost(d.costs);
  }
  return [...byMonth.entries()].sort((a, b) => a[0] - b[0]).map(([, r]) => ({ ...r, profit: r.revenue - r.cost }));
}
