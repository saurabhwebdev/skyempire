import type { UpcomingPeakView } from '@skyempire/shared';
import { formatDayMonth } from '@skyempire/sim';
import { Button, EmptyState, NumberInput, Panel, useToast } from '@skyempire/ui';
import { CalendarDays, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { useGameStore } from '../../store';
import { defaultPeakPct, peakFareCommands, routesForPeak } from './peakFares';

/** Raise fares on every route to a peak's countries for the peak dates. */
function RaiseFares({ peak, onDone }: { peak: UpcomingPeakView; onDone(): void }) {
  const view = useGameStore((s) => s.view)!;
  const toast = useToast();
  const [pct, setPct] = useState(defaultPeakPct(peak.peak));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const routes = routesForPeak(view.routes, peak);
  if (routes.length === 0) return <p className="mt-2 text-[13px] text-muted">None of your routes fly there yet.</p>;
  const apply = async () => {
    setBusy(true);
    let added = 0, skipped = 0;
    // One route at a time, reading today's date each time: a day can pass while the game runs.
    for (const route of routes) {
      const now = useGameStore.getState().view ?? view;
      const fresh = now.routes.find((x) => x.id === route.id) ?? route;
      const { commands, skipped: s } = peakFareCommands([fresh], peak, pct, now.day);
      skipped += s;
      for (const c of commands) {
        const r = await window.game.command(c);
        if (r.ok) added++;
        else toast({ title: r.reason, tone: 'danger' });
      }
    }
    setBusy(false);
    setResult(`Added to ${added} route${added === 1 ? '' : 's'}${skipped ? ` · skipped ${skipped} (already set)` : ''}`);
    if (added) toast({ title: `${peak.name}: fares ${pct >= 0 ? '+' : ''}${pct}% on ${added} route${added === 1 ? '' : 's'}`, tone: 'success' });
  };
  return (
    <div className="mt-2 flex flex-col gap-2 rounded-md border border-border bg-surface-2 p-3">
      <p className="text-[13px] text-muted">{routes.length} of your routes fly to these countries. The fare change applies over the peak dates.</p>
      <div className="flex items-end gap-2">
        <NumberInput label="Fare change" suffix="%" value={pct} min={-50} max={100} step={1} onChange={setPct} className="w-32" />
        <Button variant="primary" size="sm" loading={busy} onClick={apply}>Apply to {routes.length} route{routes.length === 1 ? '' : 's'}</Button>
        <Button variant="ghost" size="sm" onClick={onDone}>Close</Button>
      </div>
      {result && <p role="status" className="text-[13px] text-success">{result}</p>}
    </div>
  );
}

/** Festivals in the player's markets over the next 60 days: the moments to add capacity or raise fares. */
export function PeaksCard() {
  const view = useGameStore((s) => s.view)!;
  const peaks = view.upcomingPeaks;
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Panel title="Travel peaks ahead">
      {peaks.length === 0 ? (
        <EmptyState icon={<CalendarDays />} text="No big travel peaks in the next 60 days." />
      ) : (
        <ul className="flex flex-col gap-3">
          {peaks.slice(0, 4).map((p) => {
            const now = view.day >= p.startDay && view.day <= p.endDay;
            return (
              <li key={`${p.name}-${p.startDay}`} className="flex items-start gap-3">
                <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-medium">{p.name}</span>
                    {now ? (
                      <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">Now</span>
                    ) : (
                      <span className="num shrink-0 text-[12px] text-muted">{formatDayMonth(p.startDay, view.startYear)} – {formatDayMonth(p.endDay, view.startYear)}</span>
                    )}
                  </div>
                  {now && <span className="num text-[12px] text-muted">{formatDayMonth(p.startDay, view.startYear)} – {formatDayMonth(p.endDay, view.startYear)}</span>}
                  <p className="truncate text-[13px] text-muted">+{Math.round(p.peak * 100)}% leisure demand · {p.countries.slice(0, 4).join(', ')}{p.countries.length > 4 ? ` +${p.countries.length - 4}` : ''}</p>
                  {open === `${p.name}-${p.startDay}` ? (
                    <RaiseFares peak={p} onDone={() => setOpen(null)} />
                  ) : (
                    <button type="button" aria-label={`Raise fares for ${p.name}`} onClick={() => setOpen(`${p.name}-${p.startDay}`)}
                      className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-accent hover:underline">
                      <TrendingUp className="size-3.5" aria-hidden /> Raise fares
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-[12px] text-faint">Raise fares for a peak on all your routes at once, or set them per route in the route editor.</p>
    </Panel>
  );
}
