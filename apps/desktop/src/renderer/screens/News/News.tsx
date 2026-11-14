import type { Notification } from '@skyempire/shared';
import { formatDate } from '@skyempire/sim';
import { cn, EmptyState } from '@skyempire/ui';
import { AlertTriangle, BadgeCheck, CloudLightning, Info, Newspaper, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useGameStore } from '../../store';

type Filter = 'all' | 'events' | 'rivals' | 'warnings';
const FILTERS: [Filter, string][] = [['all', 'All'], ['events', 'Events'], ['rivals', 'Rivals'], ['warnings', 'Warnings']];
const match = (f: Filter, n: Notification) =>
  f === 'all' || (f === 'events' && n.category === 'event') || (f === 'rivals' && n.category === 'rival') || (f === 'warnings' && n.level !== 'info');
const ICON = { event: CloudLightning, rival: Users, airline: Info, goal: BadgeCheck };

export function News() {
  const notes = useGameStore((s) => s.notifications);
  const markRead = useGameStore((s) => s.markRead);
  const startYear = useGameStore((s) => s.view?.startYear ?? 2026);
  const [filter, setFilter] = useState<Filter>('all');
  useEffect(() => markRead(), [markRead, notes.length]);
  const shown = notes.filter((n) => match(filter, n));
  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Filter news" className="flex w-fit rounded-md border border-border p-0.5">
        {FILTERS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}
            className={cn('h-8 rounded-[6px] px-3 text-[13px] font-semibold', filter === k ? 'bg-surface-3 text-text' : 'text-muted hover:text-text')}>{label}</button>
        ))}
      </div>
      {shown.length === 0 ? (
        <EmptyState icon={<Newspaper />} text="Nothing here yet. Events, rival moves and alerts will appear as days pass." />
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((n) => {
            const Icon = n.level !== 'info' ? AlertTriangle : ICON[n.category];
            return (
              <li key={n.id} className="se-enter flex items-start gap-3 rounded-lg border border-border bg-surface-1 p-4">
                <Icon className={cn('mt-0.5 size-4 shrink-0', n.level === 'major' ? 'text-danger' : n.level === 'warning' ? 'text-warning' : 'text-muted')} aria-hidden />
                <div className="flex-1">
                  <div className="font-semibold">{n.title}</div>
                  <p className="text-[13px] text-muted">{n.body}</p>
                </div>
                <time className="num shrink-0 text-[12px] text-faint">{formatDate(n.day, startYear)}</time>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
