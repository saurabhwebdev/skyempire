import { routeChain } from '../lib/routes';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { loadBasemap, loadCatalog } from '@skyempire/data';
import type { Airport } from '@skyempire/shared';
import { formatPax } from '@skyempire/shared';
import { Map as MlMap, setWorkerUrl, type StyleSpecification } from 'maplibre-gl';
// Bundle MapLibre's module worker (and its imports) into one file served from our origin.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore, useUi } from '../store';
import { MAP } from './colors';
import { buildLayers } from './layers';
import { MapToggles } from './MapToggles';

setWorkerUrl(maplibreWorkerUrl);

const catalog = loadCatalog('world');
const AIRPORTS = Object.values(catalog.airports);
const EASE_IO = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function style(): StyleSpecification {
  return {
    version: 8,
    sources: { countries: { type: 'geojson', data: loadBasemap() as unknown as GeoJSON.FeatureCollection } },
    layers: [
      { id: 'water', type: 'background', paint: { 'background-color': MAP.water } },
      { id: 'land', type: 'fill', source: 'countries', paint: { 'fill-color': MAP.land } },
      { id: 'borders', type: 'line', source: 'countries', paint: { 'line-color': MAP.border, 'line-width': 0.6 } },
    ],
  };
}

export function WorldMap() {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const overlay = useRef<MapboxOverlay | null>(null);
  const [zoom, setZoom] = useState(3);
  const [hover, setHover] = useState<{ airport: Airport; x: number; y: number } | null>(null);
  const [fresh, setFresh] = useState<{ routeId: string; t: number } | null>(null);
  const known = useRef<Set<string> | null>(null);
  const view = useGameStore((s) => s.view);
  const settings = useGameStore((s) => s.settings);
  const selection = useUi((s) => s.selection);
  const select = useUi((s) => s.select);
  const showRivals = useUi((s) => s.showRivals);
  const reduceMotion = settings.reduceMotion || settings.performanceMode || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Create the map once.
  useEffect(() => {
    if (!container.current) return;
    const home = view ? catalog.airports[view.player.homeBaseId] : undefined;
    const m = new MlMap({
      container: container.current,
      style: style(),
      center: home ? [home.lon, home.lat] : [10, 30],
      zoom: 3,
      minZoom: 1,
      maxZoom: 9,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      renderWorldCopies: false,
    });
    m.touchZoomRotate.disableRotation();
    const o = new MapboxOverlay({ interleaved: false, layers: [] });
    m.addControl(o);
    m.on('zoom', () => setZoom(m.getZoom()));
    map.current = m;
    overlay.current = o;
    return () => {
      m.remove();
      map.current = null;
      overlay.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Animate newly opened player routes in (450 ms).
  useEffect(() => {
    if (!view) return;
    const ids = new Set(view.routes.map((r) => r.id));
    const prev = known.current;
    known.current = ids;
    if (!prev || reduceMotion) return;
    const added = [...ids].find((id) => !prev.has(id));
    if (!added) return;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 450);
      setFresh({ routeId: added, t: 1 - (1 - t) ** 3 });
      if (t < 1) raf = requestAnimationFrame(step);
      else setFresh(null);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [view, reduceMotion]);

  const layers = useMemo(
    () =>
      view
        ? buildLayers({
            airports: AIRPORTS, view, selection, showRivals, showWeather: settings.mapWeather, reduceMotion, colorBlind: settings.colorBlindRivals, zoom, fresh,
            onClick: (i) => {
              const ed = useUi.getState().routeEditor;
              // While creating a route, clicking an airport fills From (if it's a base and empty) or To.
              if (ed && !ed.routeId && i.kind === 'airport') {
                useUi.getState().openRouteEditor({ ...ed, to: i.id });
                return;
              }
              select(i);
            },
            onHover: setHover,
          })
        : [],
    [view, selection, showRivals, settings.mapWeather, reduceMotion, settings.colorBlindRivals, zoom, fresh, select],
  );
  useEffect(() => overlay.current?.setProps({ layers }), [layers]);

  // Ease the camera to the selection.
  useEffect(() => {
    const m = map.current;
    if (!m || !selection || !view) return;
    let target: [number, number] | null = null;
    if (selection.kind === 'airport') {
      const a = catalog.airports[selection.id];
      if (a) target = [a.lon, a.lat];
    } else if (selection.kind === 'route') {
      const r = view.routes.find((x) => x.id === selection.id);
      const pts = r ? routeChain(r).map((id) => catalog.airports[id]).filter((x) => !!x) : [];
      if (pts.length >= 2) {
        const lons = pts.map((p) => p!.lon), lats = pts.map((p) => p!.lat);
        m.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], {
          padding: { top: 80, bottom: 260, left: 80, right: 420 }, maxZoom: 6, duration: reduceMotion ? 0 : 600, easing: EASE_IO,
        });
        return;
      }
    }
    if (target) m.easeTo({ center: target, duration: reduceMotion ? 0 : 600, easing: EASE_IO, padding: { right: 360, bottom: 200, top: 0, left: 0 } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection]);

  const demandHint = hover && view ? view.slotsFree[hover.airport.id] : null;
  return (
    <div className="absolute inset-0">
      {/* MapLibre forces position: relative on its container, so size it with h-full inside this absolute wrapper. */}
      <div ref={container} className="h-full w-full" aria-label="World map" role="application" />
      <MapToggles />
      {hover && (
        <div
          role="tooltip"
          className="se-pop pointer-events-none absolute z-20 rounded-md border border-border bg-surface-3 px-3 py-2 text-[13px] shadow-overlay"
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          <div className="font-semibold">
            {hover.airport.city} <span className="font-mono text-muted">{hover.airport.id}</span>
          </div>
          <div className="text-muted">{hover.airport.name}</div>
          <div className="num mt-1 text-faint">
            {formatPax(hover.airport.population * 1_000_000)} people nearby{demandHint !== null && demandHint !== undefined ? ` · ${demandHint} slots free` : ''}
          </div>
        </div>
      )}
    </div>
  );
}
