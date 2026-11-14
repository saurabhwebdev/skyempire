import { formatMoney } from '@skyempire/shared';
import { Button, cn, Modal } from '@skyempire/ui';
import { useState, type ReactNode } from 'react';
import { AircraftPhoto } from '../../components/AircraftPhoto';
import { SeatMap } from '../../components/SeatMap';
import { cabinPresets, detailsOf } from '../../lib/aircraftMedia';
import { catalog } from '../../lib/catalog';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CLASS = { turboprop: 'Turboprop', regional: 'Regional jet', narrowbody: 'Narrowbody', longNarrowbody: 'Long-range narrowbody', widebody: 'Widebody' } as const;

function Row({ label, children }: { label: string; children: ReactNode }) {
  return <><dt className="text-muted">{label}</dt><dd className="num text-right">{children}</dd></>;
}

/** The aircraft page: real photo, real-world specs, in-game numbers and typical cabin layouts. */
export function AircraftDetails({ typeId, open, onOpenChange, actions }: { typeId: string; open: boolean; onOpenChange(o: boolean): void; actions?: ReactNode }) {
  const t = catalog.aircraftTypes[typeId]!;
  const d = detailsOf(typeId);
  const presets = d ? cabinPresets(t) : [];
  const [preset, setPreset] = useState<string>(presets[1]?.id ?? 'economy');
  const shown = presets.find((p) => p.id === preset) ?? presets[0];
  const ff = d ? `${MONTHS[Number(d.firstFlight.slice(5, 7)) - 1]} ${d.firstFlight.slice(0, 4)}` : '';
  return (
    <Modal open={open} onOpenChange={onOpenChange} size="lg" title={t.name}
      description={`${t.manufacturer} · ${CLASS[t.class]}${t.usedOnly ? ' · out of production' : ''}`}
      footer={<>{actions}<Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button></>}>
      <div className="flex flex-col gap-6">
        <AircraftPhoto typeId={typeId} credit eager className="aspect-[16/9] rounded-lg" />
        <div className="grid gap-6 md:grid-cols-2">
          <section aria-labelledby="ad-real">
            <h3 id="ad-real" className="label-caps">Real-world specs</h3>
            {d ? (
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
                <Row label="Length">{d.lengthM.toFixed(1)} m</Row>
                <Row label="Wingspan">{d.spanM.toFixed(1)} m</Row>
                <Row label="Height">{d.heightM.toFixed(1)} m</Row>
                <Row label="Max take-off weight">{t.mtowT.toLocaleString('en-US')} t</Row>
                <dt className="text-muted">Engines</dt><dd className="text-right">{d.engines}</dd>
                <Row label="First flight">{ff}</Row>
                <Row label="Typical seating">{d.typicalSeats}</Row>
                <Row label="Economy row">{d.abreast} abreast</Row>
              </dl>
            ) : <p className="mt-2 text-muted">No details for this type.</p>}
            {d && <p className="mt-2 text-[11px] text-faint">Source: <a href={d.source} target="_blank" rel="noreferrer" className="underline decoration-dotted hover:text-muted">Wikipedia</a></p>}
          </section>
          <section aria-labelledby="ad-game">
            <h3 id="ad-game" className="label-caps">In SkyEmpire</h3>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
              <Row label="Max seat units">{t.maxSeats}</Row>
              <Row label="Range">{t.rangeKm.toLocaleString('en-US')} km</Row>
              <Row label="Cruise speed">{t.cruiseKmh} km/h</Row>
              <Row label="Fuel burn">{t.fuelKgPerH.toLocaleString('en-US')} kg/h</Row>
              <Row label="Min runway">{t.minRunwayM.toLocaleString('en-US')} m</Row>
              <Row label="Turnaround">{t.turnaroundMin} min</Row>
              <Row label="Price new">{t.usedOnly ? 'Used only' : formatMoney(t.priceUsd)}</Row>
              <Row label="Lease">{formatMoney(t.leasePerMonth)}/mo</Row>
            </dl>
          </section>
        </div>
        {d && shown && (
          <section aria-labelledby="ad-cabin">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id="ad-cabin" className="label-caps">Cabin layouts</h3>
              <div role="tablist" aria-label="Cabin layout" className="flex rounded-md border border-border p-0.5">
                {presets.map((p) => (
                  <button key={p.id} type="button" role="tab" aria-selected={shown.id === p.id} onClick={() => setPreset(p.id)}
                    className={cn('h-7 rounded-[6px] px-3 text-[12px] font-semibold', shown.id === p.id ? 'bg-surface-3 text-text' : 'text-muted hover:text-text')}>{p.label}</button>
                ))}
              </div>
            </div>
            <SeatMap typeId={typeId} config={shown.config} className="mt-3" />
            <p className="mt-1 text-[11px] text-faint">A typical layout for this aircraft, not a specific airline's seat map. You choose your own when you lease or buy.</p>
          </section>
        )}
      </div>
    </Modal>
  );
}
