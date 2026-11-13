import { loadCatalog } from '@skyempire/data';
import type { GameState } from '@skyempire/shared';
import { newGame } from '@skyempire/sim';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SaveLoadError, SaveStore } from './saves';

const catalog = loadCatalog('world');
const state = (day = 0): GameState => {
  const s = newGame({ seed: 1, regionId: 'world', difficulty: 'normal', homeBaseId: 'LHR', aiCount: 2,
    airline: { name: 'Save Test Air', code: 'S1T', colors: { primary: '#123456', secondary: '#ffffff' }, logoShape: 'circle' } }, catalog);
  s.day = day;
  return s;
};
const store = () => new SaveStore(mkdtempSync(join(tmpdir(), 'skyempire-saves-')));

describe('SaveStore', () => {
  it('round-trips a game', () => {
    const st = store();
    const info = st.createSave('My career', state(5));
    expect(st.loadLatest(info.id)).toEqual(state(5));
    expect(st.listSaves()[0]).toMatchObject({ id: info.id, name: 'My career', airlineName: 'Save Test Air', day: 5 });
  });
  it('keeps only the last 3 autosaves (plus manual saves)', () => {
    const st = store();
    const info = st.createSave('c', state(0));
    for (let d = 1; d <= 5; d++) st.writeSnapshot(info.id, state(d * 30), 'auto');
    expect(st.snapshotCount(info.id)).toEqual({ auto: 3, manual: 1 });
    expect(st.loadLatest(info.id).day).toBe(150);
  });
  it('a failed write leaves the previous snapshot loadable', () => {
    const st = store();
    const info = st.createSave('c', state(10));
    const bad = state(20) as unknown as Record<string, unknown>;
    bad.broken = 10n; // BigInt can't be serialized
    expect(() => st.writeSnapshot(info.id, bad as unknown as GameState, 'manual')).toThrow();
    expect(st.loadLatest(info.id).day).toBe(10);
  });
  it('reports a damaged file as corrupt', () => {
    const st = store();
    const info = st.createSave('c', state(1));
    const file = st.pathOf(info.id);
    writeFileSync(file, readFileSync(file).subarray(0, 100));
    expect(() => st.loadLatest(info.id)).toThrow(SaveLoadError);
    try { st.loadLatest(info.id); } catch (e) { expect((e as SaveLoadError).reason).toBe('corrupt'); }
    expect(st.listSaves().find((x) => x.id === info.id)?.airlineName).toBe('(damaged)');
  });
  it('refuses saves from a newer version', () => {
    const st = store();
    const s = state(1) as unknown as { schemaVersion: number };
    s.schemaVersion = 99;
    const info = st.createSave('c', s as unknown as GameState);
    try { st.loadLatest(info.id); expect.fail('should throw'); } catch (e) { expect((e as SaveLoadError).reason).toBe('newerVersion'); }
  });
  it('reports a missing save', () => {
    try { store().loadLatest('nope'); expect.fail('should throw'); } catch (e) { expect((e as SaveLoadError).reason).toBe('missing'); }
  });
  it('stores daily history', () => {
    const st = store();
    const info = st.createSave('c', state(0));
    const costs = { fuel: 1, crew: 0, maintenance: 0, fees: 0, service: 0, leases: 0, interest: 0, overhead: 0, bases: 0, marketing: 0 };
    st.appendDaily(info.id, [1, 2, 3].map((day) => ({ day, airlineId: 'al_player', cash: day, revenue: day * 10, pax: 1, costs })));
    expect(st.history(info.id, 'al_player', 2, 3).map((d) => d.revenue)).toEqual([20, 30]);
  });
});
