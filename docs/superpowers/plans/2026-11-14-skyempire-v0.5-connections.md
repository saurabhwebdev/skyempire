# SkyEmpire v0.5 "Connections" Implementation Plan

> Execute with superpowers:executing-plans, TDD on every task: failing test → watch it fail → implement → green suite → commit.

**Goal:** Multi-stop routes, fleet "use free hours" suggestions, seasonal fares from the travel-peaks card, and the side-menu key badge.

**Spec:** `docs/superpowers/specs/2026-11-14-skyempire-v0.5-connections-design.md`

## Global Constraints
- At most 2 stops. Through markets use the existing allocation stop penalty.
- Old saves load: schema 4 only bumps the version, and every new field is optional.
- Nonstop behaviour is unchanged. Existing sim tests and the golden snapshot only change when there's a reason.

## Review Focus
1. **A one-stop route where the through market overfills a leg.** Passengers must never exceed seats on any leg. Test in the sim.
2. **A stop that's closed (strike) or a banned leg.** The whole route can't fly that day.
3. **"Open best for all" when two aircraft would pick the same route.** The second must get a different route, with no duplicate error.
4. **Raising peak fares on a route that already has a seasonal fare over those dates.** It must be skipped and reported, not duplicated.
5. **A multi-stop route over the hours budget or slot limits.** It must be rejected with the existing clear messages.

### Task 1: Side-menu key badge
- **Test:** hovering a nav button shows its name and a `kbd` with the number. The text "· 1" is no longer present.
- **Code:** `shell/NavRail.tsx`.

### Task 2: Raise fares from Travel peaks
- **Tests:**
  - `routesForPeak(view, peak)` picks routes with any chain airport in the peak's countries;
  - `peakFareCommands(...)` builds `updateRoute` with the merged `seasonalFares` and skips overlaps or routes already at 4;
  - the UI shows the default %, applies it, and reports added and skipped counts.
- **Code:** `screens/Overview/PeaksCard.tsx`, `screens/Overview/peakFares.ts`.

### Task 3: Fleet suggestions
- **Sim tests** (`suggest.test.ts`):
  - an idle A20N at LHR gets 1–3 profitable suggestions within range;
  - none duplicate the player's existing routes;
  - frequency fits the free hours;
  - an aircraft with no free hours gets none.
- **Worker and IPC:** a `suggestRoutes` request, plus a preload method.
- **UI test:** the panel lists underused aircraft; Open sends `openRoute`; Open best for all opens one route per aircraft with no duplicates.
- **Code:** `packages/sim/src/suggest.ts`; `apps/desktop/src/worker/simHandler.ts`, `main/ipc.ts`, `preload`, `shared/ipc.ts`; `screens/Fleet/FreeHours.tsx`, `FleetTray.tsx`.

### Task 4: Multi-stop routes (sim)
- **Helpers in `routing.ts`:** `routeChain(route)`, `routeLegs(route)`, `routeMarkets(route)` (pairs with stops count), `marketFare(route, a, b, cls, day)`.
- **Tests:**
  - `openRoute` with stops validates range per leg, rejects repeated airports and more than 2 stops, and enforces the base rule, slots (stops ×2) and hours (Σ legs);
  - the day sim carries passengers in all 3 markets;
  - leg capacity is never exceeded;
  - a strike at the stop closes the route;
  - revenue = Σ market pax × market fare;
  - costs scale with the summed legs;
  - preview returns suggested fares per market;
  - migration to schema 4 is a version bump.
- **Code:** `routing.ts`, `daySim.ts` (market offers + leg capacity), `tick.ts`, `economics.ts` (per-leg costs), `commands/routes.ts`, `commands/slots.ts`, `ops.ts`, `preview.ts`, `view.ts`, `tensions.ts`, `migrate.ts`, `shared types/commands`.

### Task 5: Multi-stop routes (UI)
- **Tests:**
  - the route editor's "Add a stop" adds a stop picker, at most 2;
  - the fare table shows 3 markets for 1 stop;
  - submitting sends `openRoute` with `stops` and `legFares`;
  - the network tray and inspector label reads `LHR → DXB → SIN`;
  - the map layer builds a path through the stops.
- **Code:** `RouteEditor.tsx`, `RouteInspector.tsx`, `NetworkTray.tsx`, `lib/routes.ts` (label), `map/layers.ts`, `listFilters` (chain search).

### Task 6: Docs, e2e, release v0.5.0
- CHANGELOG, README, version 0.5.0.
- e2e: open a one-stop route through the editor and fly a day.
- Final review, fixes, merge, tag, release notes.
