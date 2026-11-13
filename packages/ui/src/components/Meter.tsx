import { cn } from '../cn';

export function Meter({ value, max = 1, label, tone = 'accent', showValue = true, format }: {
  value: number; max?: number; label: string; tone?: 'accent' | 'success' | 'warning' | 'danger'; showValue?: boolean; format?(v: number): string;
}) {
  const pct = Math.max(0, Math.min(1, value / max));
  const fill = { accent: 'bg-accent', success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger' }[tone];
  return (
    <div className="flex items-center gap-2" role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div className="h-1.5 min-w-12 flex-1 overflow-hidden rounded-full bg-surface-3">
        <div className={cn('h-full w-full origin-left rounded-full transition-transform duration-[var(--dur-3)] ease-[var(--ease-out)]', fill)} style={{ transform: `scaleX(${pct})` }} />
      </div>
      {showValue && <span className="num w-10 text-right text-[13px] text-muted">{format ? format(value) : `${Math.round(pct * 100)}%`}</span>}
    </div>
  );
}
