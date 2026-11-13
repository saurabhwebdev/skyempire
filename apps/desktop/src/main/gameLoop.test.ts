import type { TickPush } from '@skyempire/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameLoop, type TickSource } from './gameLoop';

const push = (day: number, autoPause = false): TickPush =>
  ({ view: { day } as TickPush['view'], summary: { day, daily: [], notifications: [], autoPause } });

describe('GameLoop', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('ticks every 1,500 ms at 4×', async () => {
    let day = 0;
    const src: TickSource = { tick: async () => push(++day) };
    const seen: number[] = [];
    const loop = new GameLoop(src, (p) => seen.push(p.view.day));
    loop.setSpeed(4);
    await vi.advanceTimersByTimeAsync(4500);
    expect(seen).toEqual([1, 2, 3]);
    loop.stop();
  });

  it('never starts a tick while the previous one is running', async () => {
    let running = 0, maxRunning = 0;
    const src: TickSource = {
      tick: async () => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await new Promise((r) => setTimeout(r, 2000));
        running--;
        return push(1);
      },
    };
    const loop = new GameLoop(src, () => {});
    loop.setSpeed(8);
    await vi.advanceTimersByTimeAsync(6000);
    expect(maxRunning).toBe(1);
    loop.stop();
  });

  it('auto-pauses on a major event', async () => {
    let day = 0;
    const src: TickSource = { tick: async () => push(++day, day === 2) };
    const speeds: number[] = [];
    const loop = new GameLoop(src, () => {}, (s) => speeds.push(s));
    loop.setSpeed(8);
    await vi.advanceTimersByTimeAsync(5000);
    expect(day).toBe(2);
    expect(loop.speed).toBe(0);
    expect(speeds.at(-1)).toBe(0);
  });

  it('respects the auto-pause setting', async () => {
    let day = 0;
    const src: TickSource = { tick: async () => push(++day, true) };
    const loop = new GameLoop(src, () => {});
    loop.autoPause = false;
    loop.setSpeed(8);
    await vi.advanceTimersByTimeAsync(1600);
    expect(day).toBe(2);
    loop.stop();
  });

  it('stops and reports when a tick fails', async () => {
    const errors: string[] = [];
    const src: TickSource = { tick: async () => { throw new Error('worker died'); } };
    const loop = new GameLoop(src, () => {}, () => {}, (e) => errors.push(e));
    loop.setSpeed(8);
    await vi.advanceTimersByTimeAsync(1000);
    expect(loop.speed).toBe(0);
    expect(errors).toEqual(['worker died']);
  });

  it('stops for good when the game is over', async () => {
    let day = 0;
    const src: TickSource = { tick: async () => ({ ...push(++day), view: { day, gameOver: { reason: 'bankrupt', day } } as TickPush['view'] }) };
    const loop = new GameLoop(src, () => {});
    loop.autoPause = false;
    loop.setSpeed(8);
    await vi.advanceTimersByTimeAsync(2000);
    expect(day).toBe(1);
    loop.setSpeed(4);
    expect(loop.speed).toBe(0);
  });
});
