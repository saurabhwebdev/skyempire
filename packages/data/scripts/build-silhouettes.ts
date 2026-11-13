/**
 * Generates side and top silhouettes for every aircraft from real dimensions
 * (length, wingspan, fuselage width, wing position, engine type). Drawn by SkyEmpire — no third-party artwork.
 * Run: node packages/data/scripts/build-silhouettes.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface Dims { length: number; span: number; diam: number; prop: boolean; sweep: number }
// Length / wingspan (m) from manufacturer spec sheets; fuselage width (m) approximate.
const DIMS: Record<string, Dims> = {
  AT46: { length: 22.67, span: 24.57, diam: 2.57, prop: true, sweep: 0 },
  AT76: { length: 27.17, span: 27.05, diam: 2.57, prop: true, sweep: 0 },
  DH8D: { length: 32.8, span: 28.4, diam: 2.69, prop: true, sweep: 0 },
  E175: { length: 31.68, span: 26.0, diam: 3.01, prop: false, sweep: 23 },
  E295: { length: 41.5, span: 35.1, diam: 3.01, prop: false, sweep: 25 },
  BCS1: { length: 35.0, span: 35.1, diam: 3.7, prop: false, sweep: 25 },
  BCS3: { length: 38.7, span: 35.1, diam: 3.7, prop: false, sweep: 25 },
  A320: { length: 37.57, span: 35.8, diam: 3.95, prop: false, sweep: 25 },
  A19N: { length: 33.84, span: 35.8, diam: 3.95, prop: false, sweep: 25 },
  A20N: { length: 37.57, span: 35.8, diam: 3.95, prop: false, sweep: 25 },
  A21N: { length: 44.51, span: 35.8, diam: 3.95, prop: false, sweep: 25 },
  A21X: { length: 44.51, span: 35.8, diam: 3.95, prop: false, sweep: 25 },
  B738: { length: 39.5, span: 35.8, diam: 3.76, prop: false, sweep: 25 },
  B38M: { length: 39.52, span: 35.9, diam: 3.76, prop: false, sweep: 25 },
  A333: { length: 63.67, span: 60.3, diam: 5.64, prop: false, sweep: 30 },
  A339: { length: 63.66, span: 64.0, diam: 5.64, prop: false, sweep: 30 },
  B789: { length: 62.8, span: 60.1, diam: 5.77, prop: false, sweep: 32 },
  A359: { length: 66.8, span: 64.75, diam: 5.96, prop: false, sweep: 31 },
  B77W: { length: 73.9, span: 64.8, diam: 6.2, prop: false, sweep: 31 },
};

const f = (n: number) => n.toFixed(2);
const svg = (w: number, h: number, d: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><path fill="currentColor" d="${d}"/></svg>\n`;
const rect = (x: number, y: number, w: number, h: number) => `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}Z`;
const poly = (pts: [number, number][]) => 'M' + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L') + 'Z';
const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${f(cx - rx)} ${f(cy)}a${f(rx)} ${f(ry)} 0 1 1 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 1 ${f(-2 * rx)} 0Z`;

function side(d: Dims): string {
  const s = 96 / d.length;
  const L = d.length * s, h = d.diam * s, x0 = 2, cy = 26, top = cy - h / 2, bot = cy + h / 2;
  const noseLen = h * 1.4, tailLen = L * 0.22;
  const body = poly([
    [x0 + noseLen, top], [x0 + L - tailLen, top], [x0 + L, top + h * 0.15], [x0 + L, top + h * 0.35],
    [x0 + L - tailLen, bot], [x0 + noseLen, bot],
  ]);
  const nose = ellipse(x0 + noseLen, cy, noseLen, h / 2);
  const finH = h * (d.prop ? 2.0 : 1.75);
  const fin = poly([[x0 + L - tailLen * 0.9, top], [x0 + L - tailLen * 0.15, top - finH], [x0 + L - 0.3, top - finH], [x0 + L, top + h * 0.1]]);
  const wingX = x0 + L * 0.38;
  const wing = d.prop ? rect(wingX, top - 0.6, L * 0.14, 0.9) : rect(wingX, bot - 0.9, L * 0.2, 0.9);
  const engine = d.prop
    ? rect(wingX - 1.5, top - 0.2, L * 0.12, h * 0.4) + rect(wingX - 1.9, top - h * 1.1, 0.6, h * 2.2)
    : ellipse(wingX + L * 0.03, bot + h * 0.3, L * 0.07, h * 0.3);
  return svg(100, 40, body + nose + fin + wing + engine);
}

function top(d: Dims): string {
  const s = 96 / Math.max(d.length, d.span);
  const L = d.length * s, W = d.span * s, w = d.diam * s, cx = 50, y0 = 50 - L / 2;
  const nose = ellipse(cx, y0 + w, w / 2, w);
  const body = rect(cx - w / 2, y0 + w, w, L - w * 2) + poly([[cx - w / 2, y0 + L - w], [cx + w / 2, y0 + L - w], [cx + w * 0.15, y0 + L], [cx - w * 0.15, y0 + L]]);
  const sweep = Math.tan((d.sweep * Math.PI) / 180) * (W / 2);
  const rootY = y0 + L * (d.prop ? 0.4 : 0.36), rootC = L * (d.prop ? 0.1 : 0.17), tipC = L * (d.prop ? 0.06 : 0.05);
  const wings = poly([
    [cx, rootY], [cx + W / 2, rootY + sweep], [cx + W / 2, rootY + sweep + tipC], [cx, rootY + rootC],
    [cx - W / 2, rootY + sweep + tipC], [cx - W / 2, rootY + sweep],
  ]);
  const tS = W * 0.34, tY = y0 + L * 0.86, tSweep = Math.tan(((d.sweep + 5) * Math.PI) / 180) * (tS / 2);
  const tail = poly([[cx, tY], [cx + tS / 2, tY + tSweep], [cx + tS / 2, tY + tSweep + L * 0.04], [cx, tY + L * 0.1],
    [cx - tS / 2, tY + tSweep + L * 0.04], [cx - tS / 2, tY + tSweep]]);
  const eOff = W * (d.prop ? 0.17 : 0.17), eY = rootY + sweep * (eOff / (W / 2)) - L * 0.05;
  const engines = [1, -1].map((k) => rect(cx + k * eOff - w * 0.28, eY, w * 0.56, L * (d.prop ? 0.14 : 0.1))).join('');
  return svg(100, 100, nose + body + wings + tail + engines);
}

const here = import.meta.dirname;
const out = join(here, '..', 'src', 'silhouettes');
mkdirSync(out, { recursive: true });
const aircraft = JSON.parse(readFileSync(join(here, '..', 'src', 'aircraft.json'), 'utf8')) as { id: string }[];
for (const a of aircraft) {
  const d = DIMS[a.id];
  if (!d) throw new Error(`No dimensions for ${a.id}`);
  writeFileSync(join(out, `${a.id}-side.svg`), side(d));
  writeFileSync(join(out, `${a.id}-top.svg`), top(d));
}
console.log(`Wrote ${aircraft.length * 2} silhouettes`);
