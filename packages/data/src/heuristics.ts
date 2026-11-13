import type { SizeClass } from '@skyempire/shared';

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function sizeClassFor(type: 'large_airport' | 'medium_airport', catchmentM: number): SizeClass {
  if (type === 'large_airport') return catchmentM >= 8 ? 6 : catchmentM >= 4 ? 5 : 4;
  return catchmentM >= 2 ? 3 : catchmentM >= 0.7 ? 2 : 1;
}

const SLOTS = [0, 60, 120, 220, 400, 700, 1100];
const LANDING = [0, 4, 5, 6, 8, 10, 12];
const PAX = [0, 6, 8, 10, 14, 18, 22];

export const slotCapacityFor = (size: SizeClass): number => SLOTS[size] as number;
export const landingFeeFor = (size: SizeClass): number => LANDING[size] as number;
export const paxFeeFor = (size: SizeClass): number => PAX[size] as number;

export function wealthFor(gdpPerCapitaUsd: number): number {
  return clamp(gdpPerCapitaUsd / 40000, 0.3, 2.0);
}

export function businessFor(catchmentM: number): number {
  if (catchmentM <= 0) return 0;
  return clamp(Math.log10(catchmentM * 10) / 2, 0, 1);
}

/** Country tourism pull (0–1), hand-authored from UN Tourism arrivals rankings; default 0.3. */
export const TOURISM_BY_COUNTRY: Record<string, number> = {
  FR: 0.9, ES: 0.9, IT: 0.85, US: 0.6, TR: 0.75, MX: 0.75, TH: 0.85, GR: 0.85, AE: 0.8, GB: 0.6, DE: 0.5,
  AT: 0.6, PT: 0.8, HR: 0.8, NL: 0.5, JP: 0.6, CN: 0.45, MY: 0.6, SG: 0.65, ID: 0.6, VN: 0.6, EG: 0.6,
  MA: 0.65, MV: 0.95, CY: 0.8, MT: 0.8, DO: 0.85, JM: 0.85, CU: 0.7, BS: 0.9, CH: 0.55, CZ: 0.55, HU: 0.5,
  IE: 0.5, IN: 0.45, LK: 0.6, AU: 0.55, NZ: 0.6, ZA: 0.5, KE: 0.5, TZ: 0.55, MU: 0.85, SA: 0.45, QA: 0.5,
  CA: 0.45, BR: 0.45, AR: 0.45, PE: 0.5, CL: 0.4, CO: 0.45, KR: 0.5, PH: 0.55, IS: 0.7, NO: 0.4, SE: 0.4,
};

export const tourismFor = (country: string): number => TOURISM_BY_COUNTRY[country] ?? 0.3;
