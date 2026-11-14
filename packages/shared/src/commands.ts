import { z } from 'zod';
import type { Assignment, Cabin, CabinClass, Money, SeasonalFare } from './types';

const money = z.number().int().nonnegative();
const positiveMoney = z.number().int().positive();
const code = z.string().min(3).max(4);
const id = z.string().min(1);

export const CabinSchema = z.object({
  economy: z.number().int().nonnegative(),
  premium: z.number().int().nonnegative(),
  business: z.number().int().nonnegative(),
});
export const FaresSchema = z.object({ economy: positiveMoney, premium: positiveMoney, business: positiveMoney });
export const SeasonalFareSchema = z
  .object({ startDay: z.number().int().nonnegative(), endDay: z.number().int().nonnegative(), pct: z.number().int().min(-50).max(100) })
  .refine((f) => f.endDay >= f.startDay, { message: 'A seasonal fare must end on or after its start' });
export const AssignmentSchema = z.object({ aircraftId: id, roundTripsPerWeek: z.number().int().min(1).max(200) });

export const CommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('leaseAircraft'), typeId: id, cabin: CabinSchema }),
  z.object({ type: z.literal('buyAircraft'), typeId: id, cabin: CabinSchema }),
  z.object({ type: z.literal('buyUsedAircraft'), listingId: id, cabin: CabinSchema }),
  z.object({ type: z.literal('sellAircraft'), aircraftId: id }),
  z.object({ type: z.literal('setCabin'), aircraftId: id, cabin: CabinSchema }),
  z
    .object({
      type: z.literal('openRoute'),
      from: code,
      to: code,
      fares: FaresSchema,
      assignments: z.array(AssignmentSchema).min(1),
    })
    .refine((c) => c.from !== c.to, { message: 'A route needs two different airports' }),
  z.object({
    type: z.literal('updateRoute'),
    routeId: id,
    fares: FaresSchema.optional(),
    assignments: z.array(AssignmentSchema).optional(),
    seasonalFares: z.array(SeasonalFareSchema).max(4).optional(),
  }),
  z.object({ type: z.literal('closeRoute'), routeId: id }),
  z.object({ type: z.literal('openBase'), airportId: code }),
  z.object({ type: z.literal('closeBase'), airportId: code }),
  z.object({ type: z.literal('takeLoan'), amount: positiveMoney }),
  z.object({ type: z.literal('repayLoan'), loanId: id, amount: positiveMoney }),
  z.object({ type: z.literal('setServiceLevel'), level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]) }),
  z.object({ type: z.literal('setMarketing'), perMonth: money }),
]);

type Fares = Record<CabinClass, Money>;
export type Command =
  | { type: 'leaseAircraft'; typeId: string; cabin: Cabin }
  | { type: 'buyAircraft'; typeId: string; cabin: Cabin }
  | { type: 'buyUsedAircraft'; listingId: string; cabin: Cabin }
  | { type: 'sellAircraft'; aircraftId: string }
  | { type: 'setCabin'; aircraftId: string; cabin: Cabin }
  | { type: 'openRoute'; from: string; to: string; fares: Fares; assignments: Assignment[] }
  | { type: 'updateRoute'; routeId: string; fares?: Fares; assignments?: Assignment[]; seasonalFares?: SeasonalFare[] }
  | { type: 'closeRoute'; routeId: string }
  | { type: 'openBase'; airportId: string }
  | { type: 'closeBase'; airportId: string }
  | { type: 'takeLoan'; amount: Money }
  | { type: 'repayLoan'; loanId: string; amount: Money }
  | { type: 'setServiceLevel'; level: 1 | 2 | 3 | 4 | 5 }
  | { type: 'setMarketing'; perMonth: Money };

export type CommandResult = { ok: true } | { ok: false; reason: string };

export function parseCommand(x: unknown): Command {
  return CommandSchema.parse(x) as Command;
}
