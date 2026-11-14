import { formatMoney } from '@skyempire/shared';
import { formatDate } from '@skyempire/sim';
import { cn, Tooltip } from '@skyempire/ui';
import { Bell, Menu, Pause, Play } from 'lucide-react';
import { motion } from 'motion/react';
import { SPEEDS, useGameStore, useUi } from '../store';
import { AirlineLogo } from '../components/AirlineLogo';
import { t } from '../strings/en';

export function TopBar() {
  const view = useGameStore((s) => s.view);
  const delta = useGameStore((s) => s.cashDelta);
  const unread = useGameStore((s) => s.unread);
  const { speed, setSpeed, lastSpeed, setMenu, setSection } = useUi();
  if (!view) return null;
  const al = view.player;
  return (
    <header className="flex h-12 shrink-0 items-center gap-4 border-b border-border bg-surface-1 px-4">
      <div className="flex min-w-0 items-center gap-2">
        <span aria-hidden className="text-accent">◆</span>
        <AirlineLogo code={al.code} name={al.name} color={al.colors.primary} size={24} file="__player" />
        <span className="truncate font-semibold">{al.name}</span>
      </div>

      <div className="ml-auto flex items-center gap-3" aria-live="polite">
        <span className="num text-[18px] font-semibold tracking-[-0.01em]">{formatMoney(al.cash)}</span>
        {delta !== null && delta !== 0 && (
          <motion.span
            key={view.day}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={cn('num inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold', delta > 0 ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger')}
          >
            <span aria-hidden>{delta > 0 ? '▲' : '▼'}</span>
            <span>{formatMoney(Math.abs(delta))}</span>
          </motion.span>
        )}
      </div>

      <span className="num w-28 text-right text-muted">{formatDate(view.day, view.startYear)}</span>

      <div role="group" aria-label="Game speed" className="flex items-center rounded-md border border-border bg-bg p-0.5">
        <button
          type="button"
          aria-label={speed === 0 ? t.speed.play : t.speed.pause}
          aria-pressed={speed === 0}
          onClick={() => setSpeed(speed === 0 ? lastSpeed : 0)}
          className={cn('grid size-8 place-items-center rounded-[6px] transition-colors duration-[var(--dur-1)]', speed === 0 ? 'bg-surface-3 text-warning' : 'text-muted hover:text-text')}
        >
          {speed === 0 ? <Play className="size-4" /> : <Pause className="size-4" />}
        </button>
        {SPEEDS.filter((s) => s > 0).map((s) => (
          <button
            key={s}
            type="button"
            aria-label={t.speed.label(s)}
            aria-pressed={speed === s}
            onClick={() => setSpeed(s)}
            className={cn('num h-8 rounded-[6px] px-2 text-[13px] font-semibold transition-colors duration-[var(--dur-1)]', speed === s ? 'bg-accent text-accent-contrast' : 'text-muted hover:text-text')}
          >
            {s}×
          </button>
        ))}
      </div>

      <Tooltip content={t.topbar.notifications(unread)}>
        <button type="button" aria-label={t.topbar.notifications(unread)} onClick={() => setSection('news')} className="relative grid size-9 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-text">
          <Bell className="size-5" />
          {unread > 0 && (
            <motion.span
              key={unread}
              initial={{ scale: 0.6 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 28 }}
              className="num absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-accent px-1 text-[10px] font-semibold leading-4 text-accent-contrast"
            >
              {unread > 99 ? '99+' : unread}
            </motion.span>
          )}
        </button>
      </Tooltip>
      <button type="button" aria-label={t.topbar.menu} onClick={() => setMenu(true)} className="grid size-9 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-text">
        <Menu className="size-5" />
      </button>
    </header>
  );
}
