import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { crashAction, createLog } from './log';

describe('startup log', () => {
  it('writes timestamped lines with time since start', () => {
    const dir = mkdtempSync(join(tmpdir(), 'se-log-'));
    let t = 1_000;
    const log = createLog(join(dir, 'logs'), 1024, () => t);
    log.info('start');
    t += 250;
    log.error('boom');
    const lines = readFileSync(log.file, 'utf8').trim().split('\n');
    expect(lines[0]).toMatch(/\+0ms INFO start$/);
    expect(lines[1]).toMatch(/\+250ms ERROR boom$/);
  });
  it('rolls a big log over at start', () => {
    const dir = mkdtempSync(join(tmpdir(), 'se-log-'));
    writeFileSync(join(dir, 'main.log'), 'x'.repeat(2000));
    const log = createLog(dir, 1024);
    log.info('fresh');
    expect(existsSync(join(dir, 'main.old.log'))).toBe(true);
    expect(readFileSync(log.file, 'utf8')).toMatch(/fresh/);
  });
  it('never throws when the folder cannot be written', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'se-log-')), 'blocker');
    writeFileSync(file, '');
    expect(() => createLog(join(file, 'logs')).info('x')).not.toThrow();
  });
});

describe('renderer crash recovery', () => {
  it('reloads after a first crash, asks after repeated crashes', () => {
    expect(crashAction([], 100_000)).toBe('reload');
    expect(crashAction([90_000], 100_000)).toBe('reload');
    expect(crashAction([70_000, 90_000], 100_000)).toBe('ask');
    expect(crashAction([10_000, 20_000], 100_000)).toBe('reload');
  });
});
