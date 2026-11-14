import type { CabinClass, CabinConfig, ClassProduct, Ife, Meal } from '@skyempire/shared';
import { formatMoney } from '@skyempire/shared';
import {
  ALLOWED_MEALS, checkConfig, configUnits, ifeCostPerBlockHour, perPaxServiceCost, productScore, refitCost, refitDays, upgradeCost,
} from '@skyempire/sim';
import { Button, cn, Modal, NumberInput, useToast } from '@skyempire/ui';
import { useEffect, useState, type ReactNode } from 'react';
import { SeatMap } from '../../components/SeatMap';
import { cabinPresets, economyAbreast, rowShape } from '../../lib/aircraftMedia';
import { catalog } from '../../lib/catalog';
import { useGameStore } from '../../store';

export type DesignerMode = { kind: 'new'; confirmLabel: string } | { kind: 'refit'; current: CabinConfig };

export interface CabinDesignerProps {
  open: boolean;
  typeId: string;
  initial: CabinConfig;
  mode: DesignerMode;
  onConfirm(config: CabinConfig): void | Promise<void>;
  onOpenChange(open: boolean): void;
}

const CLASSES: { id: CabinClass; label: string }[] = [
  { id: 'economy', label: 'Economy' }, { id: 'premium', label: 'Premium' }, { id: 'business', label: 'Business' },
];
const SEATS: Record<CabinClass, { id: string; label: string; hint: string }[]> = {
  economy: [
    { id: 'slimline', label: 'Slimline', hint: '28–29" legroom · fits more seats' },
    { id: 'standard', label: 'Standard', hint: '31" legroom' },
    { id: 'extraLegroom', label: 'Extra legroom', hint: '34" legroom · fewer seats' },
  ],
  premium: [
    { id: 'recliner', label: 'Recliner', hint: '38" legroom, wider seat' },
    { id: 'legRest', label: 'Recliner with leg rest', hint: '40" legroom' },
  ],
  business: [
    { id: 'recliner', label: 'Recliner', hint: 'Wide seat, deep recline' },
    { id: 'angled', label: 'Angled lie-flat', hint: 'Sleeps at a slight angle' },
    { id: 'flat', label: 'Full-flat bed', hint: 'Flat bed, aisle access' },
    { id: 'suite', label: 'Private suite', hint: 'Flat bed with a door' },
  ],
};
const IFE: { id: Ife; label: string }[] = [
  { id: 'none', label: 'None' }, { id: 'wifi', label: 'Wi-Fi streaming' }, { id: 'seatback', label: 'Seatback screens' }, { id: 'premium', label: 'Big screens + free Wi-Fi' },
];
const MEALS: Record<Meal, string> = { none: 'No meal', buyOnBoard: 'Buy on board', snack: 'Free snack', hot: 'Hot meal', dining: 'Dining', chef: 'Chef-designed dining' };
/** Typical block hours, for the comfort score shown while designing. */
const TYPICAL_H = { turboprop: 1, regional: 1.5, narrowbody: 2.5, longNarrowbody: 6, widebody: 9 } as const;

function Choice<T extends string>({ label, options, value, onChange }: { label: string; options: { id: T; label: string; hint?: string }[]; value: T; onChange(v: T): void }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-[13px] text-muted">{label}</legend>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
        {options.map((o) => (
          <button key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)}
            className={cn('flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left text-[13px] transition-colors duration-150',
              value === o.id ? 'border-accent bg-surface-2' : 'border-border hover:border-border-strong')}>
            <span className="font-semibold">{o.label}</span>
            {o.hint && <span className="text-[12px] text-faint">{o.hint}</span>}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Check({ label, checked, onChange }: { label: ReactNode; checked: boolean; onChange(v: boolean): void }) {
  return (
    <label className="inline-flex items-center gap-2 text-[13px]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
      {label}
    </label>
  );
}

/** Design a cabin: up to three classes, each with its seat, screens, meals and extras. */
export function CabinDesigner({ open, typeId, initial, mode, onConfirm, onOpenChange }: CabinDesignerProps) {
  const t = catalog.aircraftTypes[typeId]!;
  const toast = useToast();
  const templates = useGameStore((s) => s.view?.player.cabinTemplates ?? []).filter((x) => x.typeId === typeId);
  const [config, setConfig] = useState<CabinConfig>(initial);
  const [tab, setTab] = useState<CabinClass>('economy');
  const [busy, setBusy] = useState(false);
  const [layoutName, setLayoutName] = useState('');
  useEffect(() => {
    if (open) { setConfig(structuredClone(initial)); setTab('economy'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, typeId]);

  const p = config.product[tab] as ClassProduct;
  const setProduct = (patch: Partial<ClassProduct>) => setConfig((c) => ({ ...c, product: { ...c.product, [tab]: { ...c.product[tab], ...patch } } }));
  const setSeats = (n: number) => setConfig((c) => ({ ...c, seats: { ...c.seats, [tab]: n } }));
  const problem = checkConfig(config, t);
  const units = configUnits(config, t);
  const seats = config.seats.economy + config.seats.premium + config.seats.business;
  const blockH = TYPICAL_H[t.class];
  const shape = rowShape(t.abreast ?? 6, config.product, economyAbreast(t, config.dense));
  const days = mode.kind === 'refit' ? refitDays(mode.current, config, t) : 0;
  const cost = mode.kind === 'refit' ? refitCost(mode.current, config) : upgradeCost(config);
  const wifiPerH = ifeCostPerBlockHour(config);
  const confirmLabel = mode.kind === 'new' ? mode.confirmLabel : days > 0 ? `Start refit · ${formatMoney(cost)}` : 'Save cabin';

  const saveLayout = async () => {
    const name = layoutName.trim();
    if (!name) return;
    const r = await window.game.command({ type: 'saveCabinTemplate', name, typeId, config });
    if (r.ok) { toast({ title: `Saved layout “${name}”`, tone: 'success' }); setLayoutName(''); } else toast({ title: r.reason, tone: 'danger' });
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} size="lg" title={`${t.name} cabin`}
      description={`Up to three classes in ${t.maxSeats} seat units. Bigger seats take more room.`}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" disabled={!!problem} loading={busy} onClick={async () => { setBusy(true); try { await onConfirm(config); } finally { setBusy(false); } }}>
            {confirmLabel}
          </Button>
        </>
      }>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-muted">Start from</span>
          {cabinPresets(t).map((pr) => <Button key={pr.id} size="sm" variant="ghost" onClick={() => setConfig(structuredClone(pr.config))}>{pr.label}</Button>)}
          {templates.map((x) => <Button key={x.id} size="sm" onClick={() => setConfig(structuredClone(x.config))}>{x.name}</Button>)}
        </div>

        <div role="tablist" aria-label="Cabin class" className="flex rounded-md border border-border p-0.5 self-start">
          {CLASSES.map((c) => (
            <button key={c.id} type="button" role="tab" aria-selected={tab === c.id} onClick={() => setTab(c.id)}
              className={cn('flex h-8 items-center gap-2 rounded-[6px] px-3 text-[13px] font-semibold', tab === c.id ? 'bg-surface-3 text-text' : 'text-muted hover:text-text')}>
              {c.label}<span className="num text-[12px] font-normal text-faint">{config.seats[c.id]}</span>
            </button>
          ))}
        </div>

        <section role="tabpanel" aria-label={`${CLASSES.find((c) => c.id === tab)!.label} class`} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <NumberInput label={`${CLASSES.find((c) => c.id === tab)!.label} seats`} value={config.seats[tab]} min={0} max={t.maxSeats * 2} onChange={setSeats} className="w-40" />
            <span className="pb-2 text-[13px] text-muted">{shape[tab].join('-')} per row</span>
            {tab === 'economy' && t.denseAbreast && (
              <span className="pb-2"><Check label={`Denser row (${(rowShape(t.abreast!, config.product, t.denseAbreast).economy).join('-')}): more seats, less comfort`} checked={config.dense} onChange={(dense) => setConfig((c) => ({ ...c, dense }))} /></span>
            )}
          </div>
          <Choice label="Seat" options={SEATS[tab]} value={p.seat} onChange={(seat) => setProduct({ seat })} />
          <Choice label="Entertainment" options={IFE} value={p.ife} onChange={(ife) => setProduct({ ife })} />
          <Choice label="Meals" options={ALLOWED_MEALS[tab].map((m) => ({ id: m, label: MEALS[m] }))} value={p.meal} onChange={(meal) => setProduct({ meal })} />
          {tab !== 'economy' && (
            <div className="flex flex-wrap gap-5">
              <Check label="Amenity kit" checked={p.amenityKit} onChange={(amenityKit) => setProduct({ amenityKit })} />
              {tab === 'business' && <Check label="Lounge access" checked={p.lounge} onChange={(lounge) => setProduct({ lounge })} />}
            </div>
          )}
        </section>

        <SeatMap typeId={typeId} config={config} />

        <div className="grid gap-4 rounded-lg border border-border p-4 md:grid-cols-2">
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-[13px]">
            <dt className="text-muted">Seats</dt><dd className="num text-right">{seats}</dd>
            <dt className="text-muted">Seat units</dt><dd className={cn('num text-right', units > t.maxSeats + 1e-9 && 'text-danger')}>{Math.round(units)} / {t.maxSeats}</dd>
            {CLASSES.filter((c) => config.seats[c.id] > 0).map((c) => (
              <div key={c.id} className="contents">
                <dt className="text-muted">{c.label} comfort · cost</dt>
                <dd className="num text-right">{Math.round(productScore(config.product, c.id, config.dense, blockH))}/100 · {formatMoney(Math.round(perPaxServiceCost(config.product, c.id)))}/pax</dd>
              </div>
            ))}
            {wifiPerH > 0 && <><dt className="text-muted">Connectivity</dt><dd className="num text-right">{formatMoney(wifiPerH)}/flight hour</dd></>}
          </dl>
          <div className="flex flex-col gap-2 text-[13px]">
            {mode.kind === 'new'
              ? <p><span className="text-muted">Cabin upgrades over the standard fit: </span><span className="num font-semibold">{formatMoney(cost)}</span></p>
              : days > 0
                ? <p>Refit costs <span className="num font-semibold">{formatMoney(cost)}</span>. The aircraft is out of service for {days} days.</p>
                : <p className="text-muted">No refit needed — meal and extra changes apply from the next flight.</p>}
            <p className="text-[12px] text-faint">Comfort is for a typical {blockH}-hour flight: screens and meals count for more on long flights.</p>
            {problem && <p role="alert" className="text-danger">{problem}</p>}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-[13px]">
            <span className="text-muted">Layout name</span>
            <input value={layoutName} maxLength={40} onChange={(e) => setLayoutName(e.target.value)} placeholder="e.g. Long haul"
              className="h-9 w-56 rounded-md border border-border bg-surface-2 px-3 text-text placeholder:text-faint focus-visible:outline-2 focus-visible:outline-accent" />
          </label>
          <Button disabled={!layoutName.trim() || !!problem} onClick={saveLayout}>Save as layout</Button>
        </div>
      </div>
    </Modal>
  );
}
