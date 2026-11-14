import type { AircraftType, Catalog, Command, GameState, Route } from '@skyempire/shared';
import { CABIN_CLASSES } from '@skyempire/shared';
import { applyCommand } from '../commands/apply';
import { BALANCE } from '../config/balance';
import { hoursByAircraft, pairKey, revenueOf, routeOps, simulatePair } from '../daySim';
import { refFare } from '../demand';
import { routeDayCosts } from '../economics';
import { availableCredit, monthlyFixedCosts } from '../finance';
import { tierAllows } from '../fleet';
import { defaultConfig } from '../cabin';
import { distanceKm } from '../geo';
import { maxRoundTripsPerWeek, roundTripHours } from '../ops';
import type { Rng } from '../rng';
import { upcomingPeaks } from '../holidays';
import { flightDistanceKm } from '../routing';
import { routeTensionStatus } from '../tensions';
import { PERSONALITIES, type Personality } from './personalities';

const CANDIDATES_PER_BASE = 40;
const MIN_KM = 150;

/** Fares an AI sets on a new route of this length. */
export function aiFares(distKm: number, p: Personality): Route['fares'] {
  const k = 1 - 0.2 * p.priceAggressiveness;
  return {
    economy: Math.round(refFare(distKm, 'economy') * k),
    premium: Math.round(refFare(distKm, 'premium') * (k + 0.1)),
    business: Math.round(refFare(distKm, 'business') * (k + 0.2)),
  };
}

/** Expected daily profit of a hypothetical route, without changing state. */
export function estimateRoute(
  state: GameState, airlineId: string, from: string, to: string, aircraftId: string, rtpw: number, fares: Route['fares'], catalog: Catalog, hours: Map<string, number>,
  byPair?: Map<string, Route[]>,
): { profit: number; competitors: number } {
  const cand: Route = {
    id: '__candidate', airlineId, from, to, fares, assignments: [{ aircraftId, roundTripsPerWeek: rtpw }],
    status: 'active', openedDay: state.day, last: null, profit30: [],
  };
  const key = pairKey(from, to);
  const rivals = byPair ? (byPair.get(key) ?? []) : Object.values(state.routes).filter((r) => r.status === 'active' && pairKey(r.from, r.to) === key);
  const opsList = [...rivals, cand].map((r) => routeOps(r, state, catalog, hours, true));
  const res = simulatePair(opsList, state, catalog);
  const ops = opsList[opsList.length - 1]!;
  const pax = res.pax.get(cand.id)!;
  const legs = new Map([...ops.roundTrips].map(([k, v]) => [k, 2 * v]));
  const c = routeDayCosts(cand, state, catalog, legs, pax, false);
  const ac = state.aircraft[aircraftId]!;
  const t = catalog.aircraftTypes[ac.typeId]!;
  const share = (rtpw * roundTripHours(distanceKm(catalog.airports[from]!, catalog.airports[to]!), t)) / BALANCE.weeklyHours;
  const fixed = (((ac.ownership === 'leased' ? t.leasePerMonth : 0) + BALANCE.overheadPerAircraft) / 30) * share;
  const profit = revenueOf(cand, pax, state.day) - (c.fuel + c.crew + c.maintenance + c.fees + c.service) - fixed;
  return { profit, competitors: rivals.length };
}

function pickType(state: GameState, airlineId: string, catalog: Catalog, p: Personality): AircraftType | null {
  const al = state.airlines[airlineId]!;
  const data = catalog.airlines.find((a) => `al_${a.iata}` === airlineId);
  const allowed = (data?.fleetTypes ?? ['A20N'])
    .map((id) => catalog.aircraftTypes[id])
    .filter((t): t is AircraftType => !!t && tierAllows(al.tier, t.tier));
  if (!allowed.length) return null;
  const preferred = allowed.filter((t) => p.preferredClasses.includes(t.class));
  const pool = preferred.length ? preferred : allowed;
  return [...pool].sort((a, b) => a.leasePerMonth - b.leasePerMonth)[0]!;
}

/**
 * One AI decision round (simulation-spec §10). Applies its own commands to `state`
 * (so later steps see aircraft it just acquired) and returns the commands that succeeded.
 */
export function runAi(state: GameState, airlineId: string, catalog: Catalog, rng: Rng): Command[] {
  const al = state.airlines[airlineId];
  if (!al || al.bankrupt || !al.personality) return [];
  const p = PERSONALITIES[al.personality];
  const noise = BALANCE.aiNoise[state.difficulty];
  const done: Command[] = [];
  const act = (cmd: Command) => {
    const r = applyCommand(state, airlineId, cmd, catalog);
    if (r.ok) done.push(cmd);
    return r.ok;
  };
  const myRoutes = () => Object.values(state.routes).filter((r) => r.airlineId === airlineId);

  // 1. Fares (rivals' fares indexed once per decision, by airport pair)
  const rivalFares = new Map<string, Route[]>();
  for (const x of Object.values(state.routes)) {
    if (x.airlineId === airlineId || x.status !== 'active') continue;
    const k = pairKey(x.from, x.to);
    const list = rivalFares.get(k);
    if (list) list.push(x);
    else rivalFares.set(k, [x]);
  }
  for (const r of myRoutes()) {
    if (r.status !== 'active' || !r.last) continue;
    const dist = distanceKm(catalog.airports[r.from]!, catalog.airports[r.to]!);
    const fares = { ...r.fares };
    let k = 1;
    if (r.last.loadFactor < 0.6) k = 1 - 0.05 - 0.1 * p.priceAggressiveness;
    else if (r.last.loadFactor > 0.9) k = 1.05;
    for (const cls of CABIN_CLASSES) {
      const ref = refFare(dist, cls);
      let f = fares[cls] * k;
      const rival = (rivalFares.get(pairKey(r.from, r.to)) ?? []).map((x) => x.fares[cls]);
      const cheapest = rival.length ? Math.min(...rival) : Infinity;
      if (cheapest <= f * 0.9) f -= (f - cheapest) * p.priceAggressiveness * 0.5;
      // Price ceiling by style: budget ≈ 0.9× ref, legacy ≈ 1.35× ref.
      fares[cls] = Math.round(Math.min((1.6 - 0.8 * p.priceAggressiveness) * ref, Math.max(0.5 * ref, f)));
    }
    if (CABIN_CLASSES.some((c) => fares[c] !== r.fares[c])) act({ type: 'updateRoute', routeId: r.id, fares });
  }

  // 1b. Peak pricing: raise fares for big festivals in the route's countries (the next 3 weeks).
  for (const r of myRoutes()) {
    if (r.status !== 'active') continue;
    const countries = [...new Set([catalog.airports[r.from]!.country, catalog.airports[r.to]!.country])];
    const current = (r.seasonalFares ?? []).filter((f) => f.endDay >= state.day);
    const peak = upcomingPeaks(countries, state.day, state.day + 21, state.world.startYear, catalog)
      .find((pk) => pk.peak >= 0.3 && !current.some((f) => f.endDay >= pk.startDay && f.startDay <= pk.endDay));
    if (!peak || current.length >= 4) continue;
    const pct = Math.round((10 + 15 * peak.peak) * (1 - 0.5 * p.priceAggressiveness));
    act({ type: 'updateRoute', routeId: r.id, seasonalFares: [...current, { startDay: Math.max(state.day, peak.startDay), endDay: peak.endDay, pct }] });
  }

  // 2. Close persistent losers
  for (const r of myRoutes()) {
    if (state.day - r.openedDay >= 60 && r.profit30.length >= 30 && r.profit30.reduce((a, b) => a + b, 0) < 0)
      act({ type: 'closeRoute', routeId: r.id });
  }

  // 2b. Drop routes grounded by tensions (bans, closed airspace, detours beyond range): free the aircraft for elsewhere.
  for (const r of myRoutes()) {
    const status = routeTensionStatus(state, catalog, r);
    if (!status.blocked) continue;
    const km = flightDistanceKm(state, catalog, r.from, r.to).km;
    const outOfRange = r.assignments.map((x) => { const ac = state.aircraft[x.aircraftId]; return !ac || catalog.aircraftTypes[ac.typeId]!.rangeKm < km; });
    if (aiShouldDrop(status, outOfRange)) act({ type: 'closeRoute', routeId: r.id });
  }

  // 3. Liquidity
  const monthly = monthlyFixedCosts(state, airlineId, catalog);
  const monthlyTotal = monthly.leases + monthly.overhead + monthly.bases + monthly.marketing;
  if (al.cash < monthlyTotal && p.riskTolerance >= 0.3) {
    const amount = Math.round(Math.min(availableCredit(state, airlineId, catalog), 3 * monthlyTotal));
    if (amount > 0) act({ type: 'takeLoan', amount });
  }

  // 3b. Survival: when cash covers less than two months of fixed bills, cut costs instead of growing.
  const survival = al.cash < 2 * monthlyTotal && availableCredit(state, airlineId, catalog) < 2 * monthlyTotal;
  if (survival) {
    const busy = hoursByAircraft(state, catalog);
    for (const ac of Object.values(state.aircraft)) {
      if (ac.ownerId === airlineId && !busy.get(ac.id)) act({ type: 'sellAircraft', aircraftId: ac.id });
    }
    const losers = myRoutes()
      .filter((r) => r.status === 'active' && r.profit30.length >= 7)
      .map((r) => ({ r, p: r.profit30.reduce((a, b) => a + b, 0) }))
      .filter((x) => x.p < 0)
      .sort((a, b) => a.p - b.p);
    if (losers[0]) act({ type: 'closeRoute', routeId: losers[0].r.id });
    return done;
  }

  // 4. Expansion
  let hours = hoursByAircraft(state, catalog);
  const fleet = () => Object.values(state.aircraft).filter((a) => a.ownerId === airlineId);
  const freeAircraft = () =>
    fleet().filter((a) => (hours.get(a.id) ?? 0) <= 0.7 * BALANCE.weeklyHours).sort((x, y) => (hours.get(x.id) ?? 0) - (hours.get(y.id) ?? 0));
  const idle = fleet().filter((a) => !hours.get(a.id)).length;
  const maxNew = Math.max(1 + Math.round(p.expansionRate * 2), idle);
  const airports = Object.values(catalog.airports);
  const realFromHere = catalog.realRoutes.filter((r) => `al_${r.airlineIata}` === airlineId);

  const byPair = new Map<string, Route[]>();
  for (const r of Object.values(state.routes)) {
    if (r.status !== 'active') continue;
    const k = pairKey(r.from, r.to);
    if (!byPair.has(k)) byPair.set(k, []);
    byPair.get(k)!.push(r);
  }
  let ranked: { from: string; to: string; dist: number; score: number }[] | null = null;
  const taken = new Set(myRoutes().map((r) => pairKey(r.from, r.to)));

  for (let n = 0; n < maxNew; n++) {
    let ac = freeAircraft()[0];
    if (!ac) {
      const t = pickType(state, airlineId, catalog, p);
      const need = monthlyFixedCosts(state, airlineId, catalog);
      const needTotal = need.leases + need.overhead + need.bases + need.marketing;
      if (!t || al.cash < 3 * needTotal + t.leasePerMonth) break;
      const buy = al.cash > 2 * t.priceUsd && p.riskTolerance < 0.5;
      if (!act({ type: buy ? 'buyAircraft' : 'leaseAircraft', typeId: t.id, config: defaultConfig(t, al.personality) })) break;
      hours = hoursByAircraft(state, catalog);
      ac = freeAircraft()[0];
      if (!ac) break;
    }
    const t = catalog.aircraftTypes[ac.typeId]!;
    const freeHours = BALANCE.weeklyHours - (hours.get(ac.id) ?? 0);

    // Score candidates once per decision (with the first free aircraft as the yardstick).
    if (!ranked) {
      const real = realFromHere.filter((r) => al.baseIds.includes(r.from) || al.baseIds.includes(r.to));
      const cands: { from: string; to: string; bonus: number }[] = [];
      for (let i = 0; i < Math.min(CANDIDATES_PER_BASE, real.length); i++) {
        const r = rng.pick(real);
        const from = al.baseIds.includes(r.from) ? r.from : r.to;
        cands.push({ from, to: from === r.from ? r.to : r.from, bonus: 1.25 });
      }
      for (const base of al.baseIds) for (let i = 0; i < CANDIDATES_PER_BASE; i++) cands.push({ from: base, to: rng.pick(airports).id, bonus: 1 });
      ranked = [];
      const seen = new Set<string>();
      for (const c of cands) {
        const key = pairKey(c.from, c.to);
        if (c.from === c.to || taken.has(key) || seen.has(key)) continue;
        seen.add(key);
        const A = catalog.airports[c.from]!, B = catalog.airports[c.to]!;
        const dist = distanceKm(A, B);
        if (dist < MIN_KM || dist > t.rangeKm || A.runwayM < t.minRunwayM || B.runwayM < t.minRunwayM) continue;
        const rtpw = Math.min(14, Math.floor((0.6 * freeHours) / roundTripHours(dist, t)), maxRoundTripsPerWeek(dist, t));
        if (rtpw < 1) continue;
        const e = estimateRoute(state, airlineId, c.from, c.to, ac.id, rtpw, aiFares(dist, p), catalog, hours, byPair);
        let score = e.profit * (1 + p.premiumFocus * ((A.business + B.business) / 2)) - 0.15 * e.competitors * Math.abs(e.profit);
        if (score > 0) score *= c.bonus;
        score += rng.normal(0, noise) * Math.abs(score);
        if (score > 0) ranked.push({ from: c.from, to: c.to, dist, score });
      }
      ranked.sort((x, y) => y.score - x.score);
    }

    let opened = false;
    let tries = 0;
    for (const best of ranked) {
      if (tries >= 3) break;
      const key = pairKey(best.from, best.to);
      if (taken.has(key) || best.dist > t.rangeKm) continue;
      tries += 1;
      const rtpw = Math.min(14, Math.floor((0.6 * freeHours) / roundTripHours(best.dist, t)), maxRoundTripsPerWeek(best.dist, t));
      if (rtpw < 1) continue;
      if (act({ type: 'openRoute', from: best.from, to: best.to, fares: aiFares(best.dist, p), assignments: [{ aircraftId: ac.id, roundTripsPerWeek: rtpw }] })) {
        opened = true;
        taken.add(key);
        hours = hoursByAircraft(state, catalog);
        break;
      }
    }
    if (!opened) break;
  }
  return done;
}

/** Close a route hit by tensions when it is banned or has no way around — or when none of its aircraft can make the detour. */
export function aiShouldDrop(status: { detourKm?: number; blocked: string | null }, outOfRange: boolean[]): boolean {
  if (!status.blocked) return false;
  if (status.blocked.startsWith('Detour exceeds')) return outOfRange.length > 0 && outOfRange.every(Boolean);
  return true;
}
