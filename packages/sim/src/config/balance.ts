/** Every tunable number in the simulation. Values from docs/simulation-spec.md. */
export const BALANCE = {
  // Demand (§3)
  // Fitted (log least squares) to ~24 real city pairs' annual traffic: within ~2× each.
  demandK: 206,
  alpha: 0.3,
  wealthExponent: 0.125,
  domesticFactor: 3.5,
  shortHaulKm: 150,
  shortHaulFactor: 0.2,
  distanceExponent: 0,
  businessShareBase: 0.05,
  businessShareSlope: 0.1,
  premiumShare: 0.06,
  refFareBase: 45,
  refFarePerKm: 0.08, // first refFareTaperKm km
  refFareTaperKm: 1500,
  refFarePerKmLong: 0.045, // beyond the taper
  classFareMultiplier: { economy: 1, premium: 1.8, business: 3.5 },
  elasticity: { economy: 1.2, premium: 0.8, business: 0.5 },
  demandCap: 1.5,

  // Passenger choice (§4)
  betaPrice: { economy: 2.0, premium: 2.0, business: 1.0 },
  betaFrequency: 0.6,
  betaQuality: 1.2,
  betaReputation: 1.0,
  betaStops: 1.5,
  utilityNone: -1.0,

  // Operations (§5)
  aircraftHoursPerDay: 18,
  weeklyHours: 126,
  blockOverheadH: 0.5,
  baseOnTime: 85,

  // Costs (§6)
  overheadBase: 50_000,
  overheadPerAircraft: 20_000,
  baseSetupPerSize: 2_000_000 / 3,
  baseUpkeepPerSize: 100_000,
  basePairDiscount: 0.9,
  serviceCostPerPax: [0, 2, 5, 9, 14, 20],
  serviceClassMultiplier: { economy: 1, premium: 1.5, business: 3 },
  serviceScore: [0, 20, 40, 60, 80, 100],
  seatUnits: { economy: 1, premium: 1.5, business: 2.5 },

  // Maintenance (§7)
  wearPerHour: 0.02,
  aCheckHours: 500,
  aCheckCost: 50_000,
  aCheckDays: 1,
  cCheckHours: 6000,
  cCheckCost: 1_500_000,
  cCheckDays: 7,

  // Reputation (§8)
  reputationWeights: { onTime: 0.3, quality: 0.25, priceFairness: 0.15, fleetYouth: 0.15, marketing: 0.15 },
  reputationEmaDays: 30,

  // Finance (§9)
  creditShare: 0.4,
  minCredit: 5_000_000,
  ratingRates: { A: 0.04, B: 0.06, C: 0.09, D: 0.12 },
  bankruptcyDays: 30,
  usedValueDecay: 0.92,

  // Fuel & economy
  fuelPriceStart: 0.95,
  fuelPriceMin: 0.7,
  fuelPriceMax: 1.4,

  // Game setup
  startingCash: { easy: 80_000_000, normal: 50_000_000, hard: 25_000_000 },
  aiCashFactor: { easy: 0.7, normal: 1, hard: 1.5 },
  aiStartingFleet: { easy: 4, normal: 6, hard: 10 },
  aiNoise: { easy: 0.3, normal: 0.15, hard: 0.05 },
  aiCadenceFactorHard: 0.7,

  // Real-time speeds (ms per game day)
  msPerDay: { 1: 6000, 2: 3000, 4: 1500, 8: 750 },
  tickBudgetMs: 200,
} as const;
