// @vitest-environment jsdom
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster, TooltipProvider } from '@skyempire/ui';
import type { Aircraft, Route } from '@skyempire/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { standardProduct } from '@skyempire/sim';
import { useGameStore, useUi } from '../../store';
import { fakeView } from '../../testing';
import { NetworkTray } from './NetworkTray';
import { RouteEditor } from './RouteEditor';

const ac: Aircraft = {
  id: 'ac1', typeId: 'A20N', ownerId: 'al_player', ownership: 'leased', ageDays: 0, condition: 100, flightHours: 0, hoursSinceA: 0,
  hoursSinceC: 0, cabin: { economy: 194, premium: 0, business: 0 }, product: standardProduct(), dense: false, refitDaysLeft: 0, status: 'active', maintenanceDaysLeft: 0, bookValue: 0,
};
const route = (o: Partial<Route> = {}): Route => ({
  id: 'r1', airlineId: 'al_player', from: 'LHR', to: 'CDG', fares: { economy: 90, premium: 160, business: 300 },
  assignments: [{ aircraftId: 'ac1', roundTripsPerWeek: 14 }], status: 'active', openedDay: 0,
  last: { pax: { economy: 300, premium: 0, business: 0 }, loadFactor: 0.77, revenue: 27000, cost: 20000, profit: 7000 }, profit30: [7000], ...o,
});
const wrap = (ui: React.ReactNode) => render(<TooltipProvider><Toaster>{ui}</Toaster></TooltipProvider>);

describe('RouteEditor', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    useGameStore.setState({ view: fakeView({}, { aircraft: [ac] }) });
    useUi.setState({ ...useUi.getInitialState(), screen: 'game', routeEditor: { from: 'LHR', to: 'CDG' } });
  });
  afterEach(() => vi.useRealTimers());

  it('previews once after edits settle for 150 ms', async () => {
    const preview = vi.fn().mockResolvedValue({ ok: true, expectedLoadFactor: 0.8, expectedProfitPerDay: 9200, paybackDays: 21, suggestedFares: { economy: 95, premium: 170, business: 330 }, distanceKm: 348 });
    window.game = { preview, command: vi.fn() } as unknown as typeof window.game;
    wrap(<RouteEditor />);
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(preview).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(preview).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/Expected load 80%/)).toBeInTheDocument();
  });

  it('shows the range problem and explains why it cannot open', async () => {
    window.game = {
      preview: vi.fn().mockResolvedValue({ ok: false, reason: 'Range too short — Airbus A320neo flies max 6,300 km' }),
      command: vi.fn(),
    } as unknown as typeof window.game;
    useUi.setState({ routeEditor: { from: 'LHR', to: 'SYD' } });
    wrap(<RouteEditor />);
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(await screen.findByText('Range too short — Airbus A320neo flies max 6,300 km')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open route' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Show aircraft that can fly this' })).toBeInTheDocument();
  });

  it('opens the route, confirms with a toast and closes', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const command = vi.fn().mockResolvedValue({ ok: true });
    window.game = {
      preview: vi.fn().mockResolvedValue({ ok: true, expectedLoadFactor: 0.8, expectedProfitPerDay: 9200, paybackDays: 21, suggestedFares: { economy: 95, premium: 170, business: 330 }, distanceKm: 348 }),
      command,
    } as unknown as typeof window.game;
    wrap(<RouteEditor />);
    await act(() => vi.advanceTimersByTimeAsync(200));
    await user.click(screen.getByRole('button', { name: 'Open route' }));
    expect(command).toHaveBeenCalledWith(expect.objectContaining({ type: 'openRoute', from: 'LHR', to: 'CDG' }));
    expect(await screen.findByText('Route LHR–CDG opened')).toBeInTheDocument();
    expect(useUi.getState().routeEditor).toBeNull();
  });
});

describe('NetworkTray', () => {
  it('marks suspended routes', () => {
    useGameStore.setState({ view: fakeView({}, { routes: [route(), route({ id: 'r2', to: 'AMS', status: 'suspended', assignments: [], last: null })] }) });
    wrap(<NetworkTray />);
    expect(within(screen.getByRole('table')).getByText('Suspended')).toBeInTheDocument();
    expect(screen.getByText('LHR → CDG')).toBeInTheDocument();
  });
});

describe('route status chips', () => {
  it('show a detour and a block in the route list', () => {
    useGameStore.setState({ view: fakeView({}, { aircraft: [ac], routes: [route(), route({ id: 'r2', to: 'MAD' })], routeStatus: { r1: { detourKm: 480, blocked: null }, r2: { detourKm: 0, blocked: 'Flights banned between United Kingdom and Spain' } } }) });
    wrap(<NetworkTray />);
    expect(screen.getByText('Detour +480 km')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('Grounded')).toBeInTheDocument();
  });
  it('explain a block in the route inspector', async () => {
    const { RouteInspector } = await import('./RouteInspector');
    useGameStore.setState({ view: fakeView({}, { aircraft: [ac], routes: [route()], routeStatus: { r1: { detourKm: 0, blocked: 'Flights banned between United Kingdom and France' } } }) });
    wrap(<RouteInspector id="r1" />);
    expect(screen.getByText('Flights banned between United Kingdom and France. This route is grounded until it lifts; its slots are kept.')).toBeInTheDocument();
  });
});

describe('RouteEditor detours', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    useGameStore.setState({ view: fakeView({}, { aircraft: [ac] }) });
    useUi.setState({ ...useUi.getInitialState(), screen: 'game', routeEditor: { from: 'LHR', to: 'CDG' } });
  });
  afterEach(() => vi.useRealTimers());
  it('warns about the extra distance before opening', async () => {
    const preview = vi.fn().mockResolvedValue({ ok: true, expectedLoadFactor: 0.8, expectedProfitPerDay: 9200, paybackDays: 21, suggestedFares: { economy: 95, premium: 170, business: 330 }, distanceKm: 348, detourKm: 480 });
    window.game = { preview, command: vi.fn() } as unknown as typeof window.game;
    wrap(<RouteEditor />);
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(await screen.findByText('Detour +480 km around closed airspace')).toBeInTheDocument();
  });
});
