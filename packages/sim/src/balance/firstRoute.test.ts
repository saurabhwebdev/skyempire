import { describe, expect, it } from 'vitest';
import { applyCommand } from '../commands/apply';
import { preview } from '../preview';
import { tick } from '../tick';
import { catalog, lease, playerAircraft, playerGame } from '../testing';

describe('first route', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    it(`a sensible first route (LHR–MAD, A320neo, suggested fares) covers its flying costs within 30 days — seed ${seed}`, () => {
      let s = playerGame('LHR', 19);
      s.seed = seed;
      s.rngState = seed;
      applyCommand(s, s.playerId, lease('A20N'), catalog);
      const ac = playerAircraft(s)[0]!.id;
      const cmd = { type: 'openRoute' as const, from: 'LHR', to: 'MAD', fares: { economy: 1, premium: 1, business: 1 }, assignments: [{ aircraftId: ac, roundTripsPerWeek: 14 }] };
      const p = preview(s, s.playerId, cmd, catalog);
      expect(applyCommand(s, s.playerId, { ...cmd, fares: p.suggestedFares! }, catalog)).toEqual({ ok: true });
      let profit = 0;
      for (let d = 0; d < 30; d++) {
        s = tick(s, [], catalog).state;
        profit += Object.values(s.routes).find((r) => r.airlineId === s.playerId)!.last!.profit;
      }
      expect(profit).toBeGreaterThanOrEqual(0);
    }, 60_000);
  }
});
