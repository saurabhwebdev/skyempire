import { Toast as T } from 'radix-ui';
import { X } from 'lucide-react';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { cn } from '../cn';

export interface ToastItem {
  id: string;
  title: string;
  body?: string;
  tone?: 'info' | 'success' | 'warning' | 'danger';
  action?: { label: string; onClick(): void };
}

const Ctx = createContext<(t: Omit<ToastItem, 'id'>) => void>(() => {});
export const useToast = () => useContext(Ctx);

let seq = 0;

/** Bottom-right toasts, at most 3, auto-dismiss after 4 s. */
export function Toaster({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((t: Omit<ToastItem, 'id'>) => setItems((xs) => [...xs, { ...t, id: `t${++seq}` }].slice(-3)), []);
  const tone = { info: 'border-l-accent', success: 'border-l-success', warning: 'border-l-warning', danger: 'border-l-danger' };
  return (
    <Ctx.Provider value={push}>
      <T.Provider duration={4000} swipeDirection="right">
        {children}
        {items.map((t) => (
          <T.Root
            key={t.id}
            onOpenChange={(open) => !open && setItems((xs) => xs.filter((x) => x.id !== t.id))}
            className={cn('se-enter flex items-start gap-3 rounded-lg border border-l-4 border-border bg-surface-2 p-3 shadow-overlay', tone[t.tone ?? 'info'])}
          >
            <div className="flex-1">
              <T.Title className="font-semibold">{t.title}</T.Title>
              {t.body && <T.Description className="mt-0.5 text-[13px] text-muted">{t.body}</T.Description>}
            </div>
            {t.action && (
              <T.Action altText={t.action.label} asChild>
                <button className="text-[13px] font-semibold text-accent hover:underline" onClick={t.action.onClick}>
                  {t.action.label}
                </button>
              </T.Action>
            )}
            <T.Close aria-label="Dismiss" className="text-faint hover:text-text"><X className="size-4" /></T.Close>
          </T.Root>
        ))}
        <T.Viewport className="fixed right-4 bottom-4 z-50 flex w-[360px] max-w-[calc(100vw-32px)] flex-col gap-2 outline-none" />
      </T.Provider>
    </Ctx.Provider>
  );
}
