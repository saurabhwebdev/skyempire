import type { Catalog, Command, CommandResult, GameState } from '@skyempire/shared';
import { applyAirline } from './airline';
import { ERR } from './errors';
import { applyFleet } from './fleet';
import { applyRoutes } from './routes';

/**
 * Validate and apply one command for an airline. Mutates `state` only on success:
 * every handler validates fully before its first write.
 */
export function applyCommand(state: GameState, airlineId: string, cmd: Command, catalog: Catalog): CommandResult {
  const al = state.airlines[airlineId];
  if (!al) return { ok: false, reason: 'Unknown airline' };
  if (al.bankrupt) return { ok: false, reason: ERR.bankrupt };
  switch (cmd.type) {
    case 'leaseAircraft':
    case 'buyAircraft':
    case 'buyUsedAircraft':
    case 'sellAircraft':
    case 'setCabin':
    case 'saveCabinTemplate':
    case 'deleteCabinTemplate':
    case 'convertAircraft':
      return applyFleet(state, airlineId, cmd, catalog);
    case 'openRoute':
    case 'updateRoute':
    case 'closeRoute':
    case 'preCancel':
      return applyRoutes(state, airlineId, cmd, catalog);
    default:
      return applyAirline(state, airlineId, cmd, catalog);
  }
}
