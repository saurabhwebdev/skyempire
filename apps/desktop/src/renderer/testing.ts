import type { Airline, ClientView } from '@skyempire/shared';

/** Minimal ClientView for renderer tests. */
export function fakeView(p: Partial<Airline> = {}, v: Partial<ClientView> = {}): ClientView {
  const player: Airline = {
    id: 'al_player', name: 'Test Air', code: 'TST', colors: { primary: '#3366ff', secondary: '#ffffff' }, logoShape: 'wing',
    isPlayer: true, personality: null, cash: 50_000_000, loans: [], baseIds: ['LHR'], homeBaseId: 'LHR', reputation: 50,
    serviceLevel: 3, marketingPerMonth: 0, tier: 'startup', completedObjectives: [], daysInsolvent: 0, bankrupt: false,
    creditRating: 'B', totals: { pax: 0, revenue360: Array(12).fill(0) }, nextAiDecisionDay: 0, ...p,
  };
  return {
    day: 10, startYear: 2026, player, aircraft: [], routes: [], rivals: [], rivalRoutes: [],
    market: { fuelPricePerKg: 0.95, economyIndex: 1, usedListings: [] }, events: [], slotsFree: {}, objectives: [], gameOver: null, upcomingPeaks: [], weather: { today: {}, forecast: {} }, tensions: [], routeStatus: {}, preCancelled: {},
    finance: { companyValue: player.cash, availableCredit: 20_000_000, monthlyFixed: 1_000_000 }, ...v,
  };
}
