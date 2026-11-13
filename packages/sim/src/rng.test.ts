import { describe, expect, it } from 'vitest';
import { Rng } from './rng';

describe('Rng', () => {
  it('is deterministic for a seed', () => {
    const a = new Rng(42), b = new Rng(42);
    for (let i = 0; i < 1000; i++) expect(a.next()).toBe(b.next());
  });
  it('resumes from its state', () => {
    const a = new Rng(7);
    a.next(); a.next();
    const b = new Rng(a.state);
    expect(b.next()).toBe(a.next());
  });
  it('int stays in range', () => {
    const r = new Rng(1);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(1, 6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
    }
  });
  it('next is in [0,1)', () => {
    const r = new Rng(3);
    for (let i = 0; i < 1000; i++) { const v = r.next(); expect(v >= 0 && v < 1).toBe(true); }
  });
  it('normal has roughly the right mean', () => {
    const r = new Rng(9); let s = 0;
    for (let i = 0; i < 5000; i++) s += r.normal(10, 2);
    expect(s / 5000).toBeGreaterThan(9.8); expect(s / 5000).toBeLessThan(10.2);
  });
});
