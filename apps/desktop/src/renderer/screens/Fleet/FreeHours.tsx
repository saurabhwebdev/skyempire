import type { Aircraft, Command, RouteSuggestion } from '@skyempire/shared';
import { formatMoney } from '@skyempire/shared';
import { Button, EmptyState, Modal, Skeleton, useToast } from '@skyempire/ui';
import { CheckCircle2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { aircraftLabel, hoursUsed, WEEKLY_HOURS } from '../../lib/fleet';
import { useGameStore } from '../../store';

/** Below this share of weekly hours an aircraft has time for another route. */
export const UNDERUSED = 0.7;

export function underusedAircraft(aircraft: Aircraft[], used: Map<string, number>): Aircraft[] {
  return aircraft.filter((a) => (used.get(a.id) ?? 0) / WEEKLY_HOURS < UNDERUSED);
}

const openCmd = (aircraftId: string, s: RouteSuggestion): Command =>
  ({ type: 'openRoute', from: s.from, to: s.to, fares: s.fares, assignments: [{ aircraftId, roundTripsPerWeek: s.roundTripsPerWeek }] });

/** Route suggestions for aircraft with free hours, each one click to open. */
export function FreeHoursDialog({ open, onOpenChange }: { open: boolean; onOpenChange(o: boolean): void }) {
  const view = useGameStore((s) => s.view)!;
  const toast = useToast();
  const free = underusedAircraft(view.aircraft, hoursUsed(view));
  const [suggestions, setSuggestions] = useState<Record<string, RouteSuggestion[] | undefined>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const ids = free.map((a) => a.id).join(',');

  const load = useCallback(async () => {
    const out: Record<string, RouteSuggestion[]> = {};
    for (const id of ids ? ids.split(',') : []) out[id] = await window.game.suggestRoutes(id);
    setSuggestions(out);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, view.routes.length]);
  useEffect(() => { if (open) { setSuggestions({}); void load(); } }, [open, load]);
  useEffect(() => { if (open) setDone(null); }, [open]);

  const openOne = async (acId: string, s: RouteSuggestion) => {
    setBusy(`${acId}:${s.to}`);
    const r = await window.game.command(openCmd(acId, s));
    setBusy(null);
    if (r.ok) toast({ title: `Route ${s.from}–${s.to} opened`, tone: 'success' }); else toast({ title: r.reason, tone: 'danger' });
  };
  const openAll = async () => {
    setBusy('all');
    let n = 0;
    for (const a of free) {
      const [best] = await window.game.suggestRoutes(a.id); // fresh: earlier openings change what's left
      if (!best) continue;
      const r = await window.game.command(openCmd(a.id, best));
      if (r.ok) n++;
    }
    setBusy(null);
    setDone(`Opened ${n} route${n === 1 ? '' : 's'}`);
    void load();
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} size="lg" title="Use free hours"
      description={`Aircraft flying less than ${Math.round(UNDERUSED * 100)}% of their week, with the best new routes from your bases.`}
      footer={<>
        {done && <span role="status" className="mr-auto text-[13px] text-success">{done}</span>}
        <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
        {free.length > 0 && <Button variant="primary" loading={busy === 'all'} disabled={busy !== null && busy !== 'all'} onClick={openAll}>Open best for all</Button>}
      </>}>
      {free.length === 0 ? (
        <EmptyState icon={<CheckCircle2 />} text="All your aircraft are busy. Nothing to fill." />
      ) : (
        <ul className="flex flex-col gap-4">
          {free.map((a) => {
            const used = hoursUsed(view).get(a.id) ?? 0;
            const list = suggestions[a.id];
            return (
              <li key={a.id} className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{aircraftLabel(a)}</span>
                  <span className="num text-[12px] text-muted">{Math.round((used / WEEKLY_HOURS) * 100)}% of the week used</span>
                </div>
                {!list ? <Skeleton className="h-10" /> : list.length === 0 ? (
                  <p className="text-[13px] text-muted">No profitable new route found from your bases. Try a new base or a different aircraft.</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {list.map((s) => (
                      <li key={s.to} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md bg-surface-2 px-3 py-2 text-[13px]">
                        <span className="font-mono">{s.from} → {s.to}</span>
                        <span className="num text-muted">{s.distanceKm.toLocaleString('en-US')} km · {s.roundTripsPerWeek}/wk · {Math.round(s.expectedLoadFactor * 100)}% full</span>
                        <span className="num text-success">+{formatMoney(Math.round(s.expectedProfitPerDay))}/day</span>
                        <Button size="sm" className="ml-auto" aria-label={`Open ${s.from} → ${s.to} with ${aircraftLabel(a)}`}
                          loading={busy === `${a.id}:${s.to}`} disabled={busy !== null} onClick={() => openOne(a.id, s)}>Open</Button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
