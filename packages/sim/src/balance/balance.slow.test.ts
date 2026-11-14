import { describe, expect, it } from 'vitest';
import { catalog } from '../testing';
import { margin, simulate } from './bots';

// Slow (≈10 min): run with `pnpm --filter @skyempire/sim test:balance`. Targets from simulation-spec §13.
// The world is chaotic: one seed's AI margin swings by ±4 points, so margins and bankruptcies are judged
// as averages over several seeds (see packages/sim/scripts/balance-seed.ts for wider sweeps).
const SEEDS = [1, 2, 11, 12];
const runs = SEEDS.map((seed) => ({ seed, balanced: simulate(catalog, seed, 720, 'balanced') }));
const aiMedian = (r: ReturnType<typeof simulate>) => {
  const m = Object.entries(r.yearly).filter(([id]) => id !== r.state.playerId).map(([, ys]) => margin(ys[1]!)).sort((a, b) => a - b);
  return m[Math.floor(m.length / 2)]!;
};

describe('balance targets across seeds (2 game years)', () => {
  it('AI airlines average a realistic 2–12% median operating margin in year 2', () => {
    const mean = runs.reduce((s, r) => s + aiMedian(r.balanced), 0) / runs.length;
    expect(mean).toBeGreaterThanOrEqual(0.02);
    expect(mean).toBeLessThanOrEqual(0.12);
  });
  it('few AI airlines go bankrupt (≤ 2.5 per game on average, never more than 4)', () => {
    const counts = runs.map((r) => r.balanced.bankruptAi);
    expect(counts.reduce((a, b) => a + b, 0) / counts.length).toBeLessThanOrEqual(2.5);
    expect(Math.max(...counts)).toBeLessThanOrEqual(4);
  });
  it('a balanced player stays solvent and averages a ≥ 3% margin in year 2', () => {
    for (const r of runs) expect(r.balanced.state.gameOver).toBeNull();
    const mean = runs.reduce((s, r) => s + margin(r.balanced.yearly[r.balanced.state.playerId]![1]!), 0) / runs.length;
    expect(mean).toBeGreaterThanOrEqual(0.03);
  });
  it('a balanced airline reaches Regional within 3 years and National within 6', () => {
    for (const r of runs) {
      expect(r.balanced.tierDay.regional).toBeLessThanOrEqual(3 * 360);
      expect(r.balanced.tierDay.national ?? Infinity).toBeLessThanOrEqual(6 * 360);
    }
  });
});

describe.each([1, 2])('fare strategy (seed %i)', (seed) => {
  it('a balanced strategy beats always-cheapest fares', () => {
    const balanced = runs.find((r) => r.seed === seed)!.balanced;
    const cheap = simulate(catalog, seed, 720, 'cheap');
    const value = (r: typeof balanced) => (r.state.gameOver ? -Infinity : (r.playerValueByYear.at(-1) ?? -Infinity));
    expect(value(balanced)).toBeGreaterThan(value(cheap));
  });
});
