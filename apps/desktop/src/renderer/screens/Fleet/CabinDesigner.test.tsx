// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CabinConfig } from '@skyempire/shared';
import { standardProduct } from '@skyempire/sim';
import { Toaster, TooltipProvider } from '@skyempire/ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SeatMap } from '../../components/SeatMap';
import { useGameStore } from '../../store';
import { fakeView } from '../../testing';
import { CabinDesigner } from './CabinDesigner';

const cfg = (seats: CabinConfig['seats']): CabinConfig => ({ seats, product: standardProduct(), dense: false });
const wrap = (ui: React.ReactNode) => render(<TooltipProvider><Toaster>{ui}</Toaster></TooltipProvider>);

describe('cabin designer', () => {
  beforeEach(() => {
    useGameStore.setState({ view: fakeView() });
    window.game = { command: vi.fn().mockResolvedValue({ ok: true }) } as unknown as typeof window.game;
  });

  it('designs each class: seats, seat type, screens and meals', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    wrap(<CabinDesigner open typeId="B789" initial={cfg({ economy: 250, premium: 0, business: 20 })} mode={{ kind: 'new', confirmLabel: 'Lease' }} onConfirm={onConfirm} onOpenChange={() => {}} />);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([expect.stringMatching(/^Economy/), expect.stringMatching(/^Premium/), expect.stringMatching(/^Business/)]);
    await user.click(screen.getByRole('tab', { name: /Business/ }));
    await user.click(screen.getByRole('radio', { name: /Private suite/ }));
    await user.click(screen.getByRole('radio', { name: /Chef-designed/ }));
    await user.click(screen.getByRole('checkbox', { name: /Lounge access/ }));
    expect(screen.queryByRole('radio', { name: /Buy on board/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Cabin upgrades/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Lease/ }));
    const sent = onConfirm.mock.calls[0]![0] as CabinConfig;
    expect(sent.product.business).toMatchObject({ seat: 'suite', meal: 'chef', lounge: true });
    expect(sent.seats.business).toBe(20);
  });

  it('offers the denser economy row only where the aircraft has one', async () => {
    const user = userEvent.setup();
    const { unmount } = wrap(<CabinDesigner open typeId="A333" initial={cfg({ economy: 250, premium: 0, business: 0 })} mode={{ kind: 'new', confirmLabel: 'Lease' }} onConfirm={vi.fn()} onOpenChange={() => {}} />);
    await user.click(screen.getByRole('checkbox', { name: /Denser row/ }));
    expect(screen.getByRole('checkbox', { name: /Denser row/ })).toBeChecked();
    unmount();
    wrap(<CabinDesigner open typeId="A20N" initial={cfg({ economy: 180, premium: 0, business: 0 })} mode={{ kind: 'new', confirmLabel: 'Lease' }} onConfirm={vi.fn()} onOpenChange={() => {}} />);
    expect(screen.queryByRole('checkbox', { name: /Denser row/ })).not.toBeInTheDocument();
  });

  it('blocks a cabin that does not fit', async () => {
    const user = userEvent.setup();
    wrap(<CabinDesigner open typeId="A20N" initial={cfg({ economy: 194, premium: 0, business: 0 })} mode={{ kind: 'new', confirmLabel: 'Lease for $862k/mo' }} onConfirm={vi.fn()} onOpenChange={() => {}} />);
    await user.click(screen.getByRole('radio', { name: /Extra legroom/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Too many seats — max 194 seat units');
    expect(screen.getByRole('button', { name: 'Lease for $862k/mo' })).toBeDisabled();
  });

  it('a refit shows its cost and downtime; meal changes apply at once', async () => {
    const user = userEvent.setup();
    const current = cfg({ economy: 250, premium: 0, business: 20 });
    wrap(<CabinDesigner open typeId="B789" initial={current} mode={{ kind: 'refit', current }} onConfirm={vi.fn()} onOpenChange={() => {}} />);
    await user.click(screen.getByRole('radio', { name: /Hot meal/ }));
    expect(screen.getByText(/No refit needed/)).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /Business/ }));
    await user.click(screen.getByRole('radio', { name: /Full-flat bed/ }));
    expect(screen.getByText(/out of service for 10 days/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Start refit/ })).toBeEnabled();
  });

  it('saves a layout and starts from it', async () => {
    const user = userEvent.setup();
    const command = vi.fn().mockResolvedValue({ ok: true });
    window.game = { command } as unknown as typeof window.game;
    const saved = { id: 'ct1', name: 'Long haul', typeId: 'B789', config: { ...cfg({ economy: 200, premium: 21, business: 28 }) } };
    useGameStore.setState({ view: fakeView({ cabinTemplates: [saved] }) });
    wrap(<CabinDesigner open typeId="B789" initial={cfg({ economy: 290, premium: 0, business: 0 })} mode={{ kind: 'new', confirmLabel: 'Lease' }} onConfirm={vi.fn()} onOpenChange={() => {}} />);
    await user.type(screen.getByLabelText('Layout name'), 'My 787');
    await user.click(screen.getByRole('button', { name: 'Save as layout' }));
    expect(command).toHaveBeenCalledWith({ type: 'saveCabinTemplate', name: 'My 787', typeId: 'B789', config: expect.objectContaining({ seats: { economy: 290, premium: 0, business: 0 } }) });
    await user.click(screen.getByRole('button', { name: 'Long haul' }));
    expect(screen.getByRole('tab', { name: /Business/ })).toHaveTextContent('28');
  });
});

describe('seat map', () => {
  it('draws business suites 1-2-1 on a widebody and a denser economy row', () => {
    const p = standardProduct();
    const { container } = render(<SeatMap typeId="B789" config={{ seats: { economy: 0, premium: 0, business: 8 }, product: { ...p, business: { ...p.business, seat: 'suite' } }, dense: false }} />);
    expect(container.querySelectorAll('rect')).toHaveLength(8);
    expect(within(container).getByText(/Business · 1-2-1/)).toBeInTheDocument();
    render(<SeatMap typeId="A333" config={{ seats: { economy: 27, premium: 0, business: 0 }, product: p, dense: true }} />);
    expect(screen.getByText(/Economy · 3-3-3/)).toBeInTheDocument();
    expect(screen.getByText('3 rows')).toBeInTheDocument();
  });
});
