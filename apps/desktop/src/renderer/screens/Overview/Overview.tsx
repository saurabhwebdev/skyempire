import type { AirlineDaily } from '@skyempire/shared';
import { formatMoney } from '@skyempire/shared';
import { Button, cn, EmptyState, KpiTile, Meter, Panel } from '@skyempire/ui';
import { Check, CircleAlert, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { useGameStore, useUi } from '../../store';
import { Profit } from '../Network/NetworkTray';
import { AirlineLogo } from '../../components/AirlineLogo';
import { deriveAlerts } from './alerts';
import { PeaksCard } from './PeaksCard';
import { WeatherCard } from './WeatherCard';

const card = (i: number) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, delay: Math.min(i, 7) * 0.03, ease: [0.16, 1, 0.3, 1] as const } },
});

export function Overview() {
  const view = useGameStore((s) => s.view)!;
  const [history, setHistory] = useState<AirlineDaily[]>([]);
  useEffect(() => {
    void window.game.history(view.player.id, Math.max(0, view.day - 30), view.day).then(setHistory);
    // Refresh weekly to keep IPC light.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.player.id, Math.floor(view.day / 7)]);
  const alerts = useMemo(() => deriveAlerts(view), [view]);
  const profit30 = history.reduce((s, d) => s + d.revenue - Object.values(d.costs).reduce((a, b) => a + b, 0), 0);
  const top = [...view.routes].filter((r) => r.last).sort((a, b) => b.last!.profit - a.last!.profit).slice(0, 5);
  const rivals = [...view.rivals].sort((a, b) => b.overlapRoutes - a.overlapRoutes || b.routeCount - a.routeCount).slice(0, 4);

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
      <motion.div {...card(0)}>
        <Panel title="Cash">
          <KpiTile label="Available" value={formatMoney(view.player.cash)} sparkline={history.map((d) => d.cash)} />
          <p className="mt-3 text-[13px] text-muted">
            Last 30 days: <Profit value={profit30} />
          </p>
        </Panel>
      </motion.div>

      <motion.div {...card(1)}>
        <Panel title="Needs attention">
          {alerts.length === 0 ? (
            <EmptyState icon={<Sparkles />} text="All clear. Your airline is running smoothly." />
          ) : (
            <ul className="flex flex-col gap-2">
              {alerts.slice(0, 5).map((a) => (
                <li key={a.id} className="flex items-start gap-3 rounded-md bg-surface-2 p-3">
                  <CircleAlert className={cn('mt-0.5 size-4 shrink-0', a.level === 'danger' ? 'text-danger' : 'text-warning')} />
                  <span className="flex-1 text-[13px]">{a.text}</span>
                  <Button size="sm" onClick={a.action.run}>{a.action.label}</Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </motion.div>

      <motion.div {...card(2)}>
        <Panel title="Goals">
          <ul className="flex flex-col gap-2">
            {view.objectives.map((o) => (
              <li key={o.id} className={cn('flex items-center gap-3 text-[14px]', o.done && 'text-muted line-through')}>
                <span className={cn('grid size-5 shrink-0 place-items-center rounded-full border', o.done ? 'border-success bg-success text-bg' : 'border-border-strong')}>
                  {o.done && <motion.span initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}><Check className="size-3.5" /></motion.span>}
                </span>
                {o.title}
              </li>
            ))}
          </ul>
        </Panel>
      </motion.div>

      <motion.div {...card(3)}>
        <Panel title="Top routes">
          {top.length === 0 ? (
            <p className="text-muted">Your best routes will show here once you're flying.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {top.map((r) => (
                <li key={r.id} className="flex items-center justify-between">
                  <button type="button" className="font-mono hover:text-accent" onClick={() => useUi.setState({ section: 'network', selection: { kind: 'route', id: r.id } })}>{r.from} → {r.to}</button>
                  <Profit value={r.last!.profit} suffix="/day" />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </motion.div>

      <motion.div {...card(4)}>
        <Panel title="Reputation">
          <div className="flex items-baseline justify-between">
            <span className="num text-[30px] font-semibold">{Math.round(view.player.reputation)}</span>
            <span className="text-[13px] text-muted">out of 100</span>
          </div>
          <Meter label="Reputation" value={view.player.reputation} max={100} showValue={false} tone={view.player.reputation >= 60 ? 'success' : view.player.reputation >= 40 ? 'accent' : 'warning'} />
          <p className="mt-3 text-[13px] text-muted">Driven by punctuality, service, fleet age, fair prices and marketing.</p>
        </Panel>
      </motion.div>

      <motion.div {...card(5)}>
        <PeaksCard />
      </motion.div>

      <motion.div {...card(6)}>
        <WeatherCard />
      </motion.div>

      <motion.div {...card(7)}>
        <Panel title="Rival watch">
          <ul className="flex flex-col gap-2">
            {rivals.map((r) => (
              <li key={r.id} className="flex items-center gap-3">
                <AirlineLogo code={r.code} name={r.name} color={r.color} size={24} />
                <span className="flex-1 truncate">{r.name}</span>
                <span className="num text-[13px] text-muted">{r.routeCount} routes{r.overlapRoutes ? ` · ${r.overlapRoutes} vs you` : ''}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </motion.div>
    </div>
  );
}
