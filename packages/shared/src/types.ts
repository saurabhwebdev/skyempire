export type Money = number; // integer USD
export type CabinClass = 'economy' | 'premium' | 'business';
export const CABIN_CLASSES: readonly CabinClass[] = ['economy', 'premium', 'business'] as const;
export type Cabin = Record<CabinClass, number>;
export type AircraftClass = 'turboprop' | 'regional' | 'narrowbody' | 'longNarrowbody' | 'widebody';
export type PersonalityId = 'budget' | 'legacy' | 'regional' | 'gulf' | 'expander';
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
}

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
}

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
  serviceLevel: 1 | 2 | 3 | 4 | 5;
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
  schemaVersion: 2;
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
