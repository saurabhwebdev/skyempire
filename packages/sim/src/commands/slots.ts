import type { GameState } from '@skyempire/shared';
import { slotsNeeded } from '../ops';

/** Rebuild slot usage from all active routes (cheap; avoids drift). */
export function recomputeSlots(state: GameState): void {
  const used: Record<string, number> = {};
  for (const r of Object.values(state.routes)) {
    if (r.status !== 'active') continue;
    const n = slotsNeeded(r.assignments.reduce((s, a) => s + a.roundTripsPerWeek, 0));
    used[r.from] = (used[r.from] ?? 0) + n;
    used[r.to] = (used[r.to] ?? 0) + n;
    // A stop sees an arrival and a departure in each direction: twice the slots.
    for (const st of r.stops ?? []) used[st] = (used[st] ?? 0) + 2 * n;
  }
  state.slotsUsed = used;
}
