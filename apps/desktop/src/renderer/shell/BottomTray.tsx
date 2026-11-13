import { cn } from '@skyempire/ui';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { useUi } from '../store';
import { t } from '../strings/en';

/** Collapsible table area under the map. */
export function BottomTray({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  const open = useUi((s) => s.trayOpen);
  const setTray = useUi((s) => s.setTray);
  return (
    <section aria-label={title} className={cn('absolute right-3 bottom-3 left-3 z-10 flex flex-col rounded-lg border border-border bg-surface-1/95 shadow-overlay backdrop-blur-md', open ? 'max-h-[42%]' : '')}>
      <header className="flex h-11 shrink-0 items-center gap-3 px-4">
        <h2 className="font-semibold">{title}</h2>
        <div className="ml-auto flex items-center gap-2">
          {action}
          <button type="button" aria-label={open ? t.tray.hide : t.tray.show} aria-expanded={open} onClick={() => setTray(!open)} className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-text">
            {open ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
          </button>
        </div>
      </header>
      {open && <div className="min-h-0 flex-1 overflow-hidden border-t border-border">{children}</div>}
    </section>
  );
}
