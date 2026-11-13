import { DEFAULT_SETTINGS, type Settings } from '@skyempire/shared';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const file = (dir: string) => join(dir, 'settings.json');

function sanitize(raw: unknown): Settings {
  const out: Settings = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const v = r[key];
    if (typeof v !== typeof DEFAULT_SETTINGS[key]) continue;
    if (key === 'autosaveDays' && ![30, 60, 90].includes(v as number)) continue;
    if (key === 'units' && v !== 'km' && v !== 'mi') continue;
    if (key === 'volume' && ((v as number) < 0 || (v as number) > 1)) continue;
    (out as unknown as Record<string, unknown>)[key] = v;
  }
  return out;
}

export function loadSettings(dir: string): Settings {
  try {
    return sanitize(JSON.parse(readFileSync(file(dir), 'utf8')));
  } catch (e) {
    const missing = (e as NodeJS.ErrnoException).code === 'ENOENT';
    if (!missing) writeSettingsFile(dir, DEFAULT_SETTINGS);
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(dir: string, patch: Partial<Settings>): Settings {
  const next = sanitize({ ...loadSettings(dir), ...patch });
  writeSettingsFile(dir, next);
  return next;
}

function writeSettingsFile(dir: string, s: Settings) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(file(dir), JSON.stringify(s, null, 2));
}
