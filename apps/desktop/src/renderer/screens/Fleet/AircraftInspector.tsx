import { formatMoney, type Cabin } from '@skyempire/shared';
import { aircraftMarketValue } from '@skyempire/sim';
import { Button, Meter, Modal, useToast } from '@skyempire/ui';
import { useState } from 'react';
import { AircraftSilhouette } from '../../components/AircraftSilhouette';
import { catalog } from '../../lib/catalog';
import { aircraftLabel, hoursUsed, WEEKLY_HOURS } from '../../lib/fleet';
import { useGameStore, useUi } from '../../store';
import { CabinEditor } from './CabinEditor';

export function AircraftInspector({ id }: { id: string }) {
  const view = useGameStore((s) => s.view)!;
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [cabinOpen, setCabinOpen] = useState(false);
  const ac = view.aircraft.find((a) => a.id === id);
  if (!ac) return <p className="text-muted">This aircraft has left your fleet.</p>;
  const t = catalog.aircraftTypes[ac.typeId]!;
  const routes = view.routes.filter((r) => r.assignments.some((a) => a.aircraftId === id));
  const used = hoursUsed(view).get(id) ?? 0;
  const leased = ac.ownership === 'leased';
  const value = aircraftMarketValue(t, ac.ageDays, ac.condition);
  const remove = async () => {
    const r = await window.game.command({ type: 'sellAircraft', aircraftId: id });
    setConfirm(false);
    if (r.ok) {
      toast({ title: leased ? 'Lease returned' : `Sold for ${formatMoney(value)}`, tone: 'info' });
      useUi.getState().select(null);
    } else toast({ title: r.reason, tone: 'danger' });
  };
  const setCabin = async (cabin: Cabin) => {
    const r = await window.game.command({ type: 'setCabin', aircraftId: id, cabin });
    if (r.ok) { setCabinOpen(false); toast({ title: 'Cabin updated', tone: 'success' }); } else toast({ title: r.reason, tone: 'danger' });
  };
  return (
    <div className="flex flex-col gap-5">
      <header>
        <span className="label-caps">{leased ? 'Leased aircraft' : 'Owned aircraft'}</span>
        <h2 className="mt-1 text-[24px] font-semibold tracking-[-0.02em]">{aircraftLabel(ac)}</h2>
        <AircraftSilhouette typeId={ac.typeId} className="mt-3 h-14 w-full text-muted" />
      </header>
      <div className="flex flex-col gap-2">
        <span className="text-[13px] text-muted">Condition</span>
        <Meter label="Condition" value={ac.condition} max={100} tone={ac.condition < 60 ? 'danger' : 'success'} />
        <span className="text-[13px] text-muted">Weekly hours used</span>
        <Meter label="Utilisation" value={used} max={WEEKLY_HOURS} format={(v) => `${Math.round(v)}h`} />
      </div>
      <dl className="grid grid-cols-2 gap-y-2 text-[13px]">
        <dt className="text-muted">Age</dt><dd className="num text-right">{(ac.ageDays / 360).toFixed(1)} years</dd>
        <dt className="text-muted">Seats</dt><dd className="num text-right">{ac.cabin.business}J · {ac.cabin.premium}W · {ac.cabin.economy}Y</dd>
        <dt className="text-muted">Range</dt><dd className="num text-right">{t.rangeKm.toLocaleString('en-US')} km</dd>
        <dt className="text-muted">{leased ? 'Lease' : 'Market value'}</dt><dd className="num text-right">{leased ? `${formatMoney(t.leasePerMonth)}/mo` : formatMoney(value)}</dd>
        <dt className="text-muted">Flight hours</dt><dd className="num text-right">{Math.round(ac.flightHours).toLocaleString('en-US')}</dd>
        <dt className="text-muted">Status</dt><dd className="text-right">{ac.status === 'maintenance' ? `Maintenance (${ac.maintenanceDaysLeft}d)` : routes.length ? 'Flying' : 'Idle'}</dd>
      </dl>
      <div>
        <span className="label-caps">Routes</span>
        <ul className="mt-2 flex flex-col gap-1">
          {routes.length ? routes.map((r) => (
            <li key={r.id}><button type="button" className="font-mono text-accent hover:underline" onClick={() => useUi.getState().select({ kind: 'route', id: r.id })}>{r.from} → {r.to}</button></li>
          )) : <li className="text-muted">Not assigned. <button type="button" className="text-accent hover:underline" onClick={() => useUi.getState().openRouteEditor({})}>Open a route</button></li>}
        </ul>
      </div>
      <div className="flex flex-col gap-2">
        <Button variant="primary" onClick={() => setCabinOpen(true)}>Edit cabin</Button>
        <Button variant="ghost" onClick={() => setConfirm(true)}>{leased ? 'Return lease' : `Sell aircraft · ${formatMoney(value)}`}</Button>
      </div>
      <CabinEditor open={cabinOpen} onOpenChange={setCabinOpen} typeId={ac.typeId} initial={ac.cabin} confirmLabel="Save cabin" onConfirm={setCabin} />
      <Modal open={confirm} onOpenChange={setConfirm} title={leased ? 'Return this lease?' : 'Sell this aircraft?'}
        description={routes.length ? 'These routes will be suspended until you assign another aircraft:' : leased ? 'The aircraft goes back to the lessor. No refund.' : `You'll receive ${formatMoney(value)}.`}
        footer={<><Button variant="ghost" onClick={() => setConfirm(false)}>Keep aircraft</Button><Button variant="danger" onClick={remove}>{leased ? 'Return lease' : 'Sell aircraft'}</Button></>}>
        {routes.length > 0 && <ul className="flex flex-col gap-1 font-mono">{routes.map((r) => <li key={r.id}>{r.from} → {r.to}</li>)}</ul>}
      </Modal>
    </div>
  );
}
