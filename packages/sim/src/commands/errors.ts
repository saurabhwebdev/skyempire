import { formatMoney, type TierId } from '@skyempire/shared';

const TIER_NAME: Record<TierId, string> = { startup: 'Startup', regional: 'Regional', national: 'National' };

export const ERR = {
  notEnoughCash: (short: number) => `Not enough cash — you need ${formatMoney(short)} more`,
  tierLocked: (tier: TierId) => `Unlocks at ${TIER_NAME[tier]} tier`,
  tooManySeats: (max: number) => `Too many seats — max ${max} seat units`,
  unknownType: 'Unknown aircraft type',
  unknownAircraft: 'That aircraft isn’t in your fleet',
  unknownListing: 'That aircraft is no longer for sale',
  unknownAirport: (id: string) => `Unknown airport ${id}`,
  unknownRoute: 'That route doesn’t exist',
  rangeTooShort: (name: string, km: number) => `Range too short — ${name} flies max ${km.toLocaleString('en-US')} km`,
  runwayTooShort: (airport: string, name: string) => `Runway at ${airport} is too short for the ${name}`,
  noBase: 'Routes must start or end at one of your bases',
  duplicateRoute: 'You already fly this route',
  noSlots: (airport: string) => `No free slots at ${airport}`,
  noHours: (name: string, free: number) => `Not enough free hours on this ${name} — ${Math.max(0, Math.floor(free))} h/week left`,
  duplicateAssignment: 'Each aircraft can appear only once on a route',
  alreadyBase: 'That airport is already one of your bases',
  homeBase: 'You can’t close your home base',
  notBase: 'That airport isn’t one of your bases',
  baseInUse: 'Close or move the routes that use this base first',
  creditLimit: (avail: number) => `Credit limit reached — you can borrow up to ${formatMoney(avail)}`,
  unknownLoan: 'That loan doesn’t exist',
  repayTooMuch: 'You can’t repay more than you owe',
  bankrupt: 'This airline is bankrupt',
} as const;
