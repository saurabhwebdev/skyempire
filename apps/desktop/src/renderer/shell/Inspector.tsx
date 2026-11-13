import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
import { useUi } from '../store';
import { t } from '../strings/en';

/** Right-hand details panel for the current selection (360 px; overlays the map below 1280 px). */
export function Inspector({ children }: { children: ReactNode }) {
  const selection = useUi((s) => s.selection);
  const select = useUi((s) => s.select);
  return (
    <AnimatePresence>
      {selection && (
        <motion.aside
          key={`${selection.kind}:${selection.id}`}
          aria-label="Details"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0, transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } }}
          exit={{ opacity: 0, x: 16, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
          className="absolute top-0 right-0 bottom-0 z-20 flex w-[360px] flex-col border-l border-border bg-surface-1/95 backdrop-blur-md max-[1279px]:shadow-overlay min-[1280px]:relative"
        >
          <button type="button" aria-label={t.inspector.close} onClick={() => select(null)} className="absolute top-3 right-3 z-10 rounded-md p-1 text-muted hover:bg-surface-3 hover:text-text">
            <X className="size-4" />
          </button>
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
