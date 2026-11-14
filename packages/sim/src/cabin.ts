import type {
  AircraftType, BusinessSeat, CabinClass, CabinConfig, CabinProduct, EconomySeat, Ife, Meal, PersonalityId, PremiumSeat,
} from '@skyempire/shared';
import { CABIN_CLASSES } from '@skyempire/shared';

/**
 * Cabin products (v0.4 spec): what each seat type, screen and meal costs, weighs and is worth to passengers.
 * Standard economy / recliner premium / angled business take 1 / 1.5 / 2.5 seat units, as in v0.3.
 */
type SeatOf = { economy: EconomySeat; premium: PremiumSeat; business: BusinessSeat };
type PerSeat = { [C in CabinClass]: Record<SeatOf[C], number> };

export const SEAT_UNITS: PerSeat = {
  economy: { slimline: 0.92, standard: 1, extraLegroom: 1.15 },
  premium: { recliner: 1.5, legRest: 1.75 },
  business: { recliner: 2, angled: 2.5, flat: 3.2, suite: 3.8 },
};
export const SEAT_SCORE: PerSeat = {
  economy: { slimline: 35, standard: 55, extraLegroom: 75 },
  premium: { recliner: 70, legRest: 82 },
  business: { recliner: 60, angled: 75, flat: 90, suite: 100 },
};
const SEAT_PRICE: PerSeat = {
  economy: { slimline: 2_000, standard: 3_000, extraLegroom: 4_500 },
  premium: { recliner: 12_000, legRest: 18_000 },
  business: { recliner: 30_000, angled: 90_000, flat: 200_000, suite: 400_000 },
};
const SEAT_MASS_KG: PerSeat = {
  economy: { slimline: 9, standard: 11, extraLegroom: 12 },
  premium: { recliner: 25, legRest: 30 },
  business: { recliner: 40, angled: 80, flat: 110, suite: 150 },
};
export const IFE_SCORE: Record<Ife, number> = { none: 0, wifi: 55, seatback: 75, premium: 100 };
const IFE_PRICE_PER_SEAT: Record<Ife, number> = { none: 0, wifi: 0, seatback: 8_000, premium: 18_000 };
const IFE_MASS_PER_SEAT: Record<Ife, number> = { none: 0, wifi: 0, seatback: 6, premium: 10 };
const WIFI_INSTALL = 400_000;
const WIFI_PER_BLOCK_HOUR = 60;
export const MEAL_SCORE: Record<Meal, number> = { none: 0, buyOnBoard: 25, snack: 50, hot: 75, dining: 90, chef: 100 };
const MEAL_COST: Record<Meal, number> = { none: 0, buyOnBoard: -3, snack: 3, hot: 9, dining: 35, chef: 70 };
export const ALLOWED_MEALS: Record<CabinClass, Meal[]> = {
  economy: ['none', 'buyOnBoard', 'snack', 'hot'],
  premium: ['snack', 'hot', 'dining'],
  business: ['hot', 'dining', 'chef'],
};
const AMENITY_COST: Record<CabinClass, number> = { economy: 0, premium: 8, business: 15 };
const LOUNGE_COST = 30;
const SEATBACK_PER_PAX = 0.5;
const DENSE_PENALTY = 12;
const REFIT_DAYS: Record<AircraftType['class'], number> = { turboprop: 3, regional: 3, narrowbody: 5, longNarrowbody: 5, widebody: 10 };

const CLASS_LABEL: Record<CabinClass, string> = { economy: 'Economy', premium: 'Premium economy', business: 'Business' };
const MEAL_LABEL: Record<Meal, string> = { none: 'No meal', buyOnBoard: 'Buy on board', snack: 'A snack', hot: 'A hot meal', dining: 'Dining', chef: 'Chef-designed dining' };

/** The fit a new aircraft comes with at no extra cost (meals are a running choice, not fitted). */
export function standardProduct(): CabinProduct {
  return {
    economy: { seat: 'standard', ife: 'none', meal: 'snack', amenityKit: false, lounge: false },
    premium: { seat: 'recliner', ife: 'none', meal: 'hot', amenityKit: false, lounge: false },
    business: { seat: 'angled', ife: 'none', meal: 'dining', amenityKit: false, lounge: false },
  };
}

const seatOf = <C extends CabinClass>(p: CabinProduct, c: C) => p[c].seat as SeatOf[C];
const denseRatio = (t: AircraftType) => (t.denseAbreast && t.abreast ? t.abreast / t.denseAbreast : 1);

/** Seat units per seat of a class, with the denser economy row applied. */
export function unitsPerSeat(config: Pick<CabinConfig, 'product' | 'dense'>, cls: CabinClass, t: AircraftType): number {
  const u = (SEAT_UNITS[cls] as Record<string, number>)[seatOf(config.product, cls)]!;
  return cls === 'economy' && config.dense ? u * denseRatio(t) : u;
}

export function configUnits(config: CabinConfig, t: AircraftType): number {
  return CABIN_CLASSES.reduce((s, c) => s + config.seats[c] * unitsPerSeat(config, c, t), 0);
}

/** Why a cabin can't be fitted to this aircraft, or null when it can. */
export function checkConfig(config: CabinConfig, t: AircraftType): string | null {
  const total = CABIN_CLASSES.reduce((s, c) => s + config.seats[c], 0);
  if (total === 0) return 'Add at least one seat';
  if (config.dense && !t.denseAbreast) return `The ${t.name} has no denser economy layout`;
  for (const c of CABIN_CLASSES) {
    const p = config.product[c];
    if (!ALLOWED_MEALS[c].includes(p.meal)) return `${MEAL_LABEL[p.meal]} isn't offered in ${CLASS_LABEL[c].toLowerCase()}`;
    if (p.lounge && c !== 'business') return 'Lounge access is for business only';
    if (p.amenityKit && c === 'economy') return 'Amenity kits are for premium and business';
  }
  if (configUnits(config, t) > t.maxSeats + 1e-9) return `Too many seats — max ${t.maxSeats} seat units`;
  return null;
}

/**
 * How good a class's product is, 0–100. Screens and meals count for more on long flights.
 * w = clamp((blockHours − 1) / 7, 0, 1).
 */
export function productScore(product: CabinProduct, cls: CabinClass, dense: boolean, blockH: number): number {
  const w = Math.min(1, Math.max(0, (blockH - 1) / 7));
  const p = product[cls];
  let seat = (SEAT_SCORE[cls] as Record<string, number>)[p.seat]!;
  if (cls === 'economy' && dense) seat -= DENSE_PENALTY;
  const extras = cls === 'economy' ? 0 : cls === 'premium' ? (p.amenityKit ? 100 : 0) : (p.amenityKit ? 50 : 0) + (p.lounge ? 50 : 0);
  const ws = 0.6 - 0.15 * w, wi = 0.1 + 0.1 * w, wm = 0.2 + 0.05 * w, we = cls === 'economy' ? 0 : 0.1;
  return (seat * ws + IFE_SCORE[p.ife] * wi + MEAL_SCORE[p.meal] * wm + extras * we) / (ws + wi + wm + we);
}

const hasWifi = (config: CabinConfig) => CABIN_CLASSES.some((c) => config.seats[c] > 0 && (config.product[c].ife === 'wifi' || config.product[c].ife === 'premium'));

function classInstall(config: CabinConfig, cls: CabinClass): number {
  const p = config.product[cls];
  return config.seats[cls] * ((SEAT_PRICE[cls] as Record<string, number>)[p.seat]! + IFE_PRICE_PER_SEAT[p.ife]);
}

/** What fitting this cabin costs from bare floor. */
export function installCost(config: CabinConfig): number {
  return CABIN_CLASSES.reduce((s, c) => s + classInstall(config, c), 0) + (hasWifi(config) ? WIFI_INSTALL : 0);
}

/** Extra paid on a new aircraft for a cabin above the standard fit, per class (a cheaper seat in one class doesn't pay for another). */
export function upgradeCost(config: CabinConfig): number {
  const std: CabinConfig = { seats: config.seats, product: standardProduct(), dense: false };
  return CABIN_CLASSES.reduce((s, c) => s + Math.max(0, classInstall(config, c) - classInstall(std, c)), 0) + (hasWifi(config) ? WIFI_INSTALL : 0);
}

function classChanged(a: CabinConfig, b: CabinConfig, cls: CabinClass): boolean {
  if (a.seats[cls] === 0 && b.seats[cls] === 0) return false;
  return a.seats[cls] !== b.seats[cls] || a.product[cls].seat !== b.product[cls].seat || a.product[cls].ife !== b.product[cls].ife
    || (cls === 'economy' && a.dense !== b.dense);
}

/** Refitting pays for the new seats and screens of every class that changes. Meals and extras are free. */
export function refitCost(old: CabinConfig, next: CabinConfig): number {
  const seats = CABIN_CLASSES.reduce((s, c) => s + (classChanged(old, next, c) ? classInstall(next, c) : 0), 0);
  return seats + (hasWifi(next) && !hasWifi(old) ? WIFI_INSTALL : 0);
}

export function refitDays(old: CabinConfig, next: CabinConfig, t: AircraftType): number {
  return CABIN_CLASSES.some((c) => classChanged(old, next, c)) ? REFIT_DAYS[t.class] : 0;
}

/** Meals, amenity kits, lounges and screens, per passenger flown. */
export function perPaxServiceCost(product: CabinProduct, cls: CabinClass): number {
  const p = product[cls];
  return MEAL_COST[p.meal] + (p.amenityKit ? AMENITY_COST[cls] : 0) + (p.lounge && cls === 'business' ? LOUNGE_COST : 0)
    + (p.ife === 'seatback' ? SEATBACK_PER_PAX : 0);
}

/** Connectivity cost per block hour flown by the aircraft. */
export function ifeCostPerBlockHour(config: CabinConfig): number {
  return hasWifi(config) ? WIFI_PER_BLOCK_HOUR : 0;
}

function cabinMassKg(config: CabinConfig): number {
  return CABIN_CLASSES.reduce((s, c) => {
    const p = config.product[c];
    return s + config.seats[c] * ((SEAT_MASS_KG[c] as Record<string, number>)[p.seat]! + IFE_MASS_PER_SEAT[p.ife]);
  }, 0);
}

/** Fuel multiplier for a cabin heavier (or lighter) than the standard fit with the same seats. */
export function fuelFactor(config: CabinConfig, t: AircraftType): number {
  const std = cabinMassKg({ seats: config.seats, product: standardProduct(), dense: false });
  return 1 + (cabinMassKg(config) - std) / (t.mtowT * 1000);
}

const PRODUCTS: Record<PersonalityId | 'player', (s: CabinProduct) => CabinProduct> = {
  player: (s) => s,
  budget: (s) => ({ ...s, economy: { seat: 'slimline', ife: 'none', meal: 'buyOnBoard', amenityKit: false, lounge: false } }),
  expander: (s) => ({ ...s, economy: { seat: 'slimline', ife: 'wifi', meal: 'buyOnBoard', amenityKit: false, lounge: false } }),
  regional: (s) => ({ ...s, economy: { ...s.economy, seat: 'standard', ife: 'none', meal: 'snack' } }),
  legacy: () => ({
    economy: { seat: 'standard', ife: 'seatback', meal: 'hot', amenityKit: false, lounge: false },
    premium: { seat: 'legRest', ife: 'seatback', meal: 'hot', amenityKit: true, lounge: false },
    business: { seat: 'flat', ife: 'seatback', meal: 'dining', amenityKit: true, lounge: true },
  }),
  gulf: () => ({
    economy: { seat: 'extraLegroom', ife: 'premium', meal: 'hot', amenityKit: false, lounge: false },
    premium: { seat: 'legRest', ife: 'premium', meal: 'dining', amenityKit: true, lounge: false },
    business: { seat: 'suite', ife: 'premium', meal: 'chef', amenityKit: true, lounge: true },
  }),
};

/** A sensible cabin for a type and airline style. The player (null) starts all-economy on the standard fit. */
export function defaultConfig(t: AircraftType, personality: PersonalityId | null): CabinConfig {
  let product = PRODUCTS[personality ?? 'player'](standardProduct());
  // Short-haul aircraft: full-service airlines fit simpler business seats and lighter meals.
  if (t.class !== 'widebody' && personality === 'legacy')
    product = { ...product, economy: { ...product.economy, ife: 'wifi', meal: 'snack' }, business: { ...product.business, seat: 'recliner', ife: 'wifi', meal: 'hot' } };
  if (t.class !== 'widebody' && personality === 'gulf')
    product = { ...product, economy: { ...product.economy, seat: 'standard', ife: 'seatback' }, business: { ...product.business, seat: 'flat', ife: 'seatback', meal: 'dining' } };
  const max = t.maxSeats;
  const wide = t.class === 'widebody';
  let business = 0, premium = 0;
  if (personality === 'gulf' && wide) [business, premium] = [Math.round(max * 0.08), Math.round(max * 0.06)];
  else if (personality === 'legacy' && wide) [business, premium] = [Math.round(max * 0.08), Math.round(max * 0.06)];
  else if ((personality === 'legacy' || personality === 'gulf') && t.class !== 'turboprop') business = Math.round(max * 0.05);
  const draft = { seats: { economy: 0, premium, business }, product, dense: false };
  const left = max - configUnits(draft, t);
  const economy = Math.max(0, Math.floor(left / unitsPerSeat(draft, 'economy', t) + 1e-9));
  return { ...draft, seats: { economy, premium, business } };
}

/** The aircraft fields a cabin config sets. */
export function cabinFields(config: CabinConfig): { cabin: CabinConfig['seats']; product: CabinProduct; dense: boolean; refitDaysLeft: number } {
  return { cabin: { ...config.seats }, product: structuredClone(config.product), dense: config.dense, refitDaysLeft: 0 };
}
