import { routeChain } from '../../lib/routes';
import { Button, EmptyState, Modal, Panel, useToast } from '@skyempire/ui';
import { Check, Sun } from 'lucide-react';
import { useState } from 'react';
import { catalog } from '../../lib/catalog';
import { dayLabel, SEVERE, WEATHER_ICON, WEATHER_IMPACT, WEATHER_LABEL } from '../../lib/weather';
import { useGameStore } from '../../store';

/** Severe weather at the player's airports over the next 3 days. A cyclone closes the airport: cancelling ahead costs less. */
export function WeatherCard() {
  const view = useGameStore((s) => s.view)!;
  const toast = useToast();
  const [confirm, setConfirm] = useState<{ id: string; day: number; k: number } | null>(null);
  const rows = Object.entries(view.weather.forecast)
    .flatMap(([id, days]) => days.map((cond, i) => ({ id, cond, k: i + 1 })))
    .filter((r) => SEVERE.includes(r.cond))
    .sort((a, b) => a.k - b.k || SEVERE.indexOf(a.cond) - SEVERE.indexOf(b.cond))
    .slice(0, 5);
  const routesAt = (id: string) => view.routes.filter((r) => r.status === 'active' && routeChain(r).includes(id));
  const cancelledAhead = (id: string, day: number) => {
    const rs = routesAt(id);
    return rs.length > 0 && rs.every((r) => view.preCancelled[r.id]?.includes(day));
  };

  const cancelAhead = async () => {
    if (!confirm) return;
    const { id, day } = confirm;
    setConfirm(null);
    let done = 0;
    for (const r of routesAt(id)) if ((await window.game.command({ type: 'preCancel', routeId: r.id, day })).ok) done++;
    toast(done > 0
      ? { title: `Cancelled ${done} route${done === 1 ? '' : 's'} at ${id}`, body: 'Passengers were rebooked early: $5 a seat instead of $20 when the airport closes.', tone: 'info' }
      : { title: 'Too late to cancel ahead', body: 'Flights can be cancelled 1–3 days in advance.', tone: 'warning' });
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
            const day = view.day + r.k;
            const n = routesAt(r.id).length;
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
                {r.cond === 'cyclone' && n > 0 && (cancelledAhead(r.id, day) ? (
                  <span className="inline-flex items-center gap-1 text-[12px] text-muted"><Check className="size-3.5" aria-hidden /> Cancelled ahead</span>
                ) : (
                  <Button size="sm" onClick={() => setConfirm({ id: r.id, day, k: r.k })}>Cancel ahead</Button>
                ))}
              </li>
            );
          })}
        </ul>
      )}
      <Modal open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm ? `Cancel flights at ${confirm.id} ${dayLabel(confirm.k).toLowerCase()}?` : ''}
        description="The airport is expected to close. Cancelling now costs $5 a seat in rebooking instead of $20 a seat for stranded passengers on the day."
        footer={confirm && <><Button variant="ghost" onClick={() => setConfirm(null)}>Keep flights</Button><Button variant="primary" onClick={() => void cancelAhead()}>Cancel {routesAt(confirm.id).length} route{routesAt(confirm.id).length === 1 ? '' : 's'}</Button></>} />
    </Panel>
  );
}
