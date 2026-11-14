import type { Route } from '@skyempire/shared';
export { routeChain, routeLegs, routeMarkets, pairKey } from '@skyempire/sim';
import { routeChain } from '@skyempire/sim';

/** "LHR → DXB → SIN". */
export const routeLabel = (r: Pick<Route, 'from' | 'to' | 'stops'>): string => routeChain(r).join(' → ');

/** "LHR–DXB–SIN" (compact, for lists and toasts). */
export const routeShort = (r: Pick<Route, 'from' | 'to' | 'stops'>): string => routeChain(r).join('–');
