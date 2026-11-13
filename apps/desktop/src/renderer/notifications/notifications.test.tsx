// @vitest-environment jsdom
import type { Notification } from '@skyempire/shared';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster, TooltipProvider } from '@skyempire/ui';
import { beforeEach, describe, expect, it } from 'vitest';
import { News } from '../screens/News/News';
import { useGameStore, useUi } from '../store';
import { fakeView } from '../testing';
import { NotificationCenter } from './NotificationCenter';

const note = (o: Partial<Notification>): Notification => ({ id: Math.random().toString(36), day: 1, level: 'info', category: 'airline', title: 'Hello', body: 'Body', ...o });
const push = (notes: Notification[]) =>
  act(() => useGameStore.getState().applyPush({ view: fakeView(), summary: { day: 1, daily: [], notifications: notes, autoPause: false } }));
const wrap = (ui: React.ReactNode) => render(<TooltipProvider><Toaster>{ui}</Toaster></TooltipProvider>);

describe('notifications', () => {
  beforeEach(() => {
    useGameStore.setState({ view: fakeView(), notifications: [], unread: 0, latest: [] });
    useUi.setState({ ...useUi.getInitialState(), screen: 'game' });
  });
  it('a major event opens a modal', async () => {
    wrap(<NotificationCenter />);
    push([note({ level: 'major', category: 'event', title: 'Fuel prices spike', body: 'Jet fuel is up 40%.' })]);
    expect(await screen.findByRole('dialog')).toHaveTextContent('Fuel prices spike');
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
  });
  it('a goal shows a toast but no modal', async () => {
    wrap(<NotificationCenter />);
    push([note({ category: 'goal', title: 'Goal complete: Open your first route' })]);
    expect(await screen.findByText('Goal complete: Open your first route')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('News filters by category', async () => {
    const user = userEvent.setup();
    useGameStore.setState({
      notifications: [
        note({ category: 'event', title: 'Strike at CDG', level: 'warning' }),
        note({ category: 'airline', title: 'A320neo in for an A-check' }),
      ],
    });
    wrap(<News />);
    await user.click(screen.getByRole('tab', { name: 'Events' }));
    expect(screen.getByText('Strike at CDG')).toBeInTheDocument();
    expect(screen.queryByText('A320neo in for an A-check')).not.toBeInTheDocument();
  });
});
