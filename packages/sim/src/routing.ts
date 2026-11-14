import type { AirspaceRegion, Catalog, GameState } from '@skyempire/shared';
import { distanceKm } from './geo';

type Pt = [number, number]; // [lon, lat]
const R = 6371;
const SAMPLE_KM = 50;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

function gcKm(a: Pt, b: Pt): number {
  const dLat = rad(b[1] - a[1]), dLon = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Points along the great circle a→b, every ~50 km (endpoints excluded), longitudes in [-180, 180]. */
function samples(a: Pt, b: Pt): Pt[] {
  const d = gcKm(a, b) / R;
  const n = Math.floor((d * R) / SAMPLE_KM);
  if (n < 1 || d === 0) return [];
  const [l1, p1, l2, p2] = [rad(a[0]), rad(a[1]), rad(b[0]), rad(b[1])];
  const out: Pt[] = [];
  for (let i = 1; i <= n; i++) {
    const f = i / (n + 1);
    const A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2);
    const y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2);
    const z = A * Math.sin(p1) + B * Math.sin(p2);
    out.push([deg(Math.atan2(y, x)), deg(Math.atan2(z, Math.hypot(x, y)))]);
  }
  return out;
}

function inRing(p: Pt, ring: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!, [xj, yj] = ring[j]!;
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

interface Box { minX: number; minY: number; maxX: number; maxY: number }
const boxes = new WeakMap<AirspaceRegion, Box>();
function boxOf(r: AirspaceRegion): Box {
  let b = boxes.get(r);
  if (!b) {
    const pts = r.rings.flat();
    b = { minX: Math.min(...pts.map((p) => p[0])), minY: Math.min(...pts.map((p) => p[1])), maxX: Math.max(...pts.map((p) => p[0])), maxY: Math.max(...pts.map((p) => p[1])) };
    boxes.set(r, b);
  }
  return b;
}

export function inRegion(p: Pt, r: AirspaceRegion): boolean {
  const b = boxOf(r);
  if (p[0] < b.minX || p[0] > b.maxX || p[1] < b.minY || p[1] > b.maxY) return false;
  return r.rings.some((ring) => inRing(p, ring));
}

const clear = (a: Pt, b: Pt, regions: AirspaceRegion[]) => samples(a, b).every((p) => !regions.some((r) => inRegion(p, r)));

/** Waypoint-to-waypoint visibility depends only on the closed set, so it is shared across routes. */
const visibility = new Map<string, boolean>();
function clearCached(a: Pt, b: Pt, regions: AirspaceRegion[], setKey: string): boolean {
  const k = `${setKey}|${a[0]},${a[1]}|${b[0]},${b[1]}`;
  let v = visibility.get(k);
  if (v === undefined) {
    if (visibility.size > 200_000) visibility.clear();
    v = clear(a, b, regions);
    visibility.set(k, v);
    visibility.set(`${setKey}|${b[0]},${b[1]}|${a[0]},${a[1]}`, v);
  }
  return v;
}

/**
 * Shortest path a→b (km) avoiding `regions`, through their detour nodes (Dijkstra; edges valid when
 * their great-circle samples avoid every region). Null when no way around exists.
 */
export function detour(a: Pt, b: Pt, regions: AirspaceRegion[]): number | null {
  if (clear(a, b, regions)) return gcKm(a, b);
  const setKey = regions.map((r) => r.id).join(',');
  const nodes: Pt[] = [a, b, ...regions.flatMap((r) => r.nodes).filter((n) => !regions.some((r) => inRegion(n, r)))];
  const dist = nodes.map(() => Infinity);
  const done = nodes.map(() => false);
  dist[0] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < nodes.length; i++) if (!done[i] && dist[i]! < Infinity && (u < 0 || dist[i]! < dist[u]!)) u = i;
    if (u < 0) return null;
    if (u === 1) return dist[1]!;
    done[u] = true;
    for (let v = 0; v < nodes.length; v++) {
      if (done[v]) continue;
      const w = dist[u]! + gcKm(nodes[u]!, nodes[v]!);
      if (w >= dist[v]!) continue;
      const ok = u >= 2 && v >= 2 ? clearCached(nodes[u]!, nodes[v]!, regions, setKey) : clear(nodes[u]!, nodes[v]!, regions);
      if (ok) dist[v] = w;
    }
  }
}

export interface FlightDistance {
  km: number;
  detourKm: number;
  blocked: string | null;
}

/** Airspace regions closed today. */
export function closedRegions(state: GameState, catalog: Catalog): AirspaceRegion[] {
  const ids = new Set(
    state.world.tensions.filter((t) => t.kind === 'airspaceClosure' && t.regionId && state.day >= t.startDay && state.day <= t.endDay).map((t) => t.regionId!),
  );
  return ids.size ? catalog.airspace.filter((r) => ids.has(r.id)) : [];
}

export const NO_PATH = 'No way around closed airspace';
const cache = new Map<string, FlightDistance>();

/** Distance actually flown between two airports today: great circle, or a detour around closed airspace. */
export function flightDistanceKm(state: GameState, catalog: Catalog, from: string, to: string): FlightDistance {
  const A = catalog.airports[from]!, B = catalog.airports[to]!;
  const closed = closedRegions(state, catalog);
  const gc = distanceKm(A, B);
  if (closed.length === 0) return { km: gc, detourKm: 0, blocked: null };
  const key = `${closed.map((r) => r.id).join(',')}|${from < to ? `${from}-${to}` : `${to}-${from}`}`;
  const hit = cache.get(key);
  if (hit) return hit;
  if (cache.size > 50_000) cache.clear();
  const a: Pt = [A.lon, A.lat], b: Pt = [B.lon, B.lat];
  // A closure over an endpoint's own region is ignored for that route (its airports stay reachable).
  const relevant = closed.filter((r) => !inRegion(a, r) && !inRegion(b, r));
  let res: FlightDistance;
  if (relevant.length === 0) res = { km: gc, detourKm: 0, blocked: null };
  else {
    const km = detour(a, b, relevant);
    res = km === null ? { km: gc, detourKm: 0, blocked: NO_PATH } : { km: Math.max(gc, km), detourKm: Math.round(Math.max(0, km - gc)), blocked: null };
  }
  cache.set(key, res);
  return res;
}

/** Does the great circle between two airports pass through a region (endpoints excluded)? */
export function routeCrossesRegion(catalog: Catalog, from: string, to: string, regionId: string): boolean {
  const region = catalog.airspace.find((r) => r.id === regionId);
  const A = catalog.airports[from], B = catalog.airports[to];
  if (!region || !A || !B) return false;
  return samples([A.lon, A.lat], [B.lon, B.lat]).some((p) => inRegion(p, region));
}
