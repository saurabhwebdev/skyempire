import type { CabinConfig, CabinProduct } from '@skyempire/shared';
import { describe, expect, it } from 'vitest';
import {
  checkConfig, configUnits, defaultConfig, fuelFactor, ifeCostPerBlockHour, installCost, perPaxServiceCost, productScore,
  refitCost, refitDays, standardProduct, upgradeCost,
} from './cabin';
import { seatUnits } from './ops';
import { type } from './testing';

const cfg = (seats: CabinConfig['seats'], patch: Partial<{ [K in keyof CabinProduct]: Partial<CabinProduct[K]> }> = {}, dense = false): CabinConfig => {
  const p = standardProduct();
  return {
    seats,
    dense,
    product: {
      economy: { ...p.economy, ...patch.economy },
      premium: { ...p.premium, ...patch.premium },
      business: { ...p.business, ...patch.business },
    },
  };
};

describe('cabin units', () => {
  it('the standard fit takes the same floor as v0.3 cabins', () => {
    const seats = { economy: 150, premium: 12, business: 8 };
    expect(configUnits(cfg(seats), type('A20N'))).toBeCloseTo(seatUnits(seats));
  });
  it('a dense 3-4-3 row on a 777-200 fits 10 seats where 9 went', () => {
    const t = type('B772');
    expect(configUnits(cfg({ economy: 300, premium: 0, business: 0 }, {}, true), t)).toBeCloseTo(270);
  });
  it('bigger seats take more floor', () => {
    const t = type('B789');
    const flat = configUnits(cfg({ economy: 0, premium: 0, business: 10 }, { business: { seat: 'flat' } }), t);
    const suite = configUnits(cfg({ economy: 0, premium: 0, business: 10 }, { business: { seat: 'suite' } }), t);
    expect(suite).toBeGreaterThan(flat);
    expect(flat).toBeGreaterThan(25);
  });
});

describe('checkConfig', () => {
  it('accepts the standard fit', () => {
    expect(checkConfig(cfg({ economy: 180, premium: 0, business: 0 }), type('A20N'))).toBeNull();
  });
  it('rejects too many seats', () => {
    expect(checkConfig(cfg({ economy: 400, premium: 0, business: 0 }), type('A20N'))).toMatch(/seat units/);
  });
  it('rejects a dense row where the aircraft has none', () => {
    expect(checkConfig(cfg({ economy: 150, premium: 0, business: 0 }, {}, true), type('A20N'))).toMatch(/denser/);
  });
  it('rejects meals and extras a class does not offer', () => {
    const t = type('B789');
    expect(checkConfig(cfg({ economy: 200, premium: 0, business: 0 }, { economy: { meal: 'chef' } }), t)).toMatch(/economy/i);
    expect(checkConfig(cfg({ economy: 200, premium: 0, business: 0 }, { economy: { lounge: true } }), t)).toMatch(/lounge/i);
    expect(checkConfig(cfg({ economy: 200, premium: 0, business: 0 }, { economy: { amenityKit: true } }), t)).toMatch(/amenity/i);
    expect(checkConfig(cfg({ economy: 200, premium: 0, business: 20 }, { business: { meal: 'snack' } }), t)).toMatch(/business/i);
  });
  it('needs at least one seat', () => {
    expect(checkConfig(cfg({ economy: 0, premium: 0, business: 0 }), type('A20N'))).toMatch(/at least one seat/);
  });
});

describe('product score', () => {
  const p = standardProduct();
  it('better seats, screens and meals score higher', () => {
    const better: CabinProduct = { ...p, economy: { ...p.economy, seat: 'extraLegroom', ife: 'seatback', meal: 'hot' } };
    expect(productScore(better, 'economy', false, 3)).toBeGreaterThan(productScore(p, 'economy', false, 3));
  });
  it('screens matter more on long flights', () => {
    const screens: CabinProduct = { ...p, economy: { ...p.economy, ife: 'premium' } };
    const gainShort = productScore(screens, 'economy', false, 1) - productScore(p, 'economy', false, 1);
    const gainLong = productScore(screens, 'economy', false, 12) - productScore(p, 'economy', false, 12);
    expect(gainLong).toBeGreaterThan(gainShort);
  });
  it('a dense row scores lower', () => {
    expect(productScore(p, 'economy', true, 8)).toBeLessThan(productScore(p, 'economy', false, 8));
  });
  it('a suite with every extra is near the top', () => {
    const best: CabinProduct = { ...p, business: { seat: 'suite', ife: 'premium', meal: 'chef', amenityKit: true, lounge: true } };
    expect(productScore(best, 'business', false, 12)).toBeCloseTo(100);
  });
});

describe('costs', () => {
  it('suites cost more to install than flat beds', () => {
    const flat = cfg({ economy: 0, premium: 0, business: 20 }, { business: { seat: 'flat' } });
    const suite = cfg({ economy: 0, premium: 0, business: 20 }, { business: { seat: 'suite' } });
    expect(installCost(suite) - installCost(flat)).toBe(20 * 200_000);
  });
  it('a new aircraft pays only for upgrades over the standard fit', () => {
    expect(upgradeCost(cfg({ economy: 150, premium: 0, business: 12 }))).toBe(0);
    expect(upgradeCost(cfg({ economy: 150, premium: 0, business: 12 }, { economy: { ife: 'seatback' } }))).toBe(150 * 8_000);
    expect(upgradeCost(cfg({ economy: 150, premium: 0, business: 0 }, { economy: { ife: 'wifi' } }))).toBe(400_000);
    expect(upgradeCost(cfg({ economy: 160, premium: 0, business: 0 }, { economy: { seat: 'slimline' } }))).toBe(0);
  });
  it('changing only meals and extras is free and instant', () => {
    const t = type('B789');
    const a = cfg({ economy: 200, premium: 20, business: 30 });
    const b = cfg({ economy: 200, premium: 20, business: 30 }, { economy: { meal: 'hot' }, business: { meal: 'chef', lounge: true } });
    expect(refitCost(a, b)).toBe(0);
    expect(refitDays(a, b, t)).toBe(0);
  });
  it('changing seats on a widebody costs the new seats and takes 10 days', () => {
    const t = type('B789');
    const a = cfg({ economy: 200, premium: 20, business: 30 });
    const b = cfg({ economy: 200, premium: 20, business: 30 }, { business: { seat: 'flat' } });
    expect(refitCost(a, b)).toBe(30 * 200_000);
    expect(refitDays(a, b, t)).toBe(10);
    expect(refitDays(cfg({ economy: 180, premium: 0, business: 0 }), cfg({ economy: 170, premium: 0, business: 0 }), type('A20N'))).toBe(5);
    expect(refitDays(cfg({ economy: 70, premium: 0, business: 0 }), cfg({ economy: 68, premium: 0, business: 0 }), type('AT76'))).toBe(3);
  });
  it('running costs follow meals and extras; buy on board earns a little', () => {
    const p = standardProduct();
    expect(perPaxServiceCost({ ...p, economy: { ...p.economy, meal: 'hot' } }, 'economy')).toBeGreaterThan(perPaxServiceCost({ ...p, economy: { ...p.economy, meal: 'snack' } }, 'economy'));
    expect(perPaxServiceCost({ ...p, economy: { ...p.economy, meal: 'buyOnBoard' } }, 'economy')).toBeLessThan(0);
    expect(perPaxServiceCost({ ...p, business: { ...p.business, meal: 'dining', lounge: true, amenityKit: true } }, 'business')).toBe(35 + 30 + 15);
  });
  it('Wi-Fi costs money for every hour flown', () => {
    expect(ifeCostPerBlockHour(cfg({ economy: 180, premium: 0, business: 0 }))).toBe(0);
    expect(ifeCostPerBlockHour(cfg({ economy: 180, premium: 0, business: 0 }, { economy: { ife: 'wifi' } }))).toBe(60);
  });
  it('heavier cabins burn a little more fuel', () => {
    const t = type('B789');
    expect(fuelFactor(cfg({ economy: 200, premium: 20, business: 30 }), t)).toBeCloseTo(1);
    const heavy = cfg({ economy: 200, premium: 20, business: 30 }, { business: { seat: 'suite' }, economy: { ife: 'premium' } });
    expect(fuelFactor(heavy, t)).toBeGreaterThan(1);
    expect(fuelFactor(heavy, t)).toBeLessThan(1.05);
  });
});

describe('default cabins', () => {
  it('fit the aircraft for every airline style', () => {
    for (const t of ['AT76', 'A20N', 'B789', 'A388'].map(type))
      for (const p of [null, 'budget', 'legacy', 'regional', 'gulf', 'expander'] as const)
        expect(checkConfig(defaultConfig(t, p), t), `${t.id} ${p}`).toBeNull();
  });
  it('gulf carriers fly suites, budget airlines slimline seats and buy-on-board', () => {
    expect(defaultConfig(type('B77W'), 'gulf').product.business.seat).toBe('suite');
    const budget = defaultConfig(type('A20N'), 'budget');
    expect(budget.product.economy.seat).toBe('slimline');
    expect(budget.product.economy.meal).toBe('buyOnBoard');
    expect(budget.seats.economy).toBeGreaterThan(type('A20N').maxSeats);
  });
});
