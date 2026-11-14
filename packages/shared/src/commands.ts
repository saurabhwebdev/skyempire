import { z } from 'zod';
import type { Assignment, BellySettings, CabinClass, CabinConfig, CargoType, Money, SeasonalFare } from './types';

const money = z.number().int().nonnegative();
const positiveMoney = z.number().int().positive();
const code = z.string().min(3).max(4);
const id = z.string().min(1);

export const CabinSchema = z.object({
  economy: z.number().int().nonnegative(),
  premium: z.number().int().nonnegative(),
  business: z.number().int().nonnegative(),
});
const ife = z.enum(['none', 'wifi', 'seatback', 'premium']);
const meal = z.enum(['none', 'buyOnBoard', 'snack', 'hot', 'dining', 'chef']);
const classProduct = <S extends [string, ...string[]]>(seats: S) =>
  z.object({ seat: z.enum(seats), ife, meal, amenityKit: z.boolean(), lounge: z.boolean() }).strict();
export const CabinProductSchema = z.object({
  economy: classProduct(['slimline', 'standard', 'extraLegroom']),
  premium: classProduct(['recliner', 'legRest']),
  business: classProduct(['recliner', 'angled', 'flat', 'suite']),
});
export const CabinConfigSchema = z.object({ seats: CabinSchema, product: CabinProductSchema, dense: z.boolean() });
const cargoType = z.enum(['general', 'express', 'mail', 'perishable', 'dangerous', 'special']);
const cargoRate = z.number().positive().max(50);
export const BellySchema = z.union([
  z.object({ mode: z.literal('default') }).strict(),
  z.object({ mode: z.literal('custom'), rate: cargoRate, accept: z.array(cargoType).max(6), holdShare: z.number().min(0.4).max(0.9) }).strict(),
]);
export const FaresSchema = z.object({ economy: positiveMoney, premium: positiveMoney, business: positiveMoney });
export const SeasonalFareSchema = z
  .object({ startDay: z.number().int().nonnegative(), endDay: z.number().int().nonnegative(), pct: z.number().int().min(-50).max(100) })
  .refine((f) => f.endDay >= f.startDay, { message: 'A seasonal fare must end on or after its start' });
export const AssignmentSchema = z.object({ aircraftId: id, roundTripsPerWeek: z.number().int().min(1).max(200) });

export const CommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('leaseAircraft'), typeId: id, config: CabinConfigSchema.optional() }),
  z.object({ type: z.literal('buyAircraft'), typeId: id, config: CabinConfigSchema.optional() }),
  z.object({ type: z.literal('buyUsedAircraft'), listingId: id, config: CabinConfigSchema.optional(), convertTo: id.optional() }),
  z.object({ type: z.literal('convertAircraft'), aircraftId: id, toTypeId: id }),
  z.object({ type: z.literal('buyDgLicence') }),
  z.object({ type: z.literal('setBellyCargo'), on: z.boolean() }),
  z.object({ type: z.literal('sellAircraft'), aircraftId: id }),
  z.object({ type: z.literal('setCabin'), aircraftId: id, config: CabinConfigSchema }),
  z.object({ type: z.literal('saveCabinTemplate'), name: z.string().trim().min(1).max(40), typeId: id, config: CabinConfigSchema }),
  z.object({ type: z.literal('deleteCabinTemplate'), templateId: id }),
  z
    .object({
      type: z.literal('openRoute'),
      kind: z.enum(['passenger', 'cargo']).optional(),
      cargoRate: cargoRate.optional(),
      cargoAccept: z.array(cargoType).max(6).optional(),
      belly: BellySchema.optional(),
      from: code,
      to: code,
      stops: z.array(code).max(2).optional(),
      fares: FaresSchema,
      legFares: z.record(z.string().max(9), FaresSchema).optional(),
      assignments: z.array(AssignmentSchema).min(1),
    })
    .refine((c) => c.from !== c.to, { message: 'A route needs two different airports' }),
  z.object({
    type: z.literal('updateRoute'),
    routeId: id,
    cargoRate: cargoRate.optional(),
    cargoAccept: z.array(cargoType).max(6).optional(),
    belly: BellySchema.optional(),
    fares: FaresSchema.optional(),
    legFares: z.record(z.string().max(9), FaresSchema).optional(),
    assignments: z.array(AssignmentSchema).optional(),
    seasonalFares: z.array(SeasonalFareSchema).max(4).optional(),
  }),
  z.object({ type: z.literal('closeRoute'), routeId: id }),
  z.object({ type: z.literal('preCancel'), routeId: id, day: z.number().int().nonnegative() }),
  z.object({ type: z.literal('openBase'), airportId: code }),
  z.object({ type: z.literal('closeBase'), airportId: code }),
  z.object({ type: z.literal('takeLoan'), amount: positiveMoney }),
  z.object({ type: z.literal('repayLoan'), loanId: id, amount: positiveMoney }),
  z.object({ type: z.literal('setMarketing'), perMonth: money }),
]);

type Fares = Record<CabinClass, Money>;
export type Command =
  | { type: 'leaseAircraft'; typeId: string; config?: CabinConfig }
  | { type: 'buyAircraft'; typeId: string; config?: CabinConfig }
  | { type: 'buyUsedAircraft'; listingId: string; config?: CabinConfig; convertTo?: string }
  | { type: 'convertAircraft'; aircraftId: string; toTypeId: string }
  | { type: 'buyDgLicence' }
  | { type: 'setBellyCargo'; on: boolean }
  | { type: 'sellAircraft'; aircraftId: string }
  | { type: 'setCabin'; aircraftId: string; config: CabinConfig }
  | { type: 'saveCabinTemplate'; name: string; typeId: string; config: CabinConfig }
  | { type: 'deleteCabinTemplate'; templateId: string }
  | { type: 'openRoute'; kind?: 'passenger' | 'cargo'; from: string; to: string; stops?: string[]; fares: Fares; legFares?: Record<string, Fares>; assignments: Assignment[];
      cargoRate?: number; cargoAccept?: CargoType[]; belly?: BellySettings }
  | { type: 'updateRoute'; routeId: string; fares?: Fares; legFares?: Record<string, Fares>; assignments?: Assignment[]; seasonalFares?: SeasonalFare[];
      cargoRate?: number; cargoAccept?: CargoType[]; belly?: BellySettings }
  | { type: 'closeRoute'; routeId: string }
  | { type: 'preCancel'; routeId: string; day: number }
  | { type: 'openBase'; airportId: string }
  | { type: 'closeBase'; airportId: string }
  | { type: 'takeLoan'; amount: Money }
  | { type: 'repayLoan'; loanId: string; amount: Money }
  | { type: 'setMarketing'; perMonth: Money };

export type CommandResult = { ok: true } | { ok: false; reason: string };

export function parseCommand(x: unknown): Command {
  return CommandSchema.parse(x) as Command;
}
