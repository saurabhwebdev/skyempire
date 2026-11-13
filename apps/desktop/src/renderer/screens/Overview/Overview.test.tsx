// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { Toaster, TooltipProvider } from '@skyempire/ui';
import type { Aircraft, Route } from '@skyempire/shared';
import { describe, expect, it, vi } from 'vitest';
import { useGameStore } from '../../store';
import { fakeView } from '../../testing';
import { deriveAlerts } from './alerts';
import { Overview } from './Overview';

const ac: Aircraft = {
  id: 'ac1', typeId: 'A20N', ownerId: 'al_player', ownership: 'leased', ageDays: 0, condition: 95, flightHours: 0, hoursSinceA: 0,
  hoursSinceC: 0, cabin: { economy: 194, premium: 0, business: 0 }, status: 'active', maintenanceDaysLeft: 0, bookValue: 0,
};
const route: Route = {
  id: 'r1', airlineId: 'al_player', from: 'LHR', to: 'CDG', fares: { economy: 90, premium: 1, business: 1 },
  assignments: [{ aircraftId: 'ac1', roundTripsPerWeek: 14 }], status: 'active', openedDay: 0,
  last: { pax: { economy: 300, premium: 0, business: 0 }, loadFactor: 0.8, revenue: 30000, cost: 20000, profit: 10000 }, profit30: Array(30).fill(10000),
};

describe('deriveAlerts', () => {
  it('has nothing to say about a healthy airline', () => {
    expect(deriveAlerts(fakeView({ cash: 40_000_000 }, { aircraft: [ac], routes: [route] }))).toEqual([]);
  });
  it('warns when cash will not cover next month', () => {
    const alerts = deriveAlerts(fakeView({ cash: 500_000 }, { aircraft: [ac], routes: [route] }));
    expect(alerts.map((a) => a.id)).toContain('low-cash');
    expect(alerts.find((a) => a.id === 'low-cash')!.action.label).toBe('Take a loan');
  });
  it('flags losing routes, idle aircraft and suspended routes', () => {
    const idle = { ...ac, id: 'ac2' };
    const losing = { ...route, profit30: Array(30).fill(-4000) };
    const suspended = { ...route, id: 'r2', to: 'AMS', status: 'suspended' as const, assignments: [] };
    const ids = deriveAlerts(fakeView({ cash: 40_000_000 }, { aircraft: [ac, idle], routes: [losing, suspended] })).map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['loss-r1', 'idle-ac2', 'suspended-r2']));
  });
});

describe('Overview', () => {
  it('shows the next three goals', () => {
    window.game = { history: vi.fn().mockResolvedValue([]) } as unknown as typeof window.game;
    useGameStore.setState({
      view: fakeView({}, { objectives: [
        { id: 'lease-first', title: 'Lease your first aircraft', done: false },
        { id: 'open-first-route', title: 'Open your first route', done: false },
        { id: 'first-day', title: 'Fly your first day', done: false },
      ] }),
    });
    render(<TooltipProvider><Toaster><Overview /></Toaster></TooltipProvider>);
    expect(screen.getByText('Lease your first aircraft')).toBeInTheDocument();
    expect(screen.getByText('Open your first route')).toBeInTheDocument();
    expect(screen.getByText('Fly your first day')).toBeInTheDocument();
  });
});
