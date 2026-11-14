import { routeLabel } from '../../lib/routes';
import { formatMoney, type CabinConfig } from '@skyempire/shared';
import { aircraftMarketValue } from '@skyempire/sim';
import { Button, Meter, Modal, useToast } from '@skyempire/ui';
import { useState } from 'react';
import { AircraftPhoto } from '../../components/AircraftPhoto';
import { catalog } from '../../lib/catalog';
import { aircraftLabel, hoursUsed, WEEKLY_HOURS } from '../../lib/fleet';
import { useGameStore, useUi } from '../../store';
import { AircraftDetails } from './AircraftDetails';
import { CabinDesigner } from './CabinDesigner';
import { aircraftStatus } from './FleetTray';

const SEAT_NAME: Record<string, string> = {
  slimline: 'slimline', standard: 'standard', extraLegroom: 'extra legroom', recliner: 'recliner', legRest: 'leg rest',
  angled: 'angled lie-flat', flat: 'full-flat', suite: 'suites',
};

export function AircraftInspector({ id }: { id: string }) {
  const view = useGameStore((s) => s.view)!;
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [cabinOpen, setCabinOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const ac = view.aircraft.find((a) => a.id === id);
  if (!ac) return <p className="text-muted">This aircraft has left your fleet.</p>;
  const t = catalog.aircraftTypes[ac.typeId]!;
  const freighter = t.kind === 'freighter';
  // Freighter conversions this airline can order for this airliner (Passenger airlines don't fly freighters).
  const targets = view.player.kind !== 'passenger' && !freighter
    ? Object.values(catalog.aircraftTypes).filter((x) => x.conversion?.from.includes(ac.typeId)) : [];
  const convert = async (toTypeId: string) => {
    const r = await window.game.command({ type: 'convertAircraft', aircraftId: id, toTypeId });
    if (r.ok) { setConvertOpen(false); toast({ title: 'Off to the conversion shop', tone: 'success' }); } else toast({ title: r.reason, tone: 'danger' });
  };
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
  const current: CabinConfig = { seats: ac.cabin, product: ac.product, dense: ac.dense };
  const setCabin = async (config: CabinConfig) => {
    const r = await window.game.command({ type: 'setCabin', aircraftId: id, config });
    if (r.ok) { setCabinOpen(false); toast({ title: 'Cabin updated', tone: 'success' }); } else toast({ title: r.reason, tone: 'danger' });
  };
  const product = (['business', 'premium', 'economy'] as const).filter((c) => ac.cabin[c] > 0)
    .map((c) => `${c === 'business' ? 'J' : c === 'premium' ? 'W' : 'Y'}: ${SEAT_NAME[ac.product[c].seat] ?? ac.product[c].seat}`).join(' · ');
  return (
    <div className="flex flex-col gap-5">
      <header>
        <span className="label-caps">{leased ? 'Leased aircraft' : 'Owned aircraft'}</span>
        <h2 className="mt-1 text-[24px] font-semibold tracking-[-0.02em]">{aircraftLabel(ac)}</h2>
        <button type="button" aria-label={`About the ${t.name}`} onClick={() => setAboutOpen(true)} className="mt-3 block w-full overflow-hidden rounded-md focus-visible:outline-2 focus-visible:outline-accent">
          <AircraftPhoto typeId={ac.typeId} className="aspect-[16/9]" />
        </button>
      </header>
      <div className="flex flex-col gap-2">
        <span className="text-[13px] text-muted">Condition</span>
        <Meter label="Condition" value={ac.condition} max={100} tone={ac.condition < 60 ? 'danger' : 'success'} />
        <span className="text-[13px] text-muted">Weekly hours used</span>
        <Meter label="Utilisation" value={used} max={WEEKLY_HOURS} format={(v) => `${Math.round(v)}h`} />
      </div>
      <dl className="grid grid-cols-2 gap-y-2 text-[13px]">
        <dt className="text-muted">Age</dt><dd className="num text-right">{(ac.ageDays / 360).toFixed(1)} years</dd>
        {freighter ? (
          <><dt className="text-muted">Payload</dt><dd className="num text-right">{t.payloadT} t payload</dd></>
        ) : (
          <>
            <dt className="text-muted">Seats</dt><dd className="num text-right">{ac.cabin.business}J · {ac.cabin.premium}W · {ac.cabin.economy}Y</dd>
            <dt className="text-muted">Cabin</dt><dd className="text-right">{product}{ac.dense ? ' · dense' : ''}</dd>
          </>
        )}
        <dt className="text-muted">Range</dt><dd className="num text-right">{t.rangeKm.toLocaleString('en-US')} km</dd>
        <dt className="text-muted">{leased ? 'Lease' : 'Market value'}</dt><dd className="num text-right">{leased ? `${formatMoney(t.leasePerMonth)}/mo` : formatMoney(value)}</dd>
        <dt className="text-muted">Flight hours</dt><dd className="num text-right">{Math.round(ac.flightHours).toLocaleString('en-US')}</dd>
        <dt className="text-muted">Status</dt><dd className="text-right">{aircraftStatus(ac, routes.length ? used : 0, view.day, view.startYear).text}</dd>
      </dl>
      <div>
        <span className="label-caps">Routes</span>
        <ul className="mt-2 flex flex-col gap-1">
          {routes.length ? routes.map((r) => (
            <li key={r.id}><button type="button" className="font-mono text-accent hover:underline" onClick={() => useUi.getState().select({ kind: 'route', id: r.id })}>{routeLabel(r)}</button></li>
          )) : <li className="text-muted">Not assigned. <button type="button" className="text-accent hover:underline" onClick={() => useUi.getState().openRouteEditor({})}>Open a route</button></li>}
        </ul>
      </div>
      <div className="flex flex-col gap-2">
        {!freighter && <Button variant="primary" onClick={() => setCabinOpen(true)}>Design cabin</Button>}
        {targets.length > 0 && <Button onClick={() => setConvertOpen(true)}>Convert to freighter</Button>}
        <Button onClick={() => setAboutOpen(true)}>About the {t.name}</Button>
        <Button variant="ghost" onClick={() => setConfirm(true)}>{leased ? 'Return lease' : `Sell aircraft · ${formatMoney(value)}`}</Button>
      </div>
      <AircraftDetails typeId={ac.typeId} open={aboutOpen} onOpenChange={setAboutOpen} />
      <CabinDesigner open={cabinOpen} onOpenChange={setCabinOpen} typeId={ac.typeId} initial={current} mode={{ kind: 'refit', current }} onConfirm={setCabin} />
      <Modal open={convertOpen} onOpenChange={setConvertOpen} title="Convert to a freighter?"
        description={leased ? 'Only aircraft you own can be converted.' : routes.length ? 'Take it off its routes first: it’s out of service while it’s converted.' : 'It keeps its age and condition, loses its seats, and is out of service while the work is done.'}
        footer={<Button variant="ghost" onClick={() => setConvertOpen(false)}>Cancel</Button>}>
        <ul className="flex flex-col gap-2">
          {targets.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-2 p-3 text-[13px]">
              <span><span className="font-semibold">{x.name}</span><span className="num block text-muted">{x.payloadT} t payload · {x.conversion!.days} days in the shop</span></span>
              <Button size="sm" variant="primary" disabled={leased || routes.length > 0} onClick={() => convert(x.id)}>Convert · {formatMoney(x.conversion!.costUsd)}</Button>
            </li>
          ))}
        </ul>
      </Modal>
      <Modal open={confirm} onOpenChange={setConfirm} title={leased ? 'Return this lease?' : 'Sell this aircraft?'}
        description={routes.length ? 'These routes will be suspended until you assign another aircraft:' : leased ? 'The aircraft goes back to the lessor. No refund.' : `You'll receive ${formatMoney(value)}.`}
        footer={<><Button variant="ghost" onClick={() => setConfirm(false)}>Keep aircraft</Button><Button variant="danger" onClick={remove}>{leased ? 'Return lease' : 'Sell aircraft'}</Button></>}>
        {routes.length > 0 && <ul className="flex flex-col gap-1 font-mono">{routes.map((r) => <li key={r.id}>{routeLabel(r)}</li>)}</ul>}
      </Modal>
    </div>
  );
}
