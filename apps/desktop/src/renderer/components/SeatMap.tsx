import type { CabinConfig } from '@skyempire/shared';
import { catalog } from '../lib/catalog';
import { economyAbreast, rowShape } from '../lib/aircraftMedia';

const COLOR = { business: 'var(--color-warning)', premium: 'var(--color-success)', economy: 'var(--color-accent)' } as const;
/** Seat width (across) and row pitch (along), in drawing units; bigger seats take more floor. */
const SEAT_W = { business: 1.5, premium: 1.1, economy: 0.9 } as const;
const PITCH: Record<string, number> = {
  'economy:slimline': 0.9, 'economy:standard': 1, 'economy:extraLegroom': 1.15,
  'premium:recliner': 1.35, 'premium:legRest': 1.5,
  'business:recliner': 1.7, 'business:angled': 2.1, 'business:flat': 2.4, 'business:suite': 2.7,
};
const LABEL = { business: 'Business', premium: 'Premium', economy: 'Economy' } as const;
const AISLE = 0.8;
const MAX_ROWS_DRAWN = 90;

/**
 * Top-down cabin map, nose on the left: one rounded square per seat, aisles between groups.
 * Rows follow the seat types (e.g. 1-2-1 lie-flat business). Generic layout, not a specific airline's seat map.
 */
export function SeatMap({ config, typeId, className }: { config: CabinConfig; typeId: string; className?: string }) {
  const t = catalog.aircraftTypes[typeId]!;
  const cabin = config.seats;
  const shape = rowShape(t.abreast ?? 6, config.product, economyAbreast(t, config.dense));
  const cabins = (['business', 'premium', 'economy'] as const).filter((k) => cabin[k] > 0);
  // Cross-section width is set by the economy row; other cabins spread across the same width.
  const yWidth = shape.economy.reduce((a, b) => a + b, 0) * SEAT_W.economy + (shape.economy.length - 1) * AISLE;
  const H = yWidth + 1.6;
  let x = 3.2; // after the nose
  const seats: { x: number; y: number; w: number; h: number; color: string }[] = [];
  const dividers: number[] = [];
  let rowsTotal = 0;
  for (const k of cabins) {
    const groups = shape[k];
    const perRow = groups.reduce((a, b) => a + b, 0);
    const rows = Math.ceil(cabin[k] / perRow);
    rowsTotal += rows;
    const pitch = PITCH[`${k}:${config.product[k].seat}`] ?? 1;
    const seatW = Math.min(SEAT_W[k], (yWidth - (groups.length - 1) * AISLE) / perRow);
    const aisle = (yWidth - perRow * seatW) / Math.max(1, groups.length - 1);
    let left = cabin[k];
    for (let r = 0; r < Math.min(rows, MAX_ROWS_DRAWN); r++) {
      let y = 0.8, inRow = Math.min(perRow, left);
      for (const g of groups) {
        for (let i = 0; i < g; i++) {
          if (inRow-- > 0) seats.push({ x, y, w: pitch * 0.72, h: seatW * 0.86, color: COLOR[k] });
          y += seatW;
        }
        y += aisle;
      }
      left -= perRow;
      x += pitch;
    }
    dividers.push(x + 0.2);
    x += 0.6;
  }
  const W = Math.max(x + 3.5, 20);
  const total = cabin.business + cabin.premium + cabin.economy;
  const r = H / 2;
  return (
    <figure className={className}>
      <svg viewBox={`-0.2 -0.2 ${W + 0.4} ${H + 0.4}`} role="img" preserveAspectRatio="xMidYMid meet" className="block h-auto w-full"
        aria-label={`Cabin layout: ${cabin.business} business, ${cabin.premium} premium, ${cabin.economy} economy seats`}>
        <path d={`M ${r * 1.6} 0 H ${W - r} Q ${W} 0 ${W} ${r} Q ${W} ${H} ${W - r} ${H} H ${r * 1.6} C ${-r * 0.5} ${H} ${-r * 0.5} 0 ${r * 1.6} 0 Z`}
          fill="var(--color-surface-3)" stroke="var(--color-border)" strokeWidth={0.12} />
        {seats.map((s, i) => <rect key={i} x={s.x} y={s.y + 0.05} width={s.w} height={s.h} rx={0.18} fill={s.color} />)}
        {dividers.slice(0, -1).map((d, i) => <line key={i} x1={d} x2={d} y1={0.5} y2={H - 0.5} stroke="var(--color-border)" strokeWidth={0.12} />)}
        {total === 0 && <text x={W / 2} y={H / 2} textAnchor="middle" dominantBaseline="middle" fontSize={1.2} fill="var(--color-muted)">No seats</text>}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
        {cabins.map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-sm" style={{ background: COLOR[k] }} />
            <span className="num">{cabin[k]}</span> {LABEL[k]} · {shape[k].join('-')}
          </span>
        ))}
        {total > 0 && <span className="num ml-auto">{rowsTotal} rows</span>}
      </figcaption>
    </figure>
  );
}
