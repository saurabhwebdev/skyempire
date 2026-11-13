import { isReservedAirline, loadCatalog } from '@skyempire/data';
import type { Airport, Difficulty, LogoShape } from '@skyempire/shared';
import { formatMoney, formatPax } from '@skyempire/shared';
import { Button, cn, Combobox, useToast } from '@skyempire/ui';
import { ArrowLeft } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useGameStore, useUi } from '../../store';
import { LogoMark, TailPreview } from './LogoPreview';

const catalog = loadCatalog('world');
const AIRPORTS = Object.values(catalog.airports).sort((a, b) => b.population - a.population);
const SHAPES: LogoShape[] = ['wing', 'circle', 'square', 'diamond'];
const PALETTE = ['#2f6fed', '#0f9d8a', '#d9534f', '#7b5cd6', '#e08a1e', '#1f2937', '#c2185b', '#2e7d32'];
const CODE_RE = /^[A-Z0-9]{2,3}$/;

/** Search relevance for airports: exact code, then city prefix, then anything else. */
export const airportRank = (a: Airport, q: string) =>
  a.id.toLowerCase() === q ? 0 : a.city.toLowerCase().startsWith(q) ? 1 : a.id.toLowerCase().startsWith(q) ? 2 : 3;
export const airportFilter = (a: Airport, q: string) =>
  a.id.toLowerCase().startsWith(q) || a.city.toLowerCase().includes(q) || a.name.toLowerCase().includes(q);

export function suggestCode(name: string, reserved: (code: string) => boolean): string {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, '').split(/\s+/).filter(Boolean);
  let base = words.length >= 2 ? words.slice(0, 2).map((w) => w[0]).join('') : (words[0] ?? 'SE').slice(0, 2);
  if (base.length < 2) base = (base + 'X').slice(0, 2);
  if (!reserved(base)) return base;
  for (let i = 1; i <= 9; i++) if (!reserved(base + i)) return base + i;
  return base + 'X';
}

const DIFFICULTIES: { id: Difficulty; title: string; text: string }[] = [
  { id: 'easy', title: 'Easy', text: '$80M to start. Rivals are slower to react and start smaller.' },
  { id: 'normal', title: 'Normal', text: '$50M to start. Rivals compete the way real airlines do.' },
  { id: 'hard', title: 'Hard', text: '$25M to start. Rivals are bigger, richer and quick to undercut you.' },
];

function nearbyRivals(a: Airport): number {
  return catalog.airlines.filter((x) => {
    const h = catalog.airports[x.hubId];
    return h && Math.abs(h.lat - a.lat) < 3 && Math.abs(h.lon - a.lon) < 4;
  }).length;
}

export function NewAirline() {
  const setScreen = useUi((s) => s.setScreen);
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [codeTouched, setCodeTouched] = useState(false);
  const [shape, setShape] = useState<LogoShape>('wing');
  const [primary, setPrimary] = useState(PALETTE[0]!);
  const [secondary, setSecondary] = useState('#ffffff');
  const [hub, setHub] = useState<Airport | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [busy, setBusy] = useState(false);

  const effectiveCode = codeTouched ? code : suggestCode(name, (c) => isReservedAirline('', c));
  const nameError =
    name.trim().length < 2 || name.trim().length > 30
      ? 'Give your airline a name (2–30 characters).'
      : isReservedAirline(name, '')
        ? 'That name belongs to a real airline — pick another.'
        : null;
  const codeError = !CODE_RE.test(effectiveCode)
    ? 'Codes are 2–3 letters or digits.'
    : isReservedAirline('', effectiveCode)
      ? 'That code belongs to a real airline — pick another.'
      : null;
  const identityError = nameError ?? codeError;
  const suggestions = useMemo(() => AIRPORTS.filter((a) => a.sizeClass >= 5).slice(0, 6), []);

  const found = async () => {
    if (!hub) return;
    setBusy(true);
    try {
      const view = await window.game.newGame({
        seed: Math.floor(Math.random() * 2 ** 31),
        regionId: 'world',
        difficulty,
        homeBaseId: hub.id,
        airline: { name: name.trim(), code: effectiveCode, colors: { primary, secondary }, logoShape: shape },
      });
      useGameStore.getState().setView(view);
      useUi.setState({ section: 'overview', selection: null, speed: 0 });
      setScreen('game');
    } catch (e) {
      toast({ title: 'Couldn’t start the career', body: e instanceof Error ? e.message.replace(/^.*Error: /, '') : String(e), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="se-enter w-full max-w-[560px]">
        <button type="button" onClick={() => (step === 0 ? setScreen('title') : setStep(step - 1))} className="mb-6 inline-flex items-center gap-2 text-muted hover:text-text">
          <ArrowLeft className="size-4" /> Back
        </button>
        <div className="mb-2 flex gap-2" aria-label={`Step ${step + 1} of 3`}>
          {[0, 1, 2].map((i) => (
            <span key={i} className={cn('h-1 flex-1 rounded-full transition-colors duration-[var(--dur-2)]', i <= step ? 'bg-accent' : 'bg-surface-3')} />
          ))}
        </div>

        {step === 0 && (
          <section className="flex flex-col gap-5">
            <h1 className="text-[32px] font-semibold tracking-[-0.02em]">Name your airline</h1>
            <div className="flex flex-col gap-1">
              <label htmlFor="al-name" className="text-[13px] font-semibold text-muted">Airline name</label>
              <input id="al-name" autoFocus maxLength={30} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Albion Skyways"
                className="h-10 rounded-md border border-border-strong bg-surface-1 px-3 outline-none focus:border-accent" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="al-code" className="text-[13px] font-semibold text-muted">Airline code</label>
              <input id="al-code" value={effectiveCode} maxLength={3}
                onChange={(e) => { setCodeTouched(true); setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3)); }}
                className="h-10 w-28 rounded-md border border-border-strong bg-surface-1 px-3 font-mono uppercase outline-none focus:border-accent" />
              <p className="text-[12px] text-faint">Shown on your tails and route list.</p>
            </div>
            <div className="grid grid-cols-[1fr_auto] items-center gap-6">
              <div className="flex flex-col gap-3">
                <span className="text-[13px] font-semibold text-muted">Logo</span>
                <div className="flex gap-2" role="radiogroup" aria-label="Logo shape">
                  {SHAPES.map((s) => (
                    <button key={s} type="button" role="radio" aria-checked={shape === s} aria-label={s} onClick={() => setShape(s)}
                      className={cn('rounded-lg p-1 ring-2 transition-shadow', shape === s ? 'ring-accent' : 'ring-transparent hover:ring-border-strong')}>
                      <LogoMark shape={s} primary={primary} secondary={secondary} size={36} />
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Main color">
                  {PALETTE.map((c) => (
                    <button key={c} type="button" role="radio" aria-checked={primary === c} aria-label={`Color ${c}`} onClick={() => setPrimary(c)}
                      className={cn('size-7 rounded-full ring-2 ring-offset-2 ring-offset-bg', primary === c ? 'ring-accent' : 'ring-transparent')} style={{ background: c }} />
                  ))}
                  <label className="ml-2 inline-flex items-center gap-2 text-[13px] text-muted">
                    Accent <input type="color" value={secondary} onChange={(e) => setSecondary(e.target.value)} className="size-7 rounded bg-transparent" />
                  </label>
                </div>
              </div>
              <TailPreview shape={shape} primary={primary} secondary={secondary} code={effectiveCode} />
            </div>
            <div className="flex flex-col items-end gap-2">
              <Button variant="primary" disabled={!!identityError} onClick={() => setStep(1)}>Choose a hub</Button>
              {identityError && <p className="text-[13px] text-faint">{identityError}</p>}
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="flex flex-col gap-5">
            <h1 className="text-[32px] font-semibold tracking-[-0.02em]">Pick your home hub</h1>
            <p className="text-muted">Your first base. Routes must start or end at one of your bases.</p>
            <Combobox<Airport>
              label="Search airports"
              autoFocus
              items={AIRPORTS}
              getKey={(a) => a.id}
              render={(a) => <span><span className="font-mono text-text">{a.id}</span> {a.city} · <span className="text-faint">{a.name}</span></span>}
              filter={airportFilter}
              rank={airportRank}
              onSelect={setHub}
              placeholder="City, airport or code"
            />
            <div className="grid grid-cols-2 gap-3">
              {(hub ? [hub, ...suggestions.filter((s) => s.id !== hub.id).slice(0, 3)] : suggestions).map((a) => {
                const busyHub = a.sizeClass >= 5;
                return (
                  <button key={a.id} type="button" aria-pressed={hub?.id === a.id} onClick={() => setHub(a)}
                    className={cn('flex flex-col gap-1 rounded-lg border bg-surface-1 p-4 text-left transition-colors duration-[var(--dur-1)]', hub?.id === a.id ? 'border-accent' : 'border-border hover:border-border-strong')}>
                    <span className="flex items-baseline justify-between">
                      <span className="font-semibold">{a.city}</span>
                      <span className="font-mono text-muted">{a.id}</span>
                    </span>
                    <span className="num text-[13px] text-muted">{formatPax(a.population * 1e6)} people nearby · size {a.sizeClass}/6</span>
                    <span className="text-[13px] text-faint">{nearbyRivals(a)} airline{nearbyRivals(a) === 1 ? '' : 's'} based nearby</span>
                    {busyHub && <span className="mt-1 w-fit rounded-full bg-warning/15 px-2 py-0.5 text-[12px] font-semibold text-warning">Busy hub — harder</span>}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end">
              <Button variant="primary" disabled={!hub} onClick={() => setStep(2)}>Choose difficulty</Button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="flex flex-col gap-5">
            <h1 className="text-[32px] font-semibold tracking-[-0.02em]">How tough should it be?</h1>
            <div className="flex flex-col gap-3" role="radiogroup" aria-label="Difficulty">
              {DIFFICULTIES.map((d) => (
                <button key={d.id} type="button" role="radio" aria-checked={difficulty === d.id} onClick={() => setDifficulty(d.id)}
                  className={cn('rounded-lg border bg-surface-1 p-4 text-left transition-colors', difficulty === d.id ? 'border-accent' : 'border-border hover:border-border-strong')}>
                  <span className="font-semibold">{d.title}</span>
                  <p className="text-muted">{d.text}</p>
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">
                {name.trim()} · <span className="font-mono">{effectiveCode}</span> · {hub?.city} · {formatMoney({ easy: 80e6, normal: 50e6, hard: 25e6 }[difficulty])}
              </span>
              <Button variant="primary" loading={busy} onClick={found}>Found airline</Button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
