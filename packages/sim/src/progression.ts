import type { Airline, Catalog, GameState, Notification, TierId } from '@skyempire/shared';
import { nextId } from './ids';

interface TierDef { id: TierId; name: string; aircraft: number; pax: number; revenue360: number; /** Cargo-only airlines: tonnes moved. */ cargoT: number }

/** simulation-spec §12: reach any 2 of the 3 thresholds. */
export const TIERS: TierDef[] = [
  { id: 'regional', name: 'Regional', aircraft: 5, pax: 1_000_000, revenue360: 100_000_000, cargoT: 20_000 },
  { id: 'national', name: 'National', aircraft: 15, pax: 5_000_000, revenue360: 500_000_000, cargoT: 150_000 },
  { id: 'global', name: 'Global', aircraft: 40, pax: 20_000_000, revenue360: 2_000_000_000, cargoT: 600_000 },
];
const ORDER: TierId[] = ['startup', 'regional', 'national', 'global'];

interface Objective { id: string; title: string; check: (s: GameState, al: Airline) => boolean }
const routesOf = (s: GameState, al: Airline) => Object.values(s.routes).filter((r) => r.airlineId === al.id);
const fleetOf = (s: GameState, al: Airline) => Object.values(s.aircraft).filter((a) => a.ownerId === al.id);

export const OBJECTIVES: Objective[] = [
  { id: 'lease-first', title: 'Lease your first aircraft', check: (s, al) => fleetOf(s, al).length > 0 },
  { id: 'open-first-route', title: 'Open your first route', check: (s, al) => routesOf(s, al).length > 0 },
  { id: 'first-day', title: 'Fly your first day', check: (s, al) => routesOf(s, al).some((r) => r.last !== null) },
  { id: 'first-profit', title: 'Make a profit on any route', check: (s, al) => routesOf(s, al).some((r) => (r.last?.profit ?? 0) > 0) },
  { id: 'lf70x3', title: 'Reach 70% load factor on 3 routes', check: (s, al) => routesOf(s, al).filter((r) => (r.last?.loadFactor ?? 0) >= 0.7).length >= 3 },
  { id: 'second-base', title: 'Open a second base', check: (_s, al) => al.baseIds.length >= 2 },
  { id: 'fleet5', title: 'Operate 5 aircraft', check: (s, al) => fleetOf(s, al).length >= 5 },
  { id: 'rep60', title: 'Reach reputation 60', check: (_s, al) => al.reputation >= 60 },
  { id: 'month1m', title: 'Earn $1M profit in 30 days', check: (s, al) => routesOf(s, al).reduce((x, r) => x + r.profit30.reduce((a, b) => a + b, 0), 0) >= 1_000_000 },
  { id: 'tier-regional', title: 'Become a Regional airline', check: (_s, al) => al.tier !== 'startup' },
];

/** Goals for a cargo-only airline. */
export const CARGO_OBJECTIVES: Objective[] = [
  { id: 'lease-freighter', title: 'Lease your first freighter', check: (s, al) => fleetOf(s, al).length > 0 },
  { id: 'open-cargo-route', title: 'Open your first cargo route', check: (s, al) => routesOf(s, al).length > 0 },
  { id: 'first-day', title: 'Fly your first day', check: (s, al) => routesOf(s, al).some((r) => r.last !== null) },
  { id: 'first-profit', title: 'Make a profit on any route', check: (s, al) => routesOf(s, al).some((r) => (r.last?.profit ?? 0) > 0) },
  { id: 'cargo1k', title: 'Move 1,000 tonnes', check: (_s, al) => (al.totals.cargoT ?? 0) >= 1_000 },
  { id: 'dg-licence', title: 'Get the dangerous-goods licence', check: (_s, al) => al.dgLicence },
  { id: 'second-base', title: 'Open a second base', check: (_s, al) => al.baseIds.length >= 2 },
  { id: 'fleet5', title: 'Operate 5 freighters', check: (s, al) => fleetOf(s, al).length >= 5 },
  { id: 'cargo10k', title: 'Move 10,000 tonnes', check: (_s, al) => (al.totals.cargoT ?? 0) >= 10_000 },
  { id: 'tier-regional', title: 'Become a Regional airline', check: (_s, al) => al.tier !== 'startup' },
];
const objectivesFor = (al: Airline) => (al.kind === 'cargo' ? CARGO_OBJECTIVES : OBJECTIVES);

function unlockedTypes(catalog: Catalog, tier: TierId): string {
  const names = Object.values(catalog.aircraftTypes).filter((t) => t.tier === tier).map((t) => t.name.replace(/^(Airbus|Boeing) /, ''));
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : (names[0] ?? '');
}

/** Tier promotion (all airlines) and objectives (player). Returns player-facing notifications. */
export function updateProgression(state: GameState, airlineId: string, catalog: Catalog): Notification[] {
  const al = state.airlines[airlineId]!;
  const notes: Notification[] = [];
  const fleet = fleetOf(state, al).length;
  const revenue = al.totals.revenue360.reduce((a, b) => a + b, 0);
  for (const t of TIERS) {
    if (ORDER.indexOf(al.tier) >= ORDER.indexOf(t.id)) continue;
    const volume = al.kind === 'cargo' ? (al.totals.cargoT ?? 0) >= t.cargoT : al.totals.pax >= t.pax;
    const met = [fleet >= t.aircraft, volume, revenue >= t.revenue360].filter(Boolean).length;
    if (met < 2) break;
    al.tier = t.id;
    if (al.isPlayer)
      notes.push({ id: nextId(state, 'n'), day: state.day, level: 'major', category: 'airline', title: `You’re now a ${t.name} airline`,
        body: `${unlockedTypes(catalog, t.id)} unlocked.`, link: { kind: 'airline', id: al.id } });
  }
  if (!al.isPlayer) return notes;
  for (const o of objectivesFor(al)) {
    if (al.completedObjectives.includes(o.id) || !o.check(state, al)) continue;
    al.completedObjectives.push(o.id);
    notes.push({ id: nextId(state, 'n'), day: state.day, level: 'info', category: 'goal', title: `Goal complete: ${o.title}`, body: 'Nice work. Your next goal is on the Overview.' });
  }
  return notes;
}

/** Last completed goal (if any) followed by the next three open goals. */
export function objectivesView(state: GameState, airlineId: string, _catalog: Catalog): { id: string; title: string; done: boolean }[] {
  const al = state.airlines[airlineId]!;
  const done = al.completedObjectives;
  const list = objectivesFor(al);
  const last = done.length ? list.find((o) => o.id === done[done.length - 1]) : undefined;
  const open = list.filter((o) => !done.includes(o.id)).slice(0, 3);
  return [...(last ? [{ id: last.id, title: last.title, done: true }] : []), ...open.map((o) => ({ id: o.id, title: o.title, done: false }))];
}
