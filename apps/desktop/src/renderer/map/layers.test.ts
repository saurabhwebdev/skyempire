import { loadCatalog } from '@skyempire/data';
import { describe, expect, it } from 'vitest';
import { fakeView } from '../testing';
import { buildLayers, type MapInput } from './layers';

const airports = Object.values(loadCatalog('world').airports);
const input = (o: Partial<MapInput> = {}): MapInput => ({
  airports,
  view: fakeView(
    { baseIds: ['LHR'] },
    {
      routes: [{ id: 'r1', airlineId: 'al_player', from: 'LHR', to: 'CDG', fares: { economy: 1, premium: 1, business: 1 }, assignments: [], status: 'active', openedDay: 0, last: null, profit30: [] }],
      rivals: [{ id: 'al_BA', name: 'British Airways', code: 'BA', color: '#075AAA', personality: 'legacy', fleetSize: 6, routeCount: 1, reputation: 65, overlapRoutes: 1 }],
      rivalRoutes: [{ airlineId: 'al_BA', from: 'LHR', to: 'JFK' }],
    },
  ),
  selection: null,
  showRivals: true,
  showWeather: false,
  reduceMotion: false,
  colorBlind: false,
  zoom: 5,
  ...o,
});
const ids = (o: Partial<MapInput> = {}) => buildLayers(input(o)).map((l) => l.id);

describe('buildLayers', () => {
  it('draws airports, player routes, rival routes and labels', () =>
    expect(ids()).toEqual(['rival-routes', 'player-routes', 'airports', 'labels']));
  it('hides rival routes when toggled off', () => expect(ids({ showRivals: false })).not.toContain('rival-routes'));
  it('hides labels when zoomed out', () => expect(ids({ zoom: 3 })).not.toContain('labels'));
  it('omits the weather layer when toggled off', () => {
    const view = { ...input().view, weather: { today: { LHR: 'snow' as const, JFK: 'thunderstorm' as const }, forecast: {} } };
    expect(ids({ view, showWeather: false })).not.toContain('weather');
    expect(ids({ view, showWeather: true })[0]).toBe('weather');
  });
  it('draws one weather point per airport with weather', () => {
    const view = { ...input().view, weather: { today: { LHR: 'snow' as const, JFK: 'fog' as const }, forecast: {} } };
    const layer = buildLayers(input({ view, showWeather: true })).find((l) => l.id === 'weather')!;
    expect((layer.props.data as { id: string }[]).map((d) => d.id).sort()).toEqual(['JFK', 'LHR']);
  });
  it('shades closed and soon-closing airspace only', () => {
    const t = (id: string, regionId: string, active: boolean, kind = 'airspaceClosure' as const) => ({ id, kind, regionId, startDay: 0, endDay: 9, active, label: '' });
    const view = { ...input().view, tensions: [t('a', 'caucasus', true), t('b', 'sahel', false), { id: 'c', kind: 'routeBan' as const, countries: ['DE', 'ES'] as [string, string], startDay: 0, endDay: 9, active: true, label: '' }] };
    const layer = buildLayers(input({ view })).find((l) => l.id === 'airspace')!;
    const data = layer.props.data as { id: string; active: boolean }[];
    expect(data.map((d) => [d.id, d.active])).toEqual([['caucasus', true], ['sahel', false]]);
    expect(ids()).not.toContain('airspace');
  });
  it('flags player bases', () => {
    const layer = buildLayers(input()).find((l) => l.id === 'airports')!;
    const data = layer.props.data as { id: string; isBase: boolean }[];
    expect(data.find((a) => a.id === 'LHR')?.isBase).toBe(true);
    expect(data.find((a) => a.id === 'CDG')?.isBase).toBe(false);
  });
});
