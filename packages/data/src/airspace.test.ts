import { statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadAirspace } from './index';

const regions = loadAirspace();
const inRing = (p: [number, number], ring: [number, number][]) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!, [xj, yj] = ring[j]!;
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

describe('airspace regions', () => {
  it('has 35–45 regions, each with rings and detour nodes', () => {
    expect(regions.length).toBeGreaterThanOrEqual(35);
    expect(regions.length).toBeLessThanOrEqual(45);
    for (const r of regions) {
      expect(r.rings.length).toBeGreaterThan(0);
      expect(r.nodes.length).toBeGreaterThanOrEqual(4);
      expect(r.countries.length).toBeGreaterThan(0);
    }
  });
  it('has unique ids and generic geographic names', () => {
    expect(new Set(regions.map((r) => r.id)).size).toBe(regions.length);
    for (const r of regions) expect(r.name).toMatch(/^[A-Z][A-Za-z –-]+$/);
  });
  it('never has a ring spanning more than 180° of longitude', () => {
    for (const r of regions) for (const ring of r.rings) {
      const lons = ring.map((p) => p[0]);
      expect(Math.max(...lons) - Math.min(...lons)).toBeLessThanOrEqual(180);
    }
  });
  it('keeps detour nodes outside their own region', () => {
    for (const r of regions) for (const n of r.nodes) expect(r.rings.some((ring) => inRing(n, ring))).toBe(false);
  });
  it('splits Russia into a western and an eastern region at 60°E', () => {
    const w = regions.find((r) => r.id === 'western-russia')!, e = regions.find((r) => r.id === 'siberia')!;
    expect(Math.max(...w.rings.flat().map((p) => p[0]))).toBeLessThanOrEqual(60.001);
    expect(Math.min(...e.rings.flat().map((p) => p[0]))).toBeGreaterThanOrEqual(59.999);
  });
  it('stays small', () => expect(statSync(join(import.meta.dirname, 'airspace.json')).size).toBeLessThan(400_000));
});
