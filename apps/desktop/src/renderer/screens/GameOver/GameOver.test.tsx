// @vitest-environment jsdom
import { act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useGameStore, useUi } from '../../store';
import { fakeView } from '../../testing';

describe('game over', () => {
  it('switches to the game-over screen when the airline goes bankrupt', () => {
    useUi.setState({ screen: 'game' });
    act(() => useGameStore.getState().applyPush({ view: fakeView({}, { gameOver: { reason: 'bankrupt', day: 400 } }), summary: null }));
    expect(useUi.getState().screen).toBe('gameOver');
  });
});
