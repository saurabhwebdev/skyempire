// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster, TooltipProvider } from '@skyempire/ui';
import type { Route } from '@skyempire/shared';
import { describe, expect, it, vi } from 'vitest';
import { useGameStore } from '../../store';
import { fakeView } from '../../testing';
import { SeasonalFares } from './SeasonalFares';

const route: Route = {
  id: 'r1', airlineId: 'al_player', from: 'LHR', to: 'CDG', fares: { economy: 90, premium: 160, business: 300 },
  assignments: [{ aircraftId: 'ac1', roundTripsPerWeek: 14 }], status: 'active', openedDay: 0, last: null, profit30: [],
  seasonalFares: [{ startDay: 353, endDay: 369, pct: 20 }],
};
const wrap = () => render(<TooltipProvider><Toaster><SeasonalFares route={route} /></Toaster></TooltipProvider>);

describe('SeasonalFares', () => {
  it('lists existing periods with their change', () => {
    useGameStore.setState({ view: fakeView({}, { day: 300 }) });
    wrap();
    expect(screen.getByText('Dec 20 – Jan 5')).toBeInTheDocument();
    expect(screen.getByText('+20%')).toBeInTheDocument();
  });
  it('adds a period from dates and a percentage', async () => {
    const command = vi.fn().mockResolvedValue({ ok: true });
    window.game = { command } as unknown as typeof window.game;
    useGameStore.setState({ view: fakeView({}, { day: 300 }) });
    wrap();
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2027-02-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2027-02-10' } });
    const pct = screen.getByLabelText('Fare change');
    await userEvent.clear(pct);
    await userEvent.type(pct, '15');
    await userEvent.tab();
    await userEvent.click(screen.getByRole('button', { name: 'Add seasonal fare' }));
    expect(command).toHaveBeenCalledWith({
      type: 'updateRoute', routeId: 'r1',
      seasonalFares: [{ startDay: 353, endDay: 369, pct: 20 }, { startDay: 396, endDay: 405, pct: 15 }],
    });
  });
  it('removes a period', async () => {
    const command = vi.fn().mockResolvedValue({ ok: true });
    window.game = { command } as unknown as typeof window.game;
    useGameStore.setState({ view: fakeView({}, { day: 300 }) });
    wrap();
    await userEvent.click(screen.getByRole('button', { name: 'Remove Dec 20 – Jan 5' }));
    expect(command).toHaveBeenCalledWith({ type: 'updateRoute', routeId: 'r1', seasonalFares: [] });
  });
});
