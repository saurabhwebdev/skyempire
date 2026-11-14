// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster, TooltipProvider } from '@skyempire/ui';
import type { Aircraft } from '@skyempire/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameStore, useUi } from '../../store';
import { fakeView } from '../../testing';
import { AircraftInspector } from './AircraftInspector';
import { aircraftStatus, FleetTray } from './FleetTray';
import { standardProduct } from '@skyempire/sim';

const ac: Aircraft = {
  id: 'ac1', typeId: 'A20N', ownerId: 'al_player', ownership: 'leased', ageDays: 400, condition: 92, flightHours: 900, hoursSinceA: 0,
  hoursSinceC: 0, cabin: { economy: 194, premium: 0, business: 0 }, product: standardProduct(), dense: false, refitDaysLeft: 0, status: 'active', maintenanceDaysLeft: 0, bookValue: 0,
};
const wrap = (ui: React.ReactNode) => render(<TooltipProvider><Toaster>{ui}</Toaster></TooltipProvider>);

describe('Fleet', () => {
  beforeEach(() => useUi.setState({ ...useUi.getInitialState(), screen: 'game' }));

  it('guides a new player to the aircraft market', async () => {
    const user = userEvent.setup();
    useGameStore.setState({ view: fakeView() });
    wrap(<FleetTray />);
    expect(screen.getByText('No aircraft yet. Lease your first one to start flying.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Browse aircraft' }));
    expect(useUi.getState().marketOpen).toBe(true);
  });

  it('lists the routes that will be suspended before returning a lease', async () => {
    const user = userEvent.setup();
    useGameStore.setState({
      view: fakeView({}, {
        aircraft: [ac],
        routes: [{ id: 'r1', airlineId: 'al_player', from: 'LHR', to: 'CDG', fares: { economy: 90, premium: 1, business: 1 }, assignments: [{ aircraftId: 'ac1', roundTripsPerWeek: 7 }], status: 'active', openedDay: 0, last: null, profit30: [] }],
      }),
    });
    window.game = { command: vi.fn().mockResolvedValue({ ok: true }) } as unknown as typeof window.game;
    wrap(<AircraftInspector id="ac1" />);
    await user.click(screen.getByRole('button', { name: 'Return lease' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('LHR → CDG');
  });

  it('meals can still change while a refit runs', () => {
    useGameStore.setState({ view: fakeView({}, { aircraft: [{ ...ac, refitDaysLeft: 4 }] }) });
    wrap(<AircraftInspector id="ac1" />);
    expect(screen.getByRole('button', { name: 'Design cabin' })).toBeEnabled();
  });
  it('shows a running refit as the aircraft status', () => {
    expect(aircraftStatus({ ...ac, refitDaysLeft: 4 }, 0)).toEqual({ text: 'Refit · 4d', idle: false });
  });
});
