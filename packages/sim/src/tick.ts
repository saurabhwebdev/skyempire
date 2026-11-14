import type { AirlineDaily, Catalog, Command, CommandResult, GameState, Notification, TickSummary } from '@skyempire/shared';
import { CABIN_CLASSES } from '@skyempire/shared';
import { runAi } from './ai/decide';
import { cadenceFor } from './ai/personalities';
import { dateOf, isMonthStart } from './calendar';
import { recomputeSlots } from './commands/slots';
import { applyCommand } from './commands/apply';
import { refFare } from './demand';
import { hoursByAircraft, pairKey, routeOps, simulateRoutes, type RouteOps } from './daySim';
import { simulateCargo } from './cargoSim';
import { routeDayCosts } from './economics';
import { rollEvents } from './events';
import { rollTensions } from './tensions';
import { applyMonthly, companyValue, creditRating, dailyInterest, debtOf, updateSolvency } from './finance';
import { distanceKm } from './geo';
import { nextId } from './ids';
import { advanceAircraft, incidentChance } from './maintenance';
import { stepMarket } from './market';
import { updateProgression } from './progression';
import { fleetYouth, marketingScore, priceFairness, reputationTarget, stepReputation } from './reputation';
import { Rng } from './rng';

export interface QueuedCommand {
  airlineId: string;
  cmd: Command;
}

export interface TickResult {
  state: GameState;
  summary: TickSummary;
  results: CommandResult[];
}

const zeroCosts = (): AirlineDaily['costs'] => ({
  fuel: 0, crew: 0, maintenance: 0, fees: 0, service: 0, leases: 0, interest: 0, overhead: 0, bases: 0, marketing: 0,
});

/** Advance the world by one day (simulation-spec §2). Never mutates `input`. */
export function tick(input: GameState, commands: QueuedCommand[], catalog: Catalog): TickResult {
  const s = structuredClone(input);
  const rng = new Rng(s.rngState);
  const notes: Notification[] = [];
  s.day += 1;

  // Cancellations-ahead for days already past are dropped.
  for (const [routeId, days] of Object.entries(s.world.preCancelled)) {
    const keep = s.routes[routeId] ? days.filter((d) => d >= s.day) : [];
    if (keep.length) s.world.preCancelled[routeId] = keep;
    else delete s.world.preCancelled[routeId];
  }

  // 1. Commands
  const results = commands.map((c) => applyCommand(s, c.airlineId, c.cmd, catalog));

  // 2. World: events, market
  notes.push(...rollEvents(s, catalog, rng));
  notes.push(...rollTensions(s, catalog, rng));
  stepMarket(s, catalog, rng);

  // 3. AI decisions
  for (const al of Object.values(s.airlines)) {
    if (al.isPlayer || al.bankrupt || !al.personality || s.day < al.nextAiDecisionDay) continue;
    runAi(s, al.id, catalog, rng); // applies its own commands
    al.nextAiDecisionDay = s.day + cadenceFor(al.personality, s.difficulty);
  }

  // 4–5. Demand & allocation per airport pair
  const daily = new Map<string, AirlineDaily>();
  for (const al of Object.values(s.airlines))
    daily.set(al.id, { day: s.day, airlineId: al.id, cash: 0, revenue: 0, pax: 0, costs: zeroCosts() });
  const hours = hoursByAircraft(s, catalog);
  const byPair = new Map<string, RouteOps[]>();
  for (const r of Object.values(s.routes)) {
    if (r.status !== 'active') continue;
    const ops = routeOps(r, s, catalog, hours, false);
    const k = pairKey(r.from, r.to);
    if (!byPair.has(k)) byPair.set(k, []);
    byPair.get(k)!.push(ops);
  }
  const hoursFlown = new Map<string, number>();
  const fareRatio = new Map<string, { sum: number; n: number }>();
  const onTimeAcc = new Map<string, { sum: number; n: number }>();
  const qualityAcc = new Map<string, { sum: number; n: number }>();
  const add = (m: Map<string, { sum: number; n: number }>, k: string, v: number) => {
    const e = m.get(k) ?? { sum: 0, n: 0 };
    e.sum += v;
    e.n += 1;
    m.set(k, e);
  };

  // 6. Revenue & variable costs
  // Every market of every route competes with the other routes selling it (multi-stop routes sell several).
  const allOps = [...byPair.values()].flat();
  const { results: sold } = simulateRoutes(allOps, s, catalog);
  // Cargo: freighter routes, and belly holds on passenger routes.
  const cargo = simulateCargo(allOps, s, catalog);
  const cargoByAirline = new Map<string, number>();
  for (const opsList of byPair.values()) {
    for (const ops of opsList) {
      const r = ops.route;
      const res = sold.get(r.id)!;
      const p = res.pax;
      const legs = new Map<string, number>();
      for (const [acId, rt] of ops.roundTrips) {
        legs.set(acId, 2 * rt);
        hoursFlown.set(acId, (hoursFlown.get(acId) ?? 0) + 2 * rt * ops.blockH);
      }
      const cg = ops.closed ? undefined : cargo.get(r.id);
      const revenue = ops.closed ? 0 : res.revenue + (cg?.revenue ?? 0);
      const c = routeDayCosts(r, s, catalog, legs, p, ops.closed, res.ticketRevenue);
      c.fees += ops.weatherFees + (cg?.handling ?? 0);
      const cost = c.fuel + c.crew + c.maintenance + c.fees + c.service;
      const paxTotal = CABIN_CLASSES.reduce((sum, k) => sum + p[k], 0);
      const loadFactor = r.kind === 'cargo' ? (cg?.load ?? 0) : res.loadFactor;
      r.last = { pax: p, loadFactor, revenue, cost, profit: revenue - cost };
      cargoByAirline.set(r.airlineId, (cargoByAirline.get(r.airlineId) ?? 0) + (cg?.tonnes ?? 0));
      if (cg || r.kind === 'cargo') {
        r.last.cargoT = cg?.tonnes ?? 0;
        r.last.cargoRevenue = cg?.revenue ?? 0;
        if (r.kind === 'cargo') r.last.cargoLoad = cg?.load ?? 0;
      }
      if (r.stops?.length) {
        r.last.marketPax = Object.fromEntries(res.marketPax);
        r.last.legLoad = res.legLoad;
      }
      r.profit30 = [...r.profit30, revenue - cost].slice(-30);
      const d = daily.get(r.airlineId)!;
      d.revenue += revenue;
      d.pax += paxTotal;
      d.costs.fuel += c.fuel;
      d.costs.crew += c.crew;
      d.costs.maintenance += c.maintenance;
      d.costs.fees += c.fees;
      d.costs.service += c.service;
      const dist = distanceKm(catalog.airports[r.from]!, catalog.airports[r.to]!);
      if (r.kind !== 'cargo') add(fareRatio, r.airlineId, r.fares.economy / refFare(dist, 'economy'));
      add(onTimeAcc, r.airlineId, ops.onTime);
      if (r.kind !== 'cargo') add(qualityAcc, r.airlineId, ops.qualityMean);
    }
  }

  // 7. Aircraft, reputation, cash
  const incidents = new Map<string, number>();
  for (const ac of Object.values(s.aircraft)) {
    if (ac.deliveryDay !== undefined && ac.deliveryDay > s.day) continue; // on order: doesn't exist yet
    const flown = hoursFlown.get(ac.id) ?? 0;
    const inRefit = ac.refitDaysLeft > 0;
    const { checkCost, check } = advanceAircraft(ac, flown);
    if (inRefit && ac.refitDaysLeft === 0 && ac.ownerId === s.playerId) {
      const t = catalog.aircraftTypes[ac.typeId]!;
      notes.push({ id: nextId(s, 'n'), day: s.day, level: 'info', category: 'airline',
        title: t.kind === 'freighter' ? `${t.name} conversion done` : `${t.name} refit done`,
        body: t.kind === 'freighter' ? 'Back in service as a freighter.' : 'Back in service with its new cabin.', link: { kind: 'aircraft', id: ac.id } });
    }
    const d = daily.get(ac.ownerId);
    if (d) d.costs.maintenance += checkCost;
    if (check && ac.ownerId === s.playerId) {
      const t = catalog.aircraftTypes[ac.typeId]!;
      notes.push({ id: nextId(s, 'n'), day: s.day, level: 'info', category: 'airline', title: `${t.name} in for a ${check}-check`,
        body: `Out of service for ${ac.maintenanceDaysLeft} day${ac.maintenanceDaysLeft > 1 ? 's' : ''}.`, link: { kind: 'aircraft', id: ac.id } });
    }
    if (flown > 0 && incidentChance(ac.condition) > 0 && rng.chance(incidentChance(ac.condition) * Math.max(1, flown))) {
      incidents.set(ac.ownerId, (incidents.get(ac.ownerId) ?? 0) + 15);
      const al = s.airlines[ac.ownerId]!;
      notes.push({ id: nextId(s, 'n'), day: s.day, level: al.isPlayer ? 'major' : 'info', category: al.isPlayer ? 'airline' : 'rival', title: `Safety incident at ${al.name}`,
        body: 'A poorly maintained aircraft had a serious incident. Reputation takes a hit.', link: { kind: 'aircraft', id: ac.id } });
    }
  }

  const month = dateOf(s.day, s.world.startYear).month - 1;
  for (const al of Object.values(s.airlines)) {
    const d = daily.get(al.id)!;
    if (al.bankrupt) {
      d.cash = al.cash;
      continue;
    }
    const fleet = Object.values(s.aircraft).filter((a) => a.ownerId === al.id);
    const avg = (m: Map<string, { sum: number; n: number }>, def: number) => {
      const e = m.get(al.id);
      return e && e.n ? e.sum / e.n : def;
    };
    const target = reputationTarget({
      onTime: avg(onTimeAcc, 85),
      quality: avg(qualityAcc, 50),
      priceFairness: priceFairness(avg(fareRatio, 1)),
      fleetYouth: fleetYouth(fleet.length ? fleet.reduce((x, a) => x + a.ageDays, 0) / fleet.length / 360 : 0),
      marketing: marketingScore(al.marketingPerMonth, fleet.length),
      incidentPenalty: 0,
    });
    al.reputation = Math.max(0, stepReputation(al.reputation, target) - (incidents.get(al.id) ?? 0));

    if (isMonthStart(s.day, s.world.startYear)) {
      const m = applyMonthly(s, al.id, catalog);
      Object.assign(d.costs, m);
      al.totals.revenue360[month] = 0;
      const value = companyValue(s, al.id, catalog);
      const debt = debtOf(al);
      const rev = al.totals.revenue360.reduce((x, y) => x + y, 0);
      const profit = Object.values(s.routes).filter((r) => r.airlineId === al.id).reduce((x, r) => x + r.profit30.reduce((p, q) => p + q, 0), 0);
      al.creditRating = creditRating(debt / Math.max(1, value + debt), rev > 0 ? (profit * 12) / rev : 0);
    }
    d.costs.interest = dailyInterest(al);
    const variable = d.costs.fuel + d.costs.crew + d.costs.maintenance + d.costs.fees + d.costs.service + d.costs.interest;
    al.cash += d.revenue - variable;
    al.totals.pax += d.pax;
    al.totals.cargoT = (al.totals.cargoT ?? 0) + (cargoByAirline.get(al.id) ?? 0);
    al.totals.revenue360[month] = (al.totals.revenue360[month] ?? 0) + d.revenue;

    // 8. Solvency
    const wasBankrupt = al.bankrupt;
    updateSolvency(s, al.id, catalog);
    if (al.bankrupt && !wasBankrupt) {
      for (const r of Object.values(s.routes)) if (r.airlineId === al.id) delete s.routes[r.id];
      for (const ac of Object.values(s.aircraft)) if (ac.ownerId === al.id) delete s.aircraft[ac.id];
      recomputeSlots(s);
      notes.push({ id: nextId(s, 'n'), day: s.day, level: al.isPlayer ? 'major' : 'info', category: al.isPlayer ? 'airline' : 'rival', title: `${al.name} has gone bankrupt`,
        body: al.isPlayer ? 'Your airline ran out of cash and credit.' : 'Its routes and slots are now free.', link: { kind: 'airline', id: al.id } });
    }
    d.cash = al.cash;
  }

  // 9. Progression (tiers, objectives) for every live airline
  for (const al of Object.values(s.airlines)) if (!al.bankrupt) notes.push(...updateProgression(s, al.id, catalog));

  s.rngState = rng.state;
  const playerNotes = notes.filter((n) => n.level !== 'info' || !n.link || n.link.kind !== 'aircraft' || s.aircraft[n.link.id]?.ownerId === s.playerId);
  return {
    state: s,
    results,
    summary: { day: s.day, daily: [...daily.values()], notifications: playerNotes, autoPause: playerNotes.some((n) => n.level === 'major') },
  };
}
