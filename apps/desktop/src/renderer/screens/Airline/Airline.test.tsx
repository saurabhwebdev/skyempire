// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster, TooltipProvider } from '@skyempire/ui';
import { describe, expect, it, vi } from 'vitest';
import { useGameStore } from '../../store';
import { fakeView } from '../../testing';
import { Airline } from './Airline';

const wrap = () => render(<TooltipProvider><Toaster><Airline /></Toaster></TooltipProvider>);

describe('Airline screen: cargo', () => {
  it('switches belly cargo off and buys the dangerous-goods licence', async () => {
    const user = userEvent.setup();
    const command = vi.fn().mockResolvedValue({ ok: true });
    window.game = { command, logos: {} } as unknown as typeof window.game;
    useGameStore.setState({ view: fakeView({ kind: 'combination' }) });
    wrap();
    expect(screen.getByText('Passenger + Cargo')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Sell cargo in passenger holds' }));
    expect(command).toHaveBeenCalledWith({ type: 'setBellyCargo', on: false });
    await user.click(screen.getByRole('button', { name: 'Get the licence · $250k' }));
    expect(command).toHaveBeenCalledWith({ type: 'buyDgLicence' });
  });
  it('a cargo airline has no holds to switch, and shows a held licence', () => {
    window.game = { command: vi.fn(), logos: {} } as unknown as typeof window.game;
    useGameStore.setState({ view: fakeView({ kind: 'cargo', dgLicence: true }) });
    wrap();
    expect(screen.queryByRole('checkbox', { name: 'Sell cargo in passenger holds' })).not.toBeInTheDocument();
    expect(screen.getByText(/You can carry dangerous goods/)).toBeInTheDocument();
  });
});
