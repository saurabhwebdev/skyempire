/**
 * Builds src/airports.world.json and src/basemap/countries-50m.json from free data:
 *  - OurAirports airports.csv + runways.csv (public domain)
 *  - GeoNames cities15000 (CC-BY 4.0) for catchment population
 *  - World Bank GDP per capita (CC-BY 4.0) for wealth
 *  - Natural Earth 1:50m countries (public domain) for the basemap
 * Run: node packages/data/scripts/build-airports.ts
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Airport, SizeClass } from '@skyempire/shared';
import {
  businessFor,
  landingFeeFor,
  paxFeeFor,
  sizeClassFor,
  slotCapacityFor,
  tourismFor,
  wealthFor,
} from '../src/heuristics.ts';

const ROOT = join(import.meta.dirname, '..');
const CACHE = join(ROOT, '.cache');
const TARGET = 1000;
const MIN_PER_COUNTRY = 3;
const CATCHMENT_KM = 80;
const UA = 'SkyEmpire-build/0.1 (open-source game data script)';

mkdirSync(CACHE, { recursive: true });

async function download(url: string, file: string): Promise<string> {
  const path = join(CACHE, file);
  if (!existsSync(path)) {
    console.log(`Downloading ${url}`);
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`${url} → ${res.status}`);
    writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  }
  return path;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else q = false;
      } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function toObjects(rows: string[][]): Record<string, string>[] {
  const [head, ...rest] = rows;
  return rest.map((r) => Object.fromEntries(head!.map((h, i) => [h, r[i] ?? ''])));
}

const R = 6371;
function km(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const toRad = Math.PI / 180;
  const dLat = (bLat - aLat) * toRad, dLon = (bLon - aLon) * toRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * toRad) * Math.cos(bLat * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function main() {
  const airportsCsv = await download('https://davidmegginson.github.io/ourairports-data/airports.csv', 'airports.csv');
  const runwaysCsv = await download('https://davidmegginson.github.io/ourairports-data/runways.csv', 'runways.csv');
  const citiesZip = await download('https://download.geonames.org/export/dump/cities15000.zip', 'cities15000.zip');
  const gdpJson = await download(
    'https://api.worldbank.org/v2/country/all/indicator/NY.GDP.PCAP.CD?format=json&date=2023&per_page=400',
    'gdp.json',
  );
  const neGeo = await download(
    'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson',
    'ne_50m_admin_0_countries.geojson',
  );

  // Cities (GeoNames): name, lat, lon, population
  const citiesTxt = join(CACHE, 'cities15000.txt');
  if (!existsSync(citiesTxt)) execFileSync('unzip', ['-o', citiesZip, '-d', CACHE]);
  const cities = readFileSync(citiesTxt, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => l.split('\t'))
    // Skip city sections/districts (PPLX) and historical/abandoned places to avoid double counting.
    .filter((c) => !['PPLX', 'PPLH', 'PPLQ', 'PPLW'].includes(c[7] ?? ''))
    .map((c) => ({ lat: Number(c[4]), lon: Number(c[5]), pop: Number(c[14]) }));
  const grid = new Map<string, typeof cities>();
  const cellKey = (lat: number, lon: number) => `${Math.floor(lat)}:${Math.floor(lon)}`;
  for (const c of cities) {
    const k = cellKey(c.lat, c.lon);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k)!.push(c);
  }
  const catchment = (lat: number, lon: number): number => {
    let sum = 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -2; dx <= 2; dx++)
        for (const c of grid.get(cellKey(lat + dy, lon + dx)) ?? [])
          if (km(lat, lon, c.lat, c.lon) <= CATCHMENT_KM) sum += c.pop;
    return sum / 1e6;
  };

  // GDP per capita by ISO2
  const gdpRows = JSON.parse(readFileSync(gdpJson, 'utf8'))[1] as { country: { id: string }; value: number | null }[];
  const gdp = new Map(gdpRows.filter((r) => r.value).map((r) => [r.country.id, r.value as number]));

  // Longest paved/any runway per airport
  const longest = new Map<string, number>();
  for (const r of toObjects(parseCsv(readFileSync(runwaysCsv, 'utf8')))) {
    if (r.closed === '1') continue;
    const m = Math.round(Number(r.length_ft) * 0.3048);
    if (m > (longest.get(r.airport_ident!) ?? 0)) longest.set(r.airport_ident!, m);
  }

  const overrides = JSON.parse(readFileSync(join(ROOT, 'src', 'overrides.world.json'), 'utf8')) as Record<
    string,
    Partial<Airport>
  >;
  const airlineHubs: string[] = existsSync(join(ROOT, 'src', 'airlines.seed.json'))
    ? (JSON.parse(readFileSync(join(ROOT, 'src', 'airlines.seed.json'), 'utf8')) as { hubId: string }[]).map((a) => a.hubId)
    : [];

  type Cand = Airport & { score: number };
  const cands: Cand[] = [];
  for (const a of toObjects(parseCsv(readFileSync(airportsCsv, 'utf8')))) {
    if (a.scheduled_service !== 'yes') continue;
    if (a.type !== 'large_airport' && a.type !== 'medium_airport') continue;
    if (!/^[A-Z]{3}$/.test(a.iata_code ?? '')) continue;
    const runwayM = longest.get(a.ident!) ?? 0;
    if (runwayM < 1200) continue;
    const lat = Number(a.latitude_deg), lon = Number(a.longitude_deg);
    const pop = Math.max(catchment(lat, lon), 0.05);
    const size = sizeClassFor(a.type, pop) as SizeClass;
    const country = a.iso_country!;
    const ap: Cand = {
      id: a.iata_code!,
      icao: a.icao_code || a.gps_code || a.ident!,
      name: a.name!,
      city: a.municipality || a.name!,
      country,
      lat: Math.round(lat * 1e4) / 1e4,
      lon: Math.round(lon * 1e4) / 1e4,
      sizeClass: size,
      population: Math.round(pop * 100) / 100,
      wealth: Math.round(wealthFor(gdp.get(country) ?? 8000) * 100) / 100,
      tourism: tourismFor(country),
      business: Math.round(businessFor(pop) * 100) / 100,
      runwayM,
      slotCapacity: slotCapacityFor(size),
      landingFeePerTonne: landingFeeFor(size),
      paxFee: paxFeeFor(size),
      score: pop * (a.type === 'large_airport' ? 3 : 1),
    };
    cands.push(ap);
  }

  // Dedupe IATA (keep higher score), then select.
  const byId = new Map<string, Cand>();
  for (const c of cands) if (!byId.has(c.id) || byId.get(c.id)!.score < c.score) byId.set(c.id, c);
  const all = [...byId.values()].sort((a, b) => b.score - a.score);

  // --add MEM,SDF: append just these airports (same formulas) and leave every existing one untouched.
  const addAt = process.argv.indexOf('--add');
  if (addAt >= 0) {
    const ids = (process.argv[addAt + 1] ?? '').split(',').filter(Boolean);
    const path = join(ROOT, 'src', 'airports.world.json');
    const current = JSON.parse(readFileSync(path, 'utf8')) as Airport[];
    for (const id of ids) {
      if (current.some((a) => a.id === id)) continue;
      const c = byId.get(id);
      if (!c) { console.warn(`Airport ${id} not found`); continue; }
      const { score: _score, ...ap } = c;
      current.push({ ...ap, ...(overrides[id] ?? {}) });
      console.log(`Added ${id} ${ap.name}`);
    }
    writeFileSync(path, JSON.stringify(current.sort((a, b) => a.id.localeCompare(b.id))));
    return;
  }
  const chosen = new Map<string, Cand>();
  for (const id of [...airlineHubs, ...Object.keys(overrides)]) {
    const c = byId.get(id);
    if (c) chosen.set(id, c);
    else console.warn(`Required airport ${id} not found`);
  }
  const perCountry = new Map<string, number>();
  for (const c of all) {
    if ((perCountry.get(c.country) ?? 0) < MIN_PER_COUNTRY && !chosen.has(c.id)) {
      chosen.set(c.id, c);
      perCountry.set(c.country, (perCountry.get(c.country) ?? 0) + 1);
    }
  }
  for (const c of all) {
    if (chosen.size >= TARGET) break;
    chosen.set(c.id, c);
  }

  const out: Airport[] = [...chosen.values()]
    .map(({ score: _score, ...ap }) => ({ ...ap, ...(overrides[ap.id] ?? {}) }))
    .sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(join(ROOT, 'src', 'airports.world.json'), JSON.stringify(out));
  console.log(`Wrote ${out.length} airports`);

  // Basemap: keep name + ISO2, round coordinates to 3 decimals.
  const ne = JSON.parse(readFileSync(neGeo, 'utf8')) as {
    features: { properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } }[];
  };
  const round = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(round) : typeof v === 'number' ? Math.round(v * 1000) / 1000 : v;
  const basemap = {
    type: 'FeatureCollection',
    features: ne.features.map((f) => ({
      type: 'Feature',
      properties: { name: f.properties.NAME, iso: f.properties.ISO_A2_EH ?? f.properties.ISO_A2 },
      geometry: { type: f.geometry.type, coordinates: round(f.geometry.coordinates) },
    })),
  };
  mkdirSync(join(ROOT, 'src', 'basemap'), { recursive: true });
  writeFileSync(join(ROOT, 'src', 'basemap', 'countries-50m.json'), JSON.stringify(basemap));
  console.log(`Wrote basemap with ${basemap.features.length} countries`);
}

await main();
