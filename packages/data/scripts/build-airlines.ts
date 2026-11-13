/**
 * Builds src/airlines.world.json from the hand-curated src/airlines.seed.json,
 * adding each airline's Wikidata QID and country (ISO2) from Wikidata (CC0).
 * Also builds src/routes.world.json from OpenFlights routes.dat (ODbL, 2014 snapshot).
 * Run: node packages/data/scripts/build-airlines.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const CACHE = join(ROOT, '.cache');
const UA = 'SkyEmpire-build/0.1 (open-source game data script)';
mkdirSync(CACHE, { recursive: true });

interface Seed {
  iata: string;
  icao: string;
  name: string;
  hubId: string;
  personality: string;
  sizeRank: number;
  brandColor: string;
  fleetTypes: string[];
}

async function sparql(query: string): Promise<{ [k: string]: { value: string } }[]> {
  const url = 'https://query.wikidata.org/sparql?query=' + encodeURIComponent(query);
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' } });
  if (!res.ok) throw new Error(`SPARQL ${res.status}`);
  const json = (await res.json()) as { results: { bindings: { [k: string]: { value: string } }[] } };
  return json.results.bindings;
}

async function main() {
  const seeds = JSON.parse(readFileSync(join(ROOT, 'src', 'airlines.seed.json'), 'utf8')) as Seed[];
  const cacheFile = join(CACHE, 'wikidata-airlines.json');
  let rows: { [k: string]: { value: string } }[];
  if (existsSync(cacheFile)) rows = JSON.parse(readFileSync(cacheFile, 'utf8'));
  else {
    const values = seeds.map((s) => `"${s.icao}"`).join(' ');
    rows = await sparql(`SELECT ?a ?icao ?iata ?iso ?dissolved WHERE {
      VALUES ?icao { ${values} }
      ?a wdt:P230 ?icao .
      OPTIONAL { ?a wdt:P229 ?iata . }
      OPTIONAL { ?a wdt:P17 ?c . ?c wdt:P297 ?iso . }
      OPTIONAL { ?a wdt:P576 ?dissolved . }
    }`);
    writeFileSync(cacheFile, JSON.stringify(rows));
  }

  const airportList = JSON.parse(readFileSync(join(ROOT, 'src', 'airports.world.json'), 'utf8')) as { id: string; country: string }[];
  const airports = new Set(airportList.map((a) => a.id));
  const countryOf = new Map(airportList.map((a) => [a.id, a.country]));
  const out = [];
  const missing: string[] = [];
  for (const s of seeds) {
    const qnum = (r: { a?: { value: string } }) => Number(r.a!.value.split('/Q').pop());
    const active = rows.filter((r) => r.icao?.value === s.icao && !r.dissolved);
    const dissolvedOnly = !active.length && rows.some((r) => r.icao?.value === s.icao && r.iata?.value === s.iata);
    // Prefer the item matching the IATA code; among those the lowest QID (the main, oldest item).
    const best = [...active].sort((x, y) => Number(y.iata?.value === s.iata) - Number(x.iata?.value === s.iata) || qnum(x) - qnum(y))[0];
    if (!best || dissolvedOnly) {
      missing.push(`${s.iata}/${s.icao} ${s.name}`);
      continue;
    }
    if (!airports.has(s.hubId)) throw new Error(`Hub ${s.hubId} of ${s.name} missing from airports.world.json`);
    out.push({
      iata: s.iata,
      icao: s.icao,
      name: s.name,
      country: countryOf.get(s.hubId)!,
      wikidata: best.a!.value.split('/').pop()!,
      hubId: s.hubId,
      personality: s.personality,
      sizeRank: s.sizeRank,
      brandColor: s.brandColor,
      fleetTypes: s.fleetTypes,
      sources: [`https://www.wikidata.org/wiki/${best.a!.value.split('/').pop()}`, 'OpenFlights airlines.dat (ODbL)'],
    });
  }
  if (missing.length) console.warn(`No Wikidata match (skipped): ${missing.join('; ')}`);
  writeFileSync(join(ROOT, 'src', 'airlines.world.json'), JSON.stringify(out, null, 1));
  console.log(`Wrote ${out.length} airlines`);

  // Real routes for these airlines (OpenFlights routes.dat columns: airline, id, src, id, dst, id, codeshare, stops, equipment)
  const routesPath = join(CACHE, 'routes.dat');
  if (!existsSync(routesPath)) {
    const res = await fetch('https://raw.githubusercontent.com/jpatokal/openflights/master/data/routes.dat', {
      headers: { 'User-Agent': UA },
    });
    writeFileSync(routesPath, await res.text());
  }
  const iatas = new Set(out.map((a) => a.iata));
  const seen = new Set<string>();
  const routes: { airlineIata: string; from: string; to: string }[] = [];
  for (const line of readFileSync(routesPath, 'utf8').split('\n')) {
    const [airline, , from, , to, , codeshare, stops] = line.split(',');
    if (!airline || !from || !to || !iatas.has(airline) || codeshare === 'Y' || stops !== '0') continue;
    if (!airports.has(from) || !airports.has(to)) continue;
    const key = `${airline}:${[from, to].sort().join('-')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    routes.push({ airlineIata: airline, from, to });
  }
  writeFileSync(join(ROOT, 'src', 'routes.world.json'), JSON.stringify(routes));
  console.log(`Wrote ${routes.length} real routes`);
  // Reserved names/codes: every active airline in OpenFlights airlines.dat plus our roster.
  const airlinesDat = join(CACHE, 'airlines.dat');
  if (!existsSync(airlinesDat)) {
    const res = await fetch('https://raw.githubusercontent.com/jpatokal/openflights/master/data/airlines.dat', {
      headers: { 'User-Agent': UA },
    });
    writeFileSync(airlinesDat, await res.text());
  }
  const names = new Set<string>(out.map((a) => a.name.toLowerCase()));
  const codes = new Set<string>(out.flatMap((a) => [a.iata, a.icao]));
  for (const line of readFileSync(airlinesDat, 'utf8').split('\n')) {
    const cols = [...line.matchAll(/"((?:[^"]|"")*)"|\\N|([^,]+)/g)].map((m) => m[1] ?? m[2] ?? '');
    const [, name, , iata, icao, , , active] = cols;
    if (active !== 'Y' || !name) continue;
    names.add(name.toLowerCase());
    if (iata && /^[A-Z0-9]{2}$/.test(iata)) codes.add(iata);
    if (icao && /^[A-Z]{3}$/.test(icao)) codes.add(icao);
  }
  writeFileSync(join(ROOT, 'src', 'reserved.json'), JSON.stringify({ names: [...names].sort(), codes: [...codes].sort() }));
  console.log(`Reserved ${names.size} names, ${codes.size} codes`);
}

await main();
