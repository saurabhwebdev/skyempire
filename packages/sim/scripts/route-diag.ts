/** Route economics diagnostic. Usage: tsx packages/sim/scripts/route-diag.ts */
import { loadCatalog } from '@skyempire/data';
import { applyCommand } from '../src/commands/apply';
import { refFare } from '../src/demand';
import { distanceKm } from '../src/geo';
import { newGame } from '../src/newGame';
import { preview } from '../src/preview';
import { tick } from '../src/tick';

const catalog = loadCatalog('world');
const cases: [string, string, string, number][] = [
  ['LHR', 'MAD', 'A20N', 14],
  ['LHR', 'CDG', 'A20N', 21],
  ['LHR', 'JFK', 'B789', 7],
  ['LHR', 'EDI', 'AT76', 21],
  ['DEL', 'BOM', 'A20N', 21],
];
const k = (n: number) => `${Math.round(n / 1000)}k`;

for (const [from, to, type, rt] of cases) {
  let s = newGame(
    {
      seed: 1, regionId: 'world', difficulty: 'normal', homeBaseId: from, aiCount: 0,
      airline: { name: 'Diag Air', code: 'D1G', colors: { primary: '#123456', secondary: '#ffffff' }, logoShape: 'circle' },
    },
    catalog,
  );
  s.airlines[s.playerId]!.tier = 'national';
  const t = catalog.aircraftTypes[type]!;
  applyCommand(s, s.playerId, { type: 'leaseAircraft', typeId: type, cabin: { economy: t.maxSeats, premium: 0, business: 0 } }, catalog);
  const ac = Object.values(s.aircraft).find((a) => a.ownerId === s.playerId)!.id;
  const cmd = { type: 'openRoute' as const, from, to, fares: { economy: 1, premium: 1, business: 1 }, assignments: [{ aircraftId: ac, roundTripsPerWeek: rt }] };
  const p = preview(s, s.playerId, cmd, catalog);
  const r0 = applyCommand(s, s.playerId, { ...cmd, fares: p.suggestedFares! }, catalog);
  if (!r0.ok) {
    console.log(from, to, r0.reason);
    continue;
  }
  const days = 28;
  let rev = 0, lf = 0;
  const costs: Record<string, number> = {};
  for (let d = 0; d < days; d++) {
    const res = tick(s, [], catalog);
    s = res.state;
    const row = res.summary.daily.find((x) => x.airlineId === s.playerId)!;
    rev += row.revenue;
    for (const [key, v] of Object.entries(row.costs)) costs[key] = (costs[key] ?? 0) + v;
    lf += Object.values(s.routes)[0]!.last!.loadFactor;
  }
  const per = (key: string) => (costs[key] ?? 0) / days;
  const variable = ['fuel', 'crew', 'maintenance', 'fees', 'service'].reduce((a, key) => a + per(key), 0);
  const fixed = t.leasePerMonth / 30 + 70_000 / 30;
  const revDay = rev / days;
  const dist = distanceKm(catalog.airports[from]!, catalog.airports[to]!);
  console.log(
    `${from}-${to} ${type} ${rt}/wk ${Math.round(dist)}km ref $${refFare(dist, 'economy')} fare $${p.suggestedFares!.economy}` +
      ` | LF ${Math.round((lf / days) * 100)}% | rev/day ${k(revDay)} | var ${k(variable)} (fuel ${k(per('fuel'))} crew ${k(per('crew'))}` +
      ` maint ${k(per('maintenance'))} fees ${k(per('fees'))} svc ${k(per('service'))}) fixed ${k(fixed)}` +
      ` | margin ${Math.round(((revDay - variable - fixed) / revDay) * 100)}%`,
  );
}
