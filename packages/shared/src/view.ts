import type { ActiveEvent, Aircraft, Airline, CabinClass, GameState, Money, PersonalityId, Route, WeatherCondition } from './types';

export interface Notification {
  id: string;
  day: number;
  level: 'info' | 'warning' | 'major';
  category: 'event' | 'rival' | 'airline' | 'goal';
  title: string;
  body: string;
  link?: { kind: 'route' | 'aircraft' | 'airport' | 'airline'; id: string };
}

export interface CostBreakdown {
  fuel: Money;
  crew: Money;
  maintenance: Money;
  fees: Money;
  service: Money;
  leases: Money;
  interest: Money;
  overhead: Money;
  bases: Money;
  marketing: Money;
}

export interface AirlineDaily {
  day: number;
  airlineId: string;
  cash: Money;
  revenue: Money;
  pax: number;
  costs: CostBreakdown;
}

export interface TickSummary {
  day: number;
  daily: AirlineDaily[];
  notifications: Notification[];
  autoPause: boolean;
}

export interface PreviewResult {
  ok: boolean;
  reason?: string;
  expectedLoadFactor?: number;
  expectedProfitPerDay?: Money;
  paybackDays?: number | null;
  suggestedFares?: Record<CabinClass, Money>;
  demandPerDay?: number;
  competitors?: number;
  distanceKm?: number;
}

export interface RivalSummary {
  id: string;
  name: string;
  code: string;
  color: string;
  personality: PersonalityId;
  fleetSize: number;
  routeCount: number;
  reputation: number;
  overlapRoutes: number;
}

export interface UpcomingPeakView {
  name: string;
  countries: string[];
  startDay: number;
  endDay: number;
  peak: number;
}

export interface ClientView {
  day: number;
  startYear: number;
  player: Airline;
  aircraft: Aircraft[];
  routes: Route[];
  rivals: RivalSummary[];
  rivalRoutes: { airlineId: string; from: string; to: string }[];
  market: GameState['market'];
  events: ActiveEvent[];
  slotsFree: Record<string, number>;
  objectives: { id: string; title: string; done: boolean }[];
  gameOver: GameState['gameOver'];
  finance: { companyValue: Money; availableCredit: Money; monthlyFixed: Money };
  /** Festivals in the player's markets over the next 60 days. */
  upcomingPeaks: UpcomingPeakView[];
  weather: {
    /** Airports served by anyone with weather other than clear today. */
    today: Record<string, WeatherCondition>;
    /** The player's airports: conditions for the next 3 days. */
    forecast: Record<string, WeatherCondition[]>;
  };
}
