// @vitest-environment jsdom
import type { AirlineDaily } from '@skyempire/shared';
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
