import { routeLabel } from '../../lib/routes';
import type { Route } from '@skyempire/shared';
import { formatMoney } from '@skyempire/shared';
import { Button, cn, DataTable, EmptyState, ListToolbar, Meter, NoResults, Segmented } from '@skyempire/ui';
import { useState } from 'react';
import { filterRoutes, routeHealth, type RouteHealth } from '../../lib/listFilters';
import { Plus, Waypoints } from 'lucide-react';
import { shortTypeName } from '../../lib/fleet';
import { useGameStore, useUi } from '../../store';

export function Profit({ value, suffix = '' }: { value: number; suffix?: string }) {
  return (
    <span className={cn('num inline-flex items-center gap-1', value >= 0 ? 'text-success' : 'text-danger')}>
      <span aria-hidden className="text-[10px]">{value >= 0 ? '▲' : '▼'}</span>
      {value >= 0 ? '+' : ''}{formatMoney(value)}{suffix}
    </span>
  );
}

export function NetworkTray() {
  const view = useGameStore((s) => s.view)!;
  const selection = useUi((s) => s.selection);
  const select = useUi((s) => s.select);
  const aircraftOf = (r: Route) =>
    r.assignments.map((a) => shortTypeName(view.aircraft.find((x) => x.id === a.aircraftId)?.typeId ?? '')).join(', ') || '—';
  const [query, setQuery] = useState('');
  const [health, setHealth] = useState<RouteHealth | 'all'>('all');
  const clear = () => { setQuery(''); setHealth('all'); };
  const fleet = new Map(view.aircraft.map((a) => [a.id, a]));
  const rows = filterRoutes(view.routes, { query, health }, view.routeStatus, fleet);
  const count = (k: RouteHealth) => view.routes.filter((r) => routeHealth(r, view.routeStatus[r.id], fleet) === k).length;
  const table = (
    <DataTable<Route>
      rows={rows}
      getKey={(r) => r.id}
      selectedKey={selection?.kind === 'route' ? selection.id : null}
      onRowClick={(r) => select({ kind: 'route', id: r.id })}
      maxHeight={280}
      empty={
        <EmptyState icon={<Waypoints />} text={view.aircraft.length ? 'No routes yet. Open your first route from your hub.' : 'Lease an aircraft first, then open your first route.'}
          action={<Button variant="primary" size="sm" onClick={() => useUi.getState().openRouteEditor({})}><Plus className="size-4" /> New route</Button>} />
      }
      columns={[
        { key: 'route', header: 'Route', cell: (r) => (
          <span className="inline-flex items-center gap-2">
            <span className="font-mono">{routeLabel(r)}</span>
            {r.kind === 'cargo' && <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning">Cargo</span>}
            {r.status === 'suspended' && <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning">Suspended</span>}
            {view.routeStatus[r.id]?.blocked && <span title={view.routeStatus[r.id]!.blocked!} className="rounded-full bg-danger/15 px-2 py-0.5 text-[11px] font-semibold text-danger">Grounded</span>}
            {!view.routeStatus[r.id]?.blocked && (view.routeStatus[r.id]?.detourKm ?? 0) > 0 && (
              <span className="num rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning">Detour +{view.routeStatus[r.id]!.detourKm.toLocaleString('en-US')} km</span>
            )}
          </span>
        ), sortValue: (r) => `${r.from}${r.to}` },
        { key: 'aircraft', header: 'Aircraft', cell: aircraftOf },
        { key: 'freq', header: 'Freq/wk', numeric: true, cell: (r) => r.assignments.reduce((s, a) => s + a.roundTripsPerWeek, 0), sortValue: (r) => r.assignments.reduce((s, a) => s + a.roundTripsPerWeek, 0) },
        { key: 'load', header: 'Load', width: '140px', cell: (r) => (r.last ? <Meter label="Load factor" value={r.last.loadFactor} tone={r.last.loadFactor < 0.6 ? 'warning' : 'accent'} /> : <span className="text-faint">—</span>), sortValue: (r) => r.last?.loadFactor ?? -1 },
        { key: 'fare', header: 'Fare', numeric: true, cell: (r) => (r.kind === 'cargo' ? `$${(r.cargoRate ?? 0).toFixed(2)}/kg` : formatMoney(r.fares.economy)), sortValue: (r) => (r.kind === 'cargo' ? r.cargoRate ?? 0 : r.fares.economy) },
        { key: 'profit', header: 'Profit/day', numeric: true, cell: (r) => (r.last ? <Profit value={r.last.profit} /> : <span className="text-faint">—</span>), sortValue: (r) => r.last?.profit ?? -Infinity },
      ]}
    />
  );
  if (view.routes.length === 0) return table;
  return (
    <div className="flex flex-col gap-2">
      <ListToolbar search={{ value: query, onChange: setQuery, label: 'Search routes', placeholder: 'Airport or city' }} shown={rows.length} total={view.routes.length} onClear={clear}>
        <Segmented label="Route health" value={health} onChange={setHealth} options={[
          { id: 'all', label: 'All', count: view.routes.length }, { id: 'profitable', label: 'Profitable', count: count('profitable') },
          { id: 'losing', label: 'Losing', count: count('losing') }, { id: 'suspended', label: 'Suspended', count: count('suspended') }, { id: 'grounded', label: 'Grounded', count: count('grounded') },
        ]} />
      </ListToolbar>
      {rows.length ? table : <NoResults text="No routes match these filters." onClear={clear} />}
    </div>
  );
}
