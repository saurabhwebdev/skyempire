import type { GameState } from '@skyempire/shared';

export const CURRENT_SCHEMA = 2;

type Raw = Record<string, unknown>;

/** migrations[n] turns schema version n into n + 1. */
export const migrations: Record<number, (s: Raw) => Raw> = {
  // v0.1 → v0.2: real calendar (v0.1 careers start in 2026), weather and tensions.
  1: (s) => ({ ...s, schemaVersion: 2, world: { startYear: 2026, liveWeather: {}, tensions: [], preCancelled: {} } }),
};

/** Upgrade a saved state of any older schema version to the current one. */
export function migrate(raw: unknown): GameState {
  let s = raw as Raw;
  const version = Number(s.schemaVersion);
  if (!Number.isInteger(version) || version < 1) throw new Error('Save has no schema version');
  if (version > CURRENT_SCHEMA) throw new Error('Save is from a newer version of SkyEmpire');
  for (let v = version; v < CURRENT_SCHEMA; v++) s = migrations[v]!(s);
  return s as unknown as GameState;
}
