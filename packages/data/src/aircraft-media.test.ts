import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import aircraft from './aircraft.json';
import details from './aircraft-details.json';
import photos from './aircraft-photos.json';
import { AircraftDetailsSchema, AircraftPhotoSchema } from './schema';

const ids = aircraft.map((a) => a.id);

describe('aircraft photos and specs', () => {
  it('every type has real specs', () => {
    for (const id of ids) AircraftDetailsSchema.parse((details as Record<string, unknown>)[id]);
    expect(Object.keys(details).sort()).toEqual([...ids].sort());
  });
  it('every type has a credited, freely licensed photo that ships with the game', () => {
    for (const id of ids) {
      const p = AircraftPhotoSchema.parse((photos as Record<string, unknown>)[id]);
      const file = join(import.meta.dirname, 'photos', p.file);
      expect(existsSync(file), id).toBe(true);
      expect(statSync(file).size, id).toBeLessThan(200_000);
      if (!/^(CC0|Public domain)/i.test(p.license)) expect(p.licenseUrl, id).toMatch(/^https?:\/\//);
    }
    expect(Object.keys(photos).sort()).toEqual([...ids].sort());
  });
  it('specs agree with the simulation where they overlap', () => {
    const d = details as Record<string, { abreast: number }>;
    for (const a of aircraft) {
      if (a.class === 'widebody') expect(d[a.id]!.abreast, a.id).toBeGreaterThanOrEqual(7);
      else expect(d[a.id]!.abreast, a.id).toBeLessThanOrEqual(6);
    }
  });
});
