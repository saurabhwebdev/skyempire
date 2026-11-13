// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster, TooltipProvider } from '@skyempire/ui';
import { describe, expect, it } from 'vitest';
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
});
