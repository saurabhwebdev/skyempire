// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Aircraft, Command, RouteSuggestion } from '@skyempire/shared';
import { standardProduct } from '@skyempire/sim';
import { Toaster, TooltipProvider } from '@skyempire/ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameStore, useUi } from '../../store';
import { fakeView } from '../../testing';
import { FleetTray } from './FleetTray';

const ac = (id: string): Aircraft => ({
  id, typeId: 'A20N', ownerId: 'al_player', ownership: 'leased', ageDays: 0, condition: 90, flightHours: 0, hoursSinceA: 0, hoursSinceC: 0,
  cabin: { economy: 194, premium: 0, business: 0 }, product: standardProduct(), dense: false, refitDaysLeft: 0, status: 'active', maintenanceDaysLeft: 0, bookValue: 0,
});
const sug = (to: string, profit: number): RouteSuggestion => ({ from: 'LHR', to, roundTripsPerWeek: 14, fares: { economy: 120, premium: 200, business: 400 }, expectedLoadFactor: 0.82, expectedProfitPerDay: profit, distanceKm: 1200 });
const wrap = (ui: React.ReactNode) => render(<TooltipProvider><Toaster>{ui}</Toaster></TooltipProvider>);

describe('use free hours', () => {
  beforeEach(() => useUi.setState({ ...useUi.getInitialState(), screen: 'game' }));

  it('lists underused aircraft with route suggestions and opens one in a click', async () => {
    const user = userEvent.setup();
    const command = vi.fn().mockResolvedValue({ ok: true });
    window.game = { command, suggestRoutes: vi.fn().mockResolvedValue([sug('MAD', 12_000), sug('FCO', 9_000)]) } as unknown as typeof window.game;
    useGameStore.setState({ view: fakeView({}, { aircraft: [ac('a1')] }) });
    wrap(<FleetTray />);
    await user.click(screen.getByRole('button', { name: /Use free hours/ }));
    const dialog = screen.getByRole('dialog');
    expect(await within(dialog).findByText('LHR → MAD')).toBeInTheDocument();
    expect(within(dialog).getAllByText(/82% full/)).toHaveLength(2);
    await user.click(within(dialog).getAllByRole('button', { name: /^Open LHR → MAD/ })[0]!);
    expect(command).toHaveBeenCalledWith({ type: 'openRoute', from: 'LHR', to: 'MAD', fares: { economy: 120, premium: 200, business: 400 }, assignments: [{ aircraftId: 'a1', roundTripsPerWeek: 14 }] });
  });

  it('opens the best route for every free aircraft, never the same one twice', async () => {
    const user = userEvent.setup();
    const opened = new Set<string>();
    const command = vi.fn(async (c: Command) => { if (c.type === 'openRoute') opened.add(c.to); return { ok: true }; });
    const suggestRoutes = vi.fn(async () => [sug('MAD', 12_000), sug('FCO', 9_000), sug('ATH', 5_000)].filter((x) => !opened.has(x.to)));
    window.game = { command, suggestRoutes } as unknown as typeof window.game;
    useGameStore.setState({ view: fakeView({}, { aircraft: [ac('a1'), ac('a2')] }) });
    wrap(<FleetTray />);
    await user.click(screen.getByRole('button', { name: /Use free hours/ }));
    await screen.findAllByText('LHR → MAD');
    await user.click(screen.getByRole('button', { name: 'Open best for all' }));
    await waitFor(() => expect(command).toHaveBeenCalledTimes(2));
    expect(command.mock.calls.map(([c]) => (c as { to: string }).to)).toEqual(['MAD', 'FCO']);
    expect(await screen.findByText('Opened 2 routes')).toBeInTheDocument();
  });

  it('tries the next suggestion when the best one can no longer open', async () => {
    const user = userEvent.setup();
    const command = vi.fn(async (c: Command) => (c.type === 'openRoute' && c.to === 'MAD' ? { ok: false, reason: 'No free slots at MAD' } : { ok: true }));
    window.game = { command, suggestRoutes: vi.fn(async () => [sug('MAD', 12_000), sug('FCO', 9_000)]) } as unknown as typeof window.game;
    useGameStore.setState({ view: fakeView({}, { aircraft: [ac('a1')] }) });
    wrap(<FleetTray />);
    await user.click(screen.getByRole('button', { name: /Use free hours/ }));
    await screen.findAllByText('LHR → MAD');
    await user.click(screen.getByRole('button', { name: 'Open best for all' }));
    expect(await screen.findByText('Opened 1 route')).toBeInTheDocument();
    expect(command.mock.calls.map(([c]) => (c as { to: string }).to)).toEqual(['MAD', 'FCO']);
  });

  it('a failed lookup does not leave the panel stuck', async () => {
    const user = userEvent.setup();
    const suggestRoutes = vi.fn().mockResolvedValueOnce([sug('MAD', 12_000)]).mockRejectedValueOnce(new Error('worker busy')).mockResolvedValue([]);
    window.game = { command: vi.fn(), suggestRoutes } as unknown as typeof window.game;
    useGameStore.setState({ view: fakeView({}, { aircraft: [ac('a1')] }) });
    wrap(<FleetTray />);
    await user.click(screen.getByRole('button', { name: /Use free hours/ }));
    await screen.findAllByText('LHR → MAD');
    await user.click(screen.getByRole('button', { name: 'Open best for all' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open best for all' })).toBeEnabled());
    expect(screen.getByRole('button', { name: 'Open best for all' })).not.toHaveAttribute('aria-busy', 'true');
  });

  it('says so when every aircraft is busy', async () => {
    const user = userEvent.setup();
    window.game = { suggestRoutes: vi.fn() } as unknown as typeof window.game;
    const busy = { ...ac('a1') };
    useGameStore.setState({ view: fakeView({}, {
      aircraft: [busy],
      routes: [{ id: 'r1', airlineId: 'al_player', from: 'LHR', to: 'JFK', fares: { economy: 1, premium: 1, business: 1 }, assignments: [{ aircraftId: 'a1', roundTripsPerWeek: 7 }], status: 'active', openedDay: 0, last: null, profit30: [] }],
    }) });
    wrap(<FleetTray />);
    await user.click(screen.getByRole('button', { name: /Use free hours/ }));
    expect(screen.getByText(/All your aircraft are busy/)).toBeInTheDocument();
  });
});
