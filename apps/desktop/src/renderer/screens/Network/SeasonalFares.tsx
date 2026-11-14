import type { Route, SeasonalFare } from '@skyempire/shared';
import { dateOf, dayOf, formatDayMonth } from '@skyempire/sim';
import { Button, NumberInput, useToast } from '@skyempire/ui';
import { X } from 'lucide-react';
import { useId, useState } from 'react';
import { useGameStore } from '../../store';

const MAX_PERIODS = 4;
const parseIso = (iso: string, startYear: number) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? dayOf(+iso.slice(0, 4), +iso.slice(5, 7), +iso.slice(8, 10), startYear) : NaN);

/** Raise or cut fares for a date range — e.g. +20% over Christmas. */
export function SeasonalFares({ route }: { route: Route }) {
  const view = useGameStore((s) => s.view)!;
  const toast = useToast();
  const fromId = useId(), toId = useId();
  const periods = route.seasonalFares ?? [];
  const [from, setFrom] = useState(() => dateOf(view.day + 1, view.startYear).iso);
  const [to, setTo] = useState(() => dateOf(view.day + 7, view.startYear).iso);
  const [pct, setPct] = useState(10);
  const startDay = parseIso(from, view.startYear), endDay = parseIso(to, view.startYear);
  const error = Number.isNaN(startDay) || Number.isNaN(endDay) ? 'Pick both dates'
    : startDay < view.day ? 'Start today or later'
    : endDay < startDay ? 'End on or after the start'
    : periods.length >= MAX_PERIODS ? `Up to ${MAX_PERIODS} periods per route` : null;

  const save = async (next: SeasonalFare[]) => {
    const r = await window.game.command({ type: 'updateRoute', routeId: route.id, seasonalFares: next });
    if (!r.ok) toast({ title: r.reason, tone: 'danger' });
  };
  const label = (p: SeasonalFare) => `${formatDayMonth(p.startDay, view.startYear)} – ${formatDayMonth(p.endDay, view.startYear)}`;

  return (
    <section className="flex flex-col gap-3" aria-label="Seasonal fares">
      <h3 className="label-caps">Seasonal fares</h3>
      {periods.length > 0 && (
        <ul className="flex flex-col gap-1">
          {periods.map((p) => (
            <li key={`${p.startDay}-${p.endDay}`} className="flex items-center justify-between gap-2 rounded-md bg-surface-2 px-3 py-1.5 text-[13px]">
              <span className="num">{label(p)}</span>
              <span className="flex items-center gap-2">
                <span className={p.pct >= 0 ? 'num text-success' : 'num text-warning'}>{p.pct >= 0 ? '+' : ''}{p.pct}%</span>
                <button type="button" aria-label={`Remove ${label(p)}`} className="rounded p-0.5 text-muted hover:text-text focus-visible:outline-2 focus-visible:outline-accent"
                  onClick={() => void save(periods.filter((x) => x !== p))}><X className="size-3.5" /></button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-2 gap-2">
        <label htmlFor={fromId} className="flex flex-col gap-1 text-[12px] text-muted">From
          <input id={fromId} type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded-md border border-border bg-surface-1 px-2 text-[13px] text-text" />
        </label>
        <label htmlFor={toId} className="flex flex-col gap-1 text-[12px] text-muted">To
          <input id={toId} type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-md border border-border bg-surface-1 px-2 text-[13px] text-text" />
        </label>
      </div>
      <NumberInput label="Fare change" value={pct} onChange={setPct} min={-50} max={100} step={5} suffix="%" error={error ?? undefined} />
      <Button size="sm" disabled={error !== null} onClick={() => void save([...periods, { startDay, endDay, pct }])}>Add seasonal fare</Button>
    </section>
  );
}
