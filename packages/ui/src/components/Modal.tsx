import { Dialog } from 'radix-ui';
import { X } from 'lucide-react';
import { useLayoutEffect, useRef, type ReactNode } from 'react';

export interface ModalProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, onOpenChange, title, description, children, footer }: ModalProps) {
  // Radix only restores focus to its own Trigger; our modals open from ordinary buttons, so remember the opener.
  const opener = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (open) opener.current = document.activeElement as HTMLElement | null;
  }, [open]);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="se-overlay fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            opener.current?.focus();
          }}
          className="se-content fixed top-1/2 left-1/2 z-50 w-[min(480px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface-2 p-6 shadow-overlay">
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title className="text-[20px] font-semibold tracking-[-0.02em]">{title}</Dialog.Title>
            <Dialog.Close aria-label="Close" className="rounded-md p-1 text-muted hover:bg-surface-3 hover:text-text">
              <X className="size-4" />
            </Dialog.Close>
          </div>
          {description ? <Dialog.Description className="mt-2 text-muted">{description}</Dialog.Description> : <Dialog.Description className="sr-only">{title}</Dialog.Description>}
          {children && <div className="mt-4">{children}</div>}
          {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
