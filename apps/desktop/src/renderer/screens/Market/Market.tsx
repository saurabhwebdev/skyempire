import type { Airport, PreviewResult, RivalSummary } from '@skyempire/shared';
import { formatPax } from '@skyempire/shared';
import { Combobox, DataTable, Panel } from '@skyempire/ui';
import { useEffect, useState } from 'react';
import { AirlineLogo } from '../../components/AirlineLogo';
import { catalog } from '../../lib/catalog';
import { useGameStore, useUi } from '../../store';
import { airportFilter, airportRank } from '../NewAirline/NewAirline';

const AIRPORTS = Object.values(catalog.airports).sort((a, b) => b.population - a.population);
export const PERSONALITY_LABEL = { budget: 'Low-cost', legacy: 'Network', gulf: 'Super-connector', regional: 'Regional', expander: 'Fast-growing low-cost' } as const;

function DemandLookup() {
  const [a, setA] = useState<Airport | null>(null);
  const [b, setB] = useState<Airport | null>(null);
  const [res, setRes] = useState<PreviewResult | null>(null);
  useEffect(() => {
    if (a && b && a.id !== b.id) void window.game.routeDemand(a.id, b.id).then(setRes);
    else setRes(null);
  }, [a, b]);
  const pick = (label: string, value: Airport | null, set: (x: Airport) => void) => (
    <Combobox<Airport> label={label} items={AIRPORTS} getKey={(x) => x.id} filter={airportFilter} rank={airportRank} onSelect={set}
      render={(x) => <span><span className="font-mono">{x.id}</span> {x.city}</span>} value={value} renderValue={(x) => `${x.id} · ${x.city}`} placeholder="City or code" />
  );
  return (
    <Panel title="Route demand lookup">
      <div className="grid grid-cols-2 gap-3">{pick('From', a, setA)}{pick('To', b, setB)}</div>
      {res?.ok && (
        <p className="num mt-3 text-muted">
          About <span className="text-text">{formatPax(res.demandPerDay ?? 0)}</span> passengers a day (both ways) · {res.distanceKm?.toLocaleString('en-US')} km · {res.competitors} airline{res.competitors === 1 ? '' : 's'} flying it
        </p>
      )}
    </Panel>
  );
}

export function Market() {
  const view = useGameStore((s) => s.view)!;
  return (
    <div className="flex flex-col gap-4">
      <Panel title="Competitors">
        <DataTable<RivalSummary>
          rows={view.rivals}
          getKey={(r) => r.id}
          onRowClick={(r) => useUi.setState({ selection: { kind: 'airline', id: r.id }, section: 'network' })}
          maxHeight={420}
          columns={[
            { key: 'name', header: 'Airline', cell: (r) => <span className="inline-flex items-center gap-2"><AirlineLogo code={r.code} name={r.name} color={r.color} size={24} />{r.name}<span className="font-mono text-faint">{r.code}</span></span>, sortValue: (r) => r.name },
            { key: 'type', header: 'Type', cell: (r) => PERSONALITY_LABEL[r.personality], sortValue: (r) => r.personality },
            { key: 'fleet', header: 'Fleet', numeric: true, cell: (r) => r.fleetSize, sortValue: (r) => r.fleetSize },
            { key: 'routes', header: 'Routes', numeric: true, cell: (r) => r.routeCount, sortValue: (r) => r.routeCount },
            { key: 'rep', header: 'Reputation', numeric: true, cell: (r) => r.reputation, sortValue: (r) => r.reputation },
            { key: 'overlap', header: 'Head-to-head', numeric: true, cell: (r) => r.overlapRoutes || '—', sortValue: (r) => r.overlapRoutes },
          ]}
        />
      </Panel>
      <DemandLookup />
    </div>
  );
}
