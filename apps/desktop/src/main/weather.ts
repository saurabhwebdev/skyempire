import type { WeatherCondition } from '@skyempire/shared';

/** Open-Meteo forecast API (free, no key, CC BY 4.0). Called from the main process only; requests carry coordinates only. */
const API = 'https://api.open-meteo.com/v1/forecast';
const BATCH = 50;
const MIN_INTERVAL_MS = 60_000;
const TIMEOUT_MS = 10_000;
const UA = 'SkyEmpire/0.2 (+https://github.com/saurabhwebdev/skyempire)';

export type FetchFn = (url: string, init: { headers: Record<string, string>; signal: AbortSignal }) => Promise<Response>;
export interface WeatherPoint { id: string; lat: number; lon: number }
export type LiveForecast = Record<number, Record<string, WeatherCondition>>;

/** WMO weather code + daily max gust (km/h) → game condition. */
export function conditionFromWmo(code: number, gustKmh: number): WeatherCondition {
  if (gustKmh >= 118 && code >= 80) return 'cyclone';
  if (code >= 95) return 'thunderstorm';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if (gustKmh >= 60) return 'wind';
  return 'clear';
}

interface DailyBody { daily?: { weather_code?: unknown; wind_gusts_10m_max?: unknown } }
const isNumArray = (v: unknown, n: number): v is number[] => Array.isArray(v) && v.length >= n && v.slice(0, n).every((x) => typeof x === 'number');

export class LiveWeather {
  private last = -Infinity;

  constructor(private readonly fetchFn: FetchFn, private readonly nowFn: () => number = Date.now) {}

  /**
   * Forecast for the next 3 days, mapped onto game days gameDay+1…gameDay+3.
   * Returns null when throttled, offline or nothing usable came back; never throws.
   */
  async refresh(points: WeatherPoint[], gameDay: number): Promise<LiveForecast | null> {
    if (points.length === 0) return null;
    const now = this.nowFn();
    if (now - this.last < MIN_INTERVAL_MS) return null;
    this.last = now;
    const out: LiveForecast = {};
    let any = false;
    for (let i = 0; i < points.length; i += BATCH) {
      const batch = points.slice(i, i + BATCH);
      const body = await this.fetchBatch(batch);
      if (!body) continue;
      const items: unknown[] = Array.isArray(body) ? body : [body];
      if (items.length !== batch.length) continue; // malformed: skip this batch, those airports stay simulated
      items.forEach((item, j) => {
        const d = (item as DailyBody | null)?.daily;
        if (!d || !isNumArray(d.weather_code, 3)) return;
        const gusts = isNumArray(d.wind_gusts_10m_max, 3) ? d.wind_gusts_10m_max : [0, 0, 0];
        for (let k = 0; k < 3; k++) {
          (out[gameDay + 1 + k] ??= {})[batch[j]!.id] = conditionFromWmo(d.weather_code[k]!, gusts[k]!);
          any = true;
        }
      });
    }
    return any ? out : null;
  }

  private async fetchBatch(batch: WeatherPoint[]): Promise<unknown> {
    const lat = batch.map((p) => p.lat.toFixed(2).replace(/\.?0+$/, '')).join(',');
    const lon = batch.map((p) => p.lon.toFixed(2).replace(/\.?0+$/, '')).join(',');
    const url = `${API}?latitude=${lat}&longitude=${lon}&daily=weather_code,wind_gusts_10m_max&forecast_days=3&timezone=UTC`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await this.fetchFn(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
