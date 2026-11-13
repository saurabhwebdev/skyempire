import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '../cn';

export interface NumberInputProps {
  label: string;
  value: number;
  onChange(v: number): void;
  min?: number;
  max?: number;
  step?: number;
  prefix?: ReactNode;
  suffix?: ReactNode;
  hint?: ReactNode;
  error?: string;
  className?: string;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Labelled number field: ↑/↓ steps, Shift = ×10, wheel while focused. */
export function NumberInput({ label, value, onChange, min = -Infinity, max = Infinity, step = 1, prefix, suffix, hint, error, className }: NumberInputProps) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (v: number) => onChange(clamp(Math.round(v / step) * step, min, max));
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') {
      if (e.key === 'Enter' && draft !== null) {
        commit(Number(draft.replace(/[^\d.-]/g, '')) || 0);
        setDraft(null);
      }
      return;
    }
    e.preventDefault();
    const d = (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
    setDraft(null);
    commit(value + d);
  };
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="text-[13px] font-semibold text-muted">
        {label}
      </label>
      <div
        className={cn(
          'flex h-10 items-center gap-1 rounded-md border bg-surface-1 px-3 transition-colors duration-[var(--dur-1)] focus-within:border-accent',
          error ? 'border-danger' : 'border-border-strong',
        )}
      >
        {prefix && <span className="text-faint">{prefix}</span>}
        <input
          id={id}
          inputMode="numeric"
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${id}-help` : undefined}
          className="num w-full min-w-0 bg-transparent text-text outline-none"
          value={draft ?? String(value)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft !== null) commit(Number(draft.replace(/[^\d.-]/g, '')) || 0);
            setDraft(null);
          }}
          onKeyDown={onKey}
          onWheel={(e) => {
            if (document.activeElement !== e.currentTarget) return;
            commit(value + (e.deltaY < 0 ? step : -step));
          }}
        />
        {suffix && <span className="text-faint">{suffix}</span>}
      </div>
      {(error || hint) && (
        <p id={`${id}-help`} className={cn('text-[12px]', error ? 'text-danger' : 'text-faint')}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
