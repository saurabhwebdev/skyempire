import { formatMoney, formatPax } from '@skyempire/shared';
import { baseSetupCost } from '@skyempire/sim';
import { Button, Modal, useToast } from '@skyempire/ui';
import { useState } from 'react';
import { catalog } from '../../lib/catalog';
import { useGameStore, useUi } from '../../store';

export function AirportInspector({ id }: { id: string }) {
  const view = useGameStore((s) => s.view)!;
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const a = catalog.airports[id];
  if (!a) return null;
  const isBase = view.player.baseIds.includes(id);
  const rivals = new Set(view.rivalRoutes.filter((r) => r.from === id || r.to === id).map((r) => r.airlineId));
  const rivalNames = view.rivals.filter((r) => rivals.has(r.id)).map((r) => r.name);
  const cost = baseSetupCost(catalog, id, view.player.tier);
  const openBase = async () => {
    const r = await window.game.command({ type: 'openBase', airportId: id });
    setConfirm(false);
    toast(r.ok ? { title: `${a.city} is now a base`, tone: 'success' } : { title: r.reason, tone: 'danger' });
  };
  return (
    <div className="flex flex-col gap-5">
      <header>
        <span className="label-caps">{isBase ? 'Your base' : 'Airport'}</span>
        <h2 className="mt-1 text-[24px] font-semibold tracking-[-0.02em]">{a.city} <span className="font-mono text-muted">{a.id}</span></h2>
        <p className="text-muted">{a.name}</p>
      </header>
      <dl className="grid grid-cols-2 gap-y-2 text-[13px]">
        <dt className="text-muted">People nearby</dt><dd className="num text-right">{formatPax(a.population * 1e6)}</dd>
        <dt className="text-muted">Size</dt><dd className="num text-right">{a.sizeClass}/6</dd>
        <dt className="text-muted">Slots free today</dt><dd className="num text-right">{view.slotsFree[id] ?? a.slotCapacity} of {a.slotCapacity}</dd>
        <dt className="text-muted">Fees</dt><dd className="num text-right">${a.landingFeePerTonne}/t · ${a.paxFee}/pax</dd>
        <dt className="text-muted">Rivals here</dt><dd className="text-right">{rivalNames.length ? rivalNames.slice(0, 4).join(', ') + (rivalNames.length > 4 ? ` +${rivalNames.length - 4}` : '') : 'None'}</dd>
      </dl>
      <div className="flex flex-col gap-2">
        {isBase ? (
          <Button variant="primary" onClick={() => useUi.getState().openRouteEditor({ from: id })}>New route from here</Button>
        ) : (
          <>
            <Button variant="primary" onClick={() => useUi.getState().openRouteEditor({ to: id })}>New route to here</Button>
            <Button onClick={() => setConfirm(true)}>Open base here · {formatMoney(cost)}</Button>
          </>
        )}
      </div>
      <Modal open={confirm} onOpenChange={setConfirm} title={`Open a base in ${a.city}?`}
        description={`Costs ${formatMoney(cost)} now plus monthly upkeep. You'll be able to start routes from ${a.id}.`}
        footer={<><Button variant="ghost" onClick={() => setConfirm(false)}>Not now</Button><Button variant="primary" onClick={openBase}>Open base</Button></>} />
    </div>
  );
}
