import { cn } from '../cn';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('relative overflow-hidden rounded-md bg-surface-2', className)}>
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/5 to-transparent [animation:se-shimmer_1.5s_infinite]" />
    </div>
  );
}
