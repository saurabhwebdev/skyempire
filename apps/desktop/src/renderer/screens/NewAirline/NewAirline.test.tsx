// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster, TooltipProvider } from '@skyempire/ui';
import { describe, expect, it, vi } from 'vitest';
import { NewAirline, suggestCode } from './NewAirline';

const wrap = () => render(<TooltipProvider><Toaster><NewAirline /></Toaster></TooltipProvider>);

describe('NewAirline', () => {
  it('suggests a code from the initials, avoiding real airlines', () => {
    expect(suggestCode('Albion Skyways', () => false)).toBe('AS');
    expect(suggestCode('Albion Skyways', (c) => c === 'AS')).toBe('AS1');
  });
  it('uppercases the code and refuses a fourth character', async () => {
    const user = userEvent.setup();
    wrap();
    const code = screen.getByLabelText('Airline code');
    await user.clear(code);
    await user.type(code, 'ab9x');
    expect(code).toHaveValue('AB9');
  });
  it('explains why it cannot continue until the name is valid', async () => {
    const user = userEvent.setup();
    wrap();
    const next = screen.getByRole('button', { name: 'Choose a hub' });
    expect(next).toBeDisabled();
    expect(screen.getByText('Give your airline a name (2–30 characters).')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Airline name'), 'Lufthansa');
    expect(screen.getByText('That name belongs to a real airline — pick another.')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Airline name'));
    await user.type(screen.getByLabelText('Airline name'), 'Albion Skyways');
    expect(next).toBeEnabled();
  });

  it('lets you pick the airline type, and warns that cargo-only is for good', async () => {
    const user = userEvent.setup();
    const newGame = vi.fn().mockRejectedValue(new Error('stop here'));
    window.game = { newGame } as unknown as typeof window.game;
    wrap();
    await user.type(screen.getByLabelText('Airline name'), 'Albion Freight');
    await user.click(screen.getByRole('button', { name: 'Choose a hub' }));
    await user.type(screen.getByLabelText('Search airports'), 'LEJ');
    await user.keyboard('{Enter}');
    await user.click(screen.getByRole('button', { name: 'Choose difficulty' }));
    const kinds = screen.getByRole('radiogroup', { name: 'Airline type' });
    expect(screen.getByRole('radio', { name: /^Passenger\b(?! \+)/ })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('radio', { name: /Cargo only/ }));
    expect(kinds).toHaveTextContent(/can never fly passengers/);
    await user.click(screen.getByRole('button', { name: 'Found airline' }));
    expect(newGame).toHaveBeenCalledWith(expect.objectContaining({ airlineKind: 'cargo', homeBaseId: 'LEJ' }));
  });
});
