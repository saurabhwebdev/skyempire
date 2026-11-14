import type { AirlineDaily, GameState, SaveInfo } from '@skyempire/shared';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { gunzipSync, gzipSync } from 'node:zlib';

import { CURRENT_SCHEMA, migrations } from '@skyempire/sim';

export { CURRENT_SCHEMA };
const KEEP_AUTOSAVES = 3;

export class SaveLoadError extends Error {
  constructor(readonly reason: 'corrupt' | 'newerVersion' | 'missing', message?: string) {
    super(message ?? reason);
    this.name = 'SaveLoadError';
  }
}


const SCHEMA = `
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS snapshots (id INTEGER PRIMARY KEY AUTOINCREMENT, day INTEGER NOT NULL, kind TEXT NOT NULL, state BLOB NOT NULL, created_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS airline_daily (day INTEGER NOT NULL, airline_id TEXT NOT NULL, json TEXT NOT NULL, PRIMARY KEY (day, airline_id));
`;

/** One SQLite file per career in `dir`. */
export class SaveStore {
  constructor(readonly dir: string) {
    mkdirSync(dir, { recursive: true });
  }

  pathOf(id: string): string {
    if (!/^[a-z0-9-]+$/.test(id)) throw new SaveLoadError('missing');
    return join(this.dir, `${id}.sqlite`);
  }

  private open(id: string, create = false): DatabaseSync {
    const path = this.pathOf(id);
    if (!create && !existsSync(path)) throw new SaveLoadError('missing');
    const db = new DatabaseSync(path);
    if (create) db.exec(SCHEMA);
    return db;
  }

  createSave(name: string, state: GameState): SaveInfo {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'career';
    let id = `${slug}-${Date.now().toString(36)}`;
    while (existsSync(this.pathOf(id))) id += 'x';
    const db = this.open(id, true);
    try {
      const now = Date.now();
      const put = db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)');
      put.run('name', name);
      put.run('createdAt', String(now));
    } finally {
      db.close();
    }
    this.writeSnapshot(id, state, 'manual');
    return this.info(id);
  }

  /** Atomic: serialization happens first, then one transaction writes the snapshot, prunes and updates meta. */
  writeSnapshot(id: string, state: GameState, kind: 'auto' | 'manual'): void {
    const blob = gzipSync(Buffer.from(JSON.stringify(state)));
    const airline = state.airlines[state.playerId]?.name ?? '';
    const db = this.open(id);
    try {
      db.exec('BEGIN');
      try {
        const now = Date.now();
        db.prepare('INSERT INTO snapshots (day, kind, state, created_at) VALUES (?, ?, ?, ?)').run(state.day, kind, blob, now);
        db.prepare(`DELETE FROM snapshots WHERE kind = 'auto' AND id NOT IN (SELECT id FROM snapshots WHERE kind = 'auto' ORDER BY id DESC LIMIT ${KEEP_AUTOSAVES})`).run();
        const put = db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)');
        put.run('airlineName', airline);
        put.run('day', String(state.day));
        put.run('startYear', String(state.world?.startYear ?? 2026));
        put.run('updatedAt', String(now));
        put.run('schemaVersion', String((state as { schemaVersion: number }).schemaVersion));
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    } finally {
      db.close();
    }
  }

  /** Newest loadable snapshot; falls back to older ones if the newest is damaged. */
  loadLatestWithFallback(id: string): { state: GameState; fellBack: boolean } {
    const db = this.open(id);
    let ids: number[];
    try {
      ids = (db.prepare('SELECT id FROM snapshots ORDER BY id DESC').all() as { id: number }[]).map((r) => r.id);
    } catch (e) {
      throw new SaveLoadError('corrupt', String(e));
    } finally {
      db.close();
    }
    let first: unknown = null;
    for (const [i, snap] of ids.entries()) {
      try {
        return { state: this.loadSnapshot(id, snap), fellBack: i > 0 };
      } catch (e) {
        if (e instanceof SaveLoadError && e.reason === 'newerVersion') throw e;
        first ??= e;
      }
    }
    throw first instanceof SaveLoadError ? first : new SaveLoadError('corrupt', 'no snapshots');
  }

  loadLatest(id: string): GameState {
    return this.loadSnapshot(id);
  }

  private loadSnapshot(id: string, snapshotId?: number): GameState {
    let db: DatabaseSync;
    try {
      db = this.open(id);
    } catch (e) {
      if (e instanceof SaveLoadError) throw e;
      throw new SaveLoadError('corrupt', String(e));
    }
    try {
      const row = (snapshotId === undefined
        ? db.prepare('SELECT state FROM snapshots ORDER BY id DESC LIMIT 1').get()
        : db.prepare('SELECT state FROM snapshots WHERE id = ?').get(snapshotId)) as { state: Uint8Array } | undefined;
      if (!row) throw new SaveLoadError('corrupt', 'no snapshots');
      let state = JSON.parse(gunzipSync(row.state).toString('utf8')) as Record<string, unknown>;
      const version = Number(state.schemaVersion);
      if (!Number.isInteger(version)) throw new SaveLoadError('corrupt', 'no schema version');
      if (version > CURRENT_SCHEMA) throw new SaveLoadError('newerVersion');
      for (let v = version; v < CURRENT_SCHEMA; v++) {
        const m = migrations[v];
        if (!m) throw new SaveLoadError('corrupt', `no migration from ${v}`);
        state = m(state);
      }
      return state as unknown as GameState;
    } catch (e) {
      if (e instanceof SaveLoadError) throw e;
      throw new SaveLoadError('corrupt', String(e));
    } finally {
      db.close();
    }
  }

  snapshotCount(id: string): { auto: number; manual: number } {
    const db = this.open(id);
    try {
      const rows = db.prepare('SELECT kind, COUNT(*) AS n FROM snapshots GROUP BY kind').all() as { kind: string; n: number }[];
      return { auto: rows.find((r) => r.kind === 'auto')?.n ?? 0, manual: rows.find((r) => r.kind === 'manual')?.n ?? 0 };
    } finally {
      db.close();
    }
  }

  appendDaily(id: string, daily: AirlineDaily[]): void {
    const db = this.open(id);
    try {
      db.exec('BEGIN');
      const put = db.prepare('INSERT OR REPLACE INTO airline_daily (day, airline_id, json) VALUES (?, ?, ?)');
      for (const d of daily) put.run(d.day, d.airlineId, JSON.stringify(d));
      db.exec('COMMIT');
    } finally {
      db.close();
    }
  }

  history(id: string, airlineId: string, fromDay: number, toDay: number): AirlineDaily[] {
    const db = this.open(id);
    try {
      const rows = db
        .prepare('SELECT json FROM airline_daily WHERE airline_id = ? AND day BETWEEN ? AND ? ORDER BY day')
        .all(airlineId, fromDay, toDay) as { json: string }[];
      return rows.map((r) => JSON.parse(r.json) as AirlineDaily);
    } finally {
      db.close();
    }
  }

  info(id: string): SaveInfo {
    const db = this.open(id);
    try {
      const rows = db.prepare('SELECT key, value FROM meta').all() as { key: string; value: string }[];
      const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      return { id, name: m.name ?? id, airlineName: m.airlineName ?? '', day: Number(m.day ?? 0), startYear: Number(m.startYear ?? 2026), updatedAt: Number(m.updatedAt ?? 0) };
    } finally {
      db.close();
    }
  }

  /** All saves, newest first. Unreadable files are listed as "(damaged)" so the player can see them. */
  listSaves(): SaveInfo[] {
    return readdirSync(this.dir)
      .filter((f) => f.endsWith('.sqlite'))
      .map((f) => f.slice(0, -'.sqlite'.length))
      .map((id) => {
        try {
          return this.info(id);
        } catch {
          return { id, name: id, airlineName: '(damaged)', day: 0, startYear: 2026, updatedAt: 0 };
        }
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }
}
