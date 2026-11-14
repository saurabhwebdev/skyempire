# SkyEmpire v0.4 "Cabin" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. TDD on every task: write the failing test, watch it fail, implement, watch it pass.

**Goal:** A per-class cabin designer (seats, legroom, dense rows, IFE, meals, extras) that drives quality and cost, plus saved layouts and search, filter and sort on every list.

**Architecture:**
- A new pure module, `packages/sim/src/cabin.ts`, owns all product rules: units, scores, costs, mass and validation. The day sim, commands, preview, AI and UI all call it.
- Quality becomes per class.
- Save schema 3 migrates service levels into products.
- The UI gets `CabinDesigner` and a shared `ListToolbar` with pure filter and sort helpers.

**Tech stack:** TypeScript, zod, Vitest, React 19, Playwright (Electron).

**Spec:** `docs/superpowers/specs/2026-11-14-skyempire-v0.4-cabin-design.md`

## Global Constraints
- Numbers (units, scores, costs, masses, refit days) are exactly as in the spec tables.
- Max three classes: economy, premium, business. No fourth cabin.
- Standard-fit units are 1 / 1.5 / 2.5, so every migrated cabin stays valid.
- Old saves (schema 1 and 2) load; `CURRENT_SCHEMA = 3`.
- $0 budget: no new paid services and no new runtime dependencies.

## Review Focus
1. **Migrated v0.3 save with a full cabin.** It must load, and every aircraft must stay valid and keep flying. Test in migrate.test.
2. **Refit on an aircraft assigned to routes.** It must be grounded for N days, then fly again, and its routes must not be deleted. Test in tick or daySim.
3. **Meal changes alone.** They must cost nothing and cause no downtime. Test in commands.
4. **Disallowed product** (for example a chef meal in economy, or dense on a narrowbody). It must be rejected with a clear reason. Test in cabin.test.
5. **Filters that match nothing.** The list must show an empty state with "Clear filters", not a blank area. Test in the UI.

---

### Task 1: Shared types, catalog row data and commands
**Files:**
- `packages/shared/src/types.ts`, `commands.ts`
- `packages/data/src/index.ts`, `aircraft-details.json`, `schema.ts`
- Tests in `packages/data/src/aircraft-media.test.ts` and `packages/shared` command tests

**Produces:**
- `EconomySeat`, `PremiumSeat`, `BusinessSeat`, `Ife`, `Meal`, `ClassProduct<S>`, `CabinProduct`, `CabinConfig`, `CabinTemplate`.
- `Aircraft.product`, `dense`, `refitDaysLeft`. `Airline.cabinTemplates` (with `serviceLevel` removed).
- `AircraftType.abreast?` and `denseAbreast?`, merged from the details file by `loadCatalog`.
- Commands: `leaseAircraft`, `buyAircraft` and `buyUsedAircraft` take `{ config }`; `setCabin { aircraftId, config }`; `saveCabinTemplate { name, typeId, config }`; `deleteCabinTemplate { templateId }`. `setServiceLevel` is removed.

- [ ] Tests:
  - the catalog has `abreast` for all types;
  - `denseAbreast` exists only for A332/A333/A339/B763/B772/A359/A35K and is greater than `abreast`;
  - `CommandSchema` parses `setCabin` with a config and rejects an unknown meal.
- [ ] Implement, then run `pnpm --filter @skyempire/data test` and `pnpm --filter @skyempire/shared test`. Commit.

### Task 2: `cabin.ts` product rules
**Files:** `packages/sim/src/cabin.ts`, `cabin.test.ts`, export from `index.ts`.

**Produces:**
- `SEAT_UNITS`, `SEAT_SCORE`, `IFE_SCORE`, `MEAL_SCORE`, `ALLOWED_MEALS`.
- `standardProduct()`, `configUnits(config, type)`, `productScore(product, cls, dense, blockH)`.
- `installCost(config)`, `upgradeCost(config)`, `refitCost(old, next)`, `refitDays(old, next, type)`.
- `perPaxServiceCost(product, cls)`, `ifeCostPerBlockHour(product)`, `fuelFactor(config, type)`.
- `checkConfig(config, type): string | null`, `defaultConfig(type, personality)`.

- [ ] Tests:
  - the standard fit has the same units as v0.3;
  - dense on a 777-200 gives 0.9× economy units;
  - dense on an A320 is rejected;
  - a chef meal in economy is rejected;
  - long-haul weights IFE more than short-haul;
  - a suite costs more than flat;
  - a meal-only change gives refit cost 0 and 0 days;
  - a seat-type change on a widebody gives 10 days;
  - buy on board has a negative cost;
  - `fuelFactor` of the standard fit is 1, and suites are above 1;
  - the gulf default has a suite, and the budget default is slimline.
- [ ] Implement, then run `pnpm --filter @skyempire/sim exec vitest run src/cabin.test.ts`. Commit.

### Task 3: Commands (fleet and templates)
**Files:** `packages/sim/src/commands/fleet.ts`, `airline.ts`, `apply.ts`, `commands.test.ts`, `errors.ts`.

- [ ] Tests:
  - lease with an upgraded config charges lease plus upgrade cost;
  - `setCabin` changing seats sets `refitDaysLeft`, charges the refit cost, and fails without enough cash;
  - a meal-only `setCabin` is free and instant;
  - `setCabin` is rejected while a refit is running;
  - save and delete template work, with a maximum of 30;
  - `setServiceLevel` no longer exists.
- [ ] Implement, then run `pnpm --filter @skyempire/sim test`. Commit.

### Task 4: Day sim, quality per class, costs and refit countdown
**Files:** `daySim.ts`, `quality.ts`, `economics.ts`, `preview.ts`, `maintenance.ts` or `tick.ts`, `reputation` input, `view.ts`, and their tests.

- [ ] Tests:
  - a route with a business suite wins more business passengers than an otherwise identical rival with recliners;
  - service cost follows meals (hot costs more than snack);
  - Wi-Fi adds a per-block-hour cost;
  - an aircraft with `refitDaysLeft > 0` flies 0 trips; the countdown reaches 0 and it flies again; its route still exists;
  - fuel cost rises with the suite cabin.
- [ ] Implement, then run `pnpm --filter @skyempire/sim test`. Commit.

### Task 5: Migration to schema 3, AI products and new game
**Files:** `migrate.ts`, `migrate.test.ts`, `newGame.ts`, `ai/decide.ts`, `ai/personalities.ts`, `fleet.ts`.

- [ ] Tests:
  - a schema-2 save with `serviceLevel` 5 migrates: aircraft get premium IFE and hot meals, business gets dining, amenity kit and lounge;
  - `serviceLevel` is gone and `cabinTemplates` is `[]`;
  - all configs pass `checkConfig`;
  - a v1 save migrates through 2 to 3;
  - AI lease commands carry a personality config.
- [ ] Implement, run all sim tests, commit.

### Task 6: Cabin designer UI
**Files:**
- `apps/desktop/src/renderer/screens/Fleet/CabinDesigner.tsx` (replaces `CabinEditor.tsx`)
- `components/SeatMap.tsx`, `lib/aircraftMedia.ts`
- `AircraftMarket.tsx`, `AircraftInspector.tsx`, `FleetTray.tsx`, `Airline/Airline.tsx`, `testing.ts`
- Tests

- [ ] Tests:
  - the designer shows class tabs, and seat-type cards change the unit count and seat map;
  - the dense toggle appears only on A333 and not on A320;
  - an over-limit config disables confirm and shows an alert;
  - refit mode shows cost and "out of service 10 days";
  - "Save as layout" sends `saveCabinTemplate`, and the layout appears under "Start from";
  - the seat map draws a suite business cabin as a 1-2-1 row on a widebody;
  - the fleet status shows "Refit · 4d".
- [ ] Implement, then run the desktop vitest. Commit.

### Task 7: Search, filter and sort everywhere
**Files:**
- `packages/ui/src/components/ListToolbar.tsx`
- `apps/desktop/src/renderer/lib/listFilters.ts` and tests
- Aircraft market, fleet tray, network tray, News, Market (rivals), LoadDialog, NotificationCenter, airport pickers

- [ ] Tests:
  - `filterAircraftTypes` by search, class, manufacturer and availability;
  - `sortBy` keys for price, range and fuel per seat;
  - used-listing sort by age and condition;
  - fleet status filter including refit;
  - route filter for losing and grounded;
  - a filter matching nothing renders "Clear filters", and clicking it restores the full list.
- [ ] Implement, run the desktop vitest, commit.

### Task 8: Docs, version, end-to-end and release
- [ ] CHANGELOG 0.4.0 "Cabin", README status, version 0.4.0.
- [ ] e2e: lease with a custom cabin, refit, save, reload.
- [ ] Full suite, lint, typecheck, final review, merge, tag v0.4.0, release notes.
