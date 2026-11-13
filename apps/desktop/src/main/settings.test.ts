import { DEFAULT_SETTINGS } from '@skyempire/shared';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadSettings, saveSettings } from './settings';

const dir = () => mkdtempSync(join(tmpdir(), 'skyempire-settings-'));

describe('settings', () => {
  it('defaults when the file is missing', () => expect(loadSettings(dir())).toEqual(DEFAULT_SETTINGS));
  it('defaults and rewrites when the file is invalid', () => {
    const d = dir();
    writeFileSync(join(d, 'settings.json'), '{not json');
    expect(loadSettings(d)).toEqual(DEFAULT_SETTINGS);
    expect(JSON.parse(readFileSync(join(d, 'settings.json'), 'utf8'))).toEqual(DEFAULT_SETTINGS);
  });
  it('merges and persists changes', () => {
    const d = dir();
    expect(saveSettings(d, { reduceMotion: true }).reduceMotion).toBe(true);
    expect(loadSettings(d)).toEqual({ ...DEFAULT_SETTINGS, reduceMotion: true });
  });
  it('ignores unknown or wrongly typed keys', () => {
    const d = dir();
    writeFileSync(join(d, 'settings.json'), JSON.stringify({ reduceMotion: 'yes', bogus: 1, volume: 0.2 }));
    expect(loadSettings(d)).toEqual({ ...DEFAULT_SETTINGS, volume: 0.2 });
  });
});
