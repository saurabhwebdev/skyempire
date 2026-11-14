/**
 * Builds src/airspace.json: ~40 generic, geographic airspace regions for tension events (v0.2 design §3).
 * Geometry: Natural Earth 1:50m country shapes (public domain), clipped, simplified (Douglas–Peucker 0.5°).
 * Detour nodes: the region's convex hull, pushed 0.75° outward — shortest paths around an obstacle hug its hull.
 * Run: node packages/data/scripts/build-airspace.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type Pt = [number, number];
const ROOT = join(import.meta.dirname, '..');

/** Region id → display name, countries, optional longitude clip. Names are geographic only. */
const REGIONS: { id: string; name: string; countries: string[]; lon?: [number, number] }[] = [
  { id: 'eastern-europe', name: 'Eastern Europe', countries: ['UA', 'BY', 'MD'] },
  { id: 'baltic', name: 'Baltic', countries: ['EE', 'LV', 'LT'] },
  { id: 'western-russia', name: 'Western Russia', countries: ['RU'], lon: [-180, 60] },
  { id: 'siberia', name: 'Siberia', countries: ['RU'], lon: [60, 180] },
  { id: 'caucasus', name: 'Caucasus', countries: ['GE', 'AM', 'AZ'] },
  { id: 'central-asia', name: 'Central Asia', countries: ['KZ', 'UZ', 'TM', 'KG', 'TJ'] },
  { id: 'south-central-asia', name: 'South-Central Asia', countries: ['AF', 'PK'] },
  { id: 'northern-gulf', name: 'Northern Gulf', countries: ['IR', 'IQ', 'KW'] },
  { id: 'eastern-mediterranean', name: 'Eastern Mediterranean', countries: ['SY', 'LB', 'IL', 'JO', 'PS', 'CY'] },
  { id: 'arabian-peninsula', name: 'Arabian Peninsula', countries: ['SA', 'YE', 'OM', 'AE', 'QA', 'BH'] },
  { id: 'horn-of-africa', name: 'Horn of Africa', countries: ['ER', 'DJ', 'SO', 'ET'] },
  { id: 'nile-valley', name: 'Nile Valley', countries: ['EG', 'SD', 'SS'] },
  { id: 'maghreb', name: 'Maghreb', countries: ['MA', 'DZ', 'TN', 'EH'] },
  { id: 'libyan-desert', name: 'Libyan Desert', countries: ['LY'] },
  { id: 'sahel', name: 'Sahel', countries: ['ML', 'NE', 'TD', 'BF', 'MR'] },
  { id: 'west-africa', name: 'West Africa', countries: ['SN', 'GM', 'GN', 'GW', 'SL', 'LR', 'CI', 'GH', 'TG', 'BJ'] },
  { id: 'gulf-of-guinea', name: 'Gulf of Guinea', countries: ['NG', 'CM', 'GQ', 'GA'] },
  { id: 'central-africa', name: 'Central Africa', countries: ['CF', 'CG', 'CD'] },
  { id: 'great-lakes', name: 'African Great Lakes', countries: ['UG', 'RW', 'BI', 'KE', 'TZ'] },
  { id: 'southern-africa', name: 'Southern Africa', countries: ['ZM', 'ZW', 'MZ', 'MW', 'AO', 'NA', 'BW', 'ZA', 'LS', 'SZ'] },
  { id: 'southwest-indian-ocean', name: 'Southwest Indian Ocean', countries: ['MG'] },
  { id: 'south-asia', name: 'South Asia', countries: ['IN'] },
  { id: 'bay-of-bengal', name: 'Bay of Bengal', countries: ['BD', 'MM'] },
  { id: 'himalaya', name: 'Himalaya', countries: ['NP', 'BT'] },
  { id: 'indochina', name: 'Indochina', countries: ['TH', 'LA', 'KH', 'VN'] },
  { id: 'inner-asia', name: 'Inner Asia', countries: ['CN'], lon: [-180, 100] },
  { id: 'east-asia-mainland', name: 'East Asia Mainland', countries: ['CN'], lon: [100, 180] },
  { id: 'korean-peninsula', name: 'Korean Peninsula', countries: ['KP', 'KR'] },
  { id: 'northwest-pacific', name: 'Northwest Pacific', countries: ['JP'] },
  { id: 'mongolian-plateau', name: 'Mongolian Plateau', countries: ['MN'] },
  { id: 'malay-peninsula', name: 'Malay Peninsula', countries: ['MY', 'SG', 'BN'] },
  { id: 'indonesian-archipelago', name: 'Indonesian Archipelago', countries: ['ID', 'TL'] },
  { id: 'philippine-archipelago', name: 'Philippine Archipelago', countries: ['PH'] },
  { id: 'balkans', name: 'Balkans', countries: ['RS', 'BA', 'ME', 'MK', 'AL', 'HR', '-99'] },
  { id: 'anatolia', name: 'Anatolia', countries: ['TR'] },
  { id: 'andes', name: 'Andes', countries: ['CO', 'EC', 'PE', 'BO'] },
  { id: 'northern-south-america', name: 'Northern South America', countries: ['VE', 'GY', 'SR'] },
  { id: 'central-america', name: 'Central America', countries: ['GT', 'HN', 'SV', 'NI', 'CR', 'PA', 'BZ'] },
  { id: 'caribbean', name: 'Caribbean', countries: ['CU', 'HT', 'DO', 'JM'] },
];

interface Feature { properties: { iso: string; name: string }; geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown } }
const basemap = JSON.parse(readFileSync(join(ROOT, 'src', 'basemap', 'countries-50m.json'), 'utf8')) as { features: Feature[] };

function outerRings(f: Feature): Pt[][] {
  const g = f.geometry;
  const polys = (g.type === 'Polygon' ? [g.coordinates] : g.coordinates) as Pt[][][];
  return polys.map((p) => p[0]!);
}

/** Sutherland–Hodgman clip of a ring against a vertical half-plane. */
function clip(ring: Pt[], x: number, keepLeft: boolean): Pt[] {
  const inside = (p: Pt) => (keepLeft ? p[0] <= x : p[0] >= x);
  const out: Pt[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!, b = ring[(i + 1) % ring.length]!;
    const ia = inside(a), ib = inside(b);
    if (ia) out.push(a);
    if (ia !== ib) {
      const t = (x - a[0]) / (b[0] - a[0]);
      out.push([x, a[1] + t * (b[1] - a[1])]);
    }
  }
  return out;
}

function perpDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len;
}
function simplify(pts: Pt[], tol: number): Pt[] {
  if (pts.length < 3) return pts;
  let max = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDist(pts[i]!, pts[0]!, pts[pts.length - 1]!);
    if (d > max) { max = d; idx = i; }
  }
  if (max <= tol) return [pts[0]!, pts[pts.length - 1]!];
  return [...simplify(pts.slice(0, idx + 1), tol).slice(0, -1), ...simplify(pts.slice(idx), tol)];
}
const area = (r: Pt[]) => Math.abs(r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]!; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;

function hull(points: Pt[]): Pt[] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Pt[] = [], upper: Pt[] = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, q) <= 0) lower.pop(); lower.push(q); }
  for (const q of p.reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, q) <= 0) upper.pop(); upper.push(q); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
function inRing(p: Pt, ring: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!, [xj, yj] = ring[j]!;
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const round = (p: Pt): Pt => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100];

const out = REGIONS.map((def) => {
  let rings: Pt[][] = [];
  for (const f of basemap.features) {
    if (!def.countries.includes(f.properties.iso)) continue;
    for (let ring of outerRings(f)) {
      const lons = ring.map((p) => p[0]);
      if (Math.max(...lons) - Math.min(...lons) > 180) continue; // crosses the antimeridian
      if (def.lon) ring = clip(clip(ring, def.lon[0], false), def.lon[1], true);
      if (ring.length < 3) continue;
      const s = simplify([...ring, ring[0]!], 0.5).slice(0, -1).map(round);
      if (s.length >= 3 && area(s) >= 1) rings.push(s);
    }
  }
  if (rings.length === 0) throw new Error(`${def.id}: no geometry`);
  rings = rings.sort((a, b) => area(b) - area(a)).slice(0, 8);
  const all = rings.flat();
  const cx = all.reduce((s, p) => s + p[0], 0) / all.length, cy = all.reduce((s, p) => s + p[1], 0) / all.length;
  const nodes = hull(all)
    .map((p): Pt => {
      const dx = p[0] - cx, dy = p[1] - cy, len = Math.hypot(dx, dy) || 1;
      return round([p[0] + (0.75 * dx) / len, Math.max(-89, Math.min(89, p[1] + (0.75 * dy) / len))]);
    })
    .filter((n) => !rings.some((r) => inRing(n, r)));
  return { id: def.id, name: def.name, countries: def.countries.filter((c) => c !== '-99'), rings, nodes };
});

writeFileSync(join(ROOT, 'src', 'airspace.json'), JSON.stringify(out) + '\n');
console.log(`Wrote ${out.length} airspace regions; ${out.reduce((s, r) => s + r.rings.reduce((a, x) => a + x.length, 0), 0)} vertices`);
