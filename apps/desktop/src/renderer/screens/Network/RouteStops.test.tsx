// @vitest-environment jsdom
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster, TooltipProvider } from '@skyempire/ui';
import type { Aircraft, Route } from '@skyempire/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { standardProduct } from '@skyempire/sim';
import { useGameStore, useUi } from '../../store';
import { fakeView } from '../../testing';
import { routeLabel } from '../../lib/routes';
import { NetworkTray } from './NetworkTray';
import { RouteEditor } from './RouteEditor';
import { RouteInspector } from './RouteInspector';

const ac: Aircraft = {
  id: 'ac1', typeId: 'A20N', ownerId: 'al_player', ownership: 'leased', ageDays: 0, condition: 100, flightHours: 0, hoursSinceA: 0,
  hoursSinceC: 0, cabin: { economy: 194, premium: 0, business: 0 }, product: standardProduct(), dense: false, refitDaysLeft: 0, status: 'active', maintenanceDaysLeft: 0, bookValue: 0,
};
const wrap = (ui: React.ReactNode) => render(<TooltipProvider><Toaster>{ui}</Toaster></TooltipProvider>);
const legFares = { 'DXB-LHR': { economy: 400, premium: 700, business: 1500 }, 'DXB-SIN': { economy: 380, premium: 650, business: 1400 } };

describe('routes with stops', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    useGameStore.setState({ view: fakeView({}, { aircraft: [ac] }) });
    useUi.setState({ ...useUi.getInitialState(), screen: 'game', routeEditor: { from: 'LHR', to: 'SIN' } });
  });
  afterEach(() => vi.useRealTimers());

  it('adds a stop, shows a fare for every market and opens the route with it', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const command = vi.fn().mockResolvedValue({ ok: true });
    const preview = vi.fn().mockResolvedValue({ ok: true, expectedLoadFactor: 0.8, expectedProfitPerDay: 9200, suggestedFares: { economy: 700, premium: 1200, business: 2600 }, suggestedLegFares: legFares, distanceKm: 11343 });
    window.game = { preview, command } as unknown as typeof window.game;
    wrap(<RouteEditor />);
    await user.click(screen.getByRole('button', { name: 'Add a stop' }));
    const stop = screen.getByRole('combobox', { name: 'Stop 1' });
    await user.type(stop, 'DXB');
    await user.keyboard('{Enter}');
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(preview).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'openRoute', from: 'LHR', to: 'SIN', stops: ['DXB'] }));
    const table = await screen.findByRole('table', { name: 'Fares by market' });
    expect(within(table).getAllByRole('row').map((r) => r.querySelector('th')?.textContent)).toEqual(['Market', 'LHR → DXB', 'LHR → SIN', 'DXB → SIN']);
    expect(within(table).getByLabelText('LHR → DXB economy fare')).toHaveValue('400');
    await user.click(screen.getByRole('button', { name: 'Open route' }));
    expect(command).toHaveBeenCalledWith(expect.objectContaining({ type: 'openRoute', stops: ['DXB'], fares: { economy: 700, premium: 1200, business: 2600 }, legFares }));
    expect(await screen.findByText('Route LHR → DXB → SIN opened')).toBeInTheDocument();
  });

  it('allows at most 2 stops and lets you remove one', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    window.game = { preview: vi.fn().mockResolvedValue({ ok: true }), command: vi.fn() } as unknown as typeof window.game;
    wrap(<RouteEditor />);
    await user.click(screen.getByRole('button', { name: 'Add a stop' }));
    await user.click(screen.getByRole('button', { name: 'Add a stop' }));
    expect(screen.queryByRole('button', { name: 'Add a stop' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove stop 2' }));
    expect(screen.queryByRole('combobox', { name: 'Stop 2' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add a stop' })).toBeInTheDocument();
  });

  it('labels a stop route with every airport', () => {
    const r: Route = { id: 'r1', airlineId: 'al_player', from: 'LHR', to: 'SIN', stops: ['DXB'], fares: { economy: 1, premium: 1, business: 1 }, assignments: [{ aircraftId: 'ac1', roundTripsPerWeek: 3 }], status: 'active', openedDay: 0, last: null, profit30: [] };
    expect(routeLabel(r)).toBe('LHR → DXB → SIN');
    useGameStore.setState({ view: fakeView({}, { aircraft: [ac], routes: [r] }) });
    wrap(<NetworkTray />);
    expect(screen.getByText('LHR → DXB → SIN')).toBeInTheDocument();
  });

  it('the route panel shows passengers per market and how full each leg is', () => {
    const r: Route = { id: 'r1', airlineId: 'al_player', from: 'LHR', to: 'SIN', stops: ['DXB'], fares: { economy: 1, premium: 1, business: 1 }, assignments: [{ aircraftId: 'ac1', roundTripsPerWeek: 3 }], status: 'active', openedDay: 0, profit30: [],
      last: { pax: { economy: 600, premium: 0, business: 0 }, loadFactor: 0.9, revenue: 1, cost: 1, profit: 0, legLoad: [1, 0.8],
        marketPax: { 'DXB-LHR': { economy: 300, premium: 0, business: 0 }, 'LHR-SIN': { economy: 88, premium: 0, business: 0 }, 'DXB-SIN': { economy: 212, premium: 0, business: 0 } } } };
    useGameStore.setState({ view: fakeView({}, { aircraft: [ac], routes: [r], routeStatus: {} }) });
    wrap(<RouteInspector id="r1" />);
    const table = screen.getByRole('table', { name: 'Passengers by market' });
    expect(within(table).getAllByRole('row').map((x) => x.textContent)).toEqual(['MarketPassengers/day', 'LHR → DXB300', 'LHR → SIN88', 'DXB → SIN212']);
    expect(screen.getByText('LHR → DXB 100% · DXB → SIN 80%')).toBeInTheDocument();
  });
});
