import type { ActiveTension, Airport, Catalog, GameState, Notification, Route, TensionKind } from '@skyempire/shared';
import { nextId } from './ids';
import type { Rng } from './rng';
import { flightDistanceKm, routeCrossesRegion } from './routing';

/** Generic geopolitical events (v0.2 design §3): never names parties or causes. Daily chances. */
export const TENSIONS = {
  closurePerDay: 1.5 / 360,
  banPerDay: 1 / 360,
  advisoryPerDay: 2 / 360,
  thawPerBanDay: 1 / 180,
  warnDays: [7, 30] as const,
  closureDays: [30, 360] as const,
  banDays: [60, 720] as const,
  advisoryDays: [30, 120] as const,
  advisoryMagnitude: [0.2, 0.5] as const,
  thawBonus: 0.2,
  thawBonusDays: 90,
};

const active = (t: ActiveTension, day: number) => day >= t.startDay && day <= t.endDay;
const countryName = (catalog: Catalog, iso: string) => catalog.countryNames[iso] ?? iso;
const samePair = (t: ActiveTension, a: string, b: string) => !!t.countries && ((t.countries[0] === a && t.countries[1] === b) || (t.countries[0] === b && t.countries[1] === a));

export function isBanned(state: GameState, a: string, b: string): ActiveTension | undefined {
  return state.world.tensions.find((t) => t.kind === 'routeBan' && active(t, state.day) && samePair(t, a, b));
}

export const banMessage = (catalog: Catalog, t: ActiveTension) =>
  `Flights banned between ${countryName(catalog, t.countries![0])} and ${countryName(catalog, t.countries![1])}`;

/** Player-facing one-liner for a tension (also used in the client view). */
export function tensionLabel(catalog: Catalog, t: ActiveTension): string {
  switch (t.kind) {
    case 'airspaceClosure': return `Airspace closed over ${catalog.airspace.find((r) => r.id === t.regionId)?.name ?? 'a region'}`;
    case 'routeBan': return banMessage(catalog, t);
    case 'advisory': return `Travel advisory for ${countryName(catalog, t.country!)}`;
    case 'thawBonus': return `Travel rebounds between ${countryName(catalog, t.countries![0])} and ${countryName(catalog, t.countries![1])}`;
  }
}

/** Demand multiplier for travel from o to d: advisories cut demand to a country, thaws lift a pair. */
export function tensionDemandFactor(state: GameState, o: Airport, d: Airport): number {
  let f = 1;
  for (const t of state.world.tensions) {
    if (!active(t, state.day)) continue;
    if (t.kind === 'advisory' && t.country === d.country) f *= 1 - t.magnitude;
    else if (t.kind === 'thawBonus' && samePair(t, o.country, d.country)) f *= 1 + t.magnitude;
  }
  return f;
}

/** Does the player have a route this tension touches? */
function affectsPlayer(state: GameState, catalog: Catalog, t: ActiveTension): boolean {
  return Object.values(state.routes).some((r) => r.airlineId === state.playerId && touches(state, catalog, t, r));
}
function touches(_state: GameState, catalog: Catalog, t: ActiveTension, r: Route): boolean {
  const a = catalog.airports[r.from]!, b = catalog.airports[r.to]!;
  if (t.kind === 'routeBan' || t.kind === 'thawBonus') return samePair(t, a.country, b.country);
  if (t.kind === 'advisory') return a.country === t.country || b.country === t.country;
  return !!t.regionId && routeCrossesRegion(catalog, r.from, r.to, t.regionId);
}

function note(state: GameState, level: Notification['level'], title: string, body: string): Notification {
  return { id: nextId(state, 'n'), day: state.day, level, category: 'event', title, body };
}

/** End expired tensions, start warned ones, roll thaws and new events. Returns notifications. */
export function rollTensions(state: GameState, catalog: Catalog, rng: Rng): Notification[] {
  const out: Notification[] = [];
  const w = state.world;

  for (const t of w.tensions.filter((x) => x.endDay < state.day)) {
    const ends: Record<TensionKind, () => string> = {
      airspaceClosure: () => `Airspace reopens over ${catalog.airspace.find((r) => r.id === t.regionId)?.name ?? 'a region'}`,
      routeBan: () => `Flights resume between ${countryName(catalog, t.countries![0])} and ${countryName(catalog, t.countries![1])}`,
      advisory: () => `Travel advisory lifted for ${countryName(catalog, t.country!)}`,
      thawBonus: () => '',
    };
    if (t.kind !== 'thawBonus') out.push(note(state, 'info', ends[t.kind](), 'Normal service can resume.'));
  }
  w.tensions = w.tensions.filter((x) => x.endDay >= state.day);

  for (const t of w.tensions) {
    if (t.startDay !== state.day || t.kind === 'thawBonus') continue;
    const mine = affectsPlayer(state, catalog, t);
    const body = t.kind === 'airspaceClosure' ? 'Flights crossing it now fly longer detours; some may be out of range.'
      : t.kind === 'routeBan' ? 'Routes between the two countries are grounded until it lifts. Their slots are kept.'
      : `Demand for travel there is down about ${Math.round(t.magnitude * 100)}%.`;
    out.push(note(state, mine ? 'major' : 'info', tensionLabel(catalog, t), mine ? `${body} Some of your routes are affected.` : body));
  }

  for (const t of [...w.tensions]) {
    if (t.kind !== 'routeBan' || !active(t, state.day) || !rng.chance(TENSIONS.thawPerBanDay)) continue;
    w.tensions = w.tensions.filter((x) => x !== t); // lifted now: no separate "resume" note tomorrow
    w.tensions.push({ id: nextId(state, 'tn'), kind: 'thawBonus', countries: t.countries, magnitude: TENSIONS.thawBonus, warnDay: state.day, startDay: state.day + 1, endDay: state.day + TENSIONS.thawBonusDays });
    out.push(note(state, affectsPlayer(state, catalog, t) ? 'major' : 'info', `Flights resume early between ${countryName(catalog, t.countries![0])} and ${countryName(catalog, t.countries![1])}`,
      'Restrictions have been lifted. Expect a rebound in travel between them for about three months.'));
  }

  const routes = Object.values(state.routes).filter((r) => r.status === 'active');
  const warn = () => state.day + rng.int(TENSIONS.warnDays[0], TENSIONS.warnDays[1]);
  const start = (kind: TensionKind, days: number, fields: Partial<ActiveTension>, magnitude = 1) => {
    const startDay = warn();
    const t: ActiveTension = { id: nextId(state, 'tn'), kind, magnitude, warnDay: state.day, startDay, endDay: startDay + days - 1, ...fields };
    w.tensions.push(t);
    return t;
  };
  const inDays = (t: ActiveTension) => `in about ${t.startDay - state.day} days`;

  if (rng.chance(TENSIONS.closurePerDay) && catalog.airspace.length) {
    const open = catalog.airspace.filter((r) => !w.tensions.some((t) => t.kind === 'airspaceClosure' && t.regionId === r.id));
    const sample = rng.chance(0.7) ? routes.slice(0, 40) : [];
    const crossed = open.filter((r) => sample.some((x) => touches(state, catalog, { id: '', kind: 'airspaceClosure', regionId: r.id, magnitude: 1, warnDay: 0, startDay: 0, endDay: 0 }, x)));
    const pool = crossed.length ? crossed : open;
    if (pool.length) {
      const region = rng.pick(pool);
      const t = start('airspaceClosure', rng.int(TENSIONS.closureDays[0], TENSIONS.closureDays[1]), { regionId: region.id });
      out.push(note(state, affectsPlayer(state, catalog, t) ? 'warning' : 'info', `Rising tensions: ${region.name} airspace may close`,
        `It could close ${inDays(t)}. Routes crossing it would need longer detours.`));
    }
  }
  if (rng.chance(TENSIONS.banPerDay)) {
    const intl = routes.filter((r) => catalog.airports[r.from]!.country !== catalog.airports[r.to]!.country);
    if (intl.length) {
      const r = rng.pick(intl);
      const a = catalog.airports[r.from]!.country, b = catalog.airports[r.to]!.country;
      if (!w.tensions.some((t) => t.kind === 'routeBan' && samePair(t, a, b))) {
        const t = start('routeBan', rng.int(TENSIONS.banDays[0], TENSIONS.banDays[1]), { countries: [a, b] });
        out.push(note(state, affectsPlayer(state, catalog, t) ? 'warning' : 'info', `Rising tensions: flights between ${countryName(catalog, a)} and ${countryName(catalog, b)} may be suspended`,
          `A ban could start ${inDays(t)}. Routes between them would be grounded until it lifts.`));
      }
    }
  }
  if (rng.chance(TENSIONS.advisoryPerDay) && routes.length) {
    const r = rng.pick(routes);
    const country = catalog.airports[rng.chance(0.5) ? r.from : r.to]!.country;
    if (!w.tensions.some((t) => t.kind === 'advisory' && t.country === country)) {
      const mag = Math.round(rng.range(TENSIONS.advisoryMagnitude[0], TENSIONS.advisoryMagnitude[1]) * 100) / 100;
      const t = start('advisory', rng.int(TENSIONS.advisoryDays[0], TENSIONS.advisoryDays[1]), { country }, mag);
      out.push(note(state, affectsPlayer(state, catalog, t) ? 'warning' : 'info', `Rising tensions: travel advisory expected for ${countryName(catalog, country)}`,
        `From ${inDays(t)}, demand for travel there could fall about ${Math.round(mag * 100)}%.`));
    }
  }
  return out;
}

/** Why a route can't fly today because of tensions (ban, no way around, detour beyond an aircraft's range), with its detour. */
export function routeTensionStatus(state: GameState, catalog: Catalog, r: Route): { detourKm: number; blocked: string | null } {
  const a = catalog.airports[r.from]!, b = catalog.airports[r.to]!;
  const flight = flightDistanceKm(state, catalog, r.from, r.to);
  const ban = isBanned(state, a.country, b.country);
  const short = r.assignments.map((x) => state.aircraft[x.aircraftId]).find((ac) => ac && catalog.aircraftTypes[ac.typeId]!.rangeKm < flight.km);
  return {
    detourKm: flight.detourKm,
    blocked: ban ? banMessage(catalog, ban) : flight.blocked ?? (short ? `Detour exceeds ${catalog.aircraftTypes[short.typeId]!.name} range` : null),
  };
}
