import type { AircraftType, Cabin, CabinClass, Catalog, GameState, Route } from '@skyempire/shared';
import { CABIN_CLASSES } from '@skyempire/shared';
import { allocate, type Offer } from './allocation';
import { dateOf } from './calendar';
import { BALANCE, WEATHER } from './config/balance';
import { baseDemand, classSplit, elasticDemand, refFare } from './demand';
import { flightsToday } from './economics';
import { effectiveFare } from './fares';
import { holidayDemandFactors } from './holidays';
import { isAirportClosed, isStormAffected } from './events';
import { distanceKm } from './geo';
import { onTimeFor } from './maintenance';
import { blockHours, chainRoundTripHours, slotCapacity } from './ops';
import { offerQuality } from './quality';
import { productScore } from './cabin';
import { weatherAt, weatherEffect, type WeatherEffect } from './weather';
import { flightDistanceKm, marketFare, routeChain, routeLegs, routeMarkets, type RouteMarket } from './routing';
import { pairKey } from './routing';
import { banMessage, isBanned, tensionDemandFactor } from './tensions';

export const emptyCabin = (): Cabin => ({ economy: 0, premium: 0, business: 0 });
export { pairKey };

/** Weekly hours each aircraft is committed to across active routes. */
export function hoursByAircraft(state: GameState, catalog: Catalog): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of Object.values(state.routes)) {
    if (r.status !== 'active') continue;
    for (const a of r.assignments) {
      const ac = state.aircraft[a.aircraftId];
      if (!ac) continue;
      m.set(ac.id, (m.get(ac.id) ?? 0) + a.roundTripsPerWeek * chainRoundTripHours(catalog, r, catalog.aircraftTypes[ac.typeId]!));
    }
  }
  return m;
}

export interface RouteOps {
  route: Route;
  closed: boolean;
  /** Round trips flown today per aircraft (fractional in "average day" mode). */
  roundTrips: Map<string, number>;
  /** Seats per direction per class today. */
  seats: Cabin;
  weeklyFrequency: number;
  /** Offer quality per class (0–100), seat-weighted across the route's aircraft. */
  quality: Cabin;
  /** Seat-weighted mean of the class qualities (for reputation). */
  qualityMean: number;
  onTime: number;
  blockH: number;
  /** Weather extras today: de-icing plus passenger care for cancelled or pre-cancelled seats. */
  weatherFees: number;
  /** Extra km flown around closed airspace. */
  detourKm: number;
  /** Why the route (or some of its aircraft) can't fly today: a ban, no way around closed airspace, or out of range. */
  blocked: string | null;
  /** Cargo tonnes it can carry today per direction on each leg: freighter payload, or belly holds. */
  cargoCapT: number;
  /** Has a main-deck freighter (live animals, outsize). */
  special: boolean;
}

/** Hold tonnes for cargo and bags: the type's figure, else a typical one for its size. */
export function bellyTOf(t: AircraftType): number {
  return t.bellyT ?? ({ turboprop: 0.8, regional: 1.2, narrowbody: 2.5, longNarrowbody: 3, widebody: 12 } as const)[t.class];
}
/** Share of the hold sold for cargo on the default setting: narrowbody holds are mostly bags. */
export const defaultHoldShare = (t: AircraftType) => (t.class === 'widebody' || t.class === 'longNarrowbody' ? 0.6 : 0.35);
/** Above this hold share, bags start being left behind. */
const BAG_ROOM = 0.75;

/** What a route operates today. `average` = typical day (rtpw / 7) for previews. */
export function routeOps(route: Route, state: GameState, catalog: Catalog, hours: Map<string, number>, average: boolean): RouteOps {
  // A route is a chain of airports (from → stops → to); a nonstop route is a chain of two.
  const chain = routeChain(route).map((id) => catalog.airports[id]!);
  const legs = routeLegs(route);
  const flights = legs.map(([x, y]) => flightDistanceKm(state, catalog, x, y));
  const banned = legs.map(([x, y]) => isBanned(state, catalog.airports[x]!.country, catalog.airports[y]!.country)).find(Boolean);
  const blocked = banned ? banMessage(catalog, banned) : (flights.find((f) => f.blocked)?.blocked ?? null);
  // Weather applies to real days only; previews show a typical day.
  const weather = chain.map((ap) => (average ? 'clear' : weatherAt(state, catalog, ap.id, state.day)));
  const preCancelled = !average && (state.world.preCancelled[route.id]?.includes(state.day) ?? false);
  const struck = chain.some((ap) => isAirportClosed(state, ap.id));
  const cyclone = weather.includes('cyclone');
  const closed = struck || cyclone;
  /** Departures from each airport per round trip: ends once, stops twice. */
  const visits = chain.map((_, i) => (i === 0 || i === chain.length - 1 ? 1 : 2));
  const roundTrips = new Map<string, number>();
  const seats = emptyCabin();
  let rangeBlocked: string | null = null;
  const al = state.airlines[route.airlineId]!;
  const cargoRoute = route.kind === 'cargo';
  const customShare = route.belly?.mode === 'custom' ? route.belly.holdShare : null;
  const bellyOn = !cargoRoute && al.bellyCargo !== false;
  let cargoCapT = 0, special = false;
  let weeklyFrequency = 0, condSum = 0, utilSum = 0, penaltySum = 0, n = 0, blockH = 0, weatherFees = 0;
  // Share of flights the weather cancels at one end: its own cancellations, or what reduced capacity can't handle.
  const endCancel = (ap: (typeof chain)[number], eff: WeatherEffect) => {
    if (eff.capacityCut <= 0) return eff.cancelShare;
    const used = state.slotsUsed[ap.id] ?? 0;
    const overflow = used > 0 ? 1 - ((1 - eff.capacityCut) * slotCapacity(state, catalog, ap.id)) / used : 0;
    return Math.min(1, Math.max(eff.cancelShare, overflow));
  };
  for (const asg of route.assignments) {
    const ac = state.aircraft[asg.aircraftId];
    if (!ac) continue;
    weeklyFrequency += asg.roundTripsPerWeek;
    const t = catalog.aircraftTypes[ac.typeId]!;
    blockH = flights.reduce((h, f) => h + blockHours(f.km, t.cruiseKmh), 0);
    const outOfRange = flights.some((f) => t.rangeKm < f.km);
    // Flights a cyclone would cancel still count as scheduled (stranded passengers cost money); strikes ground everything.
    const flying = !struck && !blocked && !outOfRange && ac.status === 'active' && !(ac.refitDaysLeft > 0) && !(ac.deliveryDay !== undefined && ac.deliveryDay > state.day);
    if (outOfRange && !blocked && !rangeBlocked) rangeBlocked = `Detour exceeds ${t.name} range`;
    const scheduled = flying ? (average ? asg.roundTripsPerWeek / 7 : flightsToday(asg.roundTripsPerWeek, state.day)) : 0;
    const acSeats = CABIN_CLASSES.reduce((s, c) => s + ac.cabin[c], 0);
    const util = (hours.get(ac.id) ?? 0) / BALANCE.weeklyHours;
    let rt = scheduled;
    if (preCancelled || cyclone) {
      weatherFees += (preCancelled ? WEATHER.preCancelCostPerSeat : WEATHER.cancelCostPerSeat) * 2 * legs.length * scheduled * acSeats;
      rt = 0;
    } else if (scheduled > 0) {
      const effects = chain.map((ap, i) => weatherEffect(weather[i]!, ap, t.class));
      const cancel = Math.max(...chain.map((ap, i) => endCancel(ap, effects[i]!)));
      rt = scheduled * (1 - cancel);
      weatherFees += WEATHER.cancelCostPerSeat * 2 * legs.length * (scheduled - rt) * acSeats;
      weatherFees += rt * effects.reduce((x, e, i) => x + visits[i]! * e.deicePerDeparture, 0);
      penaltySum += Math.max(...effects.map((e) => e.onTimePenalty)) * (util < WEATHER.spareUtilisation ? 0.5 : 1);
    }
    roundTrips.set(ac.id, rt);
    for (const c of CABIN_CLASSES) seats[c] += rt * ac.cabin[c];
    if (cargoRoute && t.kind === 'freighter') { cargoCapT += rt * (t.payloadT ?? 0); special ||= !!t.special; }
    else if (bellyOn && t.kind !== 'freighter') cargoCapT += rt * bellyTOf(t) * (customShare ?? defaultHoldShare(t));
    condSum += ac.condition;
    utilSum += util;
    n += 1;
  }
  const congestion = Math.max(...chain.map((ap) => (state.slotsUsed[ap.id] ?? 0) / Math.max(1, slotCapacity(state, catalog, ap.id))));
  const onTime = closed
    ? 40 // flights cancelled: counts as a bad day for punctuality
    : n
    ? Math.max(40, onTimeFor(condSum / n, congestion, utilSum / n, chain.some((ap) => isStormAffected(state, ap.id))) - penaltySum / n)
    : BALANCE.baseOnTime;
  // Quality per class: each aircraft's offer, weighted by the seats it puts in that class.
  const quality = emptyCabin(), qualSeats = emptyCabin();
  for (const asg of route.assignments) {
    const ac = state.aircraft[asg.aircraftId];
    if (!ac) continue;
    const t = catalog.aircraftTypes[ac.typeId]!;
    // Only aircraft that can fly count: one in a refit or a check offers nothing today.
    if (ac.status !== 'active' || ac.refitDaysLeft > 0) continue;
    for (const cls of CABIN_CLASSES) {
      const w = ac.cabin[cls] * asg.roundTripsPerWeek;
      if (w <= 0) continue;
      quality[cls] += w * offerQuality({ comfort: t.comfort, ageYears: ac.ageDays / 360, productScore: productScore(ac.product, cls, ac.dense, Math.max(...flights.map((f) => blockHours(f.km, t.cruiseKmh)))), onTime });
      qualSeats[cls] += w;
    }
  }
  for (const cls of CABIN_CLASSES) quality[cls] = qualSeats[cls] > 0 ? quality[cls] / qualSeats[cls] : 50;
  // A hold filled with cargo leaves bags behind.
  if (bellyOn && customShare !== null && customShare > BAG_ROOM) for (const cls of CABIN_CLASSES) quality[cls] -= (customShare - BAG_ROOM) * 40;
  const allSeats = CABIN_CLASSES.reduce((s, c) => s + qualSeats[c], 0);
  const qualityMean = allSeats > 0 ? CABIN_CLASSES.reduce((s, c) => s + quality[c] * qualSeats[c], 0) / allSeats : 50;
  return {
    route, closed, roundTrips, seats, weeklyFrequency, quality, qualityMean, onTime, blockH, weatherFees: Math.round(weatherFees),
    detourKm: flights.reduce((x, f) => x + f.detourKm, 0), blocked: blocked ?? rangeBlocked, cargoCapT, special,
  };
}

export interface PairResult {
  /** Passengers per route per class, both directions combined. */
  pax: Map<string, Cabin>;
  /** The same per direction: [A→B, B→A], where A–B are the first entry's market ends. */
  dirPax?: Map<string, [Cabin, Cabin]>;
  /** The market's A end (direction 0 starts here). */
  from?: string;
  /** Unconstrained daily demand both directions (before price effects). */
  demand: number;
}

/** One route's offer in one market (airport pair) it sells. */
export interface MarketEntry { ops: RouteOps; m: RouteMarket }

/** Demand and passenger allocation for one airport pair, both directions, all classes (a stop route sells it as a through market). */
export function simulatePair(ops: RouteOps[], state: GameState, catalog: Catalog): PairResult {
  // The pair is the one these routes share: a nonstop route's ends, else the first route's ends.
  const lead = (ops.find((o) => !o.route.stops?.length) ?? ops[0])?.route;
  if (!lead) return { pax: new Map(), demand: 0 };
  const key = pairKey(lead.from, lead.to);
  return simulateMarket(ops.map((o) => ({
    ops: o,
    m: routeMarkets(o.route).find((m) => m.key === key) ?? { a: lead.from, b: lead.to, key, stops: 0, first: 0, last: 0 },
  })), state, catalog);
}

/** Demand and passenger allocation for one market, every route selling it (nonstop or through a stop). */
export function simulateMarket(entries: MarketEntry[], state: GameState, catalog: Catalog): PairResult {
  const ops = entries.map((e) => e.ops);
  const pax = new Map<string, Cabin>(ops.map((o) => [o.route.id, emptyCabin()]));
  const dirPax = new Map<string, [Cabin, Cabin]>(ops.map((o) => [o.route.id, [emptyCabin(), emptyCabin()]]));
  if (entries.length === 0) return { pax, demand: 0 };
  const A = catalog.airports[entries[0]!.m.a]!, B = catalog.airports[entries[0]!.m.b]!;
  const dist = distanceKm(A, B);
  const doy = dateOf(state.day, state.world.startYear).dayOfYear;
  let demandTotal = 0;
  for (const [dir, [o, d]] of ([[A, B], [B, A]] as const).entries()) {
    const base = baseDemand(o, d, doy, state.market.economyIndex) * tensionDemandFactor(state, o, d);
    demandTotal += base;
    const split = classSplit(o, d);
    const hol = holidayDemandFactors(o, d, state.day, state.world.startYear, catalog);
    for (const cls of CABIN_CLASSES) {
      const ref = refFare(dist, cls);
      const classBase = base * split[cls] * (cls === 'business' ? hol.business : hol.leisure);
      const offers: Offer[] = entries
        .filter(({ ops: x }) => x.weeklyFrequency > 0)
        .map(({ ops: x, m }) => ({
          airlineId: x.route.airlineId, routeId: x.route.id, fare: marketFare(x.route, m.a, m.b, cls, state.day), weeklyFrequency: x.weeklyFrequency,
          quality: x.quality[cls], reputation: state.airlines[x.route.airlineId]!.reputation, stops: m.stops, seats: x.seats[cls],
        }));
      const withSeats = offers.filter((x) => x.seats > 0);
      if (withSeats.length === 0) continue;
      // "Other airlines": real carriers not in this world. They soak up demand the game's airlines don't serve,
      // so no player is ever a true monopolist on a big market.
      const classDemand = classBase;
      const gameSeats = withSeats.reduce((s, x) => s + x.seats, 0);
      const bgSeats = Math.max(BALANCE.backgroundMinShare * classDemand, BALANCE.backgroundShare * classDemand - gameSeats);
      offers.push({
        airlineId: '__others', routeId: '__others', fare: Math.round(ref * BALANCE.backgroundFareFactor),
        weeklyFrequency: Math.max(1, Math.round((bgSeats / BALANCE.backgroundSeatsPerFlight) * 7 / Math.max(split[cls], 0.05))),
        quality: BALANCE.backgroundQuality, reputation: BALANCE.backgroundReputation, stops: 0, seats: bgSeats,
      });
      const seatSum = withSeats.reduce((s, x) => s + x.seats, 0);
      const avgFare = (withSeats.reduce((s, x) => s + x.fare * x.seats, 0) + ref * BALANCE.backgroundFareFactor * Math.max(0, BALANCE.backgroundShare * classBase - seatSum)) / Math.max(seatSum, BALANCE.backgroundShare * classBase);
      const demand = elasticDemand(classBase, avgFare, ref, cls);
      for (const [routeId, n] of allocate(demand, offers, ref, cls)) {
        if (routeId === '__others') continue;
        pax.get(routeId)![cls] += n;
        dirPax.get(routeId)![dir]![cls] += n;
      }
    }
  }
  return { pax, dirPax, from: A.id, demand: demandTotal };
}

/** What a route sold today: passengers per market, revenue and how full each leg was. */
/** `revenue` is rounded to dollars; `ticketRevenue` is exact (it feeds the distribution fee). */
export interface RouteResult { pax: Cabin; marketPax: Map<string, Cabin>; revenue: number; ticketRevenue: number; legLoad: number[]; loadFactor: number; legPaxByDirection: [Cabin, Cabin][] }

/**
 * Passengers for a set of routes: every market of every route is allocated against all routes selling that market,
 * then multi-stop routes have their legs capped at their seats (markets sharing a full leg are scaled down).
 */
export function simulateRoutes(opsList: RouteOps[], state: GameState, catalog: Catalog): { results: Map<string, RouteResult>; demand: Map<string, number> } {
  const byMarket = new Map<string, MarketEntry[]>();
  for (const ops of opsList) for (const m of routeMarkets(ops.route)) {
    if (!byMarket.has(m.key)) byMarket.set(m.key, []);
    byMarket.get(m.key)!.push({ ops, m });
  }
  // Per route and market: passengers [forward, back], forward = the route's own chain order.
  const marketDir = new Map<string, Map<string, [Cabin, Cabin]>>(opsList.map((o) => [o.route.id, new Map()]));
  const demand = new Map<string, number>();
  for (const [key, entries] of byMarket) {
    const res = simulateMarket(entries, state, catalog);
    demand.set(key, res.demand);
    for (const { ops, m } of entries) {
      const [ab, ba] = res.dirPax!.get(ops.route.id)!;
      marketDir.get(ops.route.id)!.set(key, m.a === res.from ? [ab, ba] : [ba, ab]);
    }
  }
  const results = new Map<string, RouteResult>();
  for (const ops of opsList) {
    const r = ops.route;
    const markets = routeMarkets(r);
    const md = marketDir.get(r.id)!;
    const legCount = markets.reduce((n, m) => Math.max(n, m.last + 1), 0);
    // A leg can't carry more than its seats in either direction: scale the markets sharing an overfull leg.
    // Scaling only lowers loads, so one pass settles every leg.
    if (legCount > 1) for (let leg = 0; leg < legCount; leg++) for (const d of [0, 1] as const) for (const c of CABIN_CLASSES) {
      const on = markets.filter((m) => m.first <= leg && leg <= m.last);
      const load = on.reduce((x, m) => x + (md.get(m.key)?.[d][c] ?? 0), 0);
      if (load > ops.seats[c] + 1e-9) for (const m of on) md.get(m.key)![d][c] *= ops.seats[c] / load;
    }
    const mp = new Map<string, Cabin>([...md].map(([k, [f, b]]) => [k, { economy: f.economy + b.economy, premium: f.premium + b.premium, business: f.business + b.business }]));
    const legPaxByDirection = Array.from({ length: legCount }, (_, leg) => {
      const on = markets.filter((m) => m.first <= leg && leg <= m.last);
      return ([0, 1] as const).map((d) => {
        const c = emptyCabin();
        for (const m of on) for (const k of CABIN_CLASSES) c[k] += md.get(m.key)?.[d][k] ?? 0;
        return c;
      }) as [Cabin, Cabin];
    });
    const pax = emptyCabin();
    let revenue = 0;
    for (const m of markets) {
      const p = mp.get(m.key) ?? emptyCabin();
      for (const c of CABIN_CLASSES) { pax[c] += p[c]; revenue += p[c] * marketFare(r, m.a, m.b, c, state.day); }
    }
    const seats2 = 2 * CABIN_CLASSES.reduce((x, c) => x + ops.seats[c], 0);
    const legLoad = Array.from({ length: legCount }, (_, leg) => {
      const onLeg = markets.filter((m) => m.first <= leg && leg <= m.last).reduce((x, m) => x + CABIN_CLASSES.reduce((y, c) => y + (mp.get(m.key)?.[c] ?? 0), 0), 0);
      return seats2 > 0 ? onLeg / seats2 : 0;
    });
    const loadFactor = legLoad.length ? legLoad.reduce((a, b) => a + b, 0) / legLoad.length : 0;
    results.set(r.id, { pax, marketPax: mp, revenue: Math.round(revenue), ticketRevenue: revenue, legLoad, loadFactor, legPaxByDirection });
  }
  return { results, demand };
}

export function revenueOf(route: Route, pax: Cabin, day: number): number {
  return Math.round(CABIN_CLASSES.reduce((s, c: CabinClass) => s + pax[c] * effectiveFare(route, c, day), 0));
}

export function totalSeats(ops: RouteOps): number {
  return 2 * CABIN_CLASSES.reduce((s, c) => s + ops.seats[c], 0);
}
