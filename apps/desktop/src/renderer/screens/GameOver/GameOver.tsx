import type { AirlineDaily } from '@skyempire/shared';
import { formatMoney, formatPax } from '@skyempire/shared';
import { formatDate } from '@skyempire/sim';
import { Button, KpiTile, Panel } from '@skyempire/ui';
import { useEffect, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useGameStore, useUi } from '../../store';

export function GameOver() {
  const view = useGameStore((s) => s.view);
  const [history, setHistory] = useState<AirlineDaily[]>([]);
  useEffect(() => {
    if (view) void window.game.history(view.player.id, 0, view.day).then(setHistory);
  }, [view]);
  if (!view) return null;
  const peakCash = history.reduce((m, d) => Math.max(m, d.cash), view.player.cash);
  const worst = [...view.routes].map((r) => ({ r, p: r.profit30.reduce((a, b) => a + b, 0) })).sort((a, b) => a.p - b.p)[0];
  const hints = [
    worst && worst.p < 0 ? `Most of your recent losses came from ${worst.r.from}–${worst.r.to} (${formatMoney(worst.p)} in 30 days).` : null,
    view.player.loans.length ? 'Debt interest kept draining cash — borrow only for aircraft that will earn it back.' : null,
    'Watch the Overview alerts: idle aircraft and losing routes cost money every day.',
  ].filter(Boolean) as string[];
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="se-enter flex w-full max-w-[760px] flex-col gap-6">
        <header className="text-center">
          <p className="label-caps">Game over</p>
          <h1 className="mt-2 text-[48px] font-semibold tracking-[-0.03em]">{view.player.name} has gone bankrupt</h1>
          <p className="mt-2 text-muted">Out of cash and credit on {formatDate(view.gameOver?.day ?? view.day)}.</p>
        </header>
        <div className="grid grid-cols-3 gap-4 rounded-lg border border-border bg-surface-1 p-4">
          <KpiTile label="Days flown" value={String(view.day)} />
          <KpiTile label="Passengers" value={formatPax(view.player.totals.pax)} />
          <KpiTile label="Peak cash" value={formatMoney(peakCash)} />
        </div>
        {history.length > 1 && (
          <Panel title="Cash over time">
            <div className="h-48">
              <ResponsiveContainer>
                <LineChart data={history.map((d) => ({ day: formatDate(d.day), cash: d.cash }))}>
                  <XAxis dataKey="day" stroke="var(--text-faint)" fontSize={12} tickLine={false} axisLine={false} minTickGap={48} />
                  <YAxis tickFormatter={(v: number) => formatMoney(v)} stroke="var(--text-faint)" fontSize={12} tickLine={false} axisLine={false} width={64} />
                  <Tooltip formatter={(v) => formatMoney(Number(v))} contentStyle={{ background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 8 }} />
                  <Line dataKey="cash" name="Cash" stroke="#2f95cf" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        )}
        <Panel title="What to try next time">
          <ul className="list-disc pl-5 text-muted">{hints.map((h) => <li key={h}>{h}</li>)}</ul>
        </Panel>
        <div className="flex justify-center gap-3">
          <Button variant="primary" onClick={() => useUi.getState().setScreen('newAirline')}>New career</Button>
          <Button onClick={() => useUi.getState().setScreen('title')}>Load a save</Button>
        </div>
      </div>
    </main>
  );
}
