export type Money = number; // integer USD
export type CabinClass = 'economy' | 'premium' | 'business';
export const CABIN_CLASSES: readonly CabinClass[] = ['economy', 'premium', 'business'] as const;
export type Cabin = Record<CabinClass, number>;

// Cabin products (v0.4). Seat type sets legroom and how much floor a seat takes.
export type EconomySeat = 'slimline' | 'standard' | 'extraLegroom';
export type PremiumSeat = 'recliner' | 'legRest';
export type BusinessSeat = 'recliner' | 'angled' | 'flat' | 'suite';
export type Ife = 'none' | 'wifi' | 'seatback' | 'premium';
export type Meal = 'none' | 'buyOnBoard' | 'snack' | 'hot' | 'dining' | 'chef';
export interface ClassProduct<S extends string = string> { seat: S; ife: Ife; meal: Meal; amenityKit: boolean; lounge: boolean }
export interface CabinProduct { economy: ClassProduct<EconomySeat>; premium: ClassProduct<PremiumSeat>; business: ClassProduct<BusinessSeat> }
/** Everything the cabin designer sets: seat counts, the product per class and the denser economy row. */
export interface CabinConfig { seats: Cabin; product: CabinProduct; dense: boolean }
export interface CabinTemplate { id: string; name: string; typeId: string; config: CabinConfig }
export type AircraftClass = 'turboprop' | 'regional' | 'narrowbody' | 'longNarrowbody' | 'widebody';
export type PersonalityId = 'budget' | 'legacy' | 'regional' | 'gulf' | 'expander' | 'integrator' | 'freightCarrier';
/** Passenger, Passenger + Cargo, or Cargo only (v0.6). Chosen at the start and permanent. */
export type AirlineKind = 'passenger' | 'combination' | 'cargo';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type TierId = 'startup' | 'regional' | 'national' | 'global';
export type SizeClass = 1 | 2 | 3 | 4 | 5 | 6;

export interface Airport {
  id: string; // IATA
  icao: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  sizeClass: SizeClass;
  population: number; // catchment, millions
  wealth: number;
  tourism: number;
  business: number;
  runwayM: number;
  slotCapacity: number;
  landingFeePerTonne: Money;
  paxFee: Money;
}

export interface AircraftType {
  id: string;
  name: string;
  manufacturer: string;
  class: AircraftClass;
  maxSeats: number;
  rangeKm: number;
  cruiseKmh: number;
  fuelKgPerH: number;
  priceUsd: Money;
  leasePerMonth: Money;
  maintPerH: Money;
  crewPerH: Money;
  minRunwayM: number;
  turnaroundMin: number;
  mtowT: number;
  comfort: number;
  tier: TierId;
  /** Economy seats per row (from aircraft-details). */
  abreast?: number;
  /** A denser economy row some airlines really fly (e.g. 777 3-4-3). */
  denseAbreast?: number;
  /** v0.6: a freighter (no seats; carries payloadT). */
  kind?: 'freighter';
  /** Freighters: maximum payload, tonnes. */
  payloadT?: number;
  /** Passenger types: hold capacity for cargo and bags, tonnes. */
  bellyT?: number;
  /** First year it can be delivered (e.g. the A350F in 2027); earlier orders wait. */
  entryYear?: number;
  /** A freighter made from passenger aircraft of these types, at this cost and downtime. */
  conversion?: { from: string[]; costUsd: number; days: number };
  /** A main-deck freighter that can take live animals and outsize cargo. */
  special?: boolean;
  /** Out of production: only on the used market. */
  usedOnly?: boolean;
}

export interface AirlineData {
  iata: string;
  icao: string;
  name: string;
  country: string;
  wikidata: string;
  hubId: string;
  personality: PersonalityId;
  sizeRank: number;
  brandColor: string;
  fleetTypes: string[];
  sources: string[];
  /** v0.6: airlines that fly freighters too ('combination') or only ('cargo'). Default passenger. */
  kind?: AirlineKind;
}

/** Holiday tables (packages/data/src/holidays.json), built from date-holidays. */
export interface HolidayData {
  years: number[];
  /** country → year → day-of-year (0 = Jan 1) of public holidays. */
  public: Record<string, Record<string, number[]>>;
  /** festival anchor id → year → ISO date. */
  anchors: Record<string, Record<string, string>>;
}

export interface Catalog {
  regionId: string;
  airports: Record<string, Airport>;
  aircraftTypes: Record<string, AircraftType>;
  airlines: AirlineData[];
  realRoutes: { airlineIata: string; from: string; to: string }[];
  holidays: HolidayData;
  airspace: AirspaceRegion[];
  /** ISO 3166 alpha-2 → English short name (Natural Earth). */
  countryNames: Record<string, string>;
  /** Air cargo (v0.6): real annual tonnes for the big cargo airports, and each country's export strength. */
  cargo?: { airportT: Record<string, number>; exportIndex: Record<string, number> };
}

/** Kinds of air cargo (v0.6). */
export type CargoType = 'general' | 'express' | 'mail' | 'perishable' | 'dangerous' | 'special';
export const CARGO_TYPES: readonly CargoType[] = ['general', 'express', 'mail', 'perishable', 'dangerous', 'special'] as const;
export type CargoTonnes = Record<CargoType, number>;

export interface Aircraft {
  id: string;
  typeId: string;
  ownerId: string;
  ownership: 'owned' | 'leased';
  ageDays: number;
  condition: number;
  flightHours: number;
  hoursSinceA: number;
  hoursSinceC: number;
  cabin: Cabin;
  product: CabinProduct;
  dense: boolean;
  /** Days left in a cabin refit (or freighter conversion); the aircraft doesn't fly until 0. */
  refitDaysLeft: number;
  /** Ordered before the type's first deliveries: arrives (and starts its lease) on this game day. */
  deliveryDay?: number;
  status: 'active' | 'maintenance';
  maintenanceDaysLeft: number;
  bookValue: Money;
}

export interface Assignment {
  aircraftId: string;
  roundTripsPerWeek: number;
}

export interface RouteDayStats {
  pax: Cabin;
  loadFactor: number;
  /** Multi-stop routes: passengers per market (pairKey), both directions. */
  marketPax?: Record<string, Cabin>;
  /** Multi-stop routes: load factor of each leg, in chain order. */
  legLoad?: number[];
  /** Cargo carried today, tonnes (both directions; freighters or belly). */
  cargoT?: number;
  /** Revenue from cargo today (included in revenue). */
  cargoRevenue?: Money;
  /** Cargo routes: how full the freighters were, 0–1. */
  cargoLoad?: number;
  revenue: Money;
  cost: Money;
  profit: Money;
}

export interface Route {
  id: string;
  airlineId: string;
  from: string;
  to: string;
  fares: Record<CabinClass, Money>;
  assignments: Assignment[];
  status: 'active' | 'suspended';
  openedDay: number;
  last: RouteDayStats | null;
  profit30: Money[];
  /** Fare changes for date ranges (game days, inclusive), e.g. +20% over a festival. */
  seasonalFares?: SeasonalFare[];
  /** Up to 2 intermediate stops (v0.5): the aircraft flies from → stops → to and back. */
  stops?: string[];
  /** Fares for the markets other than from–to on a multi-stop route, keyed by pairKey (e.g. "DXB-LHR"). */
  legFares?: Record<string, Record<CabinClass, Money>>;
  /** v0.6: a passenger route (default) or a freighter route. */
  kind?: 'passenger' | 'cargo';
  /** Cargo routes: general cargo rate, $/kg (other cargo types pay a multiple). */
  cargoRate?: number;
  /** Cargo routes: the cargo types it takes. */
  cargoAccept?: CargoType[];
  /** Passenger routes: belly cargo in the holds. */
  belly?: BellySettings;
}

/** Belly cargo on a passenger route: the market default, or the player's own rate, cargo types and hold share (0.4–0.9). */
export type BellySettings = { mode: 'default' } | { mode: 'custom'; rate: number; accept: CargoType[]; holdShare: number };

export interface SeasonalFare {
  startDay: number;
  endDay: number;
  /** −50…+100 percent applied to every cabin's fare. */
  pct: number;
}

export interface Loan {
  id: string;
  principal: Money;
  annualRate: number;
  takenDay: number;
}

export type LogoShape = 'circle' | 'square' | 'diamond' | 'wing';

export interface Airline {
  id: string;
  name: string;
  code: string;
  colors: { primary: string; secondary: string };
  logoShape: LogoShape;
  isPlayer: boolean;
  personality: PersonalityId | null;
  cash: Money;
  loans: Loan[];
  baseIds: string[];
  homeBaseId: string;
  reputation: number;
  cabinTemplates: CabinTemplate[];
  /** v0.6: Passenger, Passenger + Cargo, or Cargo only. */
  kind: AirlineKind;
  /** Sell cargo in passenger aircraft holds (on by default). */
  bellyCargo: boolean;
  /** Licensed to carry dangerous goods. */
  dgLicence: boolean;
  marketingPerMonth: Money;
  tier: TierId;
  completedObjectives: string[];
  daysInsolvent: number;
  bankrupt: boolean;
  creditRating: 'A' | 'B' | 'C' | 'D';
  totals: { pax: number; revenue360: Money[] };
  nextAiDecisionDay: number;
}

export type EventKind = 'fuelSpike' | 'recession' | 'boom' | 'strike' | 'storm' | 'expansion';

export interface ActiveEvent {
  id: string;
  kind: EventKind;
  startDay: number;
  endDay: number;
  airportId?: string;
  magnitude: number;
}

export interface UsedListing {
  id: string;
  typeId: string;
  ageDays: number;
  condition: number;
  price: Money;
}

export type WeatherCondition = 'clear' | 'wind' | 'rain' | 'thunderstorm' | 'snow' | 'fog' | 'cyclone';

export type TensionKind = 'airspaceClosure' | 'routeBan' | 'advisory' | 'thawBonus';

/** A generic geopolitical event: never names parties or causes. */
export interface ActiveTension {
  id: string;
  kind: TensionKind;
  regionId?: string;
  countries?: [string, string];
  country?: string;
  magnitude: number;
  warnDay: number;
  startDay: number;
  endDay: number;
}

/** A generic geographic airspace region (packages/data/src/airspace.json). */
export interface AirspaceRegion {
  id: string;
  name: string;
  countries: string[];
  /** Outer rings, [lon, lat], simplified. */
  rings: [number, number][][];
  /** Detour waypoints just outside the region (its convex hull, pushed outward). */
  nodes: [number, number][];
}

export interface World {
  /** Real year of game day 0 (Jan 1). */
  startYear: number;
  /** Live forecast fed in by the main process: game day → airport → condition. */
  liveWeather: Record<number, Record<string, WeatherCondition>>;
  tensions: ActiveTension[];
  /** Route id → game days the player cancelled ahead of time. */
  preCancelled: Record<string, number[]>;
}

export interface GameState {
  schemaVersion: 5;
  seed: number;
  rngState: number;
  day: number;
  regionId: string;
  difficulty: Difficulty;
  playerId: string;
  airlines: Record<string, Airline>;
  aircraft: Record<string, Aircraft>;
  routes: Record<string, Route>;
  market: { fuelPricePerKg: number; economyIndex: number; usedListings: UsedListing[] };
  slotsUsed: Record<string, number>;
  airportSlotBonus: Record<string, number>;
  events: ActiveEvent[];
  nextId: number;
  gameOver: null | { reason: 'bankrupt'; day: number };
  world: World;
}

export interface NewGameOptions {
  seed: number;
  regionId: 'world';
  difficulty: Difficulty;
  airline: { name: string; code: string; colors: { primary: string; secondary: string }; logoShape: LogoShape };
  homeBaseId: string;
  aiCount?: number;
  /** Real year the career starts in (default 2026). */
  startYear?: number;
}
