import type { Aircraft } from '@skyempire/shared';
import { Button, DataTable, EmptyState, FilterSelect, ListToolbar, Meter, NoResults, Segmented } from '@skyempire/ui';
import { AlertTriangle, Plane, ShoppingCart } from 'lucide-react';
import { useMemo, useState } from 'react';
import { filterFleet, fleetStatus, type FleetStatus } from '../../lib/listFilters';
import { FreeHoursDialog, underusedAircraft } from './FreeHours';
import { Sparkles } from 'lucide-react';
import { AircraftSilhouette } from '../../components/AircraftSilhouette';
import { aircraftLabel, hoursUsed, WEEKLY_HOURS } from '../../lib/fleet';
import { useGameStore, useUi } from '../../store';

export function aircraftStatus(ac: Aircraft, used: number): { text: string; idle: boolean } {
  if (ac.refitDaysLeft > 0) return { text: `Refit · ${ac.refitDaysLeft}d`, idle: false };
  if (ac.status === 'maintenance') return { text: `Maintenance · ${ac.maintenanceDaysLeft}d`, idle: false };
  if (used <= 0) return { text: 'Idle', idle: true };
  return { text: 'Flying', idle: false };
}

export function FleetTray() {
  const view = useGameStore((s) => s.view)!;
  const selection = useUi((s) => s.selection);
  const select = useUi((s) => s.select);
  const used = useMemo(() => hoursUsed(view), [view]);
  const routesOf = (id: string) => view.routes.filter((r) => r.assignments.some((a) => a.aircraftId === id));
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<FleetStatus | 'all'>('all');
  const [ownership, setOwnership] = useState<'all' | 'owned' | 'leased'>('all');
  const [freeOpen, setFreeOpen] = useState(false);
  const underused = underusedAircraft(view.aircraft, used).length;
  const clear = () => { setQuery(''); setStatus('all'); setOwnership('all'); };
  const rows = filterFleet(view.aircraft, { query, status, ownership }, used);
  const count = (k: FleetStatus) => view.aircraft.filter((a) => fleetStatus(a, used.get(a.id) ?? 0) === k).length;
  const table = (
    <DataTable<Aircraft>
      rows={rows}
      getKey={(a) => a.id}
      maxHeight={280}
      selectedKey={selection?.kind === 'aircraft' ? selection.id : null}
      onRowClick={(a) => select({ kind: 'aircraft', id: a.id })}
      empty={<EmptyState icon={<Plane />} text="No aircraft yet. Lease your first one to start flying."
        action={<Button variant="primary" size="sm" onClick={() => useUi.getState().setMarketOpen(true)}><ShoppingCart className="size-4" /> Browse aircraft</Button>} />}
      columns={[
        { key: 'ac', header: 'Aircraft', cell: (a) => (
          <span className="inline-flex items-center gap-2">
            <AircraftSilhouette typeId={a.typeId} className="h-4 w-10 text-muted" />
            {aircraftLabel(a)}
            <span className="text-[11px] text-faint">{a.ownership === 'leased' ? 'Leased' : 'Owned'}</span>
          </span>
        ), sortValue: (a) => a.typeId },
        { key: 'age', header: 'Age', numeric: true, cell: (a) => `${(a.ageDays / 360).toFixed(1)} y`, sortValue: (a) => a.ageDays },
        { key: 'cond', header: 'Condition', width: '140px', cell: (a) => <Meter label="Condition" value={a.condition} max={100} tone={a.condition < 60 ? 'danger' : a.condition < 75 ? 'warning' : 'success'} />, sortValue: (a) => a.condition },
        { key: 'routes', header: 'Routes', cell: (a) => routesOf(a.id).map((r) => `${r.from}–${r.to}`).join(', ') || <span className="text-faint">—</span> },
        { key: 'util', header: 'Use', numeric: true, cell: (a) => `${Math.round(((used.get(a.id) ?? 0) / WEEKLY_HOURS) * 100)}%`, sortValue: (a) => used.get(a.id) ?? 0 },
        { key: 'status', header: 'Status', cell: (a) => {
          const s = aircraftStatus(a, used.get(a.id) ?? 0);
          return <span className={s.idle ? 'inline-flex items-center gap-1 text-warning' : 'text-muted'}>{s.idle && <AlertTriangle className="size-3.5" />}{s.text}</span>;
        } },
      ]}
    />
  );
  if (view.aircraft.length === 0) return table;
  return (
    <div className="flex flex-col gap-2">
      <ListToolbar search={{ value: query, onChange: setQuery, label: 'Search fleet', placeholder: 'Aircraft type' }} shown={rows.length} total={view.aircraft.length} onClear={clear}>
        <Segmented label="Status" value={status} onChange={setStatus} options={[
          { id: 'all', label: 'All', count: view.aircraft.length }, { id: 'flying', label: 'Flying', count: count('flying') }, { id: 'idle', label: 'Idle', count: count('idle') },
          { id: 'maintenance', label: 'Maintenance', count: count('maintenance') }, { id: 'refit', label: 'Refit', count: count('refit') },
        ]} />
        <FilterSelect label="Owned or leased" value={ownership} onChange={setOwnership} options={[{ id: 'all', label: 'All' }, { id: 'owned', label: 'Owned' }, { id: 'leased', label: 'Leased' }]} />
        <Button size="sm" variant={underused ? 'primary' : 'ghost'} onClick={() => setFreeOpen(true)}>
          <Sparkles className="size-4" aria-hidden /> Use free hours{underused ? ` (${underused})` : ''}
        </Button>
      </ListToolbar>
      <FreeHoursDialog open={freeOpen} onOpenChange={setFreeOpen} />
      {rows.length ? table : <NoResults text="No aircraft match these filters." onClear={clear} />}
    </div>
  );
}
