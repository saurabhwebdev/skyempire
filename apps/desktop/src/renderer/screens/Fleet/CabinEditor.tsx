import type { Cabin } from '@skyempire/shared';
import { seatUnits } from '@skyempire/sim';
import { Button, Modal, NumberInput } from '@skyempire/ui';
import { useEffect, useState } from 'react';
import { catalog } from '../../lib/catalog';

export interface CabinEditorProps {
  open: boolean;
  typeId: string;
  initial: Cabin;
  confirmLabel: string;
  onConfirm(cabin: Cabin): void | Promise<void>;
  onOpenChange(open: boolean): void;
}

/** Split seats between cabins. Business seats take 2.5 units, premium 1.5. */
export function CabinEditor({ open, typeId, initial, confirmLabel, onConfirm, onOpenChange }: CabinEditorProps) {
  const t = catalog.aircraftTypes[typeId]!;
  const [cabin, setCabin] = useState<Cabin>(initial);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setCabin(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, typeId]);
  const units = seatUnits(cabin);
  const over = units > t.maxSeats;
  const seats = cabin.economy + cabin.premium + cabin.business;
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={`${t.name} cabin`}
      description={`${t.maxSeats} seat units. Business seats use 2.5 units, premium 1.5.`}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" disabled={over || seats === 0} loading={busy} onClick={async () => { setBusy(true); try { await onConfirm(cabin); } finally { setBusy(false); } }}>
            {confirmLabel}
          </Button>
        </>
      }>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-3">
          <NumberInput label="Business seats" value={cabin.business} min={0} max={200} onChange={(v) => setCabin({ ...cabin, business: v })} />
          <NumberInput label="Premium seats" value={cabin.premium} min={0} max={300} onChange={(v) => setCabin({ ...cabin, premium: v })} />
          <NumberInput label="Economy seats" value={cabin.economy} min={0} max={t.maxSeats} onChange={(v) => setCabin({ ...cabin, economy: v })} />
        </div>
        <div>
          <div className="mb-1 flex justify-between text-[13px]">
            <span className="text-muted">{seats} seats</span>
            <span className={over ? 'num text-danger' : 'num text-muted'}>{Math.round(units)} / {t.maxSeats} units</span>
          </div>
          <div className="flex h-2 overflow-hidden rounded-full bg-surface-3" aria-hidden>
            <div className="bg-warning" style={{ width: `${(cabin.business * 2.5 / Math.max(units, t.maxSeats)) * 100}%` }} />
            <div className="bg-success" style={{ width: `${(cabin.premium * 1.5 / Math.max(units, t.maxSeats)) * 100}%` }} />
            <div className="bg-accent" style={{ width: `${(cabin.economy / Math.max(units, t.maxSeats)) * 100}%` }} />
          </div>
          {over && <p role="alert" className="mt-2 text-[13px] text-danger">Too many seats — max {t.maxSeats} seat units</p>}
        </div>
        <Button size="sm" variant="ghost" className="self-start" onClick={() => setCabin({ economy: t.maxSeats, premium: 0, business: 0 })}>Reset to all economy</Button>
      </div>
    </Modal>
  );
}
