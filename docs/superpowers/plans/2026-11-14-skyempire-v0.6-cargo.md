# SkyEmpire v0.6 "Cargo" Implementation Plan

> Execute with superpowers:executing-plans. TDD on every task: failing test → watch it fail → implement → green suite → commit.

**Goal:** Airline types (Passenger / Passenger + Cargo / Cargo only), cargo demand in tonnes with six cargo types, about 33 real freighters (new, conversions, used, coming), belly cargo (Default or Custom per route), conversions, deliveries, cargo rivals and the cargo UI.

**Spec:** `docs/superpowers/specs/2026-11-14-skyempire-v0.6-cargo-design.md`

## Global Constraints
- A cargo-only airline can never operate passenger aircraft or passenger routes. This is enforced in the commands, not only in the UI.
- Old saves load: schema 5 migration. With belly cargo on Default, passenger results change only by the added cargo revenue and handling cost.
- Nonstop passenger behaviour is otherwise unchanged. The golden snapshot changes only because belly cargo adds revenue.
- All data is real and credited: freighter specs and photos, airport cargo tonnes, cargo airlines. Estimates are marked "SkyEmpire estimate".

## Review Focus
1. **A cargo-only airline sending passenger commands** (lease a passenger type, open a passenger route, buy used without converting). All must be rejected.
2. **Converting an aircraft that is on a route, leased, or in a refit.** All must be rejected with a clear reason.
3. **Belly hold share above 75%.** Passenger quality must drop. Belly Off must give exactly zero cargo.
4. **Ordering a 2027 type in 2026.** No flying and no lease charges before delivery; it flies on its delivery day.
5. **Perishables on a route with poor on-time.** Revenue must be reduced by spoilage; the dangerous-goods type needs the licence.

### Task 1: Data (freighters, belly, airport cargo, export index, cargo airlines, photos)
- Merge the research output into `packages/data/src`: `aircraft.json` (freighters), `aircraft-details.json`, belly (`bellyT` on passenger types), `cargo.json` (airports and export index), `airlines.world.json` (cargo airlines, airline `kind`), photos via `build-aircraft-photos.ts`, and CREDITS.
- Schema tests: every freighter has payload, details and a photo; conversion `from` ids exist; every passenger type has `bellyT`; cargo airline hubs exist.

### Task 2: Shared types and save format
- Types: `AircraftType` (kind, payloadT, bellyT, entryYear, conversion, special); `Airline` (kind, bellyCargo, dgLicence); `Route` (kind, cargoRate, cargoAccept, belly); `Aircraft.deliveryDay`; `RouteDayStats` (cargoT, cargoRevenue).
- Commands: `convertAircraft`, `buyDgLicence`, `setBellyCargo`; `openRoute`/`updateRoute` gain `kind`, `cargoRate`, `cargoAccept` and `belly`; `buyUsedAircraft` gains `convertTo`.
- Migration to schema 5.

### Task 3: Cargo demand and allocation (`packages/sim/src/cargo.ts`)
- **Tests:** flows are one-sided (PVG→LAX > LAX→PVG); hubs dominate; Q4 peak; Lunar New Year dip from CN; mail flat; reference rate; shipper share rises with frequency and on-time, and falls with rate; express weights frequency more.

### Task 4: Cargo in the day sim
- **Tests:**
  - cargo routes carry tonnes ≤ payload per direction per leg and earn rate × type multiplier;
  - handling costs apply;
  - perishable spoilage applies;
  - dangerous goods need the licence;
  - special cargo needs a special freighter;
  - belly cargo on passenger routes (Default) adds revenue; Off adds none;
  - a Custom hold share > 75% lowers passenger quality;
  - preview gives the expected tonnes and a suggested rate.

### Task 5: Fleet rules, conversions, deliveries and licence
- **Tests:**
  - airline kind rules (a cargo-only airline can't lease passenger types; a passenger airline can't lease freighters);
  - `convertAircraft` (owned, convertible, unassigned, not in refit; cost and days; becomes the freighter);
  - buying used with conversion;
  - `entryYear` orders get a `deliveryDay`, don't fly and aren't charged a lease until delivered;
  - `buyDgLicence` costs $250k and is one-time.

### Task 6: New game, progression and AI
- **Tests:**
  - the new-game airline kind;
  - rivals include 3 cargo airlines;
  - combination carriers get freighters;
  - cargo tiers and goals for cargo-only;
  - cargo AI opens profitable cargo routes within 90 days, with no bankruptcies in the balance test.

### Task 7: UI
- New Airline type step; market type filter and freighter cards; buy & convert; fleet Convert; route editor cargo and belly sections; map dashed cargo routes; finance split; overview tonnes; airline screen licence and belly switch.
- Renderer tests for each.

### Task 8: Docs, e2e, review, release v0.6.0
