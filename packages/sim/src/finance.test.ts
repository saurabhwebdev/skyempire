import { describe, expect, it } from 'vitest';
import { applyMonthly, availableCredit, creditRating, dailyInterest, updateSolvency } from './finance';
import { catalog, lease, playerGame } from './testing';
import { applyCommand } from './commands/apply';

describe('finance', () => {
  it('interest on $10M at 6% is $1,667/day', () => {
    const s = playerGame();
    s.airlines[s.playerId]!.loans = [{ id: 'l', principal: 10_000_000, annualRate: 0.06, takenDay: 0 }];
    expect(dailyInterest(s.airlines[s.playerId]!)).toBe(1667);
  });
  it('credit rating follows debt and margin', () => {
    expect(creditRating(0.1, 0.08)).toBe('A');
    expect(creditRating(0.3, 0.01)).toBe('B');
    expect(creditRating(0.5, -0.1)).toBe('C');
    expect(creditRating(0.9, 0.2)).toBe('D');
  });
  it('charges leases and overhead at month start', () => {
    const s = playerGame();
    applyCommand(s, s.playerId, lease('A20N'), catalog);
    const al = s.airlines[s.playerId]!;
    const before = al.cash;
    const costs = applyMonthly(s, al.id, catalog);
    expect(costs.leases).toBe(catalog.aircraftTypes.A20N!.leasePerMonth);
    expect(costs.overhead).toBe(50_000 + 20_000);
    expect(al.cash).toBe(before - costs.leases! - costs.overhead! - costs.bases! - costs.marketing!);
  });
  it('negative cash with credit available is not insolvency', () => {
    const s = playerGame();
    s.airlines[s.playerId]!.cash = -1_000_000;
    expect(availableCredit(s, s.playerId, catalog)).toBeGreaterThan(0);
    updateSolvency(s, s.playerId, catalog);
    expect(s.airlines[s.playerId]!.daysInsolvent).toBe(0);
  });
  it('bankrupt after 30 days with no credit', () => {
    const s = playerGame();
    const al = s.airlines[s.playerId]!;
    al.cash = -1_000_000;
    al.loans = [{ id: 'l', principal: 50_000_000, annualRate: 0.12, takenDay: 0 }];
    for (let i = 0; i < 29; i++) updateSolvency(s, al.id, catalog);
    expect(al.bankrupt).toBe(false);
    updateSolvency(s, al.id, catalog);
    expect(al.bankrupt).toBe(true);
    expect(s.gameOver?.reason).toBe('bankrupt');
  });
});
