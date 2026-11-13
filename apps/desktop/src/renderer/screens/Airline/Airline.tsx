import { formatMoney } from '@skyempire/shared';
import { BALANCE } from '@skyempire/sim';
import { Button, cn, Meter, NumberInput, Panel, useToast } from '@skyempire/ui';
import { useState } from 'react';
import { catalog } from '../../lib/catalog';
import { useGameStore } from '../../store';
import { LogoMark } from '../NewAirline/LogoPreview';

const SERVICE = ['', 'Basic', 'Simple', 'Standard', 'Premium', 'Luxury'];
const TIER = { startup: 'Startup', regional: 'Regional', national: 'National' };

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
          <div>
            <div className="text-[20px] font-semibold">{al.name}</div>
            <div className="text-muted"><span className="font-mono">{al.code}</span> · {TIER[al.tier]} airline</div>
          </div>
        </div>
      </Panel>
      <Panel title="Reputation">
        <div className="num mb-2 text-[30px] font-semibold">{Math.round(al.reputation)}<span className="text-[14px] text-muted"> / 100</span></div>
        <Meter label="Reputation" value={al.reputation} max={100} showValue={false} />
        <ul className="mt-3 grid grid-cols-2 gap-1 text-[13px] text-muted">
          <li>30% punctuality</li><li>25% service & comfort</li><li>15% fair prices</li><li>15% young fleet</li><li>15% marketing</li>
        </ul>
      </Panel>
      <Panel title="Service level">
        <p className="mb-3 text-[13px] text-muted">Applies to every flight. Better service raises quality and reputation but costs more per passenger.</p>
        <div role="radiogroup" aria-label="Service level" className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((lv) => (
            <button key={lv} type="button" role="radio" aria-checked={al.serviceLevel === lv}
              onClick={() => send({ type: 'setServiceLevel', level: lv as 1 | 2 | 3 | 4 | 5 }, `Service set to ${SERVICE[lv]}`)}
              className={cn('flex flex-col items-center gap-1 rounded-lg border p-2 text-[13px]', al.serviceLevel === lv ? 'border-accent bg-surface-2' : 'border-border hover:border-border-strong')}>
              <span className="font-semibold">{SERVICE[lv]}</span>
              <span className="num text-faint">${BALANCE.serviceCostPerPax[lv]}/pax</span>
            </button>
          ))}
        </div>
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
