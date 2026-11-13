import { loadCatalog } from '@skyempire/data';
import type { NewGameOptions } from '@skyempire/shared';
import { describe, expect, it } from 'vitest';
import { createSimHandler } from './simHandler';

const opts: NewGameOptions = {
  seed: 1, regionId: 'world', difficulty: 'normal', homeBaseId: 'LHR', aiCount: 3,
  airline: { name: 'Worker Test Air', code: 'W1T', colors: { primary: '#123456', secondary: '#ffffff' }, logoShape: 'circle' },
};

describe('sim worker handler', () => {
  const catalog = loadCatalog('world');
  it('starts a game and returns the player view', () => {
    const h = createSimHandler(catalog);
    const view = h.handle({ kind: 'newGame', opts });
    expect(view.player.name).toBe('Worker Test Air');
    expect(h.handle({ kind: 'view' }).day).toBe(0);
  });
  it('rejects invalid commands without changing state', () => {
    const h = createSimHandler(catalog);
    h.handle({ kind: 'newGame', opts });
    const before = h.handle({ kind: 'snapshot' });
    const r = h.handle({ kind: 'command', cmd: { type: 'leaseAircraft', typeId: 'B77W', cabin: { economy: 400, premium: 0, business: 0 } } });
    expect(r.result.ok).toBe(false);
    expect(h.handle({ kind: 'snapshot' })).toEqual(before);
  });
  it('applies commands immediately, even while the clock runs', () => {
    const h = createSimHandler(catalog);
    h.handle({ kind: 'newGame', opts });
    const cmd = { type: 'leaseAircraft' as const, typeId: 'A20N', cabin: { economy: 194, premium: 0, business: 0 } };
    expect(h.handle({ kind: 'command', cmd }).view!.aircraft).toHaveLength(1);
    expect(h.handle({ kind: 'command', cmd }).view!.aircraft).toHaveLength(2);
    expect(h.handle({ kind: 'tick' }).view.aircraft).toHaveLength(2);
  });
  it('a failed load keeps the current game', () => {
    const h = createSimHandler(catalog);
    h.handle({ kind: 'newGame', opts });
    expect(() => h.handle({ kind: 'load', state: { schemaVersion: 1 } as never })).toThrow();
    expect(h.handle({ kind: 'view' }).player.name).toBe('Worker Test Air');
  });
  it('previews and reports route demand', () => {
    const h = createSimHandler(catalog);
    h.handle({ kind: 'newGame', opts });
    const d = h.handle({ kind: 'routeDemand', from: 'LHR', to: 'CDG' });
    expect(d.demandPerDay).toBeGreaterThan(0);
    expect(d.distanceKm).toBeGreaterThan(300);
  });
});
