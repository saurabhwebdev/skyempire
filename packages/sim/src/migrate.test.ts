import { describe, expect, it } from 'vitest';
import v1 from './__fixtures__/v1-save.json';
import { CURRENT_SCHEMA, migrate } from './migrate';
import { catalog } from './testing';
import { tick } from './tick';
import { checkConfig } from './cabin';
import type { GameState } from '@skyempire/shared';

describe('save migration', () => {
  it('migrates a v1 save', () => {
    let s = migrate(structuredClone(v1));
    expect(s.schemaVersion).toBe(CURRENT_SCHEMA);
    expect(s.world).toEqual({ startYear: 2026, liveWeather: {}, tensions: [], preCancelled: {} });
    for (let i = 0; i < 5; i++) s = tick(s, [], catalog).state;
    expect(s.day).toBe(45);
  });
  it('turns the old airline-wide service level into cabin products (schema 3)', () => {
    const raw = structuredClone(v1) as unknown as Record<string, unknown>;
    const airlines = raw.airlines as Record<string, { serviceLevel: number }>;
    const ids = Object.keys(airlines);
    airlines[ids[0]!]!.serviceLevel = 1;
    airlines[ids[1]!]!.serviceLevel = 5;
    const s: GameState = migrate(raw);
    for (const al of Object.values(s.airlines)) {
      expect(al).not.toHaveProperty('serviceLevel');
      expect(al.cabinTemplates).toEqual([]);
    }
    for (const ac of Object.values(s.aircraft)) {
      expect(ac.refitDaysLeft).toBe(0);
      expect(ac.dense).toBe(false);
      expect(checkConfig({ seats: ac.cabin, product: ac.product, dense: ac.dense }, catalog.aircraftTypes[ac.typeId]!), ac.id).toBeNull();
    }
    const of = (i: number) => Object.values(s.aircraft).find((a) => a.ownerId === ids[i])!.product;
    expect(of(0).economy).toMatchObject({ seat: 'standard', ife: 'none', meal: 'none' });
    expect(of(1).economy).toMatchObject({ seat: 'standard', ife: 'premium', meal: 'hot' });
    expect(of(1).business).toMatchObject({ seat: 'angled', meal: 'dining', amenityKit: true, lounge: true });
  });
  it('leaves a current save as is', () => {
    const s = migrate(structuredClone(v1));
    expect(migrate(structuredClone(s))).toEqual(s);
  });
  it('rejects saves from a newer version', () => expect(() => migrate({ ...v1, schemaVersion: 99 })).toThrow(/newer/));
});

describe('schema 5 (cargo)', () => {
  it('gives airlines a kind, belly cargo on, and routes passenger with default belly cargo', async () => {
    const { playerGame } = await import('./testing');
    const s = playerGame('FRA', 3) as unknown as Record<string, unknown>;
    type Loose = Record<string, unknown>;
    const old = structuredClone(s) as Loose;
    old.schemaVersion = 4;
    for (const al of Object.values(old.airlines as Record<string, Loose>)) { delete al.kind; delete al.bellyCargo; delete al.dgLicence; }
    old.routes = { r1: { id: 'r1', airlineId: old.playerId, from: 'FRA', to: 'CDG', fares: { economy: 1, premium: 1, business: 1 }, assignments: [], status: 'suspended', openedDay: 0, last: null, profit30: [] } };
    const m = migrate(old);
    expect(m.schemaVersion).toBe(CURRENT_SCHEMA);
    expect(m.airlines[m.playerId]).toMatchObject({ kind: 'passenger', bellyCargo: true, dgLicence: false });
    const lh = Object.values(m.airlines).find((a) => a.code === 'LH');
    if (lh) expect(lh.kind).toBe('combination');
    expect(m.routes.r1).toMatchObject({ kind: 'passenger', belly: { mode: 'default' } });
  });
});
