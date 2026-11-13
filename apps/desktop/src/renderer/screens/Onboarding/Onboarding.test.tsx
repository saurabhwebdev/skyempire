// @vitest-environment jsdom
import { DEFAULT_SETTINGS } from '@skyempire/shared';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster, TooltipProvider } from '@skyempire/ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameStore, useUi } from '../../store';
import { fakeView } from '../../testing';
import { Coachmarks } from './Coachmarks';
import { SettingsDialog } from '../Settings/Settings';

const wrap = (ui: React.ReactNode) => render(<TooltipProvider><Toaster>{ui}</Toaster></TooltipProvider>);

describe('Coachmarks', () => {
  beforeEach(() => {
    useUi.setState({ ...useUi.getInitialState(), screen: 'game' });
    window.game = { setSettings: vi.fn(async (s) => ({ ...DEFAULT_SETTINGS, ...s })) } as unknown as typeof window.game;
    useGameStore.setState({ settings: DEFAULT_SETTINGS, view: fakeView() });
  });
  it('moves to the next step when the first goal completes', () => {
    wrap(<Coachmarks />);
    expect(screen.getByText(/Lease your first aircraft/)).toBeInTheDocument();
    act(() => useGameStore.setState({ view: fakeView({ completedObjectives: ['lease-first'] }) }));
    expect(screen.getByText(/Open your first route/)).toBeInTheDocument();
  });
  it('can be skipped for good', async () => {
    const user = userEvent.setup();
    wrap(<Coachmarks />);
    await user.click(screen.getByRole('button', { name: 'Skip tutorial' }));
    expect(window.game.setSettings).toHaveBeenCalledWith({ tutorialDone: true });
    await waitFor(() => expect(screen.queryByText(/Lease your first aircraft/)).not.toBeInTheDocument()); // after the exit fade
  });
});

describe('Settings', () => {
  it('reduce motion marks the document', async () => {
    const user = userEvent.setup();
    useGameStore.setState({ settings: DEFAULT_SETTINGS });
    window.game = {
      setSettings: vi.fn(async (s) => ({ ...DEFAULT_SETTINGS, ...s })),
      logos: { status: vi.fn().mockResolvedValue({ have: 0, total: 145 }), onProgress: () => () => {} },
    } as unknown as typeof window.game;
    wrap(<SettingsDialog open onOpenChange={() => {}} />);
    await user.click(screen.getByRole('switch', { name: 'Reduce motion' }));
    expect(document.documentElement).toHaveAttribute('data-reduce-motion');
  });
});
