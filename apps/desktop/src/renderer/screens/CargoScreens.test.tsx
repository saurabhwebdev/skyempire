// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { loadCatalog } from '@skyempire/data';
import type { Aircraft, Route } from '@skyempire/shared';
import { standardProduct } from '@skyempire/sim';
import { Toaster, TooltipProvider } from '@skyempire/ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildLayers } from '../map/layers';
import { useGameStore, useUi } from '../store';
import { fakeView } from '../testing';
import { AircraftInspector } from './Fleet/AircraftInspector';
import { aircraftStatus } from './Fleet/FleetTray';
import { NetworkTray } from './Network/NetworkTray';
import { Overview } from './Overview/Overview';

const ac = (id: string, typeId: string, o: Partial<Aircraft> = {}): Aircraft => ({
  id, typeId, ownerId: 'al_player', ownership: 'owned', ageDays: 4000, condition: 90, flightHours: 0, hoursSinceA: 0, hoursSinceC: 0,
  cabin: { economy: 180, premium: 0, business: 0 }, product: standardProduct(), dense: false, refitDaysLeft: 0, status: 'active', maintenanceDaysLeft: 0, bookValue: 0, ...o,
});
const cargoRoute: Route = {
  id: 'c1', airlineId: 'al_player', from: 'LEJ', to: 'HKG', kind: 'cargo', cargoRate: 3.1, cargoAccept: ['general'], fares: { economy: 1, premium: 1, business: 1 },
  assignments: [{ aircraftId: 'f1', roundTripsPerWeek: 4 }], status: 'active', openedDay: 0, profit30: [],
  last: { pax: { economy: 0, premium: 0, business: 0 }, loadFactor: 0.72, revenue: 400_000, cost: 300_000, profit: 100_000, cargoT: 144, cargoRevenue: 400_000, cargoLoad: 0.72 },
};
const wrap = (ui: React.ReactNode) => render(<TooltipProvider><Toaster>{ui}</Toaster></TooltipProvider>);

describe('cargo on the screens', () => {
  beforeEach(() => useUi.setState({ ...useUi.getInitialState(), screen: 'game' }));

  it('converts an owned airliner to a freighter from its panel', async () => {
    const user = userEvent.setup();
    const command = vi.fn().mockResolvedValue({ ok: true });
    window.game = { command } as unknown as typeof window.game;
    useGameStore.setState({ view: fakeView({ kind: 'combination' }, { aircraft: [ac('a1', 'A321')] }) });
    wrap(<AircraftInspector id="a1" />);
    await user.click(screen.getByRole('button', { name: 'Convert to freighter' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent(/Airbus A321P2F/);
    expect(dialog).toHaveTextContent(/28 t/);
    await user.click(within(dialog).getByRole('button', { name: /^Convert ·/ }));
    expect(command).toHaveBeenCalledWith({ type: 'convertAircraft', aircraftId: 'a1', toTypeId: 'A21F' });
  });
  it('a passenger airline isn’t offered conversions; freighters have no cabin to design', () => {
    window.game = { command: vi.fn() } as unknown as typeof window.game;
    useGameStore.setState({ view: fakeView({ kind: 'passenger' }, { aircraft: [ac('a1', 'A321')] }) });
    const { unmount } = wrap(<AircraftInspector id="a1" />);
    expect(screen.queryByRole('button', { name: 'Convert to freighter' })).not.toBeInTheDocument();
    unmount();
    useGameStore.setState({ view: fakeView({ kind: 'cargo' }, { aircraft: [ac('f1', 'B77F', { cabin: { economy: 0, premium: 0, business: 0 } })] }) });
    wrap(<AircraftInspector id="f1" />);
    expect(screen.queryByRole('button', { name: 'Design cabin' })).not.toBeInTheDocument();
    expect(screen.getByText('103.7 t payload')).toBeInTheDocument();
  });
  it('shows orders and conversions in the fleet status', () => {
    expect(aircraftStatus(ac('f1', 'A35F', { deliveryDay: 365 }), 0, 10).text).toBe('On order · Jan 1, 2027');
    expect(aircraftStatus(ac('f1', 'A21F', { refitDaysLeft: 40 }), 0, 10).text).toBe('Converting · 40d');
  });
  it('lists cargo routes with their rate and load', () => {
    useGameStore.setState({ view: fakeView({ kind: 'cargo' }, { aircraft: [ac('f1', 'B77F')], routes: [cargoRoute] }) });
    wrap(<NetworkTray />);
    const row = screen.getAllByRole('row')[1]!;
    expect(row).toHaveTextContent('Cargo');
    expect(row).toHaveTextContent('$3.10/kg');
  });
  it('the Overview shows tonnes moved', () => {
    window.game = { history: vi.fn().mockResolvedValue([]) } as unknown as typeof window.game;
    useGameStore.setState({ view: fakeView({ kind: 'cargo' }, { aircraft: [ac('f1', 'B77F')], routes: [cargoRoute] }) });
    wrap(<Overview />);
    expect(screen.getByText('144 t cargo yesterday')).toBeInTheDocument();
  });
  it('draws cargo routes in their own colour on the map', () => {
    const view = fakeView({ kind: 'combination', colors: { primary: '#3366ff', secondary: '#ffffff' } }, {
      routes: [cargoRoute, { ...cargoRoute, id: 'p1', kind: 'passenger', from: 'LEJ', to: 'FRA' }],
    });
    const layer = buildLayers({ airports: Object.values(loadCatalog().airports), view, selection: null, showRivals: false, showWeather: false, reduceMotion: false, colorBlind: false, zoom: 4 })
      .find((l) => l.id === 'player-routes')!;
    const data = layer.props.data as { id: string; color: number[] }[];
    expect(data.find((d) => d.id === 'c1')!.color.slice(0, 3)).not.toEqual(data.find((d) => d.id === 'p1')!.color.slice(0, 3));
  });
});
