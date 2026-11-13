import type { CabinClass, Money } from '@skyempire/shared';
import { BALANCE } from './config/balance';

export interface Offer {
  airlineId: string;
  routeId: string;
  fare: Money;
  weeklyFrequency: number;
  quality: number;
  reputation: number;
  stops: number;
  seats: number; // per day, this direction, this class
}

export function utility(o: Offer, ref: Money, cls: CabinClass): number {
  return (
    -BALANCE.betaPrice[cls] * (o.fare / ref) +
    BALANCE.betaFrequency * Math.log(Math.max(1, o.weeklyFrequency)) +
    BALANCE.betaQuality * (o.quality / 100) +
    BALANCE.betaReputation * (o.reputation / 100) -
    BALANCE.betaStops * o.stops
  );
}

/** Logit split of demand among offers (+ a "don't fly" option), capped by seats, with one spill pass. */
export function allocate(demand: number, offers: Offer[], ref: Money, cls: CabinClass): Map<string, number> {
  const result = new Map<string, number>(offers.map((o) => [o.routeId, 0]));
  if (demand <= 0 || offers.length === 0) return result;
  const w = offers.map((o) => Math.exp(utility(o, ref, cls)));
  const none = Math.exp(BALANCE.utilityNone);
  const sum = w.reduce((a, b) => a + b, 0) + none;

  let unserved = 0;
  offers.forEach((o, i) => {
    const want = (demand * w[i]!) / sum;
    const got = Math.min(want, o.seats);
    result.set(o.routeId, got);
    unserved += want - got;
  });

  // One spill pass: re-offer unserved passengers to offers with free seats (renormalized, "none" included).
  if (unserved > 1e-9) {
    const open = offers.map((o, i) => ({ o, i, free: o.seats - result.get(o.routeId)! })).filter((x) => x.free > 1e-9);
    const s2 = open.reduce((a, x) => a + w[x.i]!, 0) + none;
    for (const x of open) {
      const extra = Math.min((unserved * w[x.i]!) / s2, x.free);
      result.set(x.o.routeId, result.get(x.o.routeId)! + extra);
    }
  }
  return result;
}
