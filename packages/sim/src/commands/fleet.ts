import type { Cabin, Catalog, Command, CommandResult, GameState } from '@skyempire/shared';
import { aircraftMarketValue, tierAllows } from '../fleet';
import { nextId } from '../ids';
import { seatUnits } from '../ops';
import { ERR } from './errors';
import { recomputeSlots } from './slots';

type Fail = { ok: false; reason: string };
const fail = (reason: string): Fail => ({ ok: false, reason });
const OK: CommandResult = { ok: true };

function checkCabin(cabin: Cabin, maxSeats: number): Fail | null {
  return seatUnits(cabin) > maxSeats ? fail(ERR.tooManySeats(maxSeats)) : null;
}

function addAircraft(state: GameState, ownerId: string, typeId: string, cabin: Cabin, ownership: 'owned' | 'leased', ageDays: number, condition: number, bookValue: number) {
  const id = nextId(state, 'ac');
  state.aircraft[id] = {
    id, typeId, ownerId, ownership, ageDays, condition, flightHours: 0, hoursSinceA: 0, hoursSinceC: 0,
    cabin, status: 'active', maintenanceDaysLeft: 0, bookValue,
  };
}

export function applyFleet(state: GameState, airlineId: string, cmd: Command, catalog: Catalog): CommandResult {
  const al = state.airlines[airlineId]!;
  switch (cmd.type) {
    case 'leaseAircraft':
    case 'buyAircraft': {
      const t = catalog.aircraftTypes[cmd.typeId];
      if (!t) return fail(ERR.unknownType);
      if (!tierAllows(al.tier, t.tier)) return fail(ERR.tierLocked(t.tier));
      const bad = checkCabin(cmd.cabin, t.maxSeats);
      if (bad) return bad;
      const cost = cmd.type === 'leaseAircraft' ? t.leasePerMonth : t.priceUsd;
      if (al.cash < cost) return fail(ERR.notEnoughCash(cost - al.cash));
      al.cash -= cost;
      addAircraft(state, airlineId, t.id, cmd.cabin, cmd.type === 'leaseAircraft' ? 'leased' : 'owned', 0, 100, cmd.type === 'buyAircraft' ? t.priceUsd : 0);
      return OK;
    }
    case 'buyUsedAircraft': {
      const idx = state.market.usedListings.findIndex((l) => l.id === cmd.listingId);
      const listing = state.market.usedListings[idx];
      if (!listing) return fail(ERR.unknownListing);
      const t = catalog.aircraftTypes[listing.typeId]!;
      if (!tierAllows(al.tier, t.tier)) return fail(ERR.tierLocked(t.tier));
      const bad = checkCabin(cmd.cabin, t.maxSeats);
      if (bad) return bad;
      if (al.cash < listing.price) return fail(ERR.notEnoughCash(listing.price - al.cash));
      al.cash -= listing.price;
      state.market.usedListings.splice(idx, 1);
      addAircraft(state, airlineId, t.id, cmd.cabin, 'owned', listing.ageDays, listing.condition, listing.price);
      return OK;
    }
    case 'sellAircraft': {
      const ac = state.aircraft[cmd.aircraftId];
      if (!ac || ac.ownerId !== airlineId) return fail(ERR.unknownAircraft);
      if (ac.ownership === 'owned') al.cash += aircraftMarketValue(catalog.aircraftTypes[ac.typeId]!, ac.ageDays, ac.condition);
      delete state.aircraft[ac.id];
      for (const r of Object.values(state.routes)) {
        if (!r.assignments.some((a) => a.aircraftId === ac.id)) continue;
        r.assignments = r.assignments.filter((a) => a.aircraftId !== ac.id);
        if (r.assignments.length === 0) r.status = 'suspended';
      }
      recomputeSlots(state);
      return OK;
    }
    case 'setCabin': {
      const ac = state.aircraft[cmd.aircraftId];
      if (!ac || ac.ownerId !== airlineId) return fail(ERR.unknownAircraft);
      const bad = checkCabin(cmd.cabin, catalog.aircraftTypes[ac.typeId]!.maxSeats);
      if (bad) return bad;
      ac.cabin = cmd.cabin;
      return OK;
    }
    default:
      throw new Error(`not a fleet command: ${cmd.type}`);
  }
}
