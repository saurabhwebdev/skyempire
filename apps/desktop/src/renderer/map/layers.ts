import type { Airport, ClientView } from '@skyempire/shared';
import type { Layer } from '@deck.gl/core';
import { ArcLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import type { Selection } from '../store';
import { ACCENT, AIRPORT, AIRPORT_ACTIVE, hexToRgba, RIVAL_PALETTE, type RGBA } from './colors';

export interface MapInput {
  airports: Airport[];
  view: ClientView;
  selection: Selection;
  showRivals: boolean;
  reduceMotion: boolean;
  colorBlind: boolean;
  zoom: number;
  /** Route id that was just opened (animated in), with 0..1 progress. */
  fresh?: { routeId: string; t: number } | null;
  onClick?(info: { kind: 'airport' | 'route'; id: string }): void;
  onHover?(info: { airport: Airport; x: number; y: number } | null): void;
}

export interface MapAirport extends Airport {
  isBase: boolean;
  active: boolean;
}

interface Arc {
  id: string;
  from: Airport;
  to: Airport;
  color: RGBA;
  width: number;
}

/** Pure description of every deck.gl layer on the world map. */
export function buildLayers(m: MapInput): Layer[] {
  const byId = new Map(m.airports.map((a) => [a.id, a]));
  const bases = new Set(m.view.player.baseIds);
  const used = new Set<string>();
  for (const r of m.view.routes) used.add(r.from).add(r.to);
  const rivalColor = new Map(
    m.view.rivals.map((r, i) => [r.id, m.colorBlind ? RIVAL_PALETTE[i % RIVAL_PALETTE.length]! : hexToRgba(r.color)]),
  );
  const layers: Layer[] = [];

  if (m.showRivals) {
    const arcs: Arc[] = [];
    m.view.rivalRoutes.forEach((r, i) => {
      const from = byId.get(r.from), to = byId.get(r.to);
      if (!from || !to) return;
      used.add(r.from).add(r.to);
      const c = rivalColor.get(r.airlineId) ?? RIVAL_PALETTE[7]!;
      arcs.push({ id: `${r.airlineId}:${i}`, from, to, color: [c[0], c[1], c[2], 90], width: 1 });
    });
    layers.push(
      new ArcLayer<Arc>({
        id: 'rival-routes', data: arcs, greatCircle: true, getSourcePosition: (d) => [d.from.lon, d.from.lat], getTargetPosition: (d) => [d.to.lon, d.to.lat],
        getSourceColor: (d) => d.color, getTargetColor: (d) => d.color, getWidth: 1, widthUnits: 'pixels', getHeight: 0.3,
      }),
    );
  }

  const player = hexToRgba(m.view.player.colors.primary);
  const mine: Arc[] = [];
  for (const r of m.view.routes) {
    const from = byId.get(r.from), to = byId.get(r.to);
    if (!from || !to) continue;
    const selected = m.selection?.kind === 'route' && m.selection.id === r.id;
    const fresh = m.fresh?.routeId === r.id && !m.reduceMotion ? m.fresh.t : 1;
    const alpha = r.status === 'active' ? 255 : 110;
    mine.push({ id: r.id, from, to, color: [player[0], player[1], player[2], Math.round(alpha * fresh)], width: (selected ? 4 : 2) * (0.5 + fresh / 2) });
  }
  layers.push(
    new ArcLayer<Arc>({
      id: 'player-routes', data: mine, greatCircle: true, pickable: true, autoHighlight: true, highlightColor: [255, 255, 255, 60],
      getSourcePosition: (d) => [d.from.lon, d.from.lat], getTargetPosition: (d) => [d.to.lon, d.to.lat],
      getSourceColor: (d) => d.color, getTargetColor: (d) => d.color, getWidth: (d) => d.width, widthUnits: 'pixels', getHeight: 0.3,
      updateTriggers: { getWidth: [m.selection, m.fresh], getSourceColor: [m.fresh], getTargetColor: [m.fresh] },
      onClick: (info) => {
        if (info.object) m.onClick?.({ kind: 'route', id: (info.object as Arc).id });
      },
    }),
  );

  const visible: MapAirport[] = m.airports
    .filter((a) => a.sizeClass >= 3 || used.has(a.id) || bases.has(a.id) || m.zoom >= 4)
    .map((a) => ({ ...a, isBase: bases.has(a.id), active: used.has(a.id) }));
  const selectedAirport = m.selection?.kind === 'airport' ? m.selection.id : null;
  layers.push(
    new ScatterplotLayer<MapAirport>({
      id: 'airports', data: visible, pickable: true, stroked: true, radiusUnits: 'pixels', lineWidthUnits: 'pixels',
      getPosition: (a) => [a.lon, a.lat],
      getRadius: (a) => (a.isBase ? 6 : 1.5 + a.sizeClass * 0.6) + (a.id === selectedAirport ? 2 : 0),
      getFillColor: (a) => (a.isBase ? [20, 24, 33, 255] : a.active ? AIRPORT_ACTIVE : AIRPORT),
      getLineColor: (a) => (a.isBase || a.id === selectedAirport ? ACCENT : [0, 0, 0, 0]),
      getLineWidth: (a) => (a.isBase || a.id === selectedAirport ? 2 : 0),
      updateTriggers: { getRadius: [selectedAirport], getLineColor: [selectedAirport], getLineWidth: [selectedAirport] },
      onClick: (info) => {
        if (info.object) m.onClick?.({ kind: 'airport', id: (info.object as MapAirport).id });
      },
      onHover: (info) => m.onHover?.(info.object ? { airport: info.object as MapAirport, x: info.x, y: info.y } : null),
    }),
  );

  if (m.zoom >= 4) {
    layers.push(
      new TextLayer<MapAirport>({
        id: 'labels', data: visible.filter((a) => a.sizeClass >= 4 || a.isBase), getPosition: (a) => [a.lon, a.lat], getText: (a) => a.city,
        getSize: 12, getColor: [200, 206, 215, 200], getPixelOffset: [0, 14], fontFamily: 'Inter Variable, Inter, system-ui, sans-serif',
        fontWeight: 500, characterSet: 'auto', outlineWidth: 2, outlineColor: [11, 15, 21, 255], fontSettings: { sdf: true },
      }),
    );
  }
  return layers;
}
