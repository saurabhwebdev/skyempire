import { DG_LICENCE_COST } from './fleet';
import type { Catalog, Command, CommandResult, GameState } from '@skyempire/shared';
import { availableCredit, baseSetupCost } from '../finance';
import { nextId } from '../ids';
import { BALANCE } from '../config/balance';
import { ERR } from './errors';

const fail = (reason: string): CommandResult => ({ ok: false, reason });

export function applyAirline(state: GameState, airlineId: string, cmd: Command, catalog: Catalog): CommandResult {
  const al = state.airlines[airlineId]!;
  switch (cmd.type) {
    case 'openBase': {
      if (!catalog.airports[cmd.airportId]) return fail(ERR.unknownAirport(cmd.airportId));
      if (al.baseIds.includes(cmd.airportId)) return fail(ERR.alreadyBase);
      const cost = baseSetupCost(catalog, cmd.airportId, al.tier);
      if (al.cash < cost) return fail(ERR.notEnoughCash(cost - al.cash));
      al.cash -= cost;
      al.baseIds.push(cmd.airportId);
      return { ok: true };
    }
    case 'closeBase': {
      if (cmd.airportId === al.homeBaseId) return fail(ERR.homeBase);
      if (!al.baseIds.includes(cmd.airportId)) return fail(ERR.notBase);
      const others = al.baseIds.filter((b) => b !== cmd.airportId);
      const stranded = Object.values(state.routes).some(
        (r) => r.airlineId === airlineId && (r.from === cmd.airportId || r.to === cmd.airportId) && !others.includes(r.from) && !others.includes(r.to),
      );
      if (stranded) return fail(ERR.baseInUse);
      al.baseIds = others;
      return { ok: true };
    }
    case 'takeLoan': {
      const avail = availableCredit(state, airlineId, catalog);
      if (cmd.amount > avail) return fail(ERR.creditLimit(avail));
      al.loans.push({ id: nextId(state, 'ln'), principal: cmd.amount, annualRate: BALANCE.ratingRates[al.creditRating], takenDay: state.day });
      al.cash += cmd.amount;
      return { ok: true };
    }
    case 'repayLoan': {
      const loan = al.loans.find((l) => l.id === cmd.loanId);
      if (!loan) return fail(ERR.unknownLoan);
      if (cmd.amount > loan.principal) return fail(ERR.repayTooMuch);
      if (cmd.amount > al.cash) return fail(ERR.notEnoughCash(cmd.amount - al.cash));
      al.cash -= cmd.amount;
      loan.principal -= cmd.amount;
      if (loan.principal === 0) al.loans = al.loans.filter((l) => l !== loan);
      return { ok: true };
    }
    case 'buyDgLicence': {
      if (al.dgLicence) return { ok: false, reason: ERR.dgAlready };
      if (al.cash < DG_LICENCE_COST) return { ok: false, reason: ERR.notEnoughCash(DG_LICENCE_COST - al.cash) };
      al.cash -= DG_LICENCE_COST;
      al.dgLicence = true;
      return { ok: true };
    }
    case 'setBellyCargo':
      al.bellyCargo = cmd.on;
      return { ok: true };
    case 'setMarketing':
      al.marketingPerMonth = cmd.perMonth;
      return { ok: true };
    default:
      throw new Error(`not an airline command: ${cmd.type}`);
  }
}
