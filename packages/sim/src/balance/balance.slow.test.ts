import { describe, expect, it } from 'vitest';
import { catalog } from '../testing';
import { margin, simulate } from './bots';

// Slow (≈3 min): run with `pnpm --filter @skyempire/sim test:balance`. Targets from simulation-spec §13.
describe('balance targets (2 game years)', () => {
  const balanced = simulate(catalog, 1, 720, 'balanced');
  const cheap = simulate(catalog, 1, 720, 'cheap');

  it('AI airlines earn a realistic 3–15% median operating margin in year 2', () => {
    const m = Object.entries(balanced.yearly)
      .filter(([id]) => id !== balanced.state.playerId)
      .map(([, ys]) => margin(ys[1]!))
      .sort((a, b) => a - b);
    const median = m[Math.floor(m.length / 2)]!;
    expect(median).toBeGreaterThanOrEqual(0.03);
    expect(median).toBeLessThanOrEqual(0.15);
  });
  it('at most one AI airline goes bankrupt', () => expect(balanced.bankruptAi).toBeLessThanOrEqual(1));
  it('a balanced strategy beats always-cheapest fares', () => {
    const value = (r: typeof balanced) => (r.state.gameOver ? -Infinity : (r.playerValueByYear.at(-1) ?? -Infinity));
    expect(value(balanced)).toBeGreaterThan(value(cheap));
  });
  it('a balanced airline reaches Regional within 3 years and National within 6', () => {
    expect(balanced.tierDay.regional).toBeLessThanOrEqual(3 * 360);
    expect(balanced.tierDay.national ?? Infinity).toBeLessThanOrEqual(6 * 360);
  });
});
