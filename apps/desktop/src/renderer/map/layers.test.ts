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
  it('flags player bases', () => {
    const layer = buildLayers(input()).find((l) => l.id === 'airports')!;
    const data = layer.props.data as { id: string; isBase: boolean }[];
    expect(data.find((a) => a.id === 'LHR')?.isBase).toBe(true);
    expect(data.find((a) => a.id === 'CDG')?.isBase).toBe(false);
  });
});
