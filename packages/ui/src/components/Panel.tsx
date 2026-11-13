import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

export function Panel({ title, action, children, className, ...rest }: { title?: ReactNode; action?: ReactNode } & HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn('rounded-lg border border-border bg-surface-1 p-4', className)} {...rest}>
      {(title || action) && (
        <header className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="text-[16px] font-semibold tracking-[-0.01em]">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
