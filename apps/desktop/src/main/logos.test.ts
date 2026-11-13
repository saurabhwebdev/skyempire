import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { downloadLogos } from './logos';

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
const airline = (iata: string, wikidata: string) => ({ iata, wikidata, name: iata });
const dir = () => mkdtempSync(join(tmpdir(), 'se-logos-'));

function fakeFetch(map: Record<string, unknown>, calls: string[] = []) {
  return (async (url: string) => {
    calls.push(url);
    for (const [k, v] of Object.entries(map)) {
      if (url.includes(k)) {
        if (v instanceof Uint8Array) return new Response(new Blob([v as Uint8Array<ArrayBuffer>]), { status: 200 });
        return new Response(JSON.stringify(v), { status: 200 });
      }
    }
    return new Response('nope', { status: 404 });
  }) as typeof fetch;
}
const entity = (qid: string, file?: string) => ({ entities: { [qid]: { claims: file ? { P154: [{ mainsnak: { datavalue: { value: file } } }] } : {} } } });
const fast = { gapMs: 0 };

describe('downloadLogos', () => {
  it('follows Wikidata P154 to Wikimedia Commons and saves IATA.png', async () => {
    const d = dir();
    const calls: string[] = [];
    const res = await downloadLogos([airline('LH', 'Q9325')], d, { ...fast, fetchFn: fakeFetch({ 'ids=Q9325': entity('Q9325', 'Lufthansa Logo 2018.svg'), 'Special:FilePath': PNG }, calls) });
    expect(res).toEqual({ ok: 1, failed: [] });
    expect(calls.some((c) => c.includes('commons.wikimedia.org/wiki/Special:FilePath/Lufthansa%20Logo%202018.svg'))).toBe(true);
    expect(readFileSync(join(d, 'LH.png'))).toEqual(Buffer.from(PNG));
  });
  it('reports airlines without a logo on Wikidata', async () => {
    const res = await downloadLogos([airline('XX', 'Q1')], dir(), { ...fast, fetchFn: fakeFetch({ 'ids=Q1': entity('Q1') }) });
    expect(res.failed).toEqual(['XX']);
  });
  it('skips logos it already has', async () => {
    const d = dir();
    writeFileSync(join(d, 'LH.png'), PNG);
    const calls: string[] = [];
    await downloadLogos([airline('LH', 'Q9325')], d, { ...fast, fetchFn: fakeFetch({}, calls) });
    expect(calls).toHaveLength(0);
  });
  it('looks up logos in batched Wikidata requests and waits out rate limits', async () => {
    const calls: string[] = [];
    let commonsHits = 0;
    const fetchFn = (async (url: string) => {
      calls.push(url);
      if (url.includes('wbgetentities')) {
        const ids = new URL(url).searchParams.get('ids')!.split('|');
        return new Response(JSON.stringify({ entities: Object.fromEntries(ids.map((q) => [q, entity(q, `${q}.svg`).entities[q]])) }));
      }
      commonsHits++;
      if (commonsHits === 1) return new Response('slow down', { status: 429, headers: { 'retry-after': '0' } });
      return new Response(new Blob([PNG]));
    }) as typeof fetch;
    const many = Array.from({ length: 60 }, (_, i) => airline(`A${i}`.slice(0, 3), `Q${100 + i}`));
    const res = await downloadLogos(many, dir(), { ...fast, fetchFn });
    expect(calls.filter((c) => c.includes('wbgetentities'))).toHaveLength(2); // 50 ids per request
    expect(res.ok).toBe(60);
  });
  it('stops when cancelled', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const calls: string[] = [];
    await downloadLogos([airline('LH', 'Q9325'), airline('EK', 'Q180432')], dir(), { ...fast, fetchFn: fakeFetch({}, calls), signal: ctrl.signal });
    expect(calls).toHaveLength(0);
  });
  it('never leaves a half-written file behind', async () => {
    const d = dir();
    const broken = (async (url: string) => {
      if (url.includes('wbgetentities')) return new Response(JSON.stringify(entity('Q9325', 'x.svg')));
      return new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array([1, 2])); c.error(new Error('connection reset')); } }));
    }) as typeof fetch;
    const res = await downloadLogos([airline('LH', 'Q9325')], d, { ...fast, fetchFn: broken, retries: 0 });
    expect(res.failed).toEqual(['LH']);
    expect(existsSync(join(d, 'LH.png'))).toBe(false);
    expect(readdirSync(d)).toEqual([]);
  });

  it('backs off when rate-limited without a Retry-After header', async () => {
    const sleeps: number[] = [];
    let n = 0;
    const fetchFn = (async (url: string) => {
      if (url.includes('wbgetentities')) return new Response(JSON.stringify(entity('Q9325', 'x.svg')));
      return ++n === 1 ? new Response('slow down', { status: 429 }) : new Response(new Blob([PNG as Uint8Array<ArrayBuffer>]));
    }) as typeof fetch;
    const res = await downloadLogos([airline('LH', 'Q9325')], dir(), { ...fast, fetchFn, sleepFn: async (ms) => void sleeps.push(ms) });
    expect(res.ok).toBe(1);
    expect(sleeps[0]).toBeGreaterThanOrEqual(1000);
  });
});
