import type { Catalog } from '@skyempire/shared';
import { describe, expect, it } from 'vitest';
import { airportCargoT, allocateCargo, cargoFlow, cargoFlowsByType, cargoRefRate, cargoSeason, type CargoOffer } from './cargo';
import { catalog as base } from './testing';

const catalog: Catalog = {
  ...base,
  cargo: { airportT: { HKG: 4_900_000, MEM: 4_000_000, PVG: 3_800_000, LAX: 2_700_000, ANC: 3_400_000, LHR: 1_400_000 }, exportIndex: { CN: 1.6, HK: 1.5, US: 0.85, GB: 0.9 } },
};
const ap = (id: string) => catalog.airports[id]!;
const flow = (a: string, b: string, doy = 150) => cargoFlow(ap(a), ap(b), doy, 1, catalog, 2026);

describe('cargo demand', () => {
  it('uses real airport tonnes where known, and an estimate elsewhere', () => {
    expect(airportCargoT(catalog, ap('HKG'))).toBe(4_900_000);
    const est = airportCargoT(catalog, ap('BRS'));
    expect(est).toBeGreaterThan(1_000);
    expect(est).toBeLessThan(airportCargoT(catalog, ap('LHR')));
  });
  it('is one-sided: China → USA is heavier than the way back', () => {
    expect(flow('PVG', 'LAX')).toBeGreaterThan(1.5 * flow('LAX', 'PVG'));
  });
  it('big cargo hubs dominate', () => {
    expect(flow('HKG', 'LAX')).toBeGreaterThan(5 * flow('BRS', 'LAX'));
    expect(flow('HKG', 'LAX')).toBeGreaterThan(50);
    expect(flow('HKG', 'LAX')).toBeLessThan(2_000);
  });
  it('peaks before Christmas and dips at Lunar New Year from China; mail stays flat', () => {
    const lny = 47; // 2026-02-17
    expect(cargoSeason(330, 'US', 'general', 2026, catalog)).toBeGreaterThan(1.15);
    expect(cargoSeason(lny + 3, 'CN', 'general', 2026, catalog)).toBeLessThan(0.85);
    expect(cargoSeason(lny + 3, 'US', 'general', 2026, catalog)).toBeGreaterThan(0.85);
    expect(cargoSeason(330, 'US', 'mail', 2026, catalog)).toBe(1);
  });
  it('splits flows into cargo types, with more perishables from growing countries', () => {
    const fromCN = cargoFlowsByType(100, 'CN');
    expect(fromCN.general).toBeCloseTo(55);
    expect(Object.values(fromCN).reduce((a, b) => a + b, 0)).toBeCloseTo(100);
    expect(cargoFlowsByType(100, 'KE').perishable).toBeGreaterThan(3 * fromCN.perishable);
  });
  it('the reference rate grows with distance', () => {
    expect(cargoRefRate(1000)).toBeCloseTo(1.08);
    expect(cargoRefRate(10_000)).toBeGreaterThan(3);
  });
});

describe('shippers choosing a carrier', () => {
  const offer = (o: Partial<CargoOffer> = {}): CargoOffer => ({ routeId: 'a', rate: 2, weeklyFrequency: 7, onTime: 85, stops: 0, capacityT: 1_000, ...o });
  const share = (offers: CargoOffer[], type: 'general' | 'express' = 'general') => allocateCargo(100, offers, 2, type).get('a') ?? 0;
  it('ships more with a cheaper rate, more flights and better punctuality', () => {
    const base = share([offer()]);
    expect(share([offer({ rate: 1.6 })])).toBeGreaterThan(base);
    expect(share([offer({ weeklyFrequency: 21 })])).toBeGreaterThan(base);
    expect(share([offer({ onTime: 97 })])).toBeGreaterThan(base);
    expect(share([offer({ stops: 1 })])).toBeLessThan(base);
  });
  it('express cares more about frequency than general freight does', () => {
    const gain = (t: 'general' | 'express') => share([offer({ weeklyFrequency: 21 })], t) / share([offer({ weeklyFrequency: 3 })], t);
    expect(gain('express')).toBeGreaterThan(gain('general'));
  });
  it('never ships more than the capacity', () => {
    expect(share([offer({ capacityT: 5, rate: 0.5 })])).toBeLessThanOrEqual(5);
  });
});
