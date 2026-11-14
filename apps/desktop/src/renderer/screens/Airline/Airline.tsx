import { formatMoney } from '@skyempire/shared';
import { Button, Meter, NumberInput, Panel, useToast } from '@skyempire/ui';
import { useState } from 'react';
import { catalog } from '../../lib/catalog';
import { useGameStore } from '../../store';
import { LogoMark } from '../NewAirline/LogoPreview';
import { AirlineLogo } from '../../components/AirlineLogo';
import { useGameStore as useStore } from '../../store';

const TIER = { startup: 'Startup', regional: 'Regional', national: 'National', global: 'Global' };

const KIND_LABEL = { passenger: 'Passenger', combination: 'Passenger + Cargo', cargo: 'Cargo only' } as const;

export function Airline() {
  const view = useGameStore((s) => s.view)!;
  const al = view.player;
  const toast = useToast();
  const [marketing, setMarketing] = useState(al.marketingPerMonth);
  const send = async (cmd: Parameters<typeof window.game.command>[0], ok: string) => {
    const r = await window.game.command(cmd);
    toast(r.ok ? { title: ok, tone: 'success' } : { title: r.reason, tone: 'danger' });
  };
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel title="Brand">
        <div className="flex items-center gap-4">
          <LogoMark shape={al.logoShape} primary={al.colors.primary} secondary={al.colors.secondary} size={56} />
          <AirlineLogo code={al.code} name={`${al.name} custom logo`} color={al.colors.primary} size={56} file="__player" />
          <div>
            <div className="text-[20px] font-semibold">{al.name}</div>
            <div className="text-muted"><span className="font-mono">{al.code}</span> · {TIER[al.tier]} airline</div>
          </div>
        </div>
      </Panel>
      <Panel title="Custom logo">
        <p className="mb-3 text-[13px] text-muted">Upload a PNG (under 1 MB) to replace the code badge in the top bar.</p>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border-strong bg-surface-2 px-4 py-2 text-sm font-semibold hover:bg-surface-3">
          Upload logo
          <input type="file" accept="image/png" className="sr-only" onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              await window.game.logos.setPlayerLogo(new Uint8Array(await f.arrayBuffer()));
              useStore.getState().bumpLogos();
              toast({ title: 'Logo updated', tone: 'success' });
            } catch (err) {
              toast({ title: err instanceof Error ? err.message.replace(/^.*Error: /, '') : 'Couldn’t use that file', tone: 'danger' });
            }
          }} />
        </label>
      </Panel>
      <Panel title="Reputation">
        <div className="num mb-2 text-[30px] font-semibold">{Math.round(al.reputation)}<span className="text-[14px] text-muted"> / 100</span></div>
        <Meter label="Reputation" value={al.reputation} max={100} showValue={false} />
        <ul className="mt-3 grid grid-cols-2 gap-1 text-[13px] text-muted">
          <li>30% punctuality</li><li>25% service & comfort</li><li>15% fair prices</li><li>15% young fleet</li><li>15% marketing</li>
        </ul>
      </Panel>
      <Panel title="Cargo">
        <p className="mb-3 text-[13px]"><span className="text-muted">Airline type: </span><span className="font-semibold">{KIND_LABEL[al.kind ?? 'passenger']}</span></p>
        {al.kind !== 'cargo' && (
          <label className="mb-3 flex items-start gap-2 text-[13px]">
            <input type="checkbox" checked={al.bellyCargo !== false} className="mt-0.5 size-4 accent-[var(--color-accent)]"
              aria-label="Sell cargo in passenger holds" aria-describedby="belly-hint"
              onChange={(e) => send({ type: 'setBellyCargo', on: e.target.checked }, e.target.checked ? 'Belly cargo on' : 'Belly cargo off')} />
            <span>Sell cargo in passenger holds<span id="belly-hint" className="block text-muted">Extra revenue on every passenger flight. Set it per route in the route editor.</span></span>
          </label>
        )}
        {al.dgLicence
          ? <p className="text-[13px] text-success">You can carry dangerous goods (batteries, chemicals), which pay 40% more.</p>
          : (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[13px] text-muted">Dangerous goods (batteries, chemicals) pay 40% more but need a licence.</p>
              <Button size="sm" onClick={() => send({ type: 'buyDgLicence' }, 'Dangerous-goods licence granted')}>Get the licence · $250k</Button>
            </div>
          )}
      </Panel>
      <Panel title="Cabins and service">
        <p className="text-[13px] text-muted">Each aircraft has its own cabin: seats, legroom, screens, meals and extras for every class. Better products raise quality, fares and reputation, but cost more to fit and to run.</p>
        <p className="mt-2 text-[13px] text-muted">Open an aircraft in your fleet and choose <span className="text-text">Design cabin</span>, or design it when you lease or buy.</p>
      </Panel>
      <Panel title="Marketing">
        <div className="flex items-end gap-2">
          <NumberInput label="Monthly budget" prefix="$" value={marketing} min={0} max={50_000_000} step={50_000} onChange={setMarketing} className="flex-1" />
          <Button variant="primary" onClick={() => send({ type: 'setMarketing', perMonth: marketing }, `Marketing set to ${formatMoney(marketing)}/month`)}>Set budget</Button>
        </div>
        <p className="mt-2 text-[13px] text-muted">About {formatMoney(view.aircraft.length * 50_000)}/month gives full marketing credit for your fleet size.</p>
      </Panel>
      <Panel title="Bases" className="lg:col-span-2">
        <ul className="flex flex-col gap-2">
          {al.baseIds.map((id) => (
            <li key={id} className="flex items-center justify-between rounded-md bg-surface-2 p-3">
              <span><span className="font-mono">{id}</span> {catalog.airports[id]?.city}{id === al.homeBaseId && <span className="ml-2 text-[12px] text-faint">Home base</span>}</span>
              {id !== al.homeBaseId && <Button size="sm" variant="ghost" onClick={() => send({ type: 'closeBase', airportId: id }, `Closed base ${id}`)}>Close base</Button>}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[13px] text-muted">Open more bases from any airport's panel on the map.</p>
      </Panel>
    </div>
  );
}
