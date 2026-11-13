import type { ReactNode } from 'react';
import { cn } from '../cn';

export interface KpiTileProps {
  label: string;
  value: ReactNode;
  delta?: number;
  deltaLabel?: string;
  sparkline?: number[];
  className?: string;
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${28 - ((v - min) / span) * 26}`).join(' ');
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-8 w-full text-accent" aria-hidden>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function KpiTile({ label, value, delta, deltaLabel, sparkline, className }: KpiTileProps) {
  const up = (delta ?? 0) >= 0;
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <span className="label-caps">{label}</span>
      <div className="flex items-baseline gap-3">
        <span className="num text-[30px] font-semibold leading-none tracking-[-0.02em]">{value}</span>
        {delta !== undefined && (
          <span className={cn('num inline-flex items-center gap-1 text-[13px] font-semibold', up ? 'text-success' : 'text-danger')}>
            <span aria-hidden>{up ? '▲' : '▼'}</span>
            <span>{deltaLabel ?? `${up ? '+' : '−'}${Math.abs(delta)}`}</span>
          </span>
        )}
      </div>
      {sparkline && <Sparkline data={sparkline} />}
    </div>
  );
}
