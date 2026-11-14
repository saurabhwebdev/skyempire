import { routeShort } from '../../lib/routes';
import type { ClientView } from '@skyempire/shared';
import { formatMoney } from '@skyempire/shared';
import { monthlyCosts } from '../../lib/finance';
import { aircraftLabel, hoursUsed } from '../../lib/fleet';
import { useUi, type Section, type Selection } from '../../store';

export interface Alert {
  id: string;
  level: 'warning' | 'danger';
  text: string;
  action: { label: string; run(): void };
}

const go = (section: Section, selection: Selection = null) => () => useUi.setState({ section, selection });

/** Things that need the player's attention, most urgent first. */
export function deriveAlerts(view: ClientView): Alert[] {
  const out: Alert[] = [];
  const bills = monthlyCosts(view);
  if (view.player.cash < bills)
    out.push({ id: 'low-cash', level: 'danger', text: `Cash is low — next month's bills are about ${formatMoney(bills)}.`, action: { label: 'Take a loan', run: go('finance') } });
  for (const r of view.routes) {
    const blocked = view.routeStatus[r.id]?.blocked;
    if (blocked)
      out.push({ id: `grounded-${r.id}`, level: 'danger', text: `${routeShort(r)} is grounded: ${blocked}.`, action: { label: 'Review route', run: go('network', { kind: 'route', id: r.id }) } });
    const sum = r.profit30.reduce((a, b) => a + b, 0);
    if (r.status === 'active' && r.profit30.length >= 7 && sum < 0)
      out.push({ id: `loss-${r.id}`, level: 'warning', text: `${routeShort(r)} lost ${formatMoney(-sum)} in the last ${r.profit30.length} days.`, action: { label: 'Review route', run: go('network', { kind: 'route', id: r.id }) } });
    if (r.status === 'suspended')
      out.push({ id: `suspended-${r.id}`, level: 'warning', text: `${routeShort(r)} is suspended — it has no aircraft.`, action: { label: 'Assign aircraft', run: () => useUi.getState().openRouteEditor({ routeId: r.id }) } });
  }
  const used = hoursUsed(view);
  for (const ac of view.aircraft) {
    if (ac.status === 'active' && !used.get(ac.id))
      out.push({ id: `idle-${ac.id}`, level: 'warning', text: `${aircraftLabel(ac)} is idle and still costs money.`, action: { label: 'Open a route', run: () => useUi.getState().openRouteEditor({}) } });
    if (ac.condition < 60)
      out.push({ id: `cond-${ac.id}`, level: 'warning', text: `${aircraftLabel(ac)} is in poor condition (${Math.round(ac.condition)}%). Delays and incidents are more likely.`, action: { label: 'View aircraft', run: go('fleet', { kind: 'aircraft', id: ac.id }) } });
  }
  return out;
}
