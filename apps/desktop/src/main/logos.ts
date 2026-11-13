import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface LogoAirline { iata: string; wikidata: string; name: string }
export interface DownloadOptions {
  fetchFn?: typeof fetch;
  signal?: AbortSignal;
  onProgress?(done: number, total: number): void;
  retries?: number;
  /** Pause between image downloads (Wikimedia asks clients to throttle). */
  gapMs?: number;
}

const UA = 'SkyEmpire/0.1 (open-source game; logo pack downloader)';
const BATCH = 50;
const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (ms <= 0 || signal?.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
  });

/** GET with retries; on 429/503 waits for Retry-After (or exponential backoff). */
async function politeGet(fetchFn: typeof fetch, url: string, retries: number, signal?: AbortSignal): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const r = await fetchFn(url, { headers: { 'User-Agent': UA }, signal });
    if (r.ok) return r;
    const retryable = r.status === 429 || r.status === 503;
    if (!retryable || attempt >= retries || signal?.aborted) throw new Error(`HTTP ${r.status}`);
    const after = Number(r.headers.get('retry-after'));
    await sleep(Number.isFinite(after) && after >= 0 ? after * 1000 : 1000 * 2 ** attempt, signal);
  }
}

/** Logo filenames (Wikidata P154) for many items, 50 per request. */
async function logoFiles(fetchFn: typeof fetch, qids: string[], retries: number, signal?: AbortSignal): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < qids.length && !signal?.aborted; i += BATCH) {
    const ids = qids.slice(i, i + BATCH).join('|');
    const r = await politeGet(fetchFn, `https://www.wikidata.org/w/api.php?action=wbgetentities&props=claims&format=json&ids=${ids}`, retries, signal);
    const json = (await r.json()) as { entities?: Record<string, { claims?: Record<string, { mainsnak?: { datavalue?: { value?: string } } }[]> }> };
    for (const [qid, e] of Object.entries(json.entities ?? {})) {
      const file = e.claims?.P154?.[0]?.mainsnak?.datavalue?.value;
      if (file) out.set(qid, file);
    }
  }
  return out;
}

/**
 * Downloads each airline's logo from Wikimedia Commons (Wikidata P154 "logo image") into `dir/<IATA>.png`,
 * for the player's personal use. One image at a time, temp file + rename so nothing half-written remains.
 */
export async function downloadLogos(airlines: LogoAirline[], dir: string, opts: DownloadOptions = {}): Promise<{ ok: number; failed: string[] }> {
  const fetchFn = opts.fetchFn ?? fetch;
  const retries = opts.retries ?? 4;
  const gap = opts.gapMs ?? 250;
  mkdirSync(dir, { recursive: true });
  const failed: string[] = [];
  let ok = 0, done = 0;
  const tick = () => opts.onProgress?.(++done, airlines.length);

  const todo = airlines.filter((a) => {
    if (!existsSync(join(dir, `${a.iata}.png`))) return true;
    ok++;
    tick();
    return false;
  });
  if (todo.length === 0 || opts.signal?.aborted) return { ok, failed };

  let files: Map<string, string>;
  try {
    files = await logoFiles(fetchFn, todo.map((a) => a.wikidata), retries, opts.signal);
  } catch {
    return { ok, failed: opts.signal?.aborted ? [] : todo.map((a) => a.iata) };
  }

  for (const a of todo) {
    if (opts.signal?.aborted) break;
    const target = join(dir, `${a.iata}.png`);
    const tmp = `${target}.part`;
    try {
      const file = files.get(a.wikidata);
      if (!file) throw new Error('no logo on Wikidata');
      const r = await politeGet(fetchFn, `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=256`, retries, opts.signal);
      writeFileSync(tmp, new Uint8Array(await r.arrayBuffer()));
      renameSync(tmp, target);
      ok++;
    } catch {
      rmSync(tmp, { force: true });
      if (!opts.signal?.aborted) failed.push(a.iata);
    } finally {
      tick();
    }
    await sleep(gap, opts.signal);
  }
  return { ok, failed };
}

export function countLogos(airlines: LogoAirline[], dir: string): number {
  return airlines.filter((a) => existsSync(join(dir, `${a.iata}.png`))).length;
}
