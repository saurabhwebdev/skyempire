import { Button, EmptyState, Panel, useToast } from '@skyempire/ui';
import { Sun } from 'lucide-react';
import { catalog } from '../../lib/catalog';
import { dayLabel, SEVERE, WEATHER_ICON, WEATHER_IMPACT, WEATHER_LABEL } from '../../lib/weather';
import { useGameStore } from '../../store';

/** Severe weather at the player's airports over the next 3 days, with a cheaper "cancel ahead" option. */
export function WeatherCard() {
  const view = useGameStore((s) => s.view)!;
  const toast = useToast();
  const rows = Object.entries(view.weather.forecast)
    .flatMap(([id, days]) => days.map((cond, i) => ({ id, cond, k: i + 1 })))
    .filter((r) => SEVERE.includes(r.cond))
    .sort((a, b) => a.k - b.k || SEVERE.indexOf(a.cond) - SEVERE.indexOf(b.cond))
    .slice(0, 5);

  const cancelAhead = async (airportId: string, k: number) => {
    const routes = view.routes.filter((r) => r.status === 'active' && (r.from === airportId || r.to === airportId));
    let done = 0;
    for (const r of routes) if ((await window.game.command({ type: 'preCancel', routeId: r.id, day: view.day + k })).ok) done++;
    toast({ title: `Cancelled ${done} route${done === 1 ? '' : 's'} at ${airportId} ${dayLabel(k).toLowerCase()}`, body: 'Passengers were told early, so it costs less than cancelling on the day.', tone: 'info' });
  };

  return (
    <Panel title="Weather watch">
      {rows.length === 0 ? (
        <EmptyState icon={<Sun />} text="Clear skies across your network." />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => {
            const Icon = WEATHER_ICON[r.cond];
            const a = catalog.airports[r.id];
            return (
              <li key={`${r.id}-${r.k}`} className="flex items-center gap-3 rounded-md bg-surface-2 p-3">
                <Icon className={r.cond === 'cyclone' ? 'size-5 shrink-0 text-danger' : 'size-5 shrink-0 text-warning'} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium">{WEATHER_LABEL[r.cond]}</span>
                    <span className="truncate text-[13px] text-muted">{a?.city ?? r.id} <span className="font-mono">{r.id}</span></span>
                  </div>
                  <p className="text-[12px] text-muted">{dayLabel(r.k)} · {WEATHER_IMPACT[r.cond]}</p>
                </div>
                <Button size="sm" onClick={() => void cancelAhead(r.id, r.k)}>Cancel ahead</Button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
