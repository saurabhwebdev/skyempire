import { catalog } from '../../lib/catalog';
import { useGameStore } from '../../store';
import { PERSONALITY_LABEL } from './Market';

export function RivalInspector({ id }: { id: string }) {
  const view = useGameStore((s) => s.view)!;
  const r = view.rivals.find((x) => x.id === id);
  if (!r) return <p className="text-muted">This airline has left the market.</p>;
  const data = catalog.airlines.find((a) => `al_${a.iata}` === id);
  const theirs = view.rivalRoutes.filter((x) => x.airlineId === id);
  return (
    <div className="flex flex-col gap-5">
      <header>
        <span className="label-caps">{PERSONALITY_LABEL[r.personality]} airline</span>
        <h2 className="mt-1 flex items-center gap-2 text-[24px] font-semibold tracking-[-0.02em]">
          <span className="size-3 rounded-full" style={{ background: r.color }} aria-hidden />{r.name}
        </h2>
        <p className="text-muted"><span className="font-mono">{r.code}</span>{data ? ` · based at ${catalog.airports[data.hubId]?.city ?? data.hubId}` : ''}</p>
      </header>
      <dl className="grid grid-cols-2 gap-y-2 text-[13px]">
        <dt className="text-muted">Fleet</dt><dd className="num text-right">{r.fleetSize} aircraft</dd>
        <dt className="text-muted">Routes</dt><dd className="num text-right">{r.routeCount}</dd>
        <dt className="text-muted">Reputation</dt><dd className="num text-right">{r.reputation}</dd>
        <dt className="text-muted">Head-to-head with you</dt><dd className="num text-right">{r.overlapRoutes}</dd>
      </dl>
      <div>
        <span className="label-caps">Their routes</span>
        <ul className="mt-2 grid grid-cols-2 gap-1 font-mono text-[13px] text-muted">
          {theirs.slice(0, 30).map((x, i) => <li key={i}>{x.from} → {x.to}</li>)}
        </ul>
        {theirs.length > 30 && <p className="mt-1 text-[12px] text-faint">and {theirs.length - 30} more</p>}
      </div>
    </div>
  );
}
