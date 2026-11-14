import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import aircraft from './aircraft.json';
import details from './aircraft-details.json';
import photos from './aircraft-photos.json';
import { AircraftDetailsSchema, AircraftPhotoSchema } from './schema';

const ids = aircraft.map((a) => a.id);
const isFreighter = (a: { kind?: string }) => a.kind === 'freighter';
/** Freighters with no freely licensed photo on Commons: the game draws their silhouette instead. */
const NO_PHOTO = ['A20F', 'A35F', 'B78F', 'DH4F', 'E90F', 'E95F'];

describe('aircraft photos and specs', () => {
  it('the catalog carries seats-across, and a denser row only where airlines really fly one', async () => {
    const { loadCatalog } = await import('./index');
    const types = loadCatalog().aircraftTypes;
    for (const t of Object.values(types).filter((x) => !isFreighter(x))) expect(t.abreast, t.id).toBeGreaterThanOrEqual(3);
    const dense = Object.values(types).filter((t) => t.denseAbreast).map((t) => t.id).sort();
    expect(dense).toEqual(['A332', 'A333', 'A339', 'A359', 'A35K', 'B763', 'B772'].sort());
    for (const id of dense) expect(types[id]!.denseAbreast).toBe(types[id]!.abreast! + 1);
  });
  it('every type has real specs', () => {
    for (const id of ids) AircraftDetailsSchema.parse((details as Record<string, unknown>)[id]);
    expect(Object.keys(details).sort()).toEqual([...ids].sort());
  });
  it('every type has a credited, freely licensed photo that ships with the game', () => {
    for (const id of ids.filter((x) => !NO_PHOTO.includes(x))) {
      const p = AircraftPhotoSchema.parse((photos as Record<string, unknown>)[id]);
      const file = join(import.meta.dirname, 'photos', p.file);
      expect(existsSync(file), id).toBe(true);
      expect(statSync(file).size, id).toBeLessThan(200_000);
      if (!/^(CC0|Public domain)/i.test(p.license)) expect(p.licenseUrl, id).toMatch(/^https?:\/\//);
    }
    expect(Object.keys(photos).sort()).toEqual(ids.filter((x) => !NO_PHOTO.includes(x)).sort());
  });
  it('specs agree with the simulation where they overlap', () => {
    const d = details as Record<string, { abreast: number }>;
    for (const a of aircraft.filter((x) => !isFreighter(x))) {
      if (a.class === 'widebody') expect(d[a.id]!.abreast, a.id).toBeGreaterThanOrEqual(7);
      else expect(d[a.id]!.abreast, a.id).toBeLessThanOrEqual(6);
    }
  });
});
