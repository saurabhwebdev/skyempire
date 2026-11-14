import type { AircraftType, CabinConfig, UsedListing } from '@skyempire/shared';
import { formatMoney } from '@skyempire/shared';
import { dateOf, defaultConfig, tierAllows } from '@skyempire/sim';
import { Button, cn, FilterSelect, ListToolbar, Modal, NoResults, NumberInput, useToast } from '@skyempire/ui';
import { Lock, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { AircraftPhoto } from '../../components/AircraftPhoto';
import { catalog } from '../../lib/catalog';
import { useGameStore, useUi } from '../../store';
import { AircraftDetails } from './AircraftDetails';
import { AIRCRAFT_SORTS, filterAircraftTypes, LISTING_SORTS, sortAircraftTypes, sortListings, type AircraftSort, type ListingSort } from '../../lib/listFilters';
import { CabinDesigner } from './CabinDesigner';

const TYPES = Object.values(catalog.aircraftTypes);
const MAKERS = [...new Set(TYPES.map((t) => t.manufacturer))].sort();
const CLASS_OPTIONS = [
  { id: 'all', label: 'All' }, { id: 'turboprop', label: 'Turboprop' }, { id: 'regional', label: 'Regional jet' },
  { id: 'narrowbody', label: 'Narrowbody' }, { id: 'longNarrowbody', label: 'Long-range narrowbody' }, { id: 'widebody', label: 'Widebody' },
] as const;
const TIER = { startup: 'Startup', regional: 'Regional', national: 'National', global: 'Global' } as const;
type Pending = { kind: 'lease' | 'buy'; type: AircraftType } | { kind: 'used'; type: AircraftType; listing: UsedListing }
  | { kind: 'convert'; type: AircraftType; listing: UsedListing; target: AircraftType };
/** The freighter a passenger type converts into, if any. */
const conversionOf = (typeId: string) => TYPES.find((t) => t.conversion?.from.includes(typeId));

function Spec({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[11px] text-faint">{label}</dt><dd className="num text-[13px]">{value}</dd></div>;
}

/** Full-page aircraft market (new and used). */
export function AircraftMarket() {
  const view = useGameStore((s) => s.view)!;
  const toast = useToast();
  const [tab, setTab] = useState<'new' | 'used'>('new');
  const [minRange, setMinRange] = useState(0);
  const [minSeats, setMinSeats] = useState(0);
  const [query, setQuery] = useState('');
  const [aircraftClass, setAircraftClass] = useState<(typeof CLASS_OPTIONS)[number]['id']>('all');
  const [maker, setMaker] = useState('all');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [sortNew, setSortNew] = useState<AircraftSort>('price');
  const [sortUsed, setSortUsed] = useState<ListingSort>('price');
  const airlineKind = view.player.kind ?? 'passenger';
  const [typeFilter, setTypeFilter] = useState<'all' | 'passenger' | 'freighter'>('all');
  // What this airline may fly: Passenger → airliners, Cargo only → freighters, Passenger + Cargo → the type filter.
  const kindFilter = airlineKind === 'cargo' ? 'freighter' : airlineKind === 'passenger' ? 'passenger' : typeFilter;
  const year = dateOf(view.day, view.startYear).year;
  const clear = () => { setQuery(''); setAircraftClass('all'); setMaker('all'); setAvailableOnly(false); setMinRange(0); setMinSeats(0); };
  const [compare, setCompare] = useState<string[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [details, setDetails] = useState<string | null>(null);
  const close = () => useUi.getState().setMarketOpen(false);
  const filter = { query, aircraftClass, manufacturer: maker, availableOnly, tier: view.player.tier, minRange, minSeats, kind: kindFilter };
  const types = useMemo(() => sortAircraftTypes(filterAircraftTypes(TYPES, filter), sortNew),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, aircraftClass, maker, availableOnly, view.player.tier, minRange, minSeats, sortNew, kindFilter]);
  const allListings = view.market.usedListings;
  // Used aircraft: "what I can fly" means my tier allows the type (used-only types are fine here).
  // A cargo airline also sees used airliners it can buy and convert straight away.
  const okTypes = new Set(filterAircraftTypes(TYPES, { ...filter, availableOnly: false, kind: 'all' })
    .filter((t) => (kindFilter === 'all' || (t.kind === 'freighter') === (kindFilter === 'freighter') || (airlineKind === 'cargo' && !!conversionOf(t.id))))
    .filter((t) => !availableOnly || tierAllows(view.player.tier, t.tier)).map((t) => t.id));
  const listings = sortListings(allListings.filter((l) => okTypes.has(l.typeId)), sortUsed);
  const shown = tab === 'new' ? types.length : listings.length;
  // Out of what this airline may fly (a passenger airline never "filters out" freighters).
  const allowedTotal = TYPES.filter((t) => kindFilter === 'all' || (t.kind === 'freighter') === (kindFilter === 'freighter')).length;
  const total = tab === 'new' ? allowedTotal : allListings.length;

  const confirm = async (config?: CabinConfig) => {
    if (!pending) return;
    const cabin = config ? { config } : {};
    const cmd = pending.kind === 'convert'
      ? ({ type: 'buyUsedAircraft', listingId: pending.listing.id, convertTo: pending.target.id } as const)
      : pending.kind === 'used'
        ? ({ type: 'buyUsedAircraft', listingId: pending.listing.id, ...cabin } as const)
        : ({ type: pending.kind === 'lease' ? 'leaseAircraft' : 'buyAircraft', typeId: pending.type.id, ...cabin } as const);
    const r = await window.game.command(cmd);
    if (!r.ok) { toast({ title: r.reason, tone: 'danger' }); return; }
    toast({ title: pending.kind === 'convert' ? `${pending.type.name} bought: becoming a ${pending.target.name}` : `${pending.type.name} added to your fleet`, tone: 'success' });
    setPending(null);
  };

  const card = (t: AircraftType, extra?: { listing: UsedListing }) => {
    const locked = !tierAllows(view.player.tier, t.tier);
    const freighter = t.kind === 'freighter';
    const fuelPerSeatHour = freighter ? t.fuelKgPerH / (t.payloadT ?? 1) : t.fuelKgPerH / t.maxSeats;
    const coming = !!t.entryYear && t.entryYear > year;
    const convertTo = extra && airlineKind === 'cargo' && !freighter ? conversionOf(t.id) : undefined;
    return (
      <article key={extra?.listing.id ?? t.id} className={cn('flex flex-col gap-3 overflow-hidden rounded-lg border bg-surface-1 p-4', compare.includes(t.id) ? 'border-accent' : 'border-border')}>
        <button type="button" aria-label={`About the ${t.name}`} onClick={() => setDetails(t.id)}
          className="group -mx-4 -mt-4 overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent">
          <AircraftPhoto typeId={t.id} className="aspect-[16/9] transition-transform duration-300 ease-out group-hover:scale-[1.03]" />
        </button>
        <header className="flex items-baseline justify-between gap-2">
          <h3 className="font-semibold">{t.name}</h3>
          {t.usedOnly && !extra && <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">{t.conversion ? 'Conversion' : 'Used only'}</span>}
          {coming && <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">Delivered from {t.entryYear}</span>}
          <span className="text-[12px] text-faint">{t.class === 'longNarrowbody' ? 'long-range narrowbody' : t.class}</span>
        </header>
        <dl className="grid grid-cols-3 gap-2">
          {freighter ? <Spec label="Payload" value={`${t.payloadT} t`} /> : <Spec label="Seats" value={String(t.maxSeats)} />}
          <Spec label="Range" value={`${t.rangeKm.toLocaleString('en-US')} km`} />
          <Spec label={freighter ? 'Fuel/t·h' : 'Fuel/seat·h'} value={`${fuelPerSeatHour.toFixed(1)} kg`} />
          {extra ? (
            <>
              <Spec label="Age" value={`${Math.round(extra.listing.ageDays / 360)} y`} />
              <Spec label="Condition" value={`${extra.listing.condition}%`} />
              <Spec label="Price" value={formatMoney(extra.listing.price)} />
            </>
          ) : (
            <>
              <Spec label="Price" value={formatMoney(t.priceUsd)} />
              <Spec label="Lease" value={`${formatMoney(t.leasePerMonth)}/mo`} />
              <Spec label="Speed" value={`${t.cruiseKmh} km/h`} />
            </>
          )}
        </dl>
        {locked ? (
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
            <p className="inline-flex items-center gap-2 text-[13px] text-faint"><Lock className="size-4" /> Unlocks at {TIER[t.tier]} tier</p>
            <Button size="sm" variant="ghost" onClick={() => setDetails(t.id)}>Details</Button>
          </div>
        ) : (
          <div className="mt-auto flex flex-wrap gap-2">
            {extra && convertTo ? (
              <Button size="sm" variant="primary" onClick={() => setPending({ kind: 'convert', type: t, listing: extra.listing, target: convertTo })}>
                Buy & convert to {convertTo.name} · {formatMoney(extra.listing.price + convertTo.conversion!.costUsd)}
              </Button>
            ) : extra ? (
              <Button size="sm" variant="primary" onClick={() => setPending({ kind: 'used', type: t, listing: extra.listing })}>Buy for {formatMoney(extra.listing.price)}</Button>
            ) : t.conversion ? (
              <p className="text-[13px] text-muted">Convert a {t.conversion.from.map((id) => catalog.aircraftTypes[id]?.name ?? id).join(' or ')} you own, or buy one under Used.</p>
            ) : t.usedOnly ? (
              <p className="text-[13px] text-muted">Out of production — look for it under Used.</p>
            ) : (
              <>
                <Button size="sm" variant="primary" onClick={() => setPending({ kind: 'lease', type: t })}>Lease for {formatMoney(t.leasePerMonth)}/mo</Button>
                <Button size="sm" onClick={() => setPending({ kind: 'buy', type: t })}>Buy for {formatMoney(t.priceUsd)}</Button>
              </>
            )}
            <Button size="sm" variant="ghost" onClick={() => setDetails(t.id)}>Details</Button>
            {!extra && (
              <Button size="sm" variant="ghost" aria-pressed={compare.includes(t.id)} onClick={() => setCompare((c) => (c.includes(t.id) ? c.filter((x) => x !== t.id) : [...c, t.id].slice(-3)))}>
                {compare.includes(t.id) ? 'Remove from compare' : 'Compare'}
              </Button>
            )}
          </div>
        )}
      </article>
    );
  };

  const compared = compare.map((id) => catalog.aircraftTypes[id]!).filter(Boolean);
  return (
    <motion.section aria-label="Aircraft market" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } }}
      className="absolute inset-0 z-30 flex flex-col bg-bg/95 backdrop-blur-md">
      <header className="flex items-center gap-4 border-b border-border px-6 py-4">
        <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Aircraft market</h1>
        <div role="tablist" className="flex rounded-md border border-border p-0.5">
          {(['new', 'used'] as const).map((k) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn('h-8 rounded-[6px] px-3 text-[13px] font-semibold', tab === k ? 'bg-surface-3 text-text' : 'text-muted hover:text-text')}>
              {k === 'new' ? 'New' : `Used (${view.market.usedListings.length})`}
            </button>
          ))}
        </div>
        <span className="num ml-auto text-muted">Cash {formatMoney(view.player.cash)}</span>
        <button type="button" aria-label="Close market" onClick={close} className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-text"><X className="size-5" /></button>
      </header>
      <div className="flex flex-col gap-3 border-b border-border px-6 py-3">
        <ListToolbar search={{ value: query, onChange: setQuery, label: 'Search aircraft', placeholder: 'Name or maker' }}
          sort={tab === 'new'
            ? { value: sortNew, onChange: (v) => setSortNew(v as AircraftSort), options: AIRCRAFT_SORTS }
            : { value: sortUsed, onChange: (v) => setSortUsed(v as ListingSort), options: LISTING_SORTS }}
          shown={shown} total={total} onClear={clear}>
          {airlineKind === 'combination' && (
            <FilterSelect label="Type" value={typeFilter} onChange={setTypeFilter} options={[{ id: 'all', label: 'All' }, { id: 'passenger', label: 'Airliners' }, { id: 'freighter', label: 'Freighters' }]} />
          )}
          <FilterSelect label="Class" value={aircraftClass} onChange={setAircraftClass} options={[...CLASS_OPTIONS]} />
          <FilterSelect label="Maker" value={maker} onChange={setMaker} options={[{ id: 'all', label: 'All' }, ...MAKERS.map((m) => ({ id: m, label: m }))]} />
          <label className="inline-flex items-center gap-2 text-[13px] text-muted">
            <input type="checkbox" checked={availableOnly} onChange={(e) => setAvailableOnly(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
            Only what I can fly now
          </label>
        </ListToolbar>
        <div className="flex gap-4">
          <NumberInput label="Min range (km)" value={minRange} step={500} min={0} max={16000} onChange={setMinRange} className="w-40" />
          <NumberInput label="Min seats" value={minSeats} step={10} min={0} max={450} onChange={setMinSeats} className="w-32" />
        </div>
      </div>
      {shown === 0 && total > 0 ? (
        <div className="flex-1 overflow-y-auto"><NoResults text="No aircraft match these filters." onClear={clear} /></div>
      ) : (
        <div className="grid flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 overflow-y-auto p-6">
          {tab === 'new' ? types.map((t) => card(t)) : listings.map((l) => card(catalog.aircraftTypes[l.typeId]!, { listing: l }))}
        </div>
      )}
      {compared.length > 0 && (
        <footer className="border-t border-border bg-surface-1 px-6 py-3">
          <table className="w-full text-[13px]">
            <thead><tr className="label-caps text-left"><th>Compare</th>{compared.map((t) => <th key={t.id}>{t.name}</th>)}</tr></thead>
            <tbody className="num">
              {([['Seats', (t: AircraftType) => String(t.maxSeats)], ['Range', (t: AircraftType) => `${t.rangeKm.toLocaleString('en-US')} km`],
                ['Lease', (t: AircraftType) => `${formatMoney(t.leasePerMonth)}/mo`], ['Fuel/seat·h', (t: AircraftType) => `${(t.fuelKgPerH / t.maxSeats).toFixed(1)} kg`]] as const).map(([k, f]) => (
                <tr key={k}><td className="text-muted">{k}</td>{compared.map((t) => <td key={t.id}>{f(t)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </footer>
      )}
      {details && <AircraftDetails typeId={details} open onOpenChange={(o) => !o && setDetails(null)} />}
      {pending && (pending.kind === 'convert' || pending.type.kind === 'freighter') && (
        <Modal open onOpenChange={(o) => !o && setPending(null)}
          title={pending.kind === 'convert' ? `Buy this ${pending.type.name} and convert it?` : `${pending.kind === 'lease' ? 'Lease' : 'Buy'} a ${pending.type.name}?`}
          description={pending.kind === 'convert'
            ? `It goes straight to the conversion shop and joins your fleet as a ${pending.target.name} (${pending.target.payloadT} t) after ${pending.target.conversion!.days} days.`
            : `${pending.type.payloadT} t payload · ${pending.type.rangeKm.toLocaleString('en-US')} km range at full payload.${pending.type.entryYear && pending.type.entryYear > year ? ` Delivered on 1 January ${pending.type.entryYear}; no lease payments until then.` : ''}`}
          footer={<>
            <Button variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
            <Button variant="primary" onClick={() => confirm()}>
              {pending.kind === 'convert' ? `Buy & convert · ${formatMoney(pending.listing.price + pending.target.conversion!.costUsd)}`
                : pending.kind === 'lease' ? `Lease for ${formatMoney(pending.type.leasePerMonth)}/mo`
                : `Buy for ${formatMoney(pending.kind === 'used' ? pending.listing.price : pending.type.priceUsd)}`}
            </Button>
          </>} />
      )}
      {pending && pending.kind !== 'convert' && pending.type.kind !== 'freighter' && (
        <CabinDesigner open onOpenChange={(o) => !o && setPending(null)} typeId={pending.type.id}
          initial={defaultConfig(pending.type, null)}
          mode={{ kind: 'new', confirmLabel: (extra) => `${pending.kind === 'lease' ? `Lease for ${formatMoney(pending.type.leasePerMonth)}/mo` : `Buy for ${formatMoney(pending.kind === 'used' ? pending.listing.price : pending.type.priceUsd)}`}${extra ? ` + ${extra}` : ''}` }}
          onConfirm={confirm} />
      )}
    </motion.section>
  );
}
