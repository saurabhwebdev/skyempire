// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Aircraft, Notification, Route } from '@skyempire/shared';
import { standardProduct } from '@skyempire/sim';
import { Toaster, TooltipProvider } from '@skyempire/ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameStore, useUi } from '../store';
import { fakeView } from '../testing';
import { AircraftMarket } from './Fleet/AircraftMarket';
import { FleetTray } from './Fleet/FleetTray';
import { NetworkTray } from './Network/NetworkTray';
import { News } from './News/News';
import { LoadDialog } from './Title/LoadDialog';
import { Market } from './Market/Market';

const wrap = (ui: React.ReactNode) => render(<TooltipProvider><Toaster>{ui}</Toaster></TooltipProvider>);
const ac = (id: string, typeId: string, o: Partial<Aircraft> = {}): Aircraft => ({
  id, typeId, ownerId: 'al_player', ownership: 'leased', ageDays: 0, condition: 90, flightHours: 0, hoursSinceA: 0, hoursSinceC: 0,
  cabin: { economy: 100, premium: 0, business: 0 }, product: standardProduct(), dense: false, refitDaysLeft: 0, status: 'active', maintenanceDaysLeft: 0, bookValue: 0, ...o,
});
const route = (id: string, to: string, profit: number, aircraftId: string): Route => ({
  id, airlineId: 'al_player', from: 'LHR', to, fares: { economy: 100, premium: 1, business: 1 }, assignments: [{ aircraftId, roundTripsPerWeek: 7 }],
  status: 'active', openedDay: 0, last: { pax: { economy: 50, premium: 0, business: 0 }, loadFactor: 0.7, revenue: 1, cost: 1, profit }, profit30: [],
});

describe('search, filter and sort', () => {
  beforeEach(() => useUi.setState({ ...useUi.getInitialState(), screen: 'game' }));

  it('aircraft market: search, class, what I can fly, sort, and a way back from no results', async () => {
    const user = userEvent.setup();
    useGameStore.setState({ view: fakeView() });
    wrap(<AircraftMarket />);
    const titles = () => screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent ?? '');
    await user.type(screen.getByRole('searchbox', { name: 'Search aircraft' }), 'boeing 787');
    expect(titles().every((t) => /Boeing 787/.test(t))).toBe(true);
    expect(screen.getByText(/^Showing 3 of/)).toBeInTheDocument();
    await user.clear(screen.getByRole('searchbox'));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Class' }), 'turboprop');
    expect(titles().every((t) => /ATR|Dash 8/.test(t))).toBe(true);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Class' }), 'all');
    await user.click(screen.getByRole('checkbox', { name: 'Only what I can fly now' }));
    expect(screen.queryByText(/Unlocks at/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Only what I can fly now' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'range');
    expect(titles()[0]).toMatch(/A350-1000|777|A350/);
    await user.type(screen.getByRole('searchbox'), 'concorde');
    expect(screen.getByText('No aircraft match these filters.')).toBeInTheDocument();
    await user.click(within(screen.getByRole('region', { name: 'Aircraft market' })).getAllByRole('button', { name: 'Clear filters' }).at(-1)!);
    expect(titles().length).toBeGreaterThan(30);
  });

  it('fleet: filter by status and search', async () => {
    const user = userEvent.setup();
    useGameStore.setState({ view: fakeView({}, { aircraft: [ac('a1', 'A20N'), ac('a2', 'AT76'), ac('a3', 'A20N', { refitDaysLeft: 3 })], routes: [route('r1', 'CDG', 100, 'a1')] }) });
    wrap(<FleetTray />);
    await user.click(screen.getByRole('radio', { name: /Refit/ }));
    expect(screen.getAllByRole('row')).toHaveLength(2); // header + 1
    await user.click(screen.getByRole('radio', { name: /^All/ }));
    await user.type(screen.getByRole('searchbox', { name: 'Search fleet' }), 'atr');
    expect(screen.getAllByRole('row')).toHaveLength(2);
  });

  it('routes: losing routes and airport search', async () => {
    const user = userEvent.setup();
    useGameStore.setState({ view: fakeView({}, { aircraft: [ac('a1', 'A20N'), ac('a2', 'A20N')], routes: [route('r1', 'CDG', 900, 'a1'), route('r2', 'AMS', -300, 'a2')] }) });
    wrap(<NetworkTray />);
    await user.click(screen.getByRole('radio', { name: /Losing/ }));
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText('LHR → AMS')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /^All/ }));
    await user.type(screen.getByRole('searchbox', { name: 'Search routes' }), 'paris');
    expect(screen.getByText('LHR → CDG')).toBeInTheDocument();
    expect(screen.queryByText('LHR → AMS')).not.toBeInTheDocument();
  });

  it('news: search on top of the category filter', async () => {
    const user = userEvent.setup();
    const n = (id: string, title: string): Notification => ({ id, day: 1, level: 'info', category: 'event', title, body: '' });
    useGameStore.setState({ view: fakeView(), notifications: [n('1', 'Fuel prices spike'), n('2', 'Strike over at CDG')], markRead: () => {} });
    wrap(<News />);
    await user.type(screen.getByRole('searchbox', { name: 'Search news' }), 'strike');
    expect(screen.getByText('Strike over at CDG')).toBeInTheDocument();
    expect(screen.queryByText('Fuel prices spike')).not.toBeInTheDocument();
  });

  it('saves: search and sort', async () => {
    const user = userEvent.setup();
    const saves = [
      { id: 'a', name: 'Career 1', airlineName: 'Saffron Air', day: 300, startYear: 2026, updatedAt: 10 },
      { id: 'b', name: 'Hard mode', airlineName: 'Blue Sky', day: 50, startYear: 2026, updatedAt: 30 },
    ];
    window.game = { listSaves: vi.fn().mockResolvedValue(saves) } as unknown as typeof window.game;
    wrap(<LoadDialog open onOpenChange={() => {}} />);
    await screen.findByText('Saffron Air');
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Blue Sky'); // most recent first
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'progress');
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Saffron Air');
    await user.type(screen.getByRole('searchbox', { name: 'Search saves' }), 'blue');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('rivals: search and filter by airline type', async () => {
    const user = userEvent.setup();
    const rival = (id: string, name: string, personality: 'budget' | 'legacy') => ({ id, name, code: id.slice(3), color: '#123456', personality, fleetSize: 5, routeCount: 4, reputation: 60, overlapRoutes: 0 });
    useGameStore.setState({ view: fakeView({}, { rivals: [rival('al_BA', 'British Airways', 'legacy'), rival('al_U2', 'easyJet', 'budget'), rival('al_FR', 'Ryanair', 'budget')] as never }) });
    window.game = { routeDemand: vi.fn() } as unknown as typeof window.game;
    wrap(<Market />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'budget');
    expect(screen.getAllByRole('row')).toHaveLength(3);
    await user.type(screen.getByRole('searchbox', { name: 'Search airlines' }), 'ryan');
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText('Ryanair')).toBeInTheDocument();
  });
});
