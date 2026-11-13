import type { Catalog, GameState, NewGameOptions } from '@skyempire/shared';
import { runAi } from '../ai/decide';
import { refFare } from '../demand';
import { companyValue } from '../finance';
import { distanceKm } from '../geo';
import { newGame } from '../newGame';
import { Rng } from '../rng';
import { tick } from '../tick';

export type BotStyle = 'balanced' | 'cheap' | 'passive';

/** Let the player airline be driven by the AI (balance testing only). */
export function botTurn(state: GameState, catalog: Catalog, style: BotStyle, rng: Rng): void {
  if (style === 'passive') return;
  const al = state.airlines[state.playerId]!;
  const saved = al.personality;
  al.personality = 'legacy';
  runAi(state, al.id, catalog, rng);
  al.personality = saved;
  if (style === 'cheap')
    for (const r of Object.values(state.routes)) {
      if (r.airlineId !== al.id) continue;
      const d = distanceKm(catalog.airports[r.from]!, catalog.airports[r.to]!);
      r.fares = {
        economy: Math.round(refFare(d, 'economy') * 0.6),
        premium: Math.round(refFare(d, 'premium') * 0.6),
        business: Math.round(refFare(d, 'business') * 0.6),
      };
    }
}

export interface RunResult {
  state: GameState;
  /** Per airline, per game year: revenue and total costs. */
  yearly: Record<string, { revenue: number; cost: number }[]>;
  playerValueByYear: number[];
  tierDay: Partial<Record<'regional' | 'national', number>>;
  bankruptAi: number;
}

export function simulate(catalog: Catalog, seed: number, days: number, style: BotStyle, hub = 'LHR'): RunResult {
  const opts: NewGameOptions = {
    seed, regionId: 'world', difficulty: 'normal', homeBaseId: hub,
    airline: { name: 'Balance Bot Air', code: 'B0T', colors: { primary: '#123456', secondary: '#ffffff' }, logoShape: 'circle' },
  };
  let s = newGame(opts, catalog);
  const rng = new Rng(seed * 7919);
  const yearly: RunResult['yearly'] = {};
  const playerValueByYear: number[] = [];
  const tierDay: RunResult['tierDay'] = {};
  for (let d = 0; d < days; d++) {
    if (d % 7 === 0) botTurn(s, catalog, style, rng);
    const r = tick(s, [], catalog);
    s = r.state;
    const y = Math.floor((s.day - 1) / 360);
    for (const row of r.summary.daily) {
      const arr = (yearly[row.airlineId] ??= []);
      arr[y] ??= { revenue: 0, cost: 0 };
      arr[y]!.revenue += row.revenue;
      arr[y]!.cost += Object.values(row.costs).reduce((a, b) => a + b, 0);
    }
    const p = s.airlines[s.playerId]!;
    if (p.tier !== 'startup' && tierDay.regional === undefined) tierDay.regional = s.day;
    if (p.tier === 'national' && tierDay.national === undefined) tierDay.national = s.day;
    if (s.day % 360 === 0) playerValueByYear.push(companyValue(s, s.playerId, catalog));
    if (s.gameOver) break;
  }
  const bankruptAi = Object.values(s.airlines).filter((a) => !a.isPlayer && a.bankrupt).length;
  return { state: s, yearly, playerValueByYear, tierDay, bankruptAi };
}

export const margin = (x: { revenue: number; cost: number }) => (x.revenue > 0 ? (x.revenue - x.cost) / x.revenue : -1);
