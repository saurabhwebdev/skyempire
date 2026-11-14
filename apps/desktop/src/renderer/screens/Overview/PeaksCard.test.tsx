// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Route } from '@skyempire/shared';
import { Toaster, TooltipProvider } from '@skyempire/ui';
import { describe, expect, it, vi } from 'vitest';
import { useGameStore } from '../../store';
import { fakeView } from '../../testing';
import { PeaksCard } from './PeaksCard';

const r = (id: string, from: string, to: string, o: Partial<Route> = {}): Route => ({
  id, airlineId: 'al_player', from, to, fares: { economy: 100, premium: 1, business: 1 }, assignments: [], status: 'active', openedDay: 0, last: null, profit30: [], ...o,
});

describe('travel peaks card', () => {
  it('raises fares on every route to the peak countries in one go', async () => {
    const user = userEvent.setup();
    const command = vi.fn().mockResolvedValue({ ok: true });
    window.game = { command } as unknown as typeof window.game;
    useGameStore.setState({ view: fakeView({}, {
      day: 280,
      routes: [r('a', 'LHR', 'DEL'), r('b', 'LHR', 'BOM', { seasonalFares: [{ startDay: 301, endDay: 303, pct: 5 }] }), r('c', 'LHR', 'CDG')],
      upcomingPeaks: [{ name: 'Diwali', countries: ['IN'], startDay: 300, endDay: 306, peak: 0.6 }],
    }) });
    render(<TooltipProvider><Toaster><PeaksCard /></Toaster></TooltipProvider>);
    await user.click(screen.getByRole('button', { name: 'Raise fares for Diwali' }));
    expect(screen.getByText(/2 of your routes/)).toBeInTheDocument();
    expect(screen.getByLabelText('Fare change')).toHaveValue('19');
    await user.click(screen.getByRole('button', { name: 'Apply to 2 routes' }));
    expect(command).toHaveBeenCalledTimes(1);
    expect(command).toHaveBeenCalledWith({ type: 'updateRoute', routeId: 'a', seasonalFares: [{ startDay: 300, endDay: 306, pct: 19 }] });
    expect(await screen.findByText('Added to 1 route · skipped 1 (already set)')).toBeInTheDocument();
  });
  it('says so when no route goes there', async () => {
    const user = userEvent.setup();
    useGameStore.setState({ view: fakeView({}, { routes: [r('c', 'LHR', 'CDG')], upcomingPeaks: [{ name: 'Diwali', countries: ['IN'], startDay: 300, endDay: 306, peak: 0.6 }] }) });
    render(<TooltipProvider><Toaster><PeaksCard /></Toaster></TooltipProvider>);
    await user.click(screen.getByRole('button', { name: 'Raise fares for Diwali' }));
    expect(screen.getByText(/None of your routes fly there/)).toBeInTheDocument();
  });
});
