import type { Airport, Assignment, CabinClass, Command, PreviewResult } from '@skyempire/shared';
import { formatMoney, formatPct } from '@skyempire/shared';
import { distanceKm, refFare, roundTripHours } from '@skyempire/sim';
import { Button, cn, Combobox, NumberInput, Slider, useToast } from '@skyempire/ui';
import { ChevronDown, ChevronRight, Plus, Trash2, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { catalog } from '../../lib/catalog';
import { aircraftLabel, hoursUsed, WEEKLY_HOURS } from '../../lib/fleet';
import { useGameStore, useUi } from '../../store';
import { airportFilter, airportRank } from '../NewAirline/NewAirline';
import { routeLabel, routeLegs, routeMarkets, pairKey } from '../../lib/routes';

const AIRPORTS = Object.values(catalog.airports).sort((a, b) => b.population - a.population);
type Fares = Record<CabinClass, number>;

/** Create or edit a route with a live profit preview (docs/ui-ux-design.md §4.4). */
export function RouteEditor() {
  const editor = useUi((s) => s.routeEditor);
  return editor ? <RouteEditorPanel editor={editor} /> : null;
}

function RouteEditorPanel({ editor }: { editor: NonNullable<ReturnType<typeof useUi.getState>['routeEditor']> }) {
  const close = () => useUi.getState().openRouteEditor(null);
  const view = useGameStore((s) => s.view)!;
  const toast = useToast();
  const existing = editor.routeId ? view.routes.find((r) => r.id === editor.routeId) : undefined;
  const bases = view.player.baseIds;

  const [from, setFrom] = useState(existing?.from ?? editor.from ?? view.player.homeBaseId);
  const [to, setTo] = useState<string | undefined>(existing?.to ?? editor.to);
  // Up to 2 stops; undefined = a stop row whose airport isn't chosen yet.
  const [stops, setStops] = useState<(string | undefined)[]>(() => existing?.stops ?? []);
  const chosenStops = stops.filter((x): x is string => !!x);
  const stopsReady = stops.every(Boolean);
  const chain = { from, to: to ?? '', stops: chosenStops };
  const markets = to ? routeMarkets(chain) : [];
  const used = useMemo(() => hoursUsed(view, existing?.id), [view, existing?.id]);
  const [assignments, setAssignments] = useState<Assignment[]>(() => {
    if (existing?.assignments.length) return existing.assignments.map((a) => ({ ...a }));
    const free = [...view.aircraft].sort((a, b) => (used.get(a.id) ?? 0) - (used.get(b.id) ?? 0))[0];
    return free ? [{ aircraftId: free.id, roundTripsPerWeek: 7 }] : [];
  });
  const dist = to && catalog.airports[from] && catalog.airports[to] ? distanceKm(catalog.airports[from]!, catalog.airports[to]!) : 0;
  const legKm = to ? routeLegs(chain).map(([x, y]) => (catalog.airports[x] && catalog.airports[y] ? distanceKm(catalog.airports[x]!, catalog.airports[y]!) : 0)) : [];
  const flownKm = legKm.reduce((a, b) => a + b, 0);
  const [legFares, setLegFares] = useState<Record<string, Fares>>(() => existing?.legFares ?? {});
  const [fares, setFares] = useState<Fares>(() => existing?.fares ?? { economy: 0, premium: 0, business: 0 });
  const [faresTouched, setFaresTouched] = useState(!!existing);
  const [more, setMore] = useState(false);
  const [rangeOnly, setRangeOnly] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const toInput = useRef<HTMLDivElement>(null);

  // Sync "to"/"from" when the player clicks airports on the map while the editor is open.
  useEffect(() => {
    if (editor.to && !existing) setTo(editor.to);
    if (editor.from && !existing) setFrom(editor.from);
  }, [editor.to, editor.from, existing]);

  // Default fares to the reference fare until a suggestion arrives.
  const effectiveFares: Fares = useMemo(
    () => (fares.economy > 0 || !dist ? fares : { economy: refFare(dist, 'economy'), premium: refFare(dist, 'premium'), business: refFare(dist, 'business') }),
    [fares, dist],
  );

  const maxFor = (acId: string) => {
    const ac = view.aircraft.find((a) => a.id === acId);
    const t = ac && catalog.aircraftTypes[ac.typeId];
    if (!t || !dist) return 1;
    const perTrip = legKm.reduce((h, km) => h + roundTripHours(km, t), 0);
    return Math.max(1, Math.floor((WEEKLY_HOURS - (used.get(acId) ?? 0) - otherHours(acId)) / perTrip));
  };
  // Hours used by this editor's other rows (same aircraft can't be listed twice, so 0) — kept for clarity.
  const otherHours = (_acId: string) => 0;
  // What's sent: each aircraft's flights capped at what its free hours allow (the slider shows the same cap).
  const sendAssignments = assignments.map((a) => ({ ...a, roundTripsPerWeek: Math.min(a.roundTripsPerWeek, maxFor(a.aircraftId)) }));
  const sendKey = sendAssignments.map((a) => `${a.aircraftId}:${a.roundTripsPerWeek}`).join(',');

  // Fares for the other markets of a stop route: the player's, else the reference fare for that distance.
  const effectiveLegFares: Record<string, Fares> = useMemo(() => {
    const out: Record<string, Fares> = {};
    for (const m of markets) {
      if (m.key === pairKey(from, to ?? '')) continue;
      const km = distanceKm(catalog.airports[m.a]!, catalog.airports[m.b]!);
      out[m.key] = legFares[m.key] ?? { economy: refFare(km, 'economy'), premium: refFare(km, 'premium'), business: refFare(km, 'business') };
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legFares, markets.map((m) => m.key).join(','), from, to]);

  const cmd: Command | null = useMemo(() => {
    if (!to || !stopsReady) return null;
    const leg = chosenStops.length ? { legFares: effectiveLegFares } : {};
    if (existing) return { type: 'updateRoute', routeId: existing.id, fares: effectiveFares, assignments: sendAssignments, ...leg };
    if (!sendAssignments.length) return null;
    return { type: 'openRoute', from, to, ...(chosenStops.length ? { stops: chosenStops } : {}), fares: effectiveFares, assignments: sendAssignments, ...leg };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, from, effectiveFares, effectiveLegFares, sendKey, existing, chosenStops.join(','), stopsReady]);

  useEffect(() => {
    if (!cmd) return;
    const id = setTimeout(() => {
      void window.game.preview(cmd).then((p) => {
        setPreview(p);
        if (p.ok && p.suggestedFares && !faresTouched) setFares(p.suggestedFares);
        if (p.ok && p.suggestedLegFares && !faresTouched) setLegFares(p.suggestedLegFares);
      });
    }, 150);
    return () => clearTimeout(id);
  }, [cmd, faresTouched]);

  const blocking = !to
    ? 'Choose a destination.'
    : !stopsReady
      ? 'Choose the stop airport, or remove the stop.'
    : assignments.length === 0
      ? view.aircraft.length === 0 ? 'Lease an aircraft first.' : 'Add an aircraft.'
      : preview && !preview.ok
        ? preview.reason!
        : null;

  const submit = async () => {
    if (!cmd || blocking) return;
    setSubmitting(true);
    const r = await window.game.command(cmd);
    setSubmitting(false);
    if (!r.ok) {
      setPreview({ ok: false, reason: r.reason });
      return;
    }
    const label = chosenStops.length ? routeLabel({ from, to: to!, stops: chosenStops }) : `${from}–${to}`;
    toast({ title: existing ? `Route ${label} updated` : `Route ${label} opened`, tone: 'success' });
    close();
  };

  const longestLeg = Math.max(0, ...legKm);
  const candidates = view.aircraft.filter((a) => !rangeOnly || (catalog.aircraftTypes[a.typeId]?.rangeKm ?? 0) >= longestLeg);
  const stopPicker = (i: number) => (
    <div key={i} className="flex items-end gap-2">
      <div className="flex-1">
        <Combobox<Airport>
          label={`Stop ${i + 1}`}
          items={AIRPORTS.filter((a) => a.id !== from && a.id !== to && !stops.some((x, j) => j !== i && x === a.id))}
          getKey={(a) => a.id}
          render={(a) => <span><span className="font-mono text-text">{a.id}</span> {a.city} <span className="text-faint">· {a.country}</span></span>}
          filter={airportFilter}
          rank={airportRank}
          onSelect={(a) => setStops(stops.map((x, j) => (j === i ? a.id : x)))}
          value={stops[i] ? catalog.airports[stops[i]!] ?? null : null}
          renderValue={(a) => `${a.id} · ${a.city}`}
          placeholder="City or airport code"
        />
      </div>
      <button type="button" aria-label={`Remove stop ${i + 1}`} onClick={() => setStops(stops.filter((_, j) => j !== i))} className="mb-1 rounded-md p-2 text-faint hover:bg-surface-3 hover:text-danger">
        <Trash2 className="size-4" />
      </button>
    </div>
  );
  const fareInput = (label: string, value: number, onChange: (v: number) => void) => (
    <input aria-label={label} inputMode="numeric" value={String(value)}
      onChange={(e) => {
        // An empty box keeps the old fare (so typing over it doesn't snap to $1).
        const digits = e.target.value.replace(/[^0-9]/g, '');
        if (!digits) return;
        setFaresTouched(true);
        onChange(Math.min(50000, Math.max(1, Number(digits))));
      }}
      onFocus={(e) => e.target.select()}
      className="num h-8 w-full rounded-md border border-border bg-surface-1 px-2 text-right text-[13px] outline-none focus:border-accent" />
  );

  return (
    <motion.aside
      aria-label={existing ? 'Edit route' : 'New route'}
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0, transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } }}
      className="absolute top-3 right-3 z-30 flex max-h-[calc(100%-24px)] w-[400px] flex-col rounded-xl border border-border bg-surface-1/95 shadow-overlay backdrop-blur-md"
    >
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-[16px] font-semibold">{existing ? `Edit ${routeLabel(existing)}` : 'New route'}</h2>
        <button type="button" aria-label="Close" onClick={close} className="rounded-md p-1 text-muted hover:bg-surface-3 hover:text-text"><X className="size-4" /></button>
      </header>
      <div className="flex flex-col gap-4 overflow-y-auto p-4">
        {!existing && (
          <>
            <div className="flex flex-col gap-1">
              <label htmlFor="re-from" className="text-[13px] font-semibold text-muted">From</label>
              <select id="re-from" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 rounded-md border border-border-strong bg-surface-1 px-3 outline-none focus:border-accent">
                {bases.map((b) => <option key={b} value={b}>{b} · {catalog.airports[b]?.city}</option>)}
              </select>
            </div>
            <div ref={toInput}>
              <Combobox<Airport>
                label="To"
                items={AIRPORTS.filter((a) => a.id !== from)}
                getKey={(a) => a.id}
                render={(a) => <span><span className="font-mono text-text">{a.id}</span> {a.city} <span className="text-faint">· {a.country}</span></span>}
                filter={airportFilter}
                rank={airportRank}
                onSelect={(a) => setTo(a.id)}
                value={to ? catalog.airports[to] ?? null : null}
                renderValue={(a) => `${a.id} · ${a.city}`}
                placeholder="City or airport code — or click it on the map"
              />
            </div>
            {stops.map((_, i) => stopPicker(i))}
            {stops.length < 2 && (
              <Button size="sm" variant="ghost" className="self-start" onClick={() => setStops([...stops, undefined])}>
                <Plus className="size-4" /> Add a stop
              </Button>
            )}
            {stops.length > 0 && <p className="text-[12px] text-faint">One aircraft flies the whole way and back. You sell every pair along the route, including through trips.</p>}
          </>
        )}
        {to && preview?.ok && (
          <p className="num text-[13px] text-muted">
            {Math.round(chosenStops.length ? flownKm : dist).toLocaleString('en-US')} km{chosenStops.length ? ' flown' : ''} · demand ~{(preview.demandPerDay ?? 0).toLocaleString('en-US')}/day · {preview.competitors ?? 0} competitor{preview.competitors === 1 ? '' : 's'}
          </p>
        )}
        {to && preview?.ok && (preview.detourKm ?? 0) > 0 && (
          <p className="num rounded-md bg-warning/10 p-2 text-[13px] text-warning">Detour +{preview.detourKm!.toLocaleString('en-US')} km around closed airspace</p>
        )}

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-[13px] font-semibold text-muted">Aircraft</legend>
          {assignments.map((asg, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <select
                  aria-label="Aircraft"
                  value={asg.aircraftId}
                  onChange={(e) => setAssignments(assignments.map((x, j) => (j === i ? { ...x, aircraftId: e.target.value } : x)))}
                  className="h-9 flex-1 rounded-md border border-border-strong bg-surface-1 px-2 outline-none focus:border-accent"
                >
                  {candidates.filter((a) => a.id === asg.aircraftId || !assignments.some((x) => x.aircraftId === a.id)).map((a) => (
                    <option key={a.id} value={a.id}>{aircraftLabel(a)} (free {Math.round((WEEKLY_HOURS - (used.get(a.id) ?? 0)) / 7)}h/day)</option>
                  ))}
                </select>
                <button type="button" aria-label="Remove aircraft" onClick={() => setAssignments(assignments.filter((_, j) => j !== i))} className="rounded-md p-2 text-faint hover:bg-surface-3 hover:text-danger">
                  <Trash2 className="size-4" />
                </button>
              </div>
              <Slider
                label="Round trips per week"
                value={Math.min(asg.roundTripsPerWeek, maxFor(asg.aircraftId))}
                min={1}
                max={maxFor(asg.aircraftId)}
                onChange={(v) => setAssignments(assignments.map((x, j) => (j === i ? { ...x, roundTripsPerWeek: v } : x)))}
                format={(v) => `${v}/wk`}
              />
            </div>
          ))}
          {view.aircraft.length > assignments.length && (
            <Button size="sm" variant="ghost" className="self-start" onClick={() => {
              const next = candidates.find((a) => !assignments.some((x) => x.aircraftId === a.id));
              if (next) setAssignments([...assignments, { aircraftId: next.id, roundTripsPerWeek: 7 }]);
            }}>
              <Plus className="size-4" /> Add aircraft
            </Button>
          )}
        </fieldset>

        {chosenStops.length > 0 && to ? (
          <table aria-label="Fares by market" className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-muted"><th className="pb-1 font-semibold">Market</th><th className="pb-1 font-semibold">Economy</th><th className="pb-1 font-semibold">Premium</th><th className="pb-1 font-semibold">Business</th></tr>
            </thead>
            <tbody>
              {markets.map((m) => {
                const end = m.key === pairKey(from, to);
                const f = end ? effectiveFares : effectiveLegFares[m.key]!;
                const set = (c: CabinClass) => (v: number) => end ? setFares({ ...effectiveFares, [c]: v }) : setLegFares({ ...effectiveLegFares, [m.key]: { ...f, [c]: v } });
                return (
                  <tr key={m.key}>
                    <th scope="row" className="whitespace-nowrap py-1 pr-2 text-left font-mono text-[12px] font-normal">{m.a} → {m.b}</th>
                    {(['economy', 'premium', 'business'] as const).map((c) => <td key={c} className="py-1 pr-1">{fareInput(`${m.a} → ${m.b} ${c} fare`, f[c], set(c))}</td>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <>
        <NumberInput
            label="Economy fare"
            prefix="$"
            value={effectiveFares.economy}
            min={1}
            max={20000}
            step={1}
            onChange={(v) => { setFaresTouched(true); setFares({ ...effectiveFares, economy: v }); }}
            hint={preview?.suggestedFares ? `Suggested ${formatMoney(preview.suggestedFares.economy)}` : undefined}
          />
          <button type="button" aria-expanded={more} onClick={() => setMore(!more)} className="inline-flex items-center gap-1 self-start text-[13px] font-semibold text-muted hover:text-text">
            {more ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />} Premium & business fares
          </button>
          {more && (
            <div className="grid grid-cols-2 gap-3">
              {(['premium', 'business'] as const).map((c) => (
                <NumberInput key={c} label={c === 'premium' ? 'Premium fare' : 'Business fare'} prefix="$" value={effectiveFares[c]} min={1} max={50000}
                  onChange={(v) => { setFaresTouched(true); setFares({ ...effectiveFares, [c]: v }); }}
                  hint={preview?.suggestedFares ? `Suggested ${formatMoney(preview.suggestedFares[c])}` : undefined} />
              ))}
            </div>
          )}
          </>
        )}
      </div>

      <footer className="flex flex-col gap-3 border-t border-border p-4">
        {preview?.ok && preview.expectedLoadFactor !== undefined && (
          <p className="num text-[13px]" aria-live="polite">
            Expected load {formatPct(preview.expectedLoadFactor)} ·{' '}
            <span className={cn((preview.expectedProfitPerDay ?? 0) >= 0 ? 'text-success' : 'text-danger')}>
              {(preview.expectedProfitPerDay ?? 0) >= 0 ? '+' : ''}{formatMoney(preview.expectedProfitPerDay ?? 0)}/day
            </span>
            {preview.paybackDays ? ` · payback ${preview.paybackDays}d` : ''}
          </p>
        )}
        {blocking && (
          <div role="alert" className="flex flex-col gap-2 text-[13px] text-danger">
            <span>{blocking}</span>
            {blocking.startsWith('Range too short') && (
              <Button size="sm" variant="secondary" className="self-start" onClick={() => {
                setRangeOnly(true);
                const ok = view.aircraft.find((a) => (catalog.aircraftTypes[a.typeId]?.rangeKm ?? 0) >= dist);
                if (ok) setAssignments([{ aircraftId: ok.id, roundTripsPerWeek: 3 }]);
              }}>Show aircraft that can fly this</Button>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button variant="primary" loading={submitting} disabled={!!blocking || !cmd} onClick={submit}>{existing ? 'Save changes' : 'Open route'}</Button>
        </div>
      </footer>
    </motion.aside>
  );
}
