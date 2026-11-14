import { describe, expect, it } from 'vitest';
import v1 from './__fixtures__/v1-save.json';
import { migrate } from './migrate';
import { catalog } from './testing';
import { tick } from './tick';

describe('save migration', () => {
  it('migrates a v1 save', () => {
    let s = migrate(structuredClone(v1));
    expect(s.schemaVersion).toBe(2);
    expect(s.world).toEqual({ startYear: 2026, liveWeather: {}, tensions: [], preCancelled: {} });
    for (let i = 0; i < 5; i++) s = tick(s, [], catalog).state;
    expect(s.day).toBe(45);
  });
  it('leaves a v2 save as is', () => {
    const s = migrate(structuredClone(v1));
    expect(migrate(structuredClone(s))).toEqual(s);
  });
  it('rejects saves from a newer version', () => expect(() => migrate({ ...v1, schemaVersion: 99 })).toThrow(/newer/));
});
