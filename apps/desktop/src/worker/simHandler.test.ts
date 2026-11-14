import { standardProduct } from '@skyempire/sim';
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
    const r = h.handle({ kind: 'command', cmd: { type: 'leaseAircraft', typeId: 'B77W', config: { seats: { economy: 400, premium: 0, business: 0 }, product: standardProduct(), dense: false } } });
    expect(r.result.ok).toBe(false);
    expect(h.handle({ kind: 'snapshot' })).toEqual(before);
  });
  it('applies commands immediately, even while the clock runs', () => {
    const h = createSimHandler(catalog);
    h.handle({ kind: 'newGame', opts });
    const cmd = { type: 'leaseAircraft' as const, typeId: 'A20N', config: { seats: { economy: 194, premium: 0, business: 0 }, product: standardProduct(), dense: false } };
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

describe('live weather input', () => {
  it('lists the airports in use and merges forecasts, dropping past days', async () => {
    const { loadCatalog } = await import('@skyempire/data');
    const { createSimHandler } = await import('./simHandler');
    const h = createSimHandler(loadCatalog('world'));
    h.handle({ kind: 'newGame', opts: { seed: 1, regionId: 'world', difficulty: 'normal', homeBaseId: 'LHR', aiCount: 2, airline: { name: 'Weather Test Air', code: 'W1T', colors: { primary: '#123456', secondary: '#ffffff' }, logoShape: 'circle' } } });
    const pts = h.handle({ kind: 'weatherPoints' });
    expect(pts.points.some((p) => p.id === 'LHR')).toBe(true);
    h.handle({ kind: 'setLiveWeather', token: pts.token, data: { 1: { LHR: 'snow' }, 2: { LHR: 'fog' } } });
    h.handle({ kind: 'tick' });
    h.handle({ kind: 'tick' });
    const s = h.handle({ kind: 'snapshot' });
    h.handle({ kind: 'setLiveWeather', token: pts.token, data: { 5: { LHR: 'rain' } } });
    expect(Object.keys(h.handle({ kind: 'snapshot' }).world.liveWeather)).toEqual(['2', '5']);
    expect(s.world.liveWeather[2]).toEqual({ LHR: 'fog' });
  });
});

describe('live weather safety', () => {
  it('ignores forecasts meant for another career and days already simulated', () => {
    const h = createSimHandler(loadCatalog('world'));
    h.handle({ kind: 'newGame', opts: { seed: 1, regionId: 'world', difficulty: 'normal', homeBaseId: 'LHR', aiCount: 0, airline: { name: 'Token Air', code: 'T1K', colors: { primary: '#123456', secondary: '#ffffff' }, logoShape: 'circle' } } });
    const { token } = h.handle({ kind: 'weatherPoints' });
    h.handle({ kind: 'tick' });
    h.handle({ kind: 'setLiveWeather', token: 'someone-else', data: { 5: { LHR: 'snow' } } });
    h.handle({ kind: 'setLiveWeather', token, data: { 1: { LHR: 'fog' }, 3: { LHR: 'rain' } } });
    expect(h.handle({ kind: 'snapshot' }).world.liveWeather).toEqual({ 3: { LHR: 'rain' } });
  });
});
