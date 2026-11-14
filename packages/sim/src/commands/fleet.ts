import type { AircraftType, CabinConfig, Catalog, Command, CommandResult, GameState } from '@skyempire/shared';
import { checkConfig, refitCost, refitDays, upgradeCost } from '../cabin';
import { aircraftMarketValue, tierAllows } from '../fleet';
import { nextId } from '../ids';
import { ERR } from './errors';
import { recomputeSlots } from './slots';

type Fail = { ok: false; reason: string };
const fail = (reason: string): Fail => ({ ok: false, reason });
const OK: CommandResult = { ok: true };

function checkCabin(config: CabinConfig, t: AircraftType): Fail | null {
  const bad = checkConfig(config, t);
  return bad ? fail(bad) : null;
}

function addAircraft(state: GameState, ownerId: string, typeId: string, config: CabinConfig, ownership: 'owned' | 'leased', ageDays: number, condition: number, bookValue: number) {
  const id = nextId(state, 'ac');
  state.aircraft[id] = {
    id, typeId, ownerId, ownership, ageDays, condition, flightHours: 0, hoursSinceA: 0, hoursSinceC: 0,
    cabin: { ...config.seats }, product: structuredClone(config.product), dense: config.dense, refitDaysLeft: 0,
    status: 'active', maintenanceDaysLeft: 0, bookValue,
  };
}

export function applyFleet(state: GameState, airlineId: string, cmd: Command, catalog: Catalog): CommandResult {
  const al = state.airlines[airlineId]!;
  switch (cmd.type) {
    case 'leaseAircraft':
    case 'buyAircraft': {
      const t = catalog.aircraftTypes[cmd.typeId];
      if (!t) return fail(ERR.unknownType);
      if (t.usedOnly) return fail(ERR.usedOnly);
      if (!tierAllows(al.tier, t.tier)) return fail(ERR.tierLocked(t.tier));
      const bad = checkCabin(cmd.config, t);
      if (bad) return bad;
      const cost = (cmd.type === 'leaseAircraft' ? t.leasePerMonth : t.priceUsd) + upgradeCost(cmd.config);
      if (al.cash < cost) return fail(ERR.notEnoughCash(cost - al.cash));
      al.cash -= cost;
      addAircraft(state, airlineId, t.id, cmd.config, cmd.type === 'leaseAircraft' ? 'leased' : 'owned', 0, 100, cmd.type === 'buyAircraft' ? t.priceUsd : 0);
      return OK;
    }
    case 'buyUsedAircraft': {
      const idx = state.market.usedListings.findIndex((l) => l.id === cmd.listingId);
      const listing = state.market.usedListings[idx];
      if (!listing) return fail(ERR.unknownListing);
      const t = catalog.aircraftTypes[listing.typeId]!;
      if (!tierAllows(al.tier, t.tier)) return fail(ERR.tierLocked(t.tier));
      const bad = checkCabin(cmd.config, t);
      if (bad) return bad;
      const cost = listing.price + upgradeCost(cmd.config);
      if (al.cash < cost) return fail(ERR.notEnoughCash(cost - al.cash));
      al.cash -= cost;
      state.market.usedListings.splice(idx, 1);
      addAircraft(state, airlineId, t.id, cmd.config, 'owned', listing.ageDays, listing.condition, listing.price);
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
      const t = catalog.aircraftTypes[ac.typeId]!;
      const bad = checkCabin(cmd.config, t);
      if (bad) return bad;
      const old: CabinConfig = { seats: ac.cabin, product: ac.product, dense: ac.dense };
      const days = refitDays(old, cmd.config, t);
      if (days > 0 && ac.refitDaysLeft > 0) return fail(ERR.refitRunning(ac.refitDaysLeft));
      const cost = refitCost(old, cmd.config);
      if (al.cash < cost) return fail(ERR.notEnoughCash(cost - al.cash));
      al.cash -= cost;
      ac.cabin = { ...cmd.config.seats };
      ac.product = structuredClone(cmd.config.product);
      ac.dense = cmd.config.dense;
      if (days > 0) ac.refitDaysLeft = days;
      return OK;
    }
    case 'saveCabinTemplate': {
      const t = catalog.aircraftTypes[cmd.typeId];
      if (!t) return fail(ERR.unknownType);
      const bad = checkCabin(cmd.config, t);
      if (bad) return bad;
      if (al.cabinTemplates.length >= 30) return fail(ERR.tooManyLayouts);
      al.cabinTemplates.push({ id: nextId(state, 'ct'), name: cmd.name.trim(), typeId: t.id, config: structuredClone(cmd.config) });
      return OK;
    }
    case 'deleteCabinTemplate': {
      if (!al.cabinTemplates.some((x) => x.id === cmd.templateId)) return fail(ERR.unknownLayout);
      al.cabinTemplates = al.cabinTemplates.filter((x) => x.id !== cmd.templateId);
      return OK;
    }
    default:
      throw new Error(`not a fleet command: ${cmd.type}`);
  }
}
