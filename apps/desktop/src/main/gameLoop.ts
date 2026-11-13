import type { Speed, TickPush } from '@skyempire/shared';

export interface TickSource {
  tick(): Promise<TickPush>;
}

const MS_PER_DAY: Record<Exclude<Speed, 0>, number> = { 1: 6000, 2: 3000, 4: 1500, 8: 750 };

/** Real-time clock that advances the game one day per interval; never overlaps ticks. */
export class GameLoop {
  speed: Speed = 0;
  autoPause = true;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private next = 0;

  constructor(
    private readonly source: TickSource,
    private readonly onTick: (push: TickPush) => void,
    private readonly onSpeed: (speed: Speed) => void = () => {},
  ) {}

  setSpeed(speed: Speed): void {
    this.speed = speed;
    this.clear();
    this.onSpeed(speed);
    if (speed !== 0) {
      this.next = Date.now() + MS_PER_DAY[speed];
      this.schedule();
    }
  }

  stop(): void {
    this.speed = 0;
    this.clear();
  }

  private clear() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private schedule() {
    if (this.speed === 0) return;
    this.timer = setTimeout(() => void this.fire(), Math.max(0, this.next - Date.now()));
  }

  /** Read through a method so TypeScript doesn't keep a stale narrowing across awaits. */
  private current(): Speed {
    return this.speed;
  }

  private async fire() {
    this.timer = null;
    if (this.current() === 0) return;
    if (this.running) {
      this.schedule();
      return;
    }
    this.running = true;
    try {
      const push = await this.source.tick();
      this.onTick(push);
      if (push.summary?.autoPause && this.autoPause) {
        this.setSpeed(0);
        return;
      }
    } finally {
      this.running = false;
    }
    const speed = this.current();
    if (speed === 0) return;
    // Self-correcting: schedule from the planned time, not from "now", but never pile up.
    this.next = Math.max(this.next + MS_PER_DAY[speed], Date.now());
    this.schedule();
  }
}
