// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { TooltipProvider } from '@skyempire/ui';
import { beforeEach, describe, expect, it } from 'vitest';
import { handleShortcut } from '../shortcuts';
import { useGameStore, useUi } from '../store';
import { TopBar } from './TopBar';
import { fakeView } from '../testing';

const key = (k: string, extra: Partial<KeyboardEventInit> = {}, target: EventTarget = document.body) => {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...extra });
  Object.defineProperty(e, 'target', { value: target });
  return e;
};

describe('shortcuts', () => {
  beforeEach(() => useUi.setState({ ...useUi.getInitialState(), screen: 'game' }));
  it('number keys switch sections', () => {
    handleShortcut(key('3'));
    expect(useUi.getState().section).toBe('fleet');
  });
  it('Space toggles between pause and the last speed', () => {
    useUi.getState().setSpeed(4);
    handleShortcut(key(' '));
    expect(useUi.getState().speed).toBe(0);
    handleShortcut(key(' '));
    expect(useUi.getState().speed).toBe(4);
  });
  it('does nothing outside the game screen', () => {
    useUi.setState({ screen: 'title' });
    handleShortcut(key('3'));
    expect(useUi.getState().section).toBe('overview');
  });
  it('is ignored while typing in an input', () => {
    const input = document.createElement('input');
    handleShortcut(key('3', {}, input));
    expect(useUi.getState().section).toBe('overview');
  });
  it('Escape closes the inspector before opening the menu', () => {
    useUi.getState().select({ kind: 'airport', id: 'LHR' });
    handleShortcut(key('Escape'));
    expect(useUi.getState().selection).toBeNull();
    expect(useUi.getState().menuOpen).toBe(false);
    handleShortcut(key('Escape'));
    expect(useUi.getState().menuOpen).toBe(true);
  });
});

describe('TopBar', () => {
  it('shows cash and the latest change', () => {
    useGameStore.setState({ view: fakeView({ cash: 48_200_000 }), cashDelta: 312_000 });
    render(<TooltipProvider><TopBar /></TooltipProvider>);
    expect(screen.getByText('$48.2M')).toBeInTheDocument();
    expect(screen.getByText('▲')).toBeInTheDocument();
    expect(screen.getByText('$312k')).toBeInTheDocument();
  });
});
