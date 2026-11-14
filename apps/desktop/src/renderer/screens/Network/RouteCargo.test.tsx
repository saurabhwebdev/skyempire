// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster, TooltipProvider } from '@skyempire/ui';
import type { Aircraft } from '@skyempire/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { standardProduct } from '@skyempire/sim';
import { useGameStore, useUi } from '../../store';
import { fakeView } from '../../testing';
import { RouteEditor } from './RouteEditor';

const ac = (id: string, typeId: string): Aircraft => ({
  id, typeId, ownerId: 'al_player', ownership: 'leased', ageDays: 0, condition: 100, flightHours: 0, hoursSinceA: 0, hoursSinceC: 0,
  cabin: { economy: 194, premium: 0, business: 0 }, product: standardProduct(), dense: false, refitDaysLeft: 0, status: 'active', maintenanceDaysLeft: 0, bookValue: 0,
});
const wrap = () => render(<TooltipProvider><Toaster><RouteEditor /></Toaster></TooltipProvider>);
const ok = { ok: true, expectedLoadFactor: 0.7, expectedProfitPerDay: 5000, suggestedFares: { economy: 95, premium: 170, business: 330 }, distanceKm: 900 };

describe('route editor: cargo', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    useUi.setState({ ...useUi.getInitialState(), screen: 'game', routeEditor: { from: 'LHR', to: 'CDG' } });
  });
  afterEach(() => vi.useRealTimers());

  it('a passenger route has belly cargo on the default setting, and can be customised', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const preview = vi.fn().mockResolvedValue({ ...ok, expectedCargoT: 1.4 });
    const command = vi.fn().mockResolvedValue({ ok: true });
    window.game = { preview, command } as unknown as typeof window.game;
    useGameStore.setState({ view: fakeView({ kind: 'passenger' }, { aircraft: [ac('a1', 'A20N')] }) });
    wrap();
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(screen.queryByRole('radiogroup', { name: 'Route type' })).not.toBeInTheDocument();
    expect(await screen.findByText(/1.4 t cargo a day/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Belly cargo/ }));
    await user.click(screen.getByRole('radio', { name: 'Custom' }));
    await user.click(screen.getByRole('checkbox', { name: 'Mail' }));
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(preview).toHaveBeenLastCalledWith(expect.objectContaining({ belly: expect.objectContaining({ mode: 'custom', holdShare: expect.any(Number) }) }));
    await user.click(screen.getByRole('button', { name: 'Open route' }));
    expect(command.mock.calls[0]![0].belly.accept).not.toContain('mail');
    expect(command.mock.calls[0]![0].belly.accept).not.toContain('special');
  });

  it('a combination airline can open a cargo route with a rate and the cargo it takes', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const preview = vi.fn().mockResolvedValue({ ...ok, expectedCargoT: 120, suggestedCargoRate: 1.35 });
    const command = vi.fn().mockResolvedValue({ ok: true });
    window.game = { preview, command } as unknown as typeof window.game;
    useGameStore.setState({ view: fakeView({ kind: 'combination', dgLicence: false }, { aircraft: [ac('a1', 'A20N')] }) });
    wrap();
    await user.click(screen.getByRole('radio', { name: 'Cargo' }));
    expect(screen.getByText('Lease a freighter first.')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Dangerous goods/ })).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: 'Passengers' }));
    expect(screen.queryByText('Lease a freighter first.')).not.toBeInTheDocument();
  });
});
