import type { AircraftType, CabinConfig, Catalog, Command, CommandResult, GameState } from '@skyempire/shared';
import { dateOf, dayOf } from '../calendar';
import { checkConfig, refitCost, refitDays, standardProduct, upgradeCost } from '../cabin';
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

const NO_CABIN = (): CabinConfig => ({ seats: { economy: 0, premium: 0, business: 0 }, product: standardProduct(), dense: false });
export const DG_LICENCE_COST = 250_000;

function addAircraft(state: GameState, ownerId: string, typeId: string, config: CabinConfig, ownership: 'owned' | 'leased', ageDays: number, condition: number, bookValue: number) {
  const id = nextId(state, 'ac');
  state.aircraft[id] = {
    id, typeId, ownerId, ownership, ageDays, condition, flightHours: 0, hoursSinceA: 0, hoursSinceC: 0,
    cabin: { ...config.seats }, product: structuredClone(config.product), dense: config.dense, refitDaysLeft: 0,
    status: 'active', maintenanceDaysLeft: 0, bookValue,
  };
  return state.aircraft[id]!;
}

/** Can this airline fly this type at all? (Cargo only: freighters. Passenger: no freighters.) */
function kindAllows(al: { kind: string }, t: AircraftType): Fail | null {
  if (t.kind === 'freighter' && al.kind === 'passenger') return fail(ERR.passengerNoFreighters);
  if (t.kind !== 'freighter' && al.kind === 'cargo') return fail(ERR.cargoNoPassengers);
  return null;
}

/** The cabin a new aircraft gets: none for a freighter, the player's choice (required) otherwise. */
function cabinFor(t: AircraftType, config: CabinConfig | undefined): Fail | CabinConfig {
  if (t.kind === 'freighter') return NO_CABIN();
  if (!config) return fail(ERR.needCabin);
  return checkCabin(config, t) ?? config;
}

export function applyFleet(state: GameState, airlineId: string, cmd: Command, catalog: Catalog): CommandResult {
  const al = state.airlines[airlineId]!;
  switch (cmd.type) {
    case 'leaseAircraft':
    case 'buyAircraft': {
      const t = catalog.aircraftTypes[cmd.typeId];
      if (!t) return fail(ERR.unknownType);
      if (t.usedOnly) return fail(ERR.usedOnly);
      const wrongKind = kindAllows(al, t);
      if (wrongKind) return wrongKind;
      if (!tierAllows(al.tier, t.tier)) return fail(ERR.tierLocked(t.tier));
      const cabin = cabinFor(t, cmd.config);
      if ('ok' in cabin) return cabin;
      const cost = (cmd.type === 'leaseAircraft' ? t.leasePerMonth : t.priceUsd) + (t.kind === 'freighter' ? 0 : upgradeCost(cabin));
      if (al.cash < cost) return fail(ERR.notEnoughCash(cost - al.cash));
      al.cash -= cost;
      const ac = addAircraft(state, airlineId, t.id, cabin, cmd.type === 'leaseAircraft' ? 'leased' : 'owned', 0, 100, cmd.type === 'buyAircraft' ? t.priceUsd : 0);
      // Ordered before the type's first deliveries: it arrives on Jan 1 of its entry year.
      const year = dateOf(state.day, state.world.startYear).year;
      if (t.entryYear && t.entryYear > year) ac.deliveryDay = dayOf(t.entryYear, 1, 1, state.world.startYear);
      return OK;
    }
    case 'buyUsedAircraft': {
      const idx = state.market.usedListings.findIndex((l) => l.id === cmd.listingId);
      const listing = state.market.usedListings[idx];
      if (!listing) return fail(ERR.unknownListing);
      const t = catalog.aircraftTypes[listing.typeId]!;
      if (!tierAllows(al.tier, t.tier)) return fail(ERR.tierLocked(t.tier));
      if (cmd.convertTo) {
        // Bought and sent straight to conversion: it arrives as a freighter.
        const target = catalog.aircraftTypes[cmd.convertTo];
        if (!target?.conversion?.from.includes(t.id)) return fail(ERR.notConvertible);
        const wrong = kindAllows(al, target);
        if (wrong) return wrong;
        const cost = listing.price + target.conversion.costUsd;
        if (al.cash < cost) return fail(ERR.notEnoughCash(cost - al.cash));
        al.cash -= cost;
        state.market.usedListings.splice(idx, 1);
        const ac = addAircraft(state, airlineId, target.id, NO_CABIN(), 'owned', listing.ageDays, listing.condition, listing.price);
        ac.refitDaysLeft = target.conversion.days;
        return OK;
      }
      const wrongKind = kindAllows(al, t);
      if (wrongKind) return wrongKind;
      const cabin = cabinFor(t, cmd.config);
      if ('ok' in cabin) return cabin;
      const cost = listing.price + (t.kind === 'freighter' ? 0 : upgradeCost(cabin));
      if (al.cash < cost) return fail(ERR.notEnoughCash(cost - al.cash));
      al.cash -= cost;
      state.market.usedListings.splice(idx, 1);
      addAircraft(state, airlineId, t.id, cabin, 'owned', listing.ageDays, listing.condition, listing.price);
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
      if (t.kind === 'freighter') return fail(ERR.freighterNoCabin);
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
    case 'convertAircraft': {
      const ac = state.aircraft[cmd.aircraftId];
      if (!ac || ac.ownerId !== airlineId) return fail(ERR.unknownAircraft);
      const target = catalog.aircraftTypes[cmd.toTypeId];
      if (!target?.conversion?.from.includes(ac.typeId)) return fail(ERR.notConvertible);
      const wrong = kindAllows(al, target);
      if (wrong) return wrong;
      if (ac.ownership !== 'owned') return fail(ERR.convertOwnedOnly);
      if (Object.values(state.routes).some((r) => r.assignments.some((x) => x.aircraftId === ac.id))) return fail(ERR.convertOffRoutes);
      if (ac.refitDaysLeft > 0) return fail(ERR.refitRunning(ac.refitDaysLeft));
      if (al.cash < target.conversion.costUsd) return fail(ERR.notEnoughCash(target.conversion.costUsd - al.cash));
      al.cash -= target.conversion.costUsd;
      ac.typeId = target.id;
      const none = NO_CABIN();
      ac.cabin = none.seats;
      ac.product = none.product;
      ac.dense = false;
      ac.refitDaysLeft = target.conversion.days;
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
