import { appendFileSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { join } from 'node:path';

export interface Log {
  file: string;
  info(msg: string): void;
  error(msg: string): void;
}

/**
 * A small text log at <dir>/main.log so a slow or failed start can be diagnosed on a player's PC.
 * Rolled over to main.old.log at start once it passes maxBytes. Never throws.
 */
export function createLog(dir: string, maxBytes = 512 * 1024, now = () => Date.now()): Log {
  const file = join(dir, 'main.log');
  try {
    mkdirSync(dir, { recursive: true });
    if (statSync(file).size > maxBytes) renameSync(file, join(dir, 'main.old.log'));
  } catch {
    // No log yet, or the folder can't be written: logging is best-effort.
  }
  const t0 = now();
  const write = (level: string, msg: string) => {
    try {
      appendFileSync(file, `${new Date(now()).toISOString()} +${now() - t0}ms ${level} ${msg}\n`);
    } catch {
      // ignore
    }
  };
  return { file, info: (m) => write('INFO', m), error: (m) => write('ERROR', m) };
}

/** After a renderer crash: reload by itself unless it already crashed twice in the last minute. */
export function crashAction(recentCrashes: number[], now: number): 'reload' | 'ask' {
  return recentCrashes.filter((t) => now - t < 60_000).length >= 2 ? 'ask' : 'reload';
}
