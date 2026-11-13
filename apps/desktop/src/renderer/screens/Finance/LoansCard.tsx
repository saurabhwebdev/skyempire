import { formatMoney } from '@skyempire/shared';
import { BALANCE } from '@skyempire/sim';
import { Button, NumberInput, Panel, useToast } from '@skyempire/ui';
import { useState } from 'react';
import { useGameStore } from '../../store';

export function LoansCard() {
  const view = useGameStore((s) => s.view)!;
  const toast = useToast();
  const al = view.player;
  const avail = view.finance.availableCredit;
  const [amount, setAmount] = useState(Math.min(10_000_000, Math.max(1_000_000, Math.floor(avail / 1e6) * 1e6)));
  const rate = BALANCE.ratingRates[al.creditRating];
  const take = async () => {
    const r = await window.game.command({ type: 'takeLoan', amount });
    toast(r.ok ? { title: `Borrowed ${formatMoney(amount)}`, tone: 'success' } : { title: r.reason, tone: 'danger' });
  };
  const repay = async (loanId: string, principal: number) => {
    const pay = Math.min(principal, Math.max(0, al.cash));
    const r = await window.game.command({ type: 'repayLoan', loanId, amount: pay });
    toast(r.ok ? { title: `Repaid ${formatMoney(pay)}`, tone: 'success' } : { title: r.reason, tone: 'danger' });
  };
  return (
    <Panel title="Loans" action={<span className="rounded-full bg-surface-3 px-2 py-0.5 text-[12px] font-semibold">Credit rating {al.creditRating}</span>}>
      <p className="num mb-3 text-[13px] text-muted">You can borrow up to {formatMoney(avail)} at {(rate * 100).toFixed(0)}% a year.</p>
      <div className="flex items-end gap-2">
        <NumberInput label="Loan amount" prefix="$" value={amount} min={100_000} max={Math.max(100_000, avail)} step={1_000_000} onChange={setAmount} className="flex-1" />
        <Button variant="primary" disabled={avail < 100_000} onClick={take}>Take {formatMoney(amount)} loan</Button>
      </div>
      <p className="num mt-2 text-[13px] text-muted">Interest: {formatMoney((amount * rate) / 12)}/month at {(rate * 100).toFixed(0)}%</p>
      {al.loans.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {al.loans.map((l) => (
            <li key={l.id} className="flex items-center justify-between rounded-md bg-surface-2 p-3">
              <span className="num">{formatMoney(l.principal)} <span className="text-muted">at {(l.annualRate * 100).toFixed(0)}%</span></span>
              <Button size="sm" onClick={() => repay(l.id, l.principal)} disabled={al.cash <= 0}>Repay {formatMoney(Math.min(l.principal, Math.max(0, al.cash)))}</Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
