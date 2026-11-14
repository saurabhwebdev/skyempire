import { cn, Tooltip } from '@skyempire/ui';
import { BadgeCheck, ChartColumn, LayoutDashboard, Newspaper, Plane, Waypoints, Wallet, type LucideIcon } from 'lucide-react';
import { SECTIONS, useUi, type Section } from '../store';
import { t } from '../strings/en';

const ICONS: Record<Section, LucideIcon> = {
  overview: LayoutDashboard, network: Waypoints, fleet: Plane, finance: Wallet, market: ChartColumn, airline: BadgeCheck, news: Newspaper,
};

export function NavRail() {
  const { section, setSection } = useUi();
  return (
    <nav aria-label="Sections" className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-border bg-surface-1 py-2">
      {SECTIONS.map((s, i) => {
        const Icon = ICONS[s];
        const active = section === s;
        return (
          <Tooltip key={s} content={
            <span className="inline-flex items-center gap-2">
              {t.sections[s]}
              <kbd aria-label={`Shortcut ${i + 1}`} className="num rounded border border-border bg-surface-3 px-1.5 text-[11px] leading-[18px] text-muted">{i + 1}</kbd>
            </span>
          }>
            <button
              type="button"
              aria-label={t.sections[s]}
              aria-current={active ? 'page' : undefined}
              onClick={() => setSection(s)}
              className={cn(
                'relative grid size-10 place-items-center rounded-md transition-colors duration-[var(--dur-1)]',
                active ? 'bg-surface-3 text-text' : 'text-faint hover:bg-surface-2 hover:text-text',
              )}
            >
              {active && <span aria-hidden className="absolute top-2 bottom-2 -left-2 w-0.5 rounded-full bg-accent" />}
              <Icon className="size-5" strokeWidth={1.5} />
            </button>
          </Tooltip>
        );
      })}
    </nav>
  );
}
