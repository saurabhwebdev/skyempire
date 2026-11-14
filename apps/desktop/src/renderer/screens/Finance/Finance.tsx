import type { AirlineDaily, CostBreakdown } from '@skyempire/shared';
import { formatMoney, formatPct } from '@skyempire/shared';
import { distanceKm, formatDate } from '@skyempire/sim';
import { Button, EmptyState, KpiTile, Panel, Skeleton } from '@skyempire/ui';
import { ChartColumn } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { catalog } from '../../lib/catalog';
import { useGameStore } from '../../store';
import { aggregateMonthly, totalCost } from './aggregate';
import { LoansCard } from './LoansCard';

// Validated with the dataviz palette checker (dark surface #1b1f26): lightness band, CVD ΔE 21, contrast ≥ 3:1.
const REVENUE = '#2f95cf';
const COSTS = '#c58232';
const AXIS = { stroke: 'var(--text-faint)', fontSize: 12, tickLine: false, axisLine: false } as const;
const GRID = 'color-mix(in oklch, var(--text) 8%, transparent)';
const COST_LABEL: Record<keyof CostBreakdown, string> = {
  fuel: 'Fuel', crew: 'Crew', maintenance: 'Maintenance', fees: 'Airport fees', service: 'Service', leases: 'Leases',
  interest: 'Interest', overhead: 'Overhead', bases: 'Bases', marketing: 'Marketing',
};
const short = (v: number) => formatMoney(v);

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-surface-3 px-3 py-2 text-[13px] shadow-overlay">
      <div className="mb-1 font-semibold">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="num flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} aria-hidden />
          <span className="text-muted">{p.name}</span>
          <span className="ml-auto">{formatMoney(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function Finance() {
  const view = useGameStore((s) => s.view)!;
  const [daily, setDaily] = useState<AirlineDaily[] | null>(null);
  const [asTable, setAsTable] = useState(false);
  useEffect(() => {
    void window.game.history(view.player.id, Math.max(0, view.day - 360), view.day).then(setDaily);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.player.id, Math.floor(view.day / 7)]);

  const months = useMemo(() => aggregateMonthly(daily ?? [], view.startYear).slice(-12), [daily, view.startYear]);
  const last30 = useMemo(() => (daily ?? []).slice(-30), [daily]);
  const rev30 = last30.reduce((s, d) => s + d.revenue, 0);
  const cost30 = last30.reduce((s, d) => s + totalCost(d.costs), 0);
  const costs30 = useMemo(() => {
    const c = Object.fromEntries(Object.keys(COST_LABEL).map((k) => [k, 0])) as unknown as CostBreakdown;
    for (const d of last30) for (const k of Object.keys(c) as (keyof CostBreakdown)[]) c[k] += d.costs[k];
    return (Object.entries(c) as [keyof CostBreakdown, number][]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  }, [last30]);
  const { ask, seats, pax, revDay, costDay } = useMemo(() => {
    let ask = 0, seats = 0, pax = 0, revDay = 0, costDay = 0;
    for (const r of view.routes) {
      if (!r.last || r.last.loadFactor <= 0) continue;
      const p = r.last.pax.economy + r.last.pax.premium + r.last.pax.business;
      const s = p / r.last.loadFactor;
      const d = distanceKm(catalog.airports[r.from]!, catalog.airports[r.to]!);
      ask += s * d; seats += s; pax += p; revDay += r.last.revenue; costDay += r.last.cost;
    }
    return { ask, seats, pax, revDay, costDay };
  }, [view.routes]);

  if (!daily) return <div className="grid gap-4"><Skeleton className="h-28" /><Skeleton className="h-72" /></div>;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-surface-1 p-4 md:grid-cols-5">
        <KpiTile label="Revenue · 30d" value={formatMoney(rev30)} />
        <KpiTile label="Operating margin" value={rev30 ? formatPct((rev30 - cost30) / rev30) : '—'} />
        <KpiTile label="RASK" value={ask ? `${((revDay / ask) * 100).toFixed(1)}¢` : '—'} />
        <KpiTile label="CASK" value={ask ? `${((costDay / ask) * 100).toFixed(1)}¢` : '—'} />
        <KpiTile label="Load factor" value={seats ? formatPct(pax / seats) : '—'} />
      </div>

      <Panel title="Revenue and costs by month" action={<Button size="sm" variant="ghost" onClick={() => setAsTable(!asTable)}>{asTable ? 'Show chart' : 'Show as table'}</Button>}>
        {months.length === 0 ? (
          <EmptyState icon={<ChartColumn />} text="Your monthly results appear here after your first days of flying." />
        ) : asTable ? (
          <table className="num w-full text-[13px]">
            <thead><tr className="label-caps text-left"><th>Month</th><th className="text-right">Revenue</th><th className="text-right">Costs</th><th className="text-right">Profit</th></tr></thead>
            <tbody>{months.map((m) => <tr key={m.month} className="h-8 border-b border-border"><td>{m.month}</td><td className="text-right">{formatMoney(m.revenue)}</td><td className="text-right">{formatMoney(m.cost)}</td><td className="text-right">{formatMoney(m.profit)}</td></tr>)}</tbody>
          </table>
        ) : (
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={months} barGap={2} barCategoryGap="28%">
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="month" {...AXIS} />
                <YAxis tickFormatter={short} width={64} {...AXIS} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'color-mix(in oklch, var(--text) 5%, transparent)' }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 13 }} itemSorter={(i) => (i.dataKey === 'revenue' ? 0 : 1)} formatter={(v) => <span style={{ color: 'var(--text-muted)' }}>{v}</span>} />
                <Bar dataKey="revenue" name="Revenue" fill={REVENUE} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="cost" name="Costs" fill={COSTS} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Cash">
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={daily.map((d) => ({ day: formatDate(d.day, view.startYear), cash: d.cash }))}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="day" {...AXIS} minTickGap={48} />
                <YAxis tickFormatter={short} width={64} {...AXIS} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--text-faint)', strokeDasharray: '3 3' }} />
                <Line dataKey="cash" name="Cash" stroke={REVENUE} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface-1)' }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Where the money went · 30 days">
          {costs30.length === 0 ? <p className="text-muted">No costs yet.</p> : (
            <ul className="flex flex-col gap-2">
              {costs30.map(([k, v]) => (
                <li key={k} className="grid grid-cols-[110px_1fr_72px] items-center gap-3 text-[13px]">
                  <span className="text-muted">{COST_LABEL[k]}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-surface-3"><span className="block h-full rounded-full" style={{ width: `${(v / costs30[0]![1]) * 100}%`, background: COSTS }} /></span>
                  <span className="num text-right">{formatMoney(v)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <LoansCard />
        <Panel title="Company">
          <dl className="grid grid-cols-2 gap-y-2 text-[13px]">
            <dt className="text-muted">Company value</dt><dd className="num text-right">{formatMoney(view.finance.companyValue)}</dd>
            <dt className="text-muted">Monthly fixed costs</dt><dd className="num text-right">{formatMoney(view.finance.monthlyFixed)}</dd>
            <dt className="text-muted">Debt</dt><dd className="num text-right">{formatMoney(view.player.loans.reduce((s, l) => s + l.principal, 0))}</dd>
            <dt className="text-muted">Fuel price</dt><dd className="num text-right">${view.market.fuelPricePerKg.toFixed(2)}/kg</dd>
          </dl>
        </Panel>
      </div>
    </div>
  );
}
