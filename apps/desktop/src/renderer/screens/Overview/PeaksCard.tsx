import { formatDayMonth } from '@skyempire/sim';
import { EmptyState, Panel } from '@skyempire/ui';
import { CalendarDays } from 'lucide-react';
import { useGameStore } from '../../store';

/** Festivals in the player's markets over the next 60 days: the moments to add capacity or raise fares. */
export function PeaksCard() {
  const view = useGameStore((s) => s.view)!;
  const peaks = view.upcomingPeaks;
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
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-[12px] text-faint">Tip: set a seasonal fare on a route to cash in on the rush.</p>
    </Panel>
  );
}
