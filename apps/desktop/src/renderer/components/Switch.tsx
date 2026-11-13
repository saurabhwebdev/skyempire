import { cn } from '@skyempire/ui';
import { motion } from 'motion/react';
import { useId } from 'react';

export function Switch({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange(v: boolean): void }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div>
        <label htmlFor={id} className="font-semibold">{label}</label>
        {hint && <p className="text-[13px] text-muted">{hint}</p>}
      </div>
      <button id={id} type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
        className={cn('relative h-6 w-10 shrink-0 rounded-full transition-colors duration-[var(--dur-1)]', checked ? 'bg-accent' : 'bg-surface-3')}>
        <motion.span layout transition={{ type: 'spring', stiffness: 500, damping: 32 }}
          className={cn('absolute top-0.5 size-5 rounded-full bg-white shadow', checked ? 'right-0.5' : 'left-0.5')} />
      </button>
    </div>
  );
}
