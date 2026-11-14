// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster, TooltipProvider } from '@skyempire/ui';
import type { Route } from '@skyempire/shared';
import { describe, expect, it, vi } from 'vitest';
import { useGameStore } from '../../store';
import { fakeView } from '../../testing';
import { WeatherCard } from './WeatherCard';

const route: Route = {
  id: 'r1', airlineId: 'al_player', from: 'LHR', to: 'CDG', fares: { economy: 90, premium: 160, business: 300 },
  assignments: [{ aircraftId: 'ac1', roundTripsPerWeek: 14 }], status: 'active', openedDay: 0, last: null, profit30: [],
};
const wrap = () => render(<TooltipProvider><Toaster><WeatherCard /></Toaster></TooltipProvider>);

describe('WeatherCard', () => {
  it('lists bad weather in the next 3 days with a Cancel ahead action', async () => {
    const command = vi.fn().mockResolvedValue({ ok: true });
    window.game = { command } as unknown as typeof window.game;
    useGameStore.setState({ view: fakeView({}, { day: 10, routes: [route], weather: { today: {}, forecast: { LHR: ['snow', 'clear', 'rain'], CDG: ['clear', 'clear', 'clear'] } } }) });
    wrap();
    expect(screen.getByText('Snow')).toBeInTheDocument();
    expect(screen.getByText('Tomorrow · ~10% of flights cancelled')).toBeInTheDocument();
    expect(screen.queryByText('Rain')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel ahead' }));
    expect(command).toHaveBeenCalledWith({ type: 'preCancel', routeId: 'r1', day: 11 });
  });
  it('says so when skies are clear', () => {
    useGameStore.setState({ view: fakeView({}, { routes: [route], weather: { today: {}, forecast: { LHR: ['clear', 'rain', 'wind'] } } }) });
    wrap();
    expect(screen.getByText('Clear skies across your network.')).toBeInTheDocument();
  });
});
