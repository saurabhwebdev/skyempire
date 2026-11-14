import type { WeatherCondition } from '@skyempire/shared';
import { CloudFog, CloudLightning, CloudRain, CloudSnow, Sun, Tornado, Wind, type LucideIcon } from 'lucide-react';

export const WEATHER_LABEL: Record<WeatherCondition, string> = {
  clear: 'Clear', wind: 'Windy', rain: 'Rain', thunderstorm: 'Thunderstorms', snow: 'Snow', fog: 'Fog', cyclone: 'Tropical cyclone',
};
export const WEATHER_ICON: Record<WeatherCondition, LucideIcon> = {
  clear: Sun, wind: Wind, rain: CloudRain, thunderstorm: CloudLightning, snow: CloudSnow, fog: CloudFog, cyclone: Tornado,
};
/** What the player should expect (matches WEATHER in the sim's balance config). */
export const WEATHER_IMPACT: Record<WeatherCondition, string> = {
  clear: 'No delays', wind: 'Minor delays', rain: 'Minor delays', thunderstorm: '~5% of flights cancelled',
  snow: '~10% of flights cancelled', fog: '~5% of flights cancelled', cyclone: 'Airport closed',
};
/** Conditions worth warning about (rain and wind only nudge punctuality). */
export const SEVERE: WeatherCondition[] = ['cyclone', 'snow', 'thunderstorm', 'fog'];
export const dayLabel = (k: number) => (k === 1 ? 'Tomorrow' : `In ${k} days`);
