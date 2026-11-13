import type { ReactNode } from 'react';

export function EmptyState({ icon, text, action }: { icon?: ReactNode; text: ReactNode; action?: ReactNode }) {
  return (
    <div className="se-enter flex flex-col items-center gap-3 px-6 py-10 text-center">
      {icon && <div className="text-faint [&>svg]:size-8">{icon}</div>}
      <p className="max-w-[40ch] text-muted">{text}</p>
      {action}
    </div>
  );
}
