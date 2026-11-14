// @vitest-environment jsdom
import type { AirlineDaily, Route } from '@skyempire/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster, TooltipProvider } from '@skyempire/ui';
import { describe, expect, it } from 'vitest';
import { useGameStore } from '../../store';
import { fakeView } from '../../testing';
import { aggregateMonthly } from './aggregate';
import { LoansCard } from './LoansCard';

const day = (d: number, revenue: number, fuel: number): AirlineDaily => ({
  day: d, airlineId: 'al_player', cash: 0, revenue, pax: 1,
  costs: { fuel, crew: 0, maintenance: 0, fees: 0, service: 0, leases: 0, interest: 0, overhead: 0, bases: 0, marketing: 0 },
});

describe('aggregateMonthly', () => {
  it('rolls 59 days into January and February (real month lengths)', () => {
    const rows = Array.from({ length: 59 }, (_, i) => day(i, 100, 40));
    const m = aggregateMonthly(rows, 2026);
    expect(m).toHaveLength(2);
    expect(m[0]).toMatchObject({ month: 'Jan 2026', revenue: 3100, cost: 1240, profit: 1860 });
    expect(m[1]).toMatchObject({ month: 'Feb 2026', revenue: 2800 });
  });
});

describe('LoansCard', () => {
  it('previews the monthly interest before borrowing', async () => {
    const user = userEvent.setup();
    useGameStore.setState({ view: fakeView({ creditRating: 'B' }) });
    render(<TooltipProvider><Toaster><LoansCard /></Toaster></TooltipProvider>);
    const amount = screen.getByLabelText('Loan amount');
    await user.clear(amount);
    await user.type(amount, '10000000');
    await user.tab();
    expect(screen.getByText(/Interest: \$50k\/month at 6%/)).toBeInTheDocument();
  });
});

describe('Finance: cargo', () => {
  it('shows cargo revenue on its own and keeps it out of passenger figures', async () => {
    const { Finance } = await import('./Finance');
    const { vi } = await import('vitest');
    window.game = { history: vi.fn().mockResolvedValue([day(0, 500_000, 100_000)]) } as unknown as typeof window.game;
    const route = (id: string, o: Partial<Route>): Route => ({ id, airlineId: 'al_player', from: 'LHR', to: 'JFK', fares: { economy: 1, premium: 1, business: 1 }, assignments: [], status: 'active', openedDay: 0, last: null, profit30: [], ...o });
    useGameStore.setState({ view: fakeView({ kind: 'combination' }, { routes: [
      route('p', { last: { pax: { economy: 300, premium: 0, business: 0 }, loadFactor: 0.75, revenue: 150_000, cost: 100_000, profit: 50_000, cargoT: 5, cargoRevenue: 15_000 } }),
      route('c', { kind: 'cargo', last: { pax: { economy: 0, premium: 0, business: 0 }, loadFactor: 0.6, revenue: 200_000, cost: 150_000, profit: 50_000, cargoT: 60, cargoRevenue: 200_000, cargoLoad: 0.6 } }),
    ] }) });
    render(<TooltipProvider><Toaster><Finance /></Toaster></TooltipProvider>);
    expect(await screen.findByText('Cargo · yesterday')).toBeInTheDocument();
    expect(screen.getByText('$215k · 65 t')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument(); // passenger load factor ignores the freighter route
  });
});
