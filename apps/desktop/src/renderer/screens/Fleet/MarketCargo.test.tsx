// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster, TooltipProvider } from '@skyempire/ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameStore, useUi } from '../../store';
import { fakeView } from '../../testing';
import { AircraftMarket } from './AircraftMarket';

const wrap = () => render(<TooltipProvider><Toaster><AircraftMarket /></Toaster></TooltipProvider>);
const titles = () => screen.queryAllByRole('heading', { level: 3 }).map((h) => h.textContent ?? '');

describe('aircraft market by airline type', () => {
  beforeEach(() => useUi.setState({ ...useUi.getInitialState(), screen: 'game' }));

  it('a passenger airline sees no freighters', () => {
    useGameStore.setState({ view: fakeView({ kind: 'passenger', tier: 'global' }) });
    wrap();
    expect(titles().some((t) => /777F|747-8F|Cargomaster/.test(t))).toBe(false);
    expect(screen.queryByRole('combobox', { name: 'Type' })).not.toBeInTheDocument();
  });

  it('a cargo airline sees freighters: payload, coming types, and a plain confirm to lease', async () => {
    const user = userEvent.setup();
    const command = vi.fn().mockResolvedValue({ ok: true });
    window.game = { command } as unknown as typeof window.game;
    useGameStore.setState({ view: fakeView({ kind: 'cargo', tier: 'global' }) });
    wrap();
    expect(titles().every((t) => !/A320neo|787-9/.test(t))).toBe(true);
    const card = screen.getAllByRole('article').find((a) => within(a).queryByRole('heading', { name: /^Boeing 777F/ }))!;
    expect(within(card).getByText('Payload')).toBeInTheDocument();
    expect(within(card).getByText('103.7 t')).toBeInTheDocument();
    const a350f = screen.getAllByRole('article').find((a) => within(a).queryByRole('heading', { name: /A350F/ }))!;
    expect(within(a350f).getByText('Delivered from 2027')).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: /^Lease for/ }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent(/Boeing 777F/);
    await user.click(within(dialog).getByRole('button', { name: /^Lease for/ }));
    expect(command).toHaveBeenCalledWith({ type: 'leaseAircraft', typeId: 'B77F' });
  });

  it('a cargo airline can buy a used airliner and convert it in one go', async () => {
    const user = userEvent.setup();
    const command = vi.fn().mockResolvedValue({ ok: true });
    window.game = { command } as unknown as typeof window.game;
    useGameStore.setState({ view: fakeView({ kind: 'cargo', tier: 'global' }, {
      market: { fuelPricePerKg: 1, economyIndex: 1, usedListings: [{ id: 'l1', typeId: 'A321', ageDays: 5000, condition: 80, price: 18_000_000 }, { id: 'l2', typeId: 'E295', ageDays: 900, condition: 90, price: 30_000_000 }] },
    }) });
    wrap();
    await user.click(screen.getByRole('tab', { name: /Used/ }));
    expect(titles()).toEqual(['Airbus A321ceo']); // the E195-E2 has no freighter conversion
    await user.click(screen.getByRole('button', { name: /Buy & convert to Airbus A321P2F/ }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^Buy & convert/ }));
    expect(command).toHaveBeenCalledWith({ type: 'buyUsedAircraft', listingId: 'l1', convertTo: 'A21F' });
  });

  it('a combination airline can filter by type', async () => {
    const user = userEvent.setup();
    useGameStore.setState({ view: fakeView({ kind: 'combination', tier: 'global' }) });
    wrap();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'freighter');
    expect(titles().length).toBeGreaterThan(5);
    expect(titles().every((t) => /F\b|SF|BCF|P2F|PCF|Freighter|freighter|Cargomaster|SkyCourier|QT|An-124|Il-76|Tu-204/.test(t))).toBe(true);
  });
});
