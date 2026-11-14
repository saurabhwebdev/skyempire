import type { Route } from '@skyempire/shared';

/** Every airport a route visits, in order: from, stops…, to. */
export const routeChain = (r: Pick<Route, 'from' | 'to' | 'stops'>): string[] => [r.from, ...(r.stops ?? []), r.to];

/** "LHR → DXB → SIN". */
export const routeLabel = (r: Pick<Route, 'from' | 'to' | 'stops'>): string => routeChain(r).join(' → ');
