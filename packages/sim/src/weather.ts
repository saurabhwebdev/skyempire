import type { AircraftClass, Airport, Catalog, GameState, WeatherCondition } from '@skyempire/shared';
import { dateOf } from './calendar';
import { WEATHER } from './config/balance';
import { hash01 } from './hash';

const inMonths = (m: number, months: readonly number[]) => months.includes(m);

function cycloneSeason(lat: number, month: number): boolean {
  const abs = Math.abs(lat);
  if (abs < 8 || abs > 30) return false;
  return lat >= 0 ? inMonths(month, [7, 8, 9, 10]) : inMonths(month, [1, 2, 3]);
}

/** Simulated daily weather from climatology (latitude band, hemisphere, month); a pure function of its inputs. */
export function simulatedWeather(seed: number, a: Airport, day: number, startYear: number): WeatherCondition {
  // Tropical cyclones last 1–3 days from a start day.
  for (let k = 0; k < 3; k++) {
    const d0 = day - k;
    if (!cycloneSeason(a.lat, dateOf(d0, startYear).month)) continue;
    if (hash01(seed, d0, `${a.id}:cy`) >= WEATHER.pCycloneStart) continue;
    const len = 1 + Math.floor(hash01(seed, d0, `${a.id}:cyl`) * 3);
    if (k < len) return 'cyclone';
  }
  const month = dateOf(day, startYear).month;
  const north = a.lat >= 0, abs = Math.abs(a.lat);
  const winter = inMonths(month, north ? [12, 1, 2] : [6, 7, 8]);
  const summer = inMonths(month, north ? [6, 7, 8] : [12, 1, 2]);
  const coldSeason = inMonths(month, north ? [10, 11, 12, 1, 2] : [4, 5, 6, 7, 8]);
  const wet = inMonths(month, north ? [6, 7, 8, 9] : [12, 1, 2, 3]);

  const pSnow = abs > 40 && winter ? Math.min(WEATHER.pSnowMax, WEATHER.pSnowBase + WEATHER.pSnowPerDegree * (abs - 40)) : 0;
  const pStorm = abs < 25 && wet ? WEATHER.pStormTropicalWet : summer && abs <= 55 ? WEATHER.pStormSummer : WEATHER.pStormOther;
  const pFog = coldSeason && abs >= 25 && abs <= 65 ? WEATHER.pFogColdSeason : WEATHER.pFog;

  let u = hash01(seed, day, a.id);
  for (const [cond, p] of [['snow', pSnow], ['thunderstorm', pStorm], ['fog', pFog], ['rain', WEATHER.pRain], ['wind', WEATHER.pWind]] as const) {
    if (u < p) return cond;
    u -= p;
  }
  return 'clear';
}

/** Today's weather: the live forecast when the main process supplied one, else simulated. */
export function weatherAt(state: GameState, catalog: Catalog, airportId: string, day: number): WeatherCondition {
  const live = state.world.liveWeather[day]?.[airportId];
  if (live) return live;
  const a = catalog.airports[airportId];
  return a ? simulatedWeather(state.seed, a, day, state.world.startYear) : 'clear';
}

export interface WeatherEffect {
  capacityCut: number;
  onTimePenalty: number;
  cancelShare: number;
  deicePerDeparture: number;
  closed: boolean;
}

export function weatherEffect(cond: WeatherCondition, a: Airport, cls: AircraftClass): WeatherEffect {
  const e = WEATHER.effects[cond];
  let cancelShare: number = e.cancelShare;
  if (cond === 'thunderstorm' && cls === 'turboprop') cancelShare *= WEATHER.turbopropStormFactor;
  if (cond === 'fog' && a.runwayM < WEATHER.fogShortRunwayM) cancelShare *= WEATHER.fogShortRunwayFactor;
  return {
    capacityCut: e.capacityCut,
    onTimePenalty: e.onTimePenalty,
    cancelShare: Math.min(1, cancelShare),
    deicePerDeparture: cond === 'snow' ? WEATHER.deicePerDeparture : 0,
    closed: cond === 'cyclone',
  };
}
