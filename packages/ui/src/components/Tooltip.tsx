import { Tooltip as T } from 'radix-ui';
import type { ReactNode } from 'react';

export const TooltipProvider = ({ children }: { children: ReactNode }) => <T.Provider delayDuration={300}>{children}</T.Provider>;

export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content sideOffset={6} className="se-pop z-50 max-w-64 rounded-md border border-border bg-surface-3 px-3 py-2 text-[13px] text-text shadow-overlay">
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
