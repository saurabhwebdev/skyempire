import { formatMoney, formatPct } from '@skyempire/shared';
import { distanceKm } from '@skyempire/sim';
import { Button, KpiTile, Modal, useToast } from '@skyempire/ui';
import { useState } from 'react';
import { catalog } from '../../lib/catalog';
import { aircraftLabel } from '../../lib/fleet';
import { useGameStore, useUi } from '../../store';
import { Profit } from './NetworkTray';
import { SeasonalFares } from './SeasonalFares';

export function RouteInspector({ id }: { id: string }) {
  const view = useGameStore((s) => s.view)!;
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const r = view.routes.find((x) => x.id === id);
  if (!r) return <p className="text-muted">This route no longer exists.</p>;
  const a = catalog.airports[r.from]!, b = catalog.airports[r.to]!;
  const freq = r.assignments.reduce((s, x) => s + x.roundTripsPerWeek, 0);
  const p30 = r.profit30.reduce((s, x) => s + x, 0);
  const closeRoute = async () => {
    const res = await window.game.command({ type: 'closeRoute', routeId: r.id });
    setConfirm(false);
    if (res.ok) {
      toast({ title: `Route ${r.from}–${r.to} closed`, tone: 'info' });
      useUi.getState().select(null);
    } else toast({ title: res.reason, tone: 'danger' });
  };
  return (
    <div className="flex flex-col gap-5">
      <header>
        <span className="label-caps">Route</span>
        <h2 className="mt-1 font-mono text-[24px] font-semibold">{r.from} → {r.to}</h2>
        <p className="text-muted">{a.city} – {b.city} · {Math.round(distanceKm(a, b)).toLocaleString('en-US')} km</p>
        {r.status === 'suspended' && <p className="mt-2 rounded-md bg-warning/10 p-2 text-[13px] text-warning">Suspended — assign an aircraft to fly it again.</p>}
      </header>
      <div className="grid grid-cols-2 gap-4">
        <KpiTile label="Load" value={r.last ? formatPct(r.last.loadFactor) : '—'} />
        <KpiTile label="Profit/day" value={r.last ? <Profit value={r.last.profit} /> : '—'} />
        <KpiTile label="30-day profit" value={formatMoney(p30)} sparkline={r.profit30} className="col-span-2" />
      </div>
      <dl className="grid grid-cols-2 gap-y-2 text-[13px]">
        <dt className="text-muted">Flights</dt><dd className="num text-right">{freq} round trips/wk</dd>
        <dt className="text-muted">Economy fare</dt><dd className="num text-right">{formatMoney(r.fares.economy)}</dd>
        <dt className="text-muted">Premium / Business</dt><dd className="num text-right">{formatMoney(r.fares.premium)} / {formatMoney(r.fares.business)}</dd>
        <dt className="text-muted">Revenue/day</dt><dd className="num text-right">{r.last ? formatMoney(r.last.revenue) : '—'}</dd>
        <dt className="text-muted">Aircraft</dt>
        <dd className="text-right">{r.assignments.map((x) => { const ac = view.aircraft.find((y) => y.id === x.aircraftId); return ac ? <div key={x.aircraftId}>{aircraftLabel(ac)}</div> : null; })}</dd>
      </dl>
      <SeasonalFares route={r} />
      <div className="flex flex-col gap-2">
        <Button variant="primary" onClick={() => useUi.getState().openRouteEditor({ routeId: r.id })}>Edit route</Button>
        <Button variant="ghost" onClick={() => setConfirm(true)}>Close route</Button>
      </div>
      <Modal open={confirm} onOpenChange={setConfirm} title={`Close ${r.from}–${r.to}?`} description="Its slots will be released and its aircraft freed up."
        footer={<><Button variant="ghost" onClick={() => setConfirm(false)}>Keep route</Button><Button variant="danger" onClick={closeRoute}>Close route</Button></>} />
    </div>
  );
}
