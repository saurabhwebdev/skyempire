# SkyEmpire v0.1 "First Flight" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an offline, single-player Windows airline-management game (whole world, ~1,000 airports, 20 airlines, 19 real aircraft types) with installer + auto-update on GitHub Releases.

**Architecture:** pnpm/Turborepo monorepo. A pure, deterministic TypeScript simulation (`packages/sim`) runs in an Electron `utilityProcess`; the Electron main process owns saves (SQLite) and relays commands/views over IPC; a React renderer draws a MapLibre + deck.gl map and management panels. The renderer never computes game results — it sends commands and renders `ClientView` snapshots.

**Tech Stack:** TypeScript 5 (strict), Node 22, pnpm 9, Turborepo, Electron + electron-vite, React 19, Vite, Tailwind CSS v4, Radix UI primitives, lucide-react, motion, Zustand, TanStack Query + Virtual, Recharts, MapLibre GL JS, deck.gl, Natural Earth GeoJSON, better-sqlite3 + Drizzle, Zod, Vitest, Testing Library, Playwright, electron-builder, electron-updater, GitHub Actions.

**Spec:**
- `docs/superpowers/specs/2026-11-13-skyempire-design.md` (scope, systems)
- `docs/simulation-spec.md` (all formulas and constants)
- `docs/technical-architecture.md` (stack, layout, IPC, saves)
- `docs/ui-ux-design.md` (screens, tokens, components, motion, a11y)
- `docs/roadmap.md` (v0.1 contents)

## Global Constraints

- Language: TypeScript `strict: true`, ESM everywhere. Node 22.x, pnpm 9.x.
- `packages/sim` must not import DOM, Node built-ins, Electron, or `Math.random()`/`Date.now()`. All randomness via the seeded RNG in Task 3.
- Money is **integer USD** (`Money = number`, always `Math.round` before storing in state).
- Game calendar: 1 tick = 1 day; month = 30 days; year = 360 days; day 0 = 1 Jan, Year 1.
- All balance constants live in `packages/sim/src/config/balance.ts` with the values from `simulation-spec.md` verbatim.
- **Real names:** real aircraft (ICAO type code as id) with real silhouettes, and ~150 real airlines worldwide (name, IATA/ICAO, approximate brand color). **No logo files in the repo or installer** — logos arrive only through the runtime logo-pack download or the player's `logos/` folder (Task 32). README + About screen carry the exact text: "SkyEmpire is not affiliated with any airline or aircraft manufacturer. Names are used for identification only."
- Every data entry has a `sources` field; all sources are listed in `CREDITS.md`.
- Speeds: Pause / 1× = 6000 ms per day / 2× = 3000 / 4× = 1500 / 8× = 750.
- Difficulty starting cash: Easy $80,000,000 · Normal $50,000,000 · Hard $25,000,000.
- v0.1 world = player + 19 AI, picked from the airline database: 10 with hubs nearest the player's hub + 9 largest global majors not already picked. All 5 personalities are in v0.1.
- UI: dark theme only, English only, all user-visible strings in `apps/desktop/src/renderer/strings/en.ts` (i18n-ready). Buttons are verb + object ("Open route", never "OK"/"Submit").
- Animate only `transform` and `opacity`; motion tokens from `ui-ux-design.md §6`; honor `prefers-reduced-motion` and the in-game "Reduce motion" setting.
- Electron security: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, strict CSP, no remote content.
- Every commit message ends with the session attribution lines required by the harness.

## Review Focus

1. **Corrupt or outdated save file** → loading shows "This save can't be opened" with the reason and returns to the menu; never crashes, never overwrites the file. (Test in Task 19.)
2. **Cash goes negative** (monthly leases/overheads) → game continues, cash-spending commands are rejected with "Not enough cash — you need $X more", bankruptcy only after 30 consecutive days with no credit. (Test in Task 11.)
3. **Airport closed by strike/storm while routes are active** → those flights are cancelled for the day: no revenue, no fuel/crew cost, fixed costs still charged, on-time drops. (Test in Task 13.)
4. **Selling/returning an aircraft that flies routes** → its assignments are removed, routes left with zero assignments become `suspended` (kept, slots released, shown in UI), not deleted. (Test in Task 10.)
5. **App quits during autosave** → snapshot writes happen in one SQLite transaction; a failed write leaves the previous snapshot intact and loadable. (Test in Task 19.)

---

## File Structure

```
/ (repo root = /home/admin1/webtools/airlinewebsite)
├─ package.json, pnpm-workspace.yaml, turbo.json, tsconfig.base.json, .npmrc
├─ eslint.config.js, .prettierrc, vitest.workspace.ts, LICENSE (MIT), CREDITS.md
├─ .github/workflows/ci.yml, release.yml
├─ packages/shared/src/
│   ├─ types.ts            # entity types (Airport, AircraftType, Aircraft, Route, Airline, GameState…)
│   ├─ commands.ts         # Zod schemas + Command union
│   ├─ view.ts             # ClientView, TickPush, PreviewResult, Notification
│   ├─ ipc.ts              # GameApi interface (preload contract), worker message types
│   └─ format.ts           # formatMoney, formatPct, formatPax
├─ packages/data/
│   ├─ scripts/build-airports.ts   # OurAirports + GeoNames + World Bank → JSON
│   ├─ src/heuristics.ts           # sizeClass, slots, fees, indices
│   ├─ src/aircraft.json, src/airlines.world.json, src/routes.world.json, src/overrides.world.json
│   ├─ src/silhouettes/<ICAO>.svg (side + top views)
│   ├─ src/airports.world.json (generated, committed)
│   ├─ src/basemap/countries-50m.geojson (Natural Earth, committed)
│   └─ src/index.ts                # loadCatalog(regionId): Catalog
├─ packages/sim/src/
│   ├─ config/balance.ts
│   ├─ rng.ts, calendar.ts, geo.ts, ops.ts
│   ├─ demand.ts, allocation.ts, quality.ts
│   ├─ commands/apply.ts (+ one file per command family: fleet.ts, routes.ts, finance.ts, airline.ts)
│   ├─ economics.ts         # per-route daily revenue & costs
│   ├─ finance.ts           # monthly charges, interest, credit, company value, bankruptcy
│   ├─ maintenance.ts, reputation.ts
│   ├─ market.ts, events.ts
│   ├─ ai/personalities.ts, ai/decide.ts
│   ├─ progression.ts       # tiers + objectives
│   ├─ newGame.ts, tick.ts, preview.ts, view.ts
│   └─ index.ts
├─ packages/sim/scripts/balance-report.ts
├─ packages/ui/src/
│   ├─ tokens.css, motion.css, fonts.ts
│   └─ components/ (Button, NumberInput, Slider, Combobox, DataTable, KpiTile, Panel, Toast, Modal, Tooltip, Meter, EmptyState, Skeleton)
└─ apps/desktop/
    ├─ electron.vite.config.ts, electron-builder.yml
    ├─ src/main/ index.ts, window.ts, ipc.ts, simHost.ts, gameLoop.ts, saves/db.ts, saves/saves.ts, settings.ts, updater.ts
    ├─ src/worker/ simWorker.ts
    ├─ src/preload/ index.ts
    ├─ src/renderer/ main.tsx, App.tsx, store.ts, hooks/useGame.ts, shortcuts.ts, strings/en.ts
    │   ├─ shell/ TopBar.tsx, NavRail.tsx, Inspector.tsx, BottomTray.tsx
    │   ├─ map/ WorldMap.tsx, layers.ts
    │   └─ screens/ Title/, NewAirline/, Overview/, Network/, Fleet/, Finance/, Market/, Airline/, News/, Settings/, GameOver/, Onboarding/
    └─ e2e/ smoke.spec.ts
```

**Two deliberate simplifications vs. `technical-architecture.md`** (update that doc in Task 1):
- Basemap = **Natural Earth 1:50m countries GeoJSON** rendered by MapLibre (no PMTiles, no glyph server); city labels via deck.gl `TextLayer`. Smaller, public domain, fully offline.
- Worker pushes a full **`ClientView`** (player-scoped, < 500 KB) after each tick instead of diffs. Revisit for multiplayer.

---

## Shared interfaces (defined in Task 2, used everywhere)

```ts
// packages/shared/src/types.ts
export type Money = number;                       // integer USD
export type CabinClass = 'economy' | 'premium' | 'business';
export type Cabin = Record<CabinClass, number>;   // seats
export type AircraftClass = 'turboprop' | 'regional' | 'narrowbody' | 'longNarrowbody' | 'widebody';
export type PersonalityId = 'budget' | 'legacy' | 'regional' | 'gulf' | 'expander';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type TierId = 'startup' | 'regional' | 'national';

export interface Airport { id: string /*IATA*/; icao: string; name: string; city: string; country: string;
  lat: number; lon: number; sizeClass: 1|2|3|4|5|6; population: number /*millions*/; wealth: number;
  tourism: number; business: number; runwayM: number; slotCapacity: number;
  landingFeePerTonne: Money; paxFee: Money; }

export interface AircraftType { id: string; name: string; manufacturer: string; class: AircraftClass;
  maxSeats: number; rangeKm: number; cruiseKmh: number; fuelKgPerH: number; priceUsd: Money;
  leasePerMonth: Money; maintPerH: Money; crewPerH: Money; minRunwayM: number; turnaroundMin: number;
  mtowT: number; comfort: number /*0-100*/; tier: TierId; }

export interface Catalog { regionId: string; airports: Record<string, Airport>; aircraftTypes: Record<string, AircraftType>; }

export interface Aircraft { id: string; typeId: string; ownerId: string; ownership: 'owned' | 'leased';
  ageDays: number; condition: number; flightHours: number; hoursSinceA: number; hoursSinceC: number;
  cabin: Cabin; status: 'active' | 'maintenance'; maintenanceDaysLeft: number; bookValue: Money; }

export interface Assignment { aircraftId: string; roundTripsPerWeek: number; }
export interface RouteDayStats { pax: Cabin; loadFactor: number; revenue: Money; cost: Money; profit: Money; }
export interface Route { id: string; airlineId: string; from: string; to: string; fares: Record<CabinClass, Money>;
  assignments: Assignment[]; status: 'active' | 'suspended'; openedDay: number;
  last: RouteDayStats | null; profit30: Money[] /* ring, newest last, max 30 */; }

export interface Loan { id: string; principal: Money; annualRate: number; takenDay: number; }
export interface Airline { id: string; name: string; code: string; colors: { primary: string; secondary: string };
  logoShape: 'circle' | 'square' | 'diamond' | 'wing'; isPlayer: boolean; personality: PersonalityId | null;
  cash: Money; loans: Loan[]; baseIds: string[]; homeBaseId: string; reputation: number;
  serviceLevel: 1|2|3|4|5; marketingPerMonth: Money; tier: TierId; completedObjectives: string[];
  daysInsolvent: number; bankrupt: boolean; creditRating: 'A'|'B'|'C'|'D';
  totals: { pax: number; revenue360: Money[] /* monthly ring of 12 */ }; nextAiDecisionDay: number; }

export interface ActiveEvent { id: string; kind: EventKind; startDay: number; endDay: number;
  airportId?: string; magnitude: number; }
export type EventKind = 'fuelSpike' | 'recession' | 'boom' | 'strike' | 'storm' | 'expansion';

export interface UsedListing { id: string; typeId: string; ageDays: number; condition: number; price: Money; }

export interface GameState { schemaVersion: 1; seed: number; rngState: number; day: number;
  regionId: string; difficulty: Difficulty; playerId: string;
  airlines: Record<string, Airline>; aircraft: Record<string, Aircraft>; routes: Record<string, Route>;
  market: { fuelPricePerKg: number; economyIndex: number; usedListings: UsedListing[] };
  slotsUsed: Record<string, number>; airportSlotBonus: Record<string, number>; events: ActiveEvent[];
  nextId: number; gameOver: null | { reason: 'bankrupt'; day: number }; }
```

```ts
// packages/shared/src/view.ts
export interface Notification { id: string; day: number; level: 'info' | 'warning' | 'major';
  title: string; body: string; link?: { kind: 'route' | 'aircraft' | 'airport' | 'airline'; id: string }; }
export interface AirlineDaily { day: number; airlineId: string; cash: Money; revenue: Money; pax: number;
  costs: { fuel: Money; crew: Money; maintenance: Money; fees: Money; service: Money; leases: Money;
           interest: Money; overhead: Money; bases: Money; marketing: Money }; }
export interface TickSummary { day: number; daily: AirlineDaily[]; notifications: Notification[]; autoPause: boolean; }
export interface PreviewResult { ok: boolean; reason?: string; expectedLoadFactor?: number;
  expectedProfitPerDay?: Money; paybackDays?: number | null; suggestedFares?: Record<CabinClass, Money>;
  demandPerDay?: number; competitors?: number; distanceKm?: number; }
export interface RivalSummary { id: string; name: string; code: string; color: string; personality: PersonalityId;
  fleetSize: number; routeCount: number; reputation: number; overlapRoutes: number; }
export interface ClientView { day: number; player: Airline; aircraft: Aircraft[]; routes: Route[];
  rivals: RivalSummary[]; rivalRoutes: { airlineId: string; from: string; to: string }[];
  market: GameState['market']; events: ActiveEvent[]; slotsFree: Record<string, number>;
  objectives: { id: string; title: string; done: boolean }[]; gameOver: GameState['gameOver']; }
```

```ts
// packages/shared/src/commands.ts — Zod discriminated union on `type`
type Command =
 | { type: 'leaseAircraft'; typeId: string; cabin: Cabin }
 | { type: 'buyAircraft'; typeId: string; cabin: Cabin }
 | { type: 'buyUsedAircraft'; listingId: string; cabin: Cabin }
 | { type: 'sellAircraft'; aircraftId: string }          // owned → sold at market value; leased → returned
 | { type: 'setCabin'; aircraftId: string; cabin: Cabin }
 | { type: 'openRoute'; from: string; to: string; fares: Record<CabinClass, Money>; assignments: Assignment[] }
 | { type: 'updateRoute'; routeId: string; fares?: Record<CabinClass, Money>; assignments?: Assignment[] }
 | { type: 'closeRoute'; routeId: string }
 | { type: 'openBase'; airportId: string }
 | { type: 'closeBase'; airportId: string }
 | { type: 'takeLoan'; amount: Money }
 | { type: 'repayLoan'; loanId: string; amount: Money }
 | { type: 'setServiceLevel'; level: 1|2|3|4|5 }
 | { type: 'setMarketing'; perMonth: Money };
export type CommandResult = { ok: true } | { ok: false; reason: string };
```

---

## Phase A — Foundation

### Task 1: Monorepo scaffold, git, CI

**Files:**
- Create: root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.npmrc` (`node-linker=hoisted` — needed by electron-builder + native modules), `.gitignore`, `eslint.config.js`, `.prettierrc`, `vitest.workspace.ts`, `LICENSE` (MIT), `CREDITS.md`
- Create: `packages/{shared,sim,data,ui}/package.json` + `tsconfig.json` + `src/index.ts`; `apps/desktop/package.json`
- Create: `.github/workflows/ci.yml`
- Modify: `docs/technical-architecture.md` (record the two simplifications above)
- Test: `packages/shared/src/index.test.ts`

**Interfaces:** Produces root scripts `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` (via turbo). Workspace package names `@skyempire/shared|sim|data|ui`, app `@skyempire/desktop`.

- [ ] Step 1: `git init -b main` in repo root; add `.gitignore` (node_modules, dist, out, *.sqlite, .turbo).
- [ ] Step 2: Write test `exports VERSION` → `expect(VERSION).toBe('0.1.0')`.
- [ ] Step 3: Run `pnpm install && pnpm test` → FAIL (`VERSION` undefined).
- [ ] Step 4: Add configs and `export const VERSION = '0.1.0'` in `packages/shared/src/index.ts`.
- [ ] Step 5: Run `pnpm test && pnpm typecheck && pnpm lint` → all PASS.
- [ ] Step 6: `ci.yml`: on push/PR, ubuntu-latest, pnpm 9, Node 22, `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test`.
- [ ] Step 7: Commit `chore: scaffold monorepo` (include existing docs).

### Task 2: Shared types, commands, view, formatting

**Files:** Create `packages/shared/src/{types,commands,view,ipc,format}.ts`; Test `packages/shared/src/{commands,format}.test.ts`

**Interfaces:** Produces everything in "Shared interfaces" above, plus:
- `CommandSchema: z.ZodType<Command>`; `parseCommand(x: unknown): Command` (throws `ZodError`)
- `formatMoney(n: Money): string` → `$48.2M`, `$312k`, `$950`, negatives `−$1.2M`
- `formatPct(x: number): string` (0.861 → `86%`); `formatPax(n: number): string` (`2,400`)
- `ipc.ts`: `interface GameApi` (see Task 18) and `WorkerRequest`/`WorkerResponse` unions.

- [ ] Step 1: Tests: `parseCommand({type:'takeLoan', amount: 1_000_000})` ok; `amount: -5` throws; `openRoute` with `from === to` throws (refine); cabin seats negative throws; `formatMoney(48_200_000) === '$48.2M'`, `formatMoney(312_400) === '$312k'`, `formatMoney(-1_200_000) === '−$1.2M'`, `formatPct(0.861) === '86%'`.
- [ ] Step 2: Run `pnpm --filter @skyempire/shared test` → FAIL.
- [ ] Step 3: Implement files.
- [ ] Step 4: Run tests → PASS. Step 5: Commit `feat(shared): types, commands, formatting`.

### Task 3: RNG and calendar

**Files:** Create `packages/sim/src/{rng,calendar}.ts`; Test same names `.test.ts`

**Interfaces:**
- `class Rng { constructor(state: number); next(): number /*[0,1)*/; int(min: number, max: number): number; pick<T>(a: T[]): T; normal(mean: number, sd: number): number; get state(): number }` — mulberry32.
- `dateOf(day: number): { year: number; month: number /*1-12*/; dayOfMonth: number /*1-30*/; dayOfYear: number /*0-359*/ }`
- `isMonthStart(day: number): boolean` (`day % 30 === 0`); `formatDate(day): string` → `"Mar 17 Y1"`.

- [ ] Step 1: Tests: two `Rng(42)` produce identical 1000-value sequences; `new Rng(r.state)` resumes the sequence; `int(1,6)` always in range; `dateOf(0)` = `{year:1,month:1,dayOfMonth:1,dayOfYear:0}`; `dateOf(46)` = Feb 17 Y1; `dateOf(360).year === 2`; `formatDate(76) === 'Mar 17 Y1'`.
- [ ] Step 2: Run → FAIL. Step 3: Implement. Step 4: Run → PASS. Step 5: Commit `feat(sim): seeded rng and calendar`.

---

## Phase B — Data

### Task 4: Real aircraft and airline data

**Files:** Create `packages/data/src/{aircraft.json,airlines.world.json,routes.world.json,schema.ts}`, `packages/data/scripts/build-routes.ts`; Test `packages/data/src/{aircraft,airlines}.test.ts`

**Interfaces:**
- `AircraftTypeSchema` (Zod) = `AircraftType` + `icao: string` + `sources: string[]`. `id` = ICAO type designator. `maxSeats` = typical max single-class certified exit limit (or manufacturer max), `rangeKm` = manufacturer range, `cruiseKmh`, `mtowT`, `minRunwayM` (takeoff field length at MTOW) from manufacturer spec sheets / Wikidata; `priceUsd` = last published list price; `fuelKgPerH`, `leasePerMonth` (≈ 0.7–0.9% of price), `maintPerH`, `crewPerH` = cited estimates. `comfort`: turboprop 55, regional jet 65, A220 72, narrowbody 68, newer-gen narrowbody 70, widebody 80, A350/787 85.
- Pinned values used by later tests: `A20N.cruiseKmh = 830`, `A20N.turnaroundMin = 45`, `A20N.rangeKm = 6300`, `A20N.maxSeats = 194`.
- The 19 v0.1 types and their tier:

| id | Model | Class | Tier |
|---|---|---|---|
| `AT46` | ATR 42-600 | turboprop | startup |
| `AT76` | ATR 72-600 | turboprop | startup |
| `DH8D` | De Havilland Dash 8-400 | turboprop | startup |
| `E175` | Embraer E175 | regional | startup |
| `E295` | Embraer E195-E2 | regional | startup |
| `BCS1` | Airbus A220-100 | regional | startup |
| `BCS3` | Airbus A220-300 | regional | startup |
| `A320` | Airbus A320ceo | narrowbody | startup |
| `A19N` | Airbus A319neo | narrowbody | startup |
| `A20N` | Airbus A320neo | narrowbody | startup |
| `A21N` | Airbus A321neo | narrowbody | startup |
| `B738` | Boeing 737-800 | narrowbody | startup |
| `B38M` | Boeing 737-8 | narrowbody | startup |
| `A21X` *(game id; ICAO uses A21N)* | Airbus A321XLR | longNarrowbody | regional |
| `A339` | Airbus A330-900 | widebody | regional |
| `B789` | Boeing 787-9 | widebody | regional |
| `A333` | Airbus A330-300 | widebody | regional |
| `A359` | Airbus A350-900 | widebody | national |
| `B77W` | Boeing 777-300ER | widebody | national |

- `AirlineDataSchema = { iata, icao, name, country, wikidata: string /*QID*/, hubId, personality: PersonalityId, sizeRank: number /*1 = largest by fleet*/, brandColor: string /*hex*/, fleetTypes: string[], sources: string[] }`.
- ~150 airlines covering every continent: the largest ~100 by fleet size worldwide plus ~50 for coverage (≥ 3 per country with a top-200 airport where they exist). Personality mapping: low-cost carriers → `budget` (e.g. Ryanair, Southwest, IndiGo, AirAsia); network carriers → `legacy` (Lufthansa, Delta, Air India, ANA); Emirates, Qatar Airways, Etihad, Turkish Airlines → `gulf`; regional operators → `regional` (Widerøe, SkyWest, Alliance Air); fast-growing LCCs → `expander` (Wizz Air, VietJet, Akasa Air). `fleetTypes` restricted to the 19 v0.1 types (closest equivalent if they fly others).
- Pinned entries used by tests: Lufthansa `LH`/`DLH`, `Q9325`, hub `FRA`, legacy; Emirates `EK`/`UAE`, hub `DXB`, gulf; IndiGo `6E`/`IGO`, hub `DEL`, budget.
- `build-routes.ts`: downloads OpenFlights `routes.dat`, keeps rows where airline ∈ roster and both airports ∈ `airports.world.json`, writes `{ airlineIata, from, to }[]`. (Runs after Task 5; commit output.)
- `RESERVED_AIRLINE_NAMES` / `RESERVED_CODES`: all names and IATA codes from OpenFlights `airlines.dat` where `active = Y` (exported from `packages/data/src/index.ts`).

- [ ] Step 1: Tests: `aircraft.json` parses; 19 entries; ids unique; every entry has ≥ 1 source; every `leasePerMonth < priceUsd/100`; widebodies have `rangeKm > 11000`; `airlines.world.json` parses, 140–160 entries, iata unique, every continent present, all 5 personalities present, each `fleetTypes` ⊂ aircraft ids, each `hubId` exists in the airport catalog (test enabled after Task 5).
- [ ] Step 2: Run → FAIL. Step 3: Research and enter data with sources (manufacturer "Airport Planning" / spec pages, Wikidata items). Step 4: PASS.
- [ ] Step 5: Add `src/silhouettes/<ICAO>-side.svg` and `-top.svg` for all 19 types: take free-licensed silhouettes from Wikimedia Commons (CC0 / CC-BY / CC-BY-SA; record file URL + license in `sources`), otherwise trace from public 3-view drawings; normalize to single-path, `viewBox` 0 0 100 40 (side) / 0 0 100 100 (top), no fill color. Test: every aircraft id has both files.
- [ ] Step 6: Add sources to `CREDITS.md` (OpenFlights ODbL, Wikidata CC0, Wikimedia Commons silhouettes with licenses, manufacturers' public spec pages as references). Commit `feat(data): real aircraft, silhouettes and airlines`.

### Task 5: Airport pipeline + basemap + `loadCatalog`

**Files:** Create `packages/data/src/heuristics.ts`, `packages/data/scripts/build-airports.ts`, `packages/data/src/overrides.world.json`, generated `packages/data/src/airports.world.json`, `packages/data/src/basemap/countries-50m.geojson`, `packages/data/src/index.ts`; Test `heuristics.test.ts`, `catalog.test.ts`

**Interfaces:**
- `sizeClassFor(type: 'large_airport'|'medium_airport', catchmentM: number): 1..6` — large: ≥8M→6, ≥4M→5, else 4; medium: ≥2M→3, ≥0.7M→2, else 1.
- `slotCapacityFor(size): number` → `[0,60,120,220,400,700,1100][size]` per day.
- `landingFeeFor(size): Money` → `[0,4,5,6,8,10,12][size]` $/tonne; `paxFeeFor(size)` → `[0,6,8,10,14,18,22][size]`.
- `wealthFor(gdpPerCapitaUsd: number): number` → `clamp(gdp/40000, 0.3, 2.0)`.
- `businessFor(catchmentM)` → `clamp(log10(catchmentM*10)/2, 0, 1)`; `tourismFor(country)` from a small country table in the script (default 0.3), then overrides file wins.
- `loadCatalog(regionId: 'world'): Catalog`; `loadAirlines(): AirlineData[]`; `silhouettePath(typeId, view: 'side'|'top'): string`; `loadBasemap(): GeoJSON.FeatureCollection`.
- Script: `pnpm --filter @skyempire/data build:airports` downloads OurAirports `airports.csv` + `runways.csv`, GeoNames `cities15000.zip`, World Bank GDP per capita CSV into `packages/data/.cache/` (gitignored); keeps `scheduled_service=yes`, type large/medium, all continents, has IATA; catchment = sum of city populations within 80 km (nearest-airport split not needed in v0.1); takes top 1,000 by catchment (minimum 3 per country that has any qualifying airport), always including every hub in `airlines.world.json`; writes JSON sorted by id.
- Overrides file: ~80 biggest airports worldwide hand-tuned (`tourism`, `business`, `slotCapacity`), e.g. LHR slotCapacity 1300, tourism 0.8, business 1.0.

- [ ] Step 1: Heuristic tests: `sizeClassFor('large_airport', 9) === 6`; `sizeClassFor('medium_airport', 0.5) === 1`; `slotCapacityFor(4) === 400`; `wealthFor(10_000) === 0.3`; `wealthFor(100_000) === 2.0`.
- [ ] Step 2: Run → FAIL. Step 3: Implement heuristics. Step 4: PASS.
- [ ] Step 5: Implement and run the script; download Natural Earth `ne_50m_admin_0_countries` (public domain), simplify to properties `{name, iso}` and commit (< 5 MB).
- [ ] Step 6: Catalog tests: `loadCatalog('world')` has 950–1,050 airports; contains `LHR`, `JFK`, `DXB`, `DEL`, `NRT`, `SYD`, `GRU`, `JNB`; every airline hub is present; every airport passes Zod schema; every `runwayM ≥ 1200`.
- [ ] Step 7: Run → PASS. Add sources/licenses to `CREDITS.md` (OurAirports PD, GeoNames CC-BY 4.0, World Bank CC-BY 4.0, Natural Earth PD). Commit `feat(data): world airports and basemap`.

---

## Phase C — Simulation core (`packages/sim`)

### Task 6: Balance config, geo, ops math

**Files:** Create `src/config/balance.ts`, `src/geo.ts`, `src/ops.ts`; Test `geo.test.ts`, `ops.test.ts`

**Interfaces:**
- `BALANCE` object containing every constant from `simulation-spec.md` (α=0.8, ε, β's, U_none=−1.0, ref fare 40+0.11d, class multipliers 1.8/3.5, demand cap 1.5, aircraft day 18 h, tick perf budget, maintenance intervals 500/6000 h, A-check 1 day $50,000, C-check 7 days $1,500,000, condition wear 0.02/h, reputation weights, credit 40%/$5M, rates A4/B6/C9/D12 %, bankruptcy 30 days, overhead $50k + $20k/aircraft per month, base setup $2M × sizeClass/3, base upkeep $100k × sizeClass /month, base-pair discount 0.9, service cost per pax `[2,5,9,14,20]` econ ×1.5 premium ×3 business, service score `[20,40,60,80,100]`, seat units premium 1.5 / business 2.5, starting cash per difficulty, speeds).
- `distanceKm(a: {lat,lon}, b: {lat,lon}): number` (haversine, R=6371).
- `blockHours(distKm, cruiseKmh): number` = `dist/cruise + 0.5`.
- `roundTripHours(distKm, type: AircraftType): number` = `2 × (block + turnaround/60)`.
- `maxRoundTripsPerWeek(distKm, type): number` = `floor(126 / roundTripHours)`.
- `aircraftHoursUsed(aircraftId, state, catalog): number` (sum over all routes' assignments).
- `slotsNeeded(roundTripsPerWeek): number` = `2 × ceil(rtpw / 7)` (per airport per day).
- `seatUnits(cabin: Cabin): number` = `economy + 1.5·premium + 2.5·business`; valid iff `≤ maxSeats`.

- [ ] Step 1: Tests: `distanceKm(LHR, CDG)` ≈ 348 ±5; `blockHours(830, 830) === 1.5`; `roundTripHours(655, A20N)` = 2×(655/830+0.5+0.75) ≈ 4.078; `maxRoundTripsPerWeek(655, A20N) === 30`; `slotsNeeded(14) === 4`; `slotsNeeded(15) === 6`; `seatUnits({economy:150, premium:0, business:12}) === 180`.
- [ ] Step 2: FAIL. Step 3: Implement. Step 4: PASS. Step 5: Commit `feat(sim): balance config, geo and ops math`.

### Task 7: Demand model

**Files:** Create `src/demand.ts`; Test `demand.test.ts`

**Interfaces:**
- `seasonality(dayOfYear: number, tourism: number): number` = `1 + (0.05 + 0.25·tourism) · cos(2π·(dayOfYear − 195)/360)` (peak mid-July; range 0.7–1.3).
- `baseDemand(a: Airport, b: Airport, day: number, economyIndex: number): number` — the gravity formula in `simulation-spec.md §3`, one direction, pax/day, with `K` = `BALANCE.demandK` tuned so `baseDemand(LHR, CDG, 195, 1.0)` is in 3,000–6,000; `<150 km → ×0.2`.
- `classSplit(a, b): Cabin` (fractions) — business `0.05 + 0.10·avg(business)`, premium `0.06`, economy rest.
- `refFare(distKm: number, cls: CabinClass): Money`.
- `elasticDemand(base: number, avgFare: Money, ref: Money, cls): number` with cap 1.5 × base.

- [ ] Step 1: Tests: LHR–CDG mid-July within [3000, 6000]; LHR–CDG mid-January < mid-July; pair 120 km apart is ≤ 0.25 × same pair if it were 151 km (use synthetic airports); `classSplit` sums to 1; `refFare(655,'economy') === 112`; `elasticDemand(1000, 56, 112, 'economy')` ≤ 1500; `elasticDemand(1000, 224, 112, 'economy')` ≈ 1000·2^−1.2 ≈ 435.
- [ ] Step 2: FAIL. Step 3: Implement, tune `K`. Step 4: PASS. Step 5: Commit `feat(sim): demand model`.

### Task 8: Quality and passenger allocation

**Files:** Create `src/quality.ts`, `src/allocation.ts`; Test `allocation.test.ts`, `quality.test.ts`

**Interfaces:**
- `offerQuality(args: { comfort: number; ageYears: number; seatUnitsRatio: number; serviceLevel: 1..5; onTime: number /*0-100*/ }): number` = `0.4·aircraftComfort + 0.35·serviceScore + 0.25·onTime`, where `aircraftComfort = comfort × (1 − min(0.4, 0.02·age)) × (seatUnitsRatio > 0.95 ? 0.85 : 1)`.
- `interface Offer { airlineId: string; routeId: string; fare: Money; weeklyFrequency: number; quality: number; reputation: number; stops: number; seats: number /*per day, this direction, this class*/ }`
- `allocate(demand: number, offers: Offer[], ref: Money, cls: CabinClass): Map<string /*routeId*/, number>` — logit with `U_none`, cap at seats, one spill pass re-offering unserved pax among offers with free seats using renormalized shares.

- [ ] Step 1: Tests: single offer with fare = ref, 10/wk, quality 70, rep 50 → served < demand (some choose "none"); two identical offers split 50/50 ±1%; cheaper offer gets more share; offer with 0 seats gets 0 and its passengers spill to the other (other's pax increases vs. no-spill); totals never exceed demand nor seats; `offerQuality` with age 30 caps penalty at 40%.
- [ ] Step 2: FAIL. Step 3: Implement. Step 4: PASS. Step 5: Commit `feat(sim): quality and passenger allocation`.

### Task 9: New game + AI names

**Files:** Create `src/newGame.ts`, `src/ai/personalities.ts`; Test `newGame.test.ts`

**Interfaces:**
- `interface NewGameOptions { seed: number; regionId: 'world'; difficulty: Difficulty; airline: { name: string; code: string; colors: {primary: string; secondary: string}; logoShape: Airline['logoShape'] }; homeBaseId: string; aiCount?: number /* default 19 */ }`
- `newGame(opts, catalog): GameState` — player with difficulty cash, no aircraft, base = home; AI airlines picked from `loadAirlines()` (`aiCount` default 19: the `ceil(aiCount/2)` whose hubs are nearest the player's hub by `distanceKm`, then the lowest `sizeRank` not yet picked; ties broken by RNG), each at its real `hubId` with its `brandColor` (the player may share a hub with an AI), AI colors from the rival palette, AI cash = player cash × `{easy 0.7, normal 1, hard 1.5}`; starting fleet `{easy 4, normal 6, hard 10}` leased aircraft of its `fleetTypes` allowed at startup tier; fuel price $0.95/kg; economy 1.0; 12 used listings; slotsUsed all 0; `nextAiDecisionDay` staggered 0–6.
- `PERSONALITIES: Record<PersonalityId, { priceAggressiveness; expansionRate; riskTolerance; premiumFocus; preferredClasses: AircraftClass[]; cadenceDays }>` — values from `simulation-spec.md §10`; cadence budget 7, legacy 14, regional 10, gulf 14, expander 7; Hard multiplies cadence by 0.7.

- [ ] Step 1: Tests: same opts → deep-equal states; 20 airlines, exactly 1 `isPlayer`; player hub FRA → Lufthansa is among the AIs with `homeBaseId === 'FRA'`; player hub DEL → IndiGo is among the AIs; Normal AI starts with 6 aircraft; player cash Normal = 50,000,000; validation throws for unknown `homeBaseId`, code not matching `/^[A-Z0-9]{2,3}$/`, or a name/code in `RESERVED_AIRLINE_NAMES`/`RESERVED_CODES` ("That name belongs to a real airline — pick another").
- [ ] Step 2: FAIL. Step 3: Implement. Step 4: PASS. Step 5: Commit `feat(sim): new game setup`.

### Task 10: Commands and validation

**Files:** Create `src/commands/{apply,fleet,routes,finance,airline}.ts`; Test `commands/*.test.ts`

**Interfaces:**
- `applyCommand(state: GameState, airlineId: string, cmd: Command, catalog: Catalog): CommandResult` — mutates `state` on success only (validate fully, then apply).
- Rules (each with its exact error string, stored in `src/commands/errors.ts`):
  - Lease: upfront deposit = 1 month lease; tier must allow type ("Unlocks at Regional tier"); cabin seat units ≤ maxSeats.
  - Buy new: cash ≥ price ("Not enough cash — you need $X more"). Buy used: listing exists, removed on purchase.
  - Sell: owned → cash += market value (`price × 0.92^ageYears × sqrt(condition/100)`); leased → returned, no refund. Removes its assignments; routes with no assignments → `status: 'suspended'`, slots released (Review Focus #4).
  - Open route: `from ≠ to`; at least one end is an airline base ("Routes must start or end at one of your bases"); no duplicate active route same pair same airline; each assigned aircraft owned by airline, active or in maintenance, range ≥ distance ("Range too short — A320neo flies max 6,300 km"), both runways ≥ minRunwayM, hours used + new ≤ 126; free slots at both airports ≥ `slotsNeeded(total rtpw)` ("No free slots at LHR"); fares > 0.
  - Update route: same checks on the new assignment set (excluding the route's own current usage). Assigning to a suspended route reactivates it.
  - Close route: releases slots.
  - Open base: cost `2M × sizeClass/3` (×0.5 at Regional tier+); Close base: not home base, no active routes touching only this base.
  - Loans: amount ≤ available credit; repay ≤ cash and ≤ principal.
  - Service level / marketing: plain set.

- [ ] Step 1: Tests (one per rule): range failure message; hour-budget overflow when one aircraft is assigned 20 + 15 rt/wk on 655 km routes; slot exhaustion on an airport with `slotCapacity` 4; route touching no base rejected; selling an assigned aircraft suspends the route and frees its slots; lease of `vt-w250` rejected at startup tier; insufficient cash message includes the exact shortfall `formatMoney`; a rejected command leaves `state` deep-equal to before.
- [ ] Step 2: FAIL. Step 3: Implement. Step 4: PASS. Step 5: Commit `feat(sim): commands and validation`.

### Task 11: Economics and finance

**Files:** Create `src/economics.ts`, `src/finance.ts`; Test `economics.test.ts`, `finance.test.ts`

**Interfaces:**
- `flightsToday(rtpw: number, day: number): number` — deterministic distribution of weekly round trips over 7 days (e.g. `floor(rtpw/7) + (day % 7 < rtpw % 7 ? 1 : 0)`), legs = 2 × that.
- `routeDayCosts(route, state, catalog, legsByAircraft: Map<string, number>, paxByClass: Cabin, closed: boolean): { fuel; crew; maintenance; fees; service }` — formulas in `simulation-spec.md §6`; base-pair discount ×0.9 on crew+maintenance when both ends are the airline's bases; when `closed` (event), all variable costs 0.
- `applyMonthly(state, airline): Partial<AirlineDaily['costs']>` — on `isMonthStart`: leases, overhead, base upkeep, marketing.
- `dailyInterest(airline): Money` = `Σ principal × rate / 360`.
- `companyValue(state, airlineId, catalog): Money`; `availableCredit(...)`: `max(5M, 0.4 × value) − Σ principal`.
- `creditRating(debtRatio, opMargin90): 'A'|'B'|'C'|'D'` — A: ratio < 0.2 and margin > 5%; B: < 0.4 and > 0%; C: < 0.6; else D. New loans use rating rate.
- `updateSolvency(state, airlineId)`: `cash < 0 && availableCredit ≤ 0` → `daysInsolvent++` else reset; at 30 → `bankrupt = true` (player → `state.gameOver`).

- [ ] Step 1: Tests: fuel cost for one A20N leg 655 km at $1.00/kg = `A20N.fuelKgPerH × 1.289 h` (rounded); `flightsToday` over 7 consecutive days sums to rtpw for rtpw ∈ {1, 7, 10, 21}; base-pair discount applied only when both ends are bases; interest on $10M at 6% = $1,667/day; Review Focus #2: airline at −$1M cash with credit available keeps `daysInsolvent = 0`; with no credit, after 29 days not bankrupt, day 30 bankrupt and `gameOver.reason === 'bankrupt'`.
- [ ] Step 2: FAIL. Step 3: Implement. Step 4: PASS. Step 5: Commit `feat(sim): economics and finance`.

### Task 12: Maintenance, on-time, reputation

**Files:** Create `src/maintenance.ts`, `src/reputation.ts`; Test both `.test.ts`

**Interfaces:**
- `advanceAircraft(ac: Aircraft, hoursFlown: number): { checkCost: Money; notification?: Notification }` — wear `0.02/h`, `ageDays++`; when `hoursSinceA ≥ 500` → maintenance 1 day, cost $50,000, condition +10 (max 100); `hoursSinceC ≥ 6000` → 7 days, $1,500,000, condition → 95. Aircraft in maintenance fly 0 legs that day (their route frequency is reduced, not reassigned).
- `onTimeFor(conditionAvg, airportCongestion /*slotsUsed/capacity*/, utilisation, stormAffected): number` — base 85; −0.5 per condition point below 60; −10 if congestion > 0.9; −5 if utilisation > 0.9; −10 storm; clamp 40–98.
- `incidentChance(condition)`: condition < 40 → 0.0005/flight; incident = −15 reputation, major notification.
- `reputationTarget(inputs: { onTime; quality; priceFairness; fleetYouth; marketing; incidentPenalty }): number` per spec weights; `stepReputation(current, target): number` = EMA α = 2/31.
- `priceFairness(avgFareRatio)` = `clamp(100 − (ratio−1)·100, 0, 100)`; `fleetYouth(avgAgeYears)` = `clamp(100 − 5·age, 0, 100)`; `marketingScore(perMonth, fleetSize)` = `clamp(perMonth / max(1, fleetSize·50_000) · 100, 0, 100)`.

- [ ] Step 1: Tests: 500 h triggers A-check and 1 maintenance day; reputation moving from 50 toward target 80 reaches > 75 within 90 steps and never overshoots; `onTimeFor(100, 0.5, 0.5, false) === 85`; `incidentChance(50) === 0`.
- [ ] Step 2: FAIL. Step 3: Implement. Step 4: PASS. Step 5: Commit `feat(sim): maintenance and reputation`.

### Task 13: Market and events

**Files:** Create `src/market.ts`, `src/events.ts`; Test both `.test.ts`

**Interfaces:**
- `stepMarket(state, rng)`: fuel random walk `price × (1 + rng.normal(0, 0.01))` mean-reverting 2%/day toward $0.95, clamped $0.70–1.40 (×event spike multiplier, which may exceed 1.40); economy index drifts toward 1.0 ± active recession/boom; monthly refresh of 12 used listings.
- `rollEvents(state, catalog, rng): Notification[]` — daily probabilities: fuelSpike 1/360 (×1.3–1.8, 30–120 days), recession 1/1080 and boom 1/1080 (±0.2 over 180 days), strike 4/360 (random airport size ≥ 3, 1–5 days), storm 6/360 Nov–Feb else 2/360 (1–3 days), expansion 2/360 (+20–50% `slotCapacity`, permanent — stored as a state override `airportSlotBonus: Record<string, number>`; `GameState.airportSlotBonus`). Events start/end produce notifications; fuelSpike, recession and strike at a player base are `major` (auto-pause).
- `isAirportClosed(state, airportId): boolean`.

- [ ] Step 1: Tests: with a fixed seed, 3600 simulated days produce fuelSpike count within 5–15 and strike count 25–55; fuel price stays within [0.70, 1.40] when no spike active; Review Focus #3: run `tick` (after Task 14 exists, add this test there) — here assert `isAirportClosed` true during a strike window and false after.
- [ ] Step 2: FAIL. Step 3: Implement. Step 4: PASS. Step 5: Commit `feat(sim): market and events`.

### Task 14: Tick, preview, client view

**Files:** Create `src/tick.ts`, `src/preview.ts`, `src/view.ts`, `src/index.ts`; Test `tick.test.ts`, `preview.test.ts`, `golden.test.ts`, `perf.test.ts`

**Interfaces:**
- `tick(state: GameState, commands: { airlineId: string; cmd: Command }[], catalog: Catalog): { state: GameState; summary: TickSummary; results: CommandResult[] }` — clones `state` (`structuredClone`), runs the 9 steps of `simulation-spec.md §2` in order (AI step calls Task 15's `runAi` — stub returning no commands until then), returns new state; never mutates input.
- Demand step only for unordered airport pairs that have ≥ 1 active route; each direction and class allocated separately; seats per day per direction = Σ over assignments `flightsToday × cabin seats` (aircraft in maintenance excluded).
- Closed airport (event) → routes touching it fly 0 legs that day.
- `preview(state, airlineId, cmd: Command, catalog): PreviewResult` — for `openRoute`/`updateRoute`: validates via `applyCommand` on a clone, runs demand + allocation for one typical day (dayOfYear = current) with current rival offers, returns expected LF, profit/day (incl. pro-rated lease & overhead share), payback days (`(deposit or price) / profit`, null if ≤ 0), `suggestedFares` = per class, the fare in `refFare × {0.6, 0.7, …, 1.6}` maximizing expected profit; `demandPerDay`; `competitors`; `distanceKm`.
- `buildClientView(state, playerId, catalog): ClientView` — rivals' finances hidden (only summary fields).
- `index.ts` re-exports: `newGame, tick, preview, buildClientView, applyCommand, BALANCE, PERSONALITIES`.

- [ ] Step 1: Tests: `tick` doesn't mutate input (deep-freeze input); day increments; a player route LHR–CDG (A20N, 14 rt/wk, suggested fares) yields pax > 0 and revenue > 0 on day 1; Review Focus #3: during a strike at CDG that route has `last.revenue === 0` and `last.cost === 0` while monthly overhead still charges on month start; preview suggestedFares within 0.6–1.6 × ref; golden: seed 7, normal, player passive, 365 ticks → `summary` of day 365 matches committed snapshot (`toMatchSnapshot`); perf: 20-airline world (default `newGame`, hub `LHR`) after 180 days of AI expansion, single `tick` median < 200 ms over 20 runs.
- [ ] Step 2: FAIL. Step 3: Implement. Step 4: PASS. Step 5: Commit `feat(sim): tick loop, preview and client view`.

### Task 15: AI airlines

**Files:** Create `src/ai/decide.ts`; Modify `src/tick.ts` (replace stub); Test `ai/decide.test.ts`

**Interfaces:**
- `runAi(state, airlineId, catalog, rng): Command[]` — called when `day ≥ nextAiDecisionDay`; then `nextAiDecisionDay += cadence`. Order per `simulation-spec.md §10`:
  1. Candidate routes: 40 random destinations within range of preferred aircraft from each base, scored as `profit × (1 + premiumFocus × avgBusinessIndex) − 0.15 × competitors × |profit|`, where `profit` is `preview` expected profit/day at a fare of `refFare × (1 − 0.3 × priceAggressiveness)`, plus noise `rng.normal(0, difficultyNoise)` × |score| (`easy 0.3, normal 0.15, hard 0.05`).
  2. Open the best positive-score route if an aircraft has ≥ 30% free hours, else acquire (step 5) first. Max routes opened per decision = `1 + round(expansionRate × 2)`.
  3. Fares: per route, LF < 0.6 → fare × `(1 − 0.05 − 0.10·priceAggressiveness)`; LF > 0.9 → × 1.05; if a rival on the same pair is ≥ 10% cheaper → move `priceAggressiveness × 50%` of the gap. Never below 0.5 × ref.
  4. Close routes with `profit30` sum < 0 and age ≥ 60 days.
  5. Acquire: average utilisation > 85% (or no free aircraft for a good candidate) and cash > 3 × monthly costs → buy if cash > 2 × price and `riskTolerance < 0.5`, else lease; type from `preferredClasses` allowed by tier.
  6. Loan: cash < 1 month of costs → take `min(availableCredit, 3 months costs)` if `riskTolerance ≥ 0.3`.
- Candidate generation also includes every real route of that airline from `routes.world.json` with a `+25%` score bonus, so incumbents rebuild something close to their real network first.
- Day 0: AIs already hold their starting fleet (Task 9) and make their first decision immediately.

- [ ] Step 1: Tests: after 90 days (seed 3) every AI has ≥ 2 routes and ≥ 3 aircraft; no AI command is ever rejected (collect `results`, assert all ok); budget airlines' average fare ratio < legacy's; an AI whose route LF is 0.4 lowers its fare at next decision; same seed → identical AI commands.
- [ ] Step 2: FAIL. Step 3: Implement. Step 4: PASS. Step 5: Commit `feat(sim): utility AI airlines`.

### Task 16: Tiers and objectives

**Files:** Create `src/progression.ts`; Modify `src/tick.ts`, `src/view.ts`; Test `progression.test.ts`

**Interfaces:**
- `TIERS` per `simulation-spec.md §12` (any 2 of 3: aircraft count, `totals.pax`, Σ `revenue360`). Tier-up emits a `major` notification "You're now a Regional airline — A321XLR, A330-900 and 787-9 unlocked".
- `OBJECTIVES: { id; title; check(state, airlineId, catalog): boolean }[]`, in order: `lease-first` "Lease your first aircraft", `open-first-route` "Open your first route", `first-day` "Fly your first day", `first-profit` "Make a profit on any day", `lf70x3` "Reach 70% load factor on 3 routes", `second-base` "Open a second base", `fleet5` "Operate 5 aircraft", `rep60` "Reach reputation 60", `month1m` "Earn $1M profit in a month", `tier-regional` "Become a Regional airline".
- `updateProgression(state, airlineId, catalog): Notification[]`; `ClientView.objectives` = first 3 incomplete + last completed.

- [ ] Step 1: Tests: brand-new player sees first 3 objectives incomplete; after leasing an aircraft `lease-first` is done; synthetic airline with 5 aircraft and 1.2M pax promotes to `regional`; tier never goes down.
- [ ] Step 2: FAIL. Step 3: Implement. Step 4: PASS. Step 5: Commit `feat(sim): tiers and objectives`.

---

## Phase D — Desktop shell

### Task 17: Electron app shell + Windows build in CI

**Files:** Create `apps/desktop/{electron.vite.config.ts,electron-builder.yml}`, `src/main/{index,window}.ts`, `src/preload/index.ts`, `src/renderer/{index.html,main.tsx,App.tsx}`; Create `.github/workflows/release.yml`; Test `apps/desktop/e2e/smoke.spec.ts`

**Interfaces:** Produces app id `com.skyempire.game`, product name `SkyEmpire`, window min 1024×680, default 1440×900, dark background `oklch(0.16 0.012 250)` set before first paint (`backgroundColor` `#141821`), CSP `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'`.

- [ ] Step 1: Playwright `_electron` test: app launches, window title is `SkyEmpire`, renderer shows text "SkyEmpire".
- [ ] Step 2: Run `pnpm --filter @skyempire/desktop e2e` (Linux: `xvfb-run -a`) → FAIL.
- [ ] Step 3: Implement shell with secure `webPreferences`. `electron-builder.yml`: targets `nsis` (oneClick false, allow dir change) + `zip`, `publish: github`, `npmRebuild: true`.
- [ ] Step 4: Run e2e → PASS.
- [ ] Step 5: `release.yml`: on tag `v*`, `windows-latest`: install, test, `pnpm --filter @skyempire/desktop dist -- --publish always` with `GH_TOKEN`. Also a `workflow_dispatch` "build only" job uploading the installer as an artifact.
- [ ] Step 6: Commit `feat(desktop): electron shell and windows release workflow`.

### Task 18: Sim host, game loop, IPC

**Files:** Create `src/worker/simWorker.ts`, `src/main/{simHost,gameLoop,ipc}.ts`; Modify `src/preload/index.ts`, `packages/shared/src/ipc.ts`; Test `src/main/gameLoop.test.ts`, `src/worker/simWorker.test.ts`

**Interfaces:**
- Preload exposes `window.game: GameApi`:
  ```ts
  interface GameApi {
    newGame(opts: NewGameOptions): Promise<ClientView>;
    loadSave(saveId: string): Promise<ClientView>;
    listSaves(): Promise<SaveInfo[]>;            // Task 19
    save(): Promise<void>;  saveAs(name: string): Promise<SaveInfo>;
    command(cmd: Command): Promise<CommandResult>;   // queued, applied next tick; result returned after validation dry-run
    preview(cmd: Command): Promise<PreviewResult>;
    setSpeed(speed: 0 | 1 | 2 | 4 | 8): void;
    onTick(cb: (push: { view: ClientView; summary: TickSummary }) => void): () => void;
    history(airlineId: string, fromDay: number, toDay: number): Promise<AirlineDaily[]>;
    routeDemand(from: string, to: string): Promise<PreviewResult>;
    getSettings(): Promise<Settings>; setSettings(s: Partial<Settings>): Promise<Settings>;
  }
  ```
- Worker message protocol: `WorkerRequest = {id, kind: 'init'|'tick'|'command'|'preview'|'view'|'snapshot', ...}` / `WorkerResponse = {id, ok, data | error}`. The worker holds `GameState` + `Catalog`.
- `class GameLoop { constructor(host: SimHost, onTick: (push) => void); setSpeed(s); stop(); }` — uses a self-correcting `setTimeout` (interval = `6000 / speed` ms); a tick never starts while the previous one is running; `summary.autoPause` → speed 0 and emits.
- `command()` runs a validation dry-run in the worker immediately (so the UI gets instant errors), then queues it for the next tick; when paused, commands apply immediately and a fresh view is pushed (so the player can plan while paused).

- [ ] Step 1: Tests (Vitest with a fake `SimHost`): at speed 4 with fake timers, 3 ticks fire in 4500 ms; overlapping tick is skipped; `autoPause` sets speed 0; worker test (run `simWorker` handler function directly): `init` → `view` returns player airline; invalid command returns `{ok:false, reason}` without changing state.
- [ ] Step 2: FAIL. Step 3: Implement. Step 4: PASS. Step 5: Commit `feat(desktop): sim worker, game loop and ipc`.

### Task 19: Saves and settings

**Files:** Create `src/main/saves/{db,saves}.ts`, `src/main/settings.ts`; Test `saves.test.ts`, `settings.test.ts`

**Interfaces:**
- Location: `app.getPath('userData')/saves/<saveId>.sqlite` (inject base dir for tests). One file per career.
- Drizzle tables: `meta(key TEXT PK, value TEXT)` (name, airlineName, schemaVersion, createdAt, updatedAt, day); `snapshots(id INTEGER PK, day INTEGER, kind TEXT 'auto'|'manual', state BLOB /*gzip JSON*/, createdAt)`; `airline_daily(day, airline_id, json TEXT, PK(day, airline_id))`.
- `createSave(name, state): SaveInfo`; `writeSnapshot(saveId, state, kind)` — single transaction; keeps last 3 `auto` + all `manual`; `appendDaily(saveId, daily: AirlineDaily[])` (batched per tick); `loadLatest(saveId): GameState` — throws `SaveLoadError { reason: 'corrupt' | 'newerVersion' | 'missing' }`; runs `migrations[schemaVersion]` for older; `listSaves(): SaveInfo[]` sorted by `updatedAt` desc (`SaveInfo = {id, name, airlineName, day, updatedAt}`).
- Autosave every 30 game days and on app quit (`before-quit` awaits save).
- `Settings = { reduceMotion: boolean; performanceMode: boolean; autoPauseMajor: boolean; autosaveDays: 30|60|90; units: 'km'|'mi'; volume: number; tutorialDone: boolean; colorBlindRivals: boolean }` in `settings.json`, defaults `{false,false,true,30,'km',0.6,false,false}`.

- [ ] Step 1: Tests: create → write → load returns deep-equal state; 5 autos keep only last 3; Review Focus #5: make serialization throw inside `writeSnapshot` → previous snapshot still loads; Review Focus #1: truncated file → `SaveLoadError('corrupt')`; `schemaVersion: 99` → `'newerVersion'`; settings missing file → defaults; invalid JSON → defaults (file rewritten).
- [ ] Step 2: FAIL. Step 3: Implement. Step 4: PASS. Step 5: Commit `feat(desktop): saves and settings`.

---

## Phase E — UI

All UI tasks: Vitest + Testing Library (jsdom) for component behavior; follow `ui-ux-design.md` exactly for tokens, sizes, copy rules and motion. Each screen must ship its **empty, loading (skeleton) and error** states.

### Task 20: Design system (`packages/ui`)

**Files:** Create `packages/ui/src/{tokens.css,motion.css,fonts.ts,index.ts}`, `packages/ui/src/components/*.tsx`; Test `components/*.test.tsx`

**Interfaces:**
- `tokens.css`: all dark tokens from `ui-ux-design.md §5.2` on `:root`, plus spacing, radius (4/8/12/16/9999), elevation, rival palette `--rival-1..8` (color-blind-checked), Tailwind v4 `@theme` mapping (`bg-surface-1`, `text-muted`, …). `motion.css`: `--ease-*`, `--dur-*`, global reduced-motion block, `[data-reduce-motion]` attribute equivalent.
- Fonts: `@fontsource-variable/inter`, `@fontsource/jetbrains-mono` (400/600); `font-variant-numeric: tabular-nums` on `.num`.
- Components (Radix primitives where applicable): `Button({variant: 'primary'|'secondary'|'ghost'|'danger', size: 'sm'|'md', loading?})`, `NumberInput({label, value, onChange, min, max, step, suffix, prefix})` (↑↓ = step, Shift = ×10, wheel), `Slider`, `Combobox<T>({label, items, getKey, render, filter, recentKeys})`, `DataTable<T>({columns, rows, sort, onRowClick, virtual})` (TanStack Virtual above 100 rows), `KpiTile({label, value, delta?, sparkline?})` (delta shows ▲/▼ + sign), `Panel`, `Toast` (Radix Toast, max 3, 4 s), `Modal` (Radix Dialog), `Tooltip` (300 ms), `Meter({value, max, label})`, `EmptyState({icon, text, action})`, `Skeleton`.

- [ ] Step 1: Tests: `Button` with `loading` keeps width and has `aria-busy`; `NumberInput` ArrowUp +step, Shift+ArrowUp +10×step, clamps to max; `Combobox` filters by IATA and city, recents first; `KpiTile` delta −5 renders `▼` and `−`; `DataTable` sorts numeric column desc on second click; `Modal` closes on Esc and returns focus.
- [ ] Step 2: FAIL. Step 3: Implement. Step 4: PASS. Step 5: Commit `feat(ui): design tokens and core components`.

### Task 21: App shell, store, shortcuts

**Files:** Create `src/renderer/{store.ts,hooks/useGame.ts,shortcuts.ts,strings/en.ts}`, `src/renderer/shell/{TopBar,NavRail,Inspector,BottomTray}.tsx`; Modify `App.tsx`; Test `shell/*.test.tsx`, `shortcuts.test.ts`

**Interfaces:**
- `useUi` (Zustand): `{ screen: 'title'|'newAirline'|'game'|'gameOver'; section: 'overview'|'network'|'fleet'|'finance'|'market'|'airline'|'news'; selection: {kind, id} | null; trayOpen: boolean; speed; setSection(); select(); }`.
- `useGame()`: subscribes to `window.game.onTick`, stores latest `ClientView` + rolling notifications (last 200) in a Zustand slice; exposes `command(cmd)` that toasts the `reason` on failure.
- TopBar shows airline code chip, name, cash (`formatMoney`) with tick delta chip (▲ green / ▼ red, fades in 200 ms), `formatDate(day)`, speed buttons (aria-pressed), bell with unread count, menu (Esc).
- Shortcuts (`ui-ux-design.md §7`): `1–7` sections, `Space` play/pause (restores last non-zero speed), `+`/`-` speed, `N` new route, `T` tray, `Esc` close inspector → then menu, `/` focus search, `Ctrl+S` save, `?` shortcut sheet. Ignored while typing in inputs.
- Layout per `ui-ux-design.md §3`; inspector 360 px slides in (320 ms ease-out, 16 px travel); below 1280 px it overlays as a drawer.

- [ ] Step 1: Tests: pressing `3` sets section `fleet`; `Space` toggles 0 ↔ last speed; shortcut ignored when an `<input>` is focused; TopBar renders `$48.2M` and `▲` delta; Esc closes inspector before opening menu.
- [ ] Step 2: FAIL. Step 3: Implement. Step 4: PASS. Step 5: Commit `feat(desktop): app shell, store and shortcuts`.

### Task 22: World map

**Files:** Create `src/renderer/map/{WorldMap.tsx,layers.ts}`; Test `map/layers.test.ts`

**Interfaces:**
- `WorldMap` — MapLibre map, style built in code: background `--map-water`, GeoJSON source from `loadBasemap()` with fill `--map-land` and hairline border line layer; `MapboxOverlay` (deck.gl, interleaved) with layers from `buildLayers(input)`.
- `buildLayers(input: { airports: Airport[]; view: ClientView; selection; hover; showRivals: boolean; reduceMotion: boolean; zoom: number }): Layer[]` → `ScatterplotLayer` airports (radius by sizeClass, player bases ring + accent), `ArcLayer` player routes (livery color, width 2, great-circle), rival routes (airline `brandColor`, or `--rival-1..8` when the color-blind setting is on; width 1, opacity 0.35, only if `showRivals`), `TextLayer` city labels for `sizeClass ≥ 4` at zoom ≥ 4.
- Click airport → `select({kind:'airport'})`; click arc → `select({kind:'route'})`; hover tooltip (name, IATA, demand hint).
- Camera eases (600 ms `--ease-io`) to selection; new route arc animates in over 450 ms unless reduced motion.
- Map stays mounted across sections (dimmed with an overlay on full-page sections).

- [ ] Step 1: Tests on `buildLayers`: rival layer absent when `showRivals` false; player base airports flagged `isBase`; labels absent at zoom 3.
- [ ] Step 2: FAIL. Step 3: Implement. Step 4: PASS, plus manual check in `pnpm dev` that pan/zoom is smooth. Step 5: Commit `feat(desktop): world map`.

### Task 23: Title, New airline, Load

**Files:** Create `screens/Title/Title.tsx`, `screens/NewAirline/{NewAirline,StepIdentity,StepHub,StepDifficulty,LogoPreview}.tsx`, `screens/Title/LoadDialog.tsx`; Test `NewAirline.test.tsx`, `LoadDialog.test.tsx`

**Interfaces:**
- Title: background slow ambient arcs (static under reduced motion), buttons **Continue** (primary; only if a save exists → loads latest), **New career**, **Load**, **Settings**, **Quit**.
- New airline: 3 steps with progress dots, single column, labels above fields. Identity: name (2–30 chars), code (auto-suggest from name initials, `/^[A-Z0-9]{2,3}$/`), logo shape + 2 colors, live tail preview. Hub: `Combobox` + map; airport cards show size, demand potential, rivals nearby, difficulty tag ("Busy hub — harder" for sizeClass ≥ 5). Difficulty: 3 cards with consequences text. Final button **"Found airline"** → `game.newGame` (seed = `Date.now()` in renderer — allowed here, not in sim).
- Load: list of `SaveInfo` (airline, day as date, updated); load errors show the `SaveLoadError` reason text: corrupt → "This save can't be opened — the file is damaged."; newerVersion → "This save was made with a newer version of SkyEmpire. Update the game to open it."

- [ ] Step 1: Tests: "Found airline" disabled-with-reason until name and hub valid (reason shown below button); code input uppercases and rejects 4 chars; LoadDialog shows corrupt-message on rejected promise and stays open.
- [ ] Step 2: FAIL. Step 3: Implement. Step 4: PASS. Step 5: Commit `feat(desktop): title, new airline and load screens`.

### Task 24: Network — routes list and route editor

**Files:** Create `screens/Network/{NetworkTray,RouteEditor,RouteInspector,AirportInspector}.tsx`; Test `RouteEditor.test.tsx`

**Interfaces:**
- Bottom tray table: Route (`LHR → CDG` mono), Aircraft, Freq/wk, Load (Meter), Fare (econ), Profit/day (signed, arrow), status chip (Suspended). Primary action **"New route"**.
- `RouteEditor` (mockup in `ui-ux-design.md §4.4`): From (defaults to selected base), To (`Combobox`, suggestions = top 8 by `demandPerDay` from preview cache), assignments rows (aircraft select showing "free Nh/day", round trips slider max = hours left), economy fare + suggested; disclosure "Premium & business fares, service level"; live preview line debounced 150 ms via `game.preview`; inline error from `PreviewResult.reason` with fix button where applicable ("Show aircraft that can fly this" filters the aircraft select by range). Buttons **Cancel** / **"Open route"** (or **"Save changes"** when editing). Clicking origin then destination on the map opens the editor prefilled.
- `RouteInspector`: stats, 30-day profit sparkline, **Edit route**, **Close route** (Modal confirm: "Close LHR–CDG? Its slots will be released.").
- `AirportInspector`: name, size, slots free, rivals present, **"Open base here"** (shows cost) or **"New route from here"** if base.

- [ ] Step 1: Tests: preview called once after typing stops for 150 ms (fake timers); range error text visible and "Open route" disabled-with-reason; successful open shows toast "Route LHR–CDG opened" and closes editor; suspended route shows chip "Suspended".
- [ ] Step 2: FAIL. Step 3: Implement. Step 4: PASS. Step 5: Commit `feat(desktop): network screen and route editor`.

### Task 25: Fleet and aircraft market

**Files:** Create `screens/Fleet/{FleetTable,AircraftInspector,AircraftMarket,CabinEditor,CompareTray}.tsx`; Test `Fleet.test.tsx`

**Interfaces:**
- Fleet table columns: Aircraft (id + type), Age, Condition (Meter), Routes, Utilisation %, Status (Flying/Maintenance N days/Idle — Idle rows get warning icon + text). Empty state: "No aircraft yet. Lease your first one to start flying." + **"Browse aircraft"**.
- Market (full page): tabs New / Used; cards: name, class icon, seats, range, price, lease/mo, fuel per seat-hour; filters (min range, min seats); locked types show "Unlocks at Regional tier"; compare tray up to 3. Actions **"Lease for $X/mo"**, **"Buy for $X"** open `CabinEditor` (sliders per class, live seat-units bar, default all-economy at maxSeats).
- `AircraftInspector`: stats, assigned routes, **Edit cabin**, **Sell aircraft** / **Return lease** (Modal confirm listing routes that will be suspended).

- [ ] Step 1: Tests: empty fleet shows empty state CTA; selling an assigned aircraft lists its routes in the confirm modal; CabinEditor blocks confirm when seat units exceed max with message "Too many seats — max 194 seat units".
- [ ] Step 2: FAIL. Step 3: Implement. Step 4: PASS. Step 5: Commit `feat(desktop): fleet and aircraft market`.

### Task 26: Overview dashboard

**Files:** Create `screens/Overview/{Overview,AlertsCard,GoalsCard,TopRoutesCard,RivalWatchCard}.tsx`, `screens/Overview/alerts.ts`; Test `alerts.test.ts`, `Overview.test.tsx`

**Interfaces:**
- Grid `repeat(auto-fit, minmax(280px, 1fr))`, gap 16: Cash & 30-day profit (KpiTile + sparkline from `game.history`), Alerts, Goals (`view.objectives`, checkmark animation on completion), Top routes (5 by profit/day), Reputation (Meter + trend), Rival watch (biggest change in route count this week).
- `deriveAlerts(view: ClientView): Alert[]` — `{id, level, text, action: {label, select}}`: route profit30 sum < 0 ("LHR–CDG lost $120k in 30 days" → "Review route"); idle aircraft; aircraft condition < 60; cash < 1 month of costs ("Cash is low" → "Take a loan"); suspended routes.
- Card stagger 30 ms (max 8), none under reduced motion.

- [ ] Step 1: Tests: `deriveAlerts` returns the low-cash alert when cash < monthly costs; no alerts for a healthy view; Goals renders 3 incomplete objectives.
- [ ] Step 2: FAIL. Step 3: Implement. Step 4: PASS. Step 5: Commit `feat(desktop): overview dashboard`.

### Task 27: Finance

**Files:** Create `screens/Finance/{Finance,PnlChart,CashChart,LoansCard,KpiRow}.tsx`, `screens/Finance/aggregate.ts`; Test `aggregate.test.ts`, `LoansCard.test.tsx`

**Interfaces:**
- `aggregateMonthly(daily: AirlineDaily[]): { month: string; revenue: Money; costs: AirlineDaily['costs']; profit: Money }[]`.
- KPI row: Revenue (30 d), Operating margin, RASK (revenue / available seat-km), CASK, Load factor. Stacked bar P&L (Recharts) by month; cash line chart (last 360 days).
- Loans card: rating chip, available credit, list of loans, **"Take loan"** (NumberInput with preview "Interest: $X/month at Y%"), **"Repay"**.

- [ ] Step 1: Tests: `aggregateMonthly` sums 60 days into 2 months correctly; take-loan button shows interest preview `$50k/month` for $10M at 6%.
- [ ] Step 2: FAIL. Step 3: Implement. Step 4: PASS. Step 5: Commit `feat(desktop): finance screen`.

### Task 28: Market, Airline, News, notifications

**Files:** Create `screens/Market/Market.tsx`, `screens/Airline/Airline.tsx`, `screens/News/News.tsx`, `src/renderer/notifications/{Toaster,EventModal}.tsx`; Test `News.test.tsx`, `EventModal.test.tsx`

**Interfaces:**
- Market (basic): competitor table from `view.rivals` (name, personality label, fleet, routes, reputation, overlap) — click → inspector with their routes highlighted on map; route demand lookup (two Comboboxes → `game.routeDemand`).
- Airline (basic): name/colors/logo (custom logo upload; read-only colors in v0.1), reputation breakdown, service level selector (1–5 with cost per pax shown), marketing budget NumberInput, bases list with **"Close base"**.
- News: chronological notification log with level icons + filters (All / Events / Rivals / Warnings); event cards show effect + duration + affected link.
- Toaster: `info`/`warning` notifications from each tick → toasts (max 3); `major` → `EventModal` (scale .98→1 + fade 250 ms) and the loop is already paused by `autoPause` if the setting is on; buttons **"Resume"** / **"View details"**.

- [ ] Step 1: Tests: major notification opens EventModal; info notification creates a toast but no modal; News filter "Events" hides warnings.
- [ ] Step 2: FAIL. Step 3: Implement. Step 4: PASS. Step 5: Commit `feat(desktop): market, airline, news and notifications`.

### Task 29: Onboarding, settings, game over

**Files:** Create `screens/Onboarding/{Coachmarks,steps.ts}.tsx`, `screens/Settings/Settings.tsx`, `screens/GameOver/GameOver.tsx`; Test `Onboarding.test.tsx`, `Settings.test.tsx`

**Interfaces:**
- Onboarding: after "Found airline", a dismissible coach-mark sequence tied to objectives `lease-first → open-first-route → first-day → first-profit`; each step anchors to the relevant control ("Browse aircraft", "New route", Play button, cash). "Skip tutorial" sets `Settings.tutorialDone = true`. Empty states teach the same steps if skipped.
- Settings: Reduce motion, Performance mode (disables backdrop blur and arc animation), Auto-pause on major events, Autosave interval, Units, Volume (no audio in v0.1 → hide Volume; keep field), Shortcut list.
- Game over: final stats (days survived, peak fleet, total pax, peak company value chart from history), two hints from `deriveAlerts`-style rules ("Most of your losses came from LHR–MAD"), **New career** / **Load save**.

- [ ] Step 1: Tests: tutorial advances when `lease-first` completes; "Skip tutorial" hides coachmarks and persists; toggling Reduce motion sets `data-reduce-motion` on `<html>`; `gameOver` in view switches screen to GameOver.
- [ ] Step 2: FAIL. Step 3: Implement. Step 4: PASS. Step 5: Commit `feat(desktop): onboarding, settings and game over`.

### Task 32: Logo pack and silhouettes (do right after Task 29)

**Files:** Create `apps/desktop/src/main/logos.ts`, `apps/desktop/src/renderer/components/{AirlineLogo,AircraftSilhouette}.tsx`, `screens/Settings/LogoPackSection.tsx`; Modify `src/preload/index.ts`, `packages/shared/src/ipc.ts`; Test `src/main/logos.test.ts`, `components/AirlineLogo.test.tsx`

**Interfaces:**
- `GameApi` additions: `logos.status(): Promise<{ have: number; total: number }>`; `logos.download(onProgress: (done: number, total: number) => void): Promise<{ ok: number; failed: string[] }>`; `logos.cancel(): void`; `logos.url(iata: string): string | null` (custom `skyempire-logo://` protocol registered in main, serving files from `userData/logos/`).
- `downloadLogos(airlines: AirlineData[], dir: string, fetchFn = fetch, signal?)`: for each QID, query `https://www.wikidata.org/wiki/Special:EntityData/<QID>.json`, read claim `P154` (logo image) filename, download `https://commons.wikimedia.org/wiki/Special:FilePath/<filename>?width=256` → `<IATA>.png` (or `.svg` when the original is SVG and no width). Concurrency 4; 2 retries with backoff; User-Agent `SkyEmpire/0.1 (open-source game)`; skip airlines whose file already exists; write to temp file then rename.
- Player custom logo: `NewAirline` identity step and Airline screen accept a PNG/SVG ≤ 1 MB, copied to `logos/__player.png`.
- `AirlineLogo({ airline, size: 16|24|40 })`: uses `logos.url`; on missing/error renders placeholder badge (IATA code on `brandColor`, text color chosen for ≥ 4.5:1 contrast).
- `AircraftSilhouette({ typeId, view: 'side'|'top', size })`: inline SVG from `silhouettePath`, `fill: currentColor`. Map plane dots (Task 22) use the `top` view via deck.gl `IconLayer` when not in performance mode.
- Settings section per `ui-ux-design.md §5.5a` (progress, cancel, failures listed with "Retry").
- `CREDITS.md`: silhouettes' licenses; README note: logos are downloaded by the player from Wikimedia Commons and are not distributed with the game.

- [ ] Step 1: Tests (mock `fetchFn`): Wikidata JSON with P154 → Commons URL requested and file saved as `LH.png`; airline without P154 → listed in `failed`; existing file skipped (no fetch); abort signal stops further downloads; partial download leaves no half-written file; `AirlineLogo` renders badge text `EK` when `logos.url` returns null and has `aria-label="Emirates"`.
- [ ] Step 2: FAIL. Step 3: Implement. Step 4: PASS; manual check: download all logos in `pnpm dev`, logos appear in rival list and map tooltips.
- [ ] Step 5: Commit `feat(desktop): logo pack download and aircraft silhouettes`.

---

## Phase F — Release

### Task 30: Balance pass

**Files:** Create `packages/sim/scripts/balance-report.ts`, `packages/sim/src/balance.test.ts`; Modify `src/config/balance.ts` (tuning only)

**Interfaces:** `pnpm --filter @skyempire/sim balance -- --seeds 1-5 --years 5` prints per-AI and "bot player" (a `balanced` bot = legacy personality with priceAggressiveness 0.5) metrics: operating margin, bankruptcies, tier reached, avg LF.

- [ ] Step 1: Tests (targets from `simulation-spec.md §13`): a player route LHR–CDG with A20N at 14 rt/wk and suggested fares has cumulative route profit ≥ 0 by day 30 (seeds 1–5); median AI operating margin over years 2–5 in [3%, 15%]; ≤ 1 AI bankruptcy per 5-year run on Normal; a pure "fare = 0.6 × ref" bot ends year 3 with lower company value than the balanced bot; balanced bot reaches Regional tier within 3 years and National within 6.
- [ ] Step 2: Run → expect some FAIL. Step 3: Tune `balance.ts` constants only (record each change + reason in the commit message). Step 4: PASS; regenerate golden snapshot (Task 14) deliberately. Step 5: Commit `balance: tune v0.1 economy`.

### Task 31: Auto-update, e2e flow, v0.1 release

**Files:** Create `src/main/updater.ts`; Modify `e2e/smoke.spec.ts`, `README.md` (install instructions, SmartScreen "More info → Run anyway" note, screenshots); Create `CHANGELOG.md`

**Interfaces:** `initUpdater(window)`: `electron-updater` with GitHub provider; checks on launch (not in dev), shows a non-blocking toast "Update ready — restart to install" with **"Restart now"**.

- [ ] Step 1: Extend e2e: launch → New career → name "Test Air", hub LHR, Normal → lease A20N → open route LHR–CDG with suggested fare → set speed 8× → wait until day ≥ 7 → Overview cash delta visible and Finance shows revenue > 0 → Ctrl+S → relaunch → Continue → day ≥ 7.
- [ ] Step 2: Run e2e (`xvfb-run -a pnpm --filter @skyempire/desktop e2e`) → FAIL until wired. Step 3: Implement updater + fixes. Step 4: PASS; run full `pnpm lint && pnpm typecheck && pnpm test`.
- [ ] Step 5: Run the `release.yml` build-only job; download installer artifact; record install test on Windows (ask the user to run it — this dev machine is Linux).
- [ ] Step 6: Commit `feat: auto-update and v0.1 e2e`. **Ask the user** before creating the GitHub repo, pushing, and tagging `v0.1.0`.

---

## Execution notes
- Phases A–C are pure TypeScript and fully testable on this Linux machine. Phase D/E e2e needs `xvfb-run` (install `xvfb` if missing). Windows installer is built only in GitHub Actions.
- `better-sqlite3` is rebuilt for Electron by electron-builder (`npmRebuild: true`); in dev, run `electron-builder install-app-deps` via the desktop `postinstall`.
- Out of v0.1 (do not build): connections, cargo, IPO, alliances, slot trading, achievements, light theme, undo, UI scale, multiplayer, Sentry, itch.io/Microsoft Store packaging.
