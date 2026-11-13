import { isReservedAirline } from '@skyempire/data';
import type { Airline, AirlineData, Catalog, GameState, NewGameOptions } from '@skyempire/shared';
import { PERSONALITIES } from './ai/personalities';
import { BALANCE } from './config/balance';
import { aircraftMarketValue, defaultCabin, tierAllows } from './fleet';
import { distanceKm } from './geo';
import { nextId } from './ids';
import { Rng } from './rng';

const CODE_RE = /^[A-Z0-9]{2,3}$/;

function blankAirline(id: string, cash: number): Omit<Airline, 'name' | 'code' | 'colors' | 'logoShape' | 'isPlayer' | 'personality' | 'homeBaseId' | 'baseIds'> {
  return {
    id,
    cash,
    loans: [],
    reputation: 50,
    serviceLevel: 3,
    marketingPerMonth: 0,
    tier: 'startup',
    completedObjectives: [],
    daysInsolvent: 0,
    bankrupt: false,
    creditRating: 'B',
    totals: { pax: 0, revenue360: Array(12).fill(0) },
    nextAiDecisionDay: 0,
  };
}

/** The ceil(n/2) airlines nearest the player hub, then the biggest (lowest sizeRank) not yet picked. */
export function pickAiAirlines(catalog: Catalog, hubId: string, n: number, rng: Rng): AirlineData[] {
  const hub = catalog.airports[hubId]!;
  const jitter = new Map(catalog.airlines.map((a) => [a.iata, rng.next()]));
  const byDistance = [...catalog.airlines].sort(
    (a, b) =>
      distanceKm(hub, catalog.airports[a.hubId]!) - distanceKm(hub, catalog.airports[b.hubId]!) ||
      jitter.get(a.iata)! - jitter.get(b.iata)!,
  );
  const picked = byDistance.slice(0, Math.ceil(n / 2));
  const chosen = new Set(picked.map((a) => a.iata));
  for (const a of [...catalog.airlines].sort((x, y) => x.sizeRank - y.sizeRank)) {
    if (picked.length >= n) break;
    if (!chosen.has(a.iata)) {
      picked.push(a);
      chosen.add(a.iata);
    }
  }
  return picked;
}

export function newGame(opts: NewGameOptions, catalog: Catalog): GameState {
  const { airline, homeBaseId, difficulty } = opts;
  if (!catalog.airports[homeBaseId]) throw new Error(`Unknown airport ${homeBaseId}`);
  if (!CODE_RE.test(airline.code)) throw new Error('Airline code must be 2–3 letters or digits');
  if (airline.name.trim().length < 2 || airline.name.trim().length > 30) throw new Error('Airline name must be 2–30 characters');
  if (isReservedAirline(airline.name, '')) throw new Error('That name belongs to a real airline — pick another');
  if (isReservedAirline('', airline.code)) throw new Error('That code belongs to a real airline — pick another');

  const rng = new Rng(opts.seed);
  const cash = BALANCE.startingCash[difficulty];
  const state: GameState = {
    schemaVersion: 1,
    seed: opts.seed,
    rngState: 0,
    day: 0,
    regionId: opts.regionId,
    difficulty,
    playerId: 'al_player',
    airlines: {},
    aircraft: {},
    routes: {},
    market: { fuelPricePerKg: BALANCE.fuelPriceStart, economyIndex: 1, usedListings: [] },
    slotsUsed: {},
    airportSlotBonus: {},
    events: [],
    nextId: 0,
    gameOver: null,
  };

  state.airlines.al_player = {
    ...blankAirline('al_player', cash),
    name: airline.name.trim(),
    code: airline.code,
    colors: airline.colors,
    logoShape: airline.logoShape,
    isPlayer: true,
    personality: null,
    homeBaseId,
    baseIds: [homeBaseId],
  };

  const aiCount = opts.aiCount ?? 19;
  for (const data of pickAiAirlines(catalog, homeBaseId, aiCount, rng)) {
    const p = PERSONALITIES[data.personality];
    const id = `al_${data.iata}`;
    const al: Airline = {
      ...blankAirline(id, Math.round(cash * BALANCE.aiCashFactor[difficulty])),
      name: data.name,
      code: data.iata,
      colors: { primary: data.brandColor, secondary: '#ffffff' },
      logoShape: 'circle',
      isPlayer: false,
      personality: data.personality,
      homeBaseId: data.hubId,
      baseIds: [data.hubId],
      reputation: p.startReputation,
      serviceLevel: p.serviceLevel,
      tier: p.startTier,
      creditRating: 'A',
      nextAiDecisionDay: rng.int(0, 6),
    };
    state.airlines[id] = al;

    const allowed = data.fleetTypes.filter((t) => catalog.aircraftTypes[t] && tierAllows(al.tier, catalog.aircraftTypes[t]!.tier));
    const types = allowed.length ? allowed : ['A20N'];
    for (let i = 0; i < BALANCE.aiStartingFleet[difficulty]; i++) {
      const type = catalog.aircraftTypes[types[i % types.length]!]!;
      const ageDays = rng.int(0, 10 * 360);
      const condition = rng.int(85, 100);
      const acId = nextId(state, 'ac');
      state.aircraft[acId] = {
        id: acId,
        typeId: type.id,
        ownerId: id,
        ownership: 'leased',
        ageDays,
        condition,
        flightHours: 0,
        hoursSinceA: rng.int(0, 400),
        hoursSinceC: rng.int(0, 5000),
        cabin: defaultCabin(type, data.personality),
        status: 'active',
        maintenanceDaysLeft: 0,
        bookValue: aircraftMarketValue(type, ageDays, condition),
      };
    }
  }

  refreshUsedListings(state, catalog, rng);
  state.rngState = rng.state;
  return state;
}

export function refreshUsedListings(state: GameState, catalog: Catalog, rng: Rng): void {
  const types = Object.values(catalog.aircraftTypes);
  state.market.usedListings = Array.from({ length: 12 }, () => {
    const type = rng.pick(types);
    const ageDays = rng.int(3, 20) * 360;
    const condition = rng.int(60, 95);
    return { id: nextId(state, 'ul'), typeId: type.id, ageDays, condition, price: aircraftMarketValue(type, ageDays, condition) };
  });
}
