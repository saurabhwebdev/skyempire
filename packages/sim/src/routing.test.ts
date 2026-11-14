import type { ActiveTension, GameState } from '@skyempire/shared';
import { describe, expect, it } from 'vitest';
import { distanceKm } from './geo';
import { detour, flightDistanceKm } from './routing';
import { airport, catalog, playerGame } from './testing';

function closing(...regionIds: string[]): GameState {
  const s = playerGame('FRA', 0);
  s.day = 50;
  s.world.tensions = regionIds.map((regionId, i): ActiveTension => ({ id: `t${i}`, kind: 'airspaceClosure', regionId, magnitude: 1, warnDay: 10, startDay: 40, endDay: 400 }));
  return s;
}
const gc = (a: string, b: string) => distanceKm(airport(a), airport(b));

describe('flight distance and detours', () => {
  it('is the great circle when nothing is closed', () => {
    const s = playerGame('FRA', 0);
    expect(flightDistanceKm(s, catalog, 'LHR', 'DEL')).toEqual({ km: gc('LHR', 'DEL'), detourKm: 0, blocked: null });
  });
  it('detours LHR–DEL around closed Northern Gulf and South-Central Asia airspace', () => {
    const r = flightDistanceKm(closing('northern-gulf', 'south-central-asia'), catalog, 'LHR', 'DEL');
    expect(r.blocked).toBeNull();
    expect(r.km).toBeGreaterThan(gc('LHR', 'DEL') + 50);
    expect(r.km).toBeLessThan(gc('LHR', 'DEL') * 1.5);
    expect(r.detourKm).toBe(Math.round(r.km - gc('LHR', 'DEL')));
  });
  it('SYD–LAX does not cross Siberia', () =>
    expect(flightDistanceKm(closing('siberia'), catalog, 'SYD', 'LAX').km).toBeCloseTo(gc('SYD', 'LAX')));
  it('stays sane across the antimeridian', () => {
    const r = flightDistanceKm(closing('siberia', 'northwest-pacific'), catalog, 'ICN', 'SFO');
    expect(r.blocked).toBeNull();
    expect(r.km).toBeLessThanOrEqual(gc('ICN', 'SFO') * 1.5);
    expect(r.km).toBeGreaterThanOrEqual(gc('ICN', 'SFO') - 1);
  });
  it('ignores a closed region that contains an endpoint', () =>
    expect(flightDistanceKm(closing('arabian-peninsula'), catalog, 'DXB', 'LHR').detourKm).toBe(0));
  it('reports a blocked route when no way around exists, and terminates', () => {
    const wall = { id: 'wall', name: 'Wall', countries: [], rings: [[[5, -89], [15, -89], [15, 89], [5, 89]]] as [number, number][][], nodes: [] };
    const r = detour([0, 0], [20, 0], [wall]);
    expect(r).toBeNull();
  });
  it('caches results', () => {
    const s = closing('northern-gulf');
    expect(flightDistanceKm(s, catalog, 'LHR', 'DEL')).toBe(flightDistanceKm(s, catalog, 'LHR', 'DEL'));
  });
  it('closures not yet started do not apply', () => {
    const s = closing('northern-gulf', 'south-central-asia');
    s.day = 20;
    expect(flightDistanceKm(s, catalog, 'LHR', 'DEL').detourKm).toBe(0);
  });
});
