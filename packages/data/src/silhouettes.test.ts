import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import aircraft from './aircraft.json';

const dir = join(import.meta.dirname, 'silhouettes');

describe('silhouettes', () => {
  for (const a of aircraft) {
    it(`${a.id} has side and top views`, () => {
      for (const view of ['side', 'top']) {
        const f = join(dir, `${a.id}-${view}.svg`);
        expect(existsSync(f)).toBe(true);
        const svg = readFileSync(f, 'utf8');
        expect(svg).toContain('viewBox');
        expect(svg).not.toMatch(/fill="#/);
      }
    });
  }
});
