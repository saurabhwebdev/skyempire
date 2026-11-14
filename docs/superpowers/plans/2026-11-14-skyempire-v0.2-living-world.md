# SkyEmpire v0.2 "Living World" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add more aircraft and a Global tier, real-calendar holidays, simulated and live weather, and geopolitical airspace tensions, then rebalance and ship v0.2.0.

**Architecture:** Every new system lives in the pure, deterministic `@skyempire/sim`. Weather is a pure function of (seed, airport, day), with live data overriding it. Holiday dates come from a data table generated at build time. Airspace polygons are precomputed from the Natural Earth basemap. The only network input is live weather: the main process fetches it and hands it to the worker as data stored in state, so the simulation stays deterministic given its inputs. The save schema moves to v2, with a migration from v1.

**Tech Stack:** As in v0.1. New dev dependency in `packages/data`: `date-holidays@3.39.1` (ISC), used at build time only. Open-Meteo forecast API (CC BY 4.0, no key).

**Spec:** `docs/superpowers/specs/2026-11-13-skyempire-v0.2-living-world-design.md`

## Global Constraints

- Everything works offline. Live weather is optional, defaults to on, and falls back to simulated weather on any failure.
- Sim purity: no `Math.random`, `Date.now` or network calls in `packages/sim`. All randomness comes from `Rng` or the seeded hash.
- Tensions are generic and region-level. Never name parties or causes. Region names are geographic ("Eastern Mediterranean airspace").
- Most tension events give 7–30 days' warning. Tropical cyclones give 2 days' warning.
- Open-Meteo is called from the main process only, at most once per real minute, with attribution in Credits. Requests carry coordinates only.
- The calendar is real and Gregorian: Year 1 is the year passed in `NewGameOptions.startYear` (main process: the current year; default 2026).
- Save schema v2. v1 saves migrate (simulated weather, no tensions, `startYear` 2026).
- Free tools only; no new runtime dependencies in the renderer or the sim.

## Review Focus

1. A v0.1 save loads in v0.2 and keeps playing. (Task 2 test `migrates a v1 save`.)
2. Live weather is offline, times out, returns HTTP errors or a partial or malformed body: simulated weather is used and nothing throws. (Task 7 tests.)
3. A detour has an endpoint inside the closed region, or no path exists: no infinite loop; endpoints inside the region ignore that region; no path means blocked with a message. (Task 9 tests.)
4. A country is missing from the holiday table (e.g. `XK`), or the year is beyond the table: multiplier 1 or the wrapped year; never throws. (Task 3 tests.)
5. A route crosses the antimeridian (SYD–LAX, NRT–SFO) while a closure is active: the distance stays sane (≤ 1.5× great circle) with no wrap bug. (Task 9 test.)

---

### Task 1: More aircraft, used-only types and the Global tier

**Files:**
- Modify: `packages/data/src/aircraft.json`, `packages/data/src/schema.ts`, `packages/data/scripts/build-silhouettes.ts` (DIMS), `packages/data/src/airlines.seed.json` (fleetTypes), `packages/shared/src/types.ts` (`TierId` adds `'global'`; `AircraftType.usedOnly?: boolean`)
- Modify: `packages/sim/src/progression.ts` (TIERS adds Global), `packages/sim/src/commands/fleet.ts` (reject lease/buy of a `usedOnly` type: "Only available used"), `packages/sim/src/market.ts` (used listings include usedOnly types), `packages/sim/src/newGame.ts` (sizeRank ≤ 5 majors start at `global`)
- Modify: renderer tier labels and the aircraft market (a "Used only" badge; hide Lease/Buy new)
- Test: `packages/data/src/aircraft.test.ts`, `packages/sim/src/progression.test.ts`, `packages/sim/src/commands/commands.test.ts`

New types (ICAO id · tier · usedOnly): CRJ9 startup · E290 startup · AJ27 startup · A319 startup used · B737 startup used · A321 regional used · B39M regional · B3XM regional · C919 regional · B752 regional used · B763 national used · A332 national · B788 national · B78X national · B772 national used · A35K global · B779 global · A388 global · B748 global. That makes 38 types.

Specs come from manufacturer data. Prices follow the v0.1 rule: 50% of list, lease 0.75% a month. For used-only types, the price is the notional new value that depreciation starts from. Every entry carries `sources`.

Global tier: `{ id: 'global', name: 'Global', aircraft: 40, pax: 20_000_000, revenue360: 2_000_000_000 }`. Fleets: EK and QR get A388/B779/A35K; LH and BA get A388/B748; UA and DL get B752/B763.

- [ ] Write tests:
  - `aircraft.json has 38 types, every type has sources and a silhouette`;
  - `tiers: national airline meeting 2 of 3 global thresholds becomes global`;
  - `leaseAircraft of usedOnly type is rejected with "Only available used"`;
  - `used market can list a B752`.
- [ ] Run them and watch them fail. Implement. Regenerate silhouettes (`node packages/data/scripts/build-silhouettes.ts`).
- [ ] `pnpm test` is green. Commit `feat: 19 more aircraft, used-only types, Global tier`.

### Task 2: Real calendar and save schema v2

**Files:**
- Modify: `packages/sim/src/calendar.ts`, `packages/shared/src/types.ts`, `packages/sim/src/newGame.ts`, `packages/sim/src/view.ts`, every `dateOf` / `formatDate` caller (sim, worker `demandInfo.ts`, renderer)
- Create: `packages/sim/src/migrate.ts` (exported), used by the worker load path and `apps/desktop/src/main/saves/saves.ts`
- Test: `packages/sim/src/calendar.test.ts`, `packages/sim/src/migrate.test.ts`

**Interfaces (produces):**
- `dateOf(day: number, startYear: number): { year: number; month: number; dayOfMonth: number; dayOfYear: number; iso: string }`: day 0 is Jan 1 of `startYear`. `year` is the real year. It uses `Date.UTC` arithmetic.
- `isMonthStart(day, startYear)`: the real first of the month.
- `formatDate(day, startYear)` gives "Mar 5, 2027".
- `GameState.schemaVersion: 2`, and `GameState.world: { startYear: number; liveWeather: Record<number, Record<string, WeatherCondition>>; tensions: ActiveTension[]; preCancelled: Record<string, number[]> }`. `WeatherCondition` and `ActiveTension` types are added here, empty until Tasks 5 and 9.
- `NewGameOptions.startYear?: number`.
- `ClientView.startYear`.
- `migrate(raw: unknown): GameState`: v1 → v2 adds `world` with `startYear: 2026`.

- [ ] Write tests:
  - `day 0 is Jan 1`;
  - `day 59 of 2027 is Mar 1` (non-leap);
  - `day 59 of 2028 is Feb 29`;
  - `isMonthStart true on day 31 (Feb 1)`;
  - `migrates a v1 save`: load the fixture `packages/sim/src/__fixtures__/v1-save.json` (generated once from a v0.1 game at day 40), migrate, then tick 5 days without throwing; `schemaVersion === 2`.
- [ ] Implement it. Seasonality uses a 365-day period. Leave `ageDays / 360` and interest `/360` unchanged (see Ruling 1 below). The worker's main-process start passes `startYear: new Date().getFullYear()`.
- [ ] `pnpm test` (update snapshot tests whose output only changed because of date strings) and lint are green. Commit `feat: real calendar and save schema v2`.

### Task 3: Holidays engine

**Files:**
- Create: `packages/data/scripts/build-holidays.ts` → `packages/data/src/holidays.json`; `packages/data` adds the devDependency `date-holidays@3.39.1`
- Create: `packages/sim/src/holidays.ts`, `packages/sim/src/config/festivals.ts`
- Modify: `packages/data/src/index.ts` (`Catalog.holidays`), `packages/shared/src/types.ts`, `packages/sim/src/daySim.ts`, `packages/sim/src/demand.ts` (hemisphere seasonality: phase +180° when lat < 0)
- Test: `packages/sim/src/holidays.test.ts`, `packages/data/src/holidays.test.ts`

**Data (`holidays.json`)** covers 2026–2045:
- `public`: `Record<countryIso2, Record<year, number[]>>`, each list holding day-of-year values of `type: 'public'` holidays. Countries where date-holidays throws (BN, CC, CN, CX, HK, ID, KR, MU, MY, PH, SG, SR, TW, VN) are skipped and rely on festivals.
- `anchors`: `Record<festivalId, Record<year, 'YYYY-MM-DD'>>`, sourced as follows:
  - Eid al-Fitr: TT "End of Ramadan (Eid al-Fitr)";
  - Eid al-Adha: GY "Eid Ul Adha";
  - Diwali: TT "Deepavali";
  - Easter: GB "Easter Sunday";
  - Thanksgiving: US "Thanksgiving Day";
  - Lunar New Year: a hardcoded table in the script (2026-02-17, 2027-02-06, 2028-01-26, 2029-02-13, 2030-02-03, 2031-01-23, 2032-02-11, 2033-01-31, 2034-02-19, 2035-02-08, 2036-01-28, 2037-02-15, 2038-02-04, 2039-01-24, 2040-02-12, 2041-02-01, 2042-01-22, 2043-02-10, 2044-01-30, 2045-02-17).

**Festivals (`festivals.ts`):** `{ id, name, countries: string[], anchor: festivalId | { month, day }, before, after, peak }`.

| Festival | Countries | Window | Peak |
|---|---|---|---|
| Christmas–New Year | Christian-majority list, all of Europe and the Americas, plus AU and NZ | anchor 12-24, −4 / +12 | 0.8 |
| Lunar New Year (Chunyun) | CN, TW, HK, SG, VN, KR, MY | −10 / +10 | 0.8 |
| Diwali | IN, NP, TT, MU, FJ | −3 / +4 | 0.5 |
| Eid al-Fitr | Muslim-majority list | −2 / +4 | 0.5 |
| Eid al-Adha | Muslim-majority list | −2 / +4 | 0.4 |
| Ramadan | Muslim-majority list | −29 / −1 relative to Eid al-Fitr | −0.15 (business unaffected) |
| Easter | Christian-majority list | −3 / +2 | 0.3 |
| Golden Week JP | JP | 04-29, 0 / +7 | 0.5 |
| Golden Week CN | CN | 10-01, 0 / +7 | 0.6 |
| Thanksgiving | US | −1 / +4 | 0.4 |
| Southern summer | AU, NZ, ZA, AR, BR, CL | 12-20, 0 / +40 | 0.2 |

**Interfaces (produces):** `holidayLift(country: string, day: number, startYear: number, catalog: Catalog): number` returns peak-weighted lift (≥ −0.15, ≤ 0.8), as follows:
- Public holidays give 0.1 on the day and 0.05 on days ±1.
- Festivals give `peak` inside the window. They ramp linearly to 0 over the 3 days outside each edge. The last 2 days of the window are ×1.25 (the return spike).
- Overlapping lifts use the maximum, not a sum.
- An unknown country or missing data gives 0. A year beyond the table maps to `2026 + ((y − 2026) mod 20)`.

**Applying the lift in `simulatePair`:**
- For each direction o→d, `lift = max(holidayLift(o.country), holidayLift(d.country))`.
- Economy and premium demand are multiplied by `1 + lift × (0.6 + 0.4 × avgTourism)`.
- Business demand is multiplied by `1 − 0.5 × max(0, lift)`.

- [ ] Write tests:
  - `Lunar New Year dates are each within 1 day of a new moon`, using the Meeus mean new moon formula in the test;
  - `Chunyun lift for CN on CNY 2027 is 0.8`;
  - `Christmas lift for GB on Dec 26 > 0.5`;
  - `Diwali 2027 for IN is 2027-10-28 ±1`;
  - `XK gives 0`;
  - `year 2051 wraps without throwing`;
  - `holiday raises economy demand and lowers business demand on a CN–CN pair`;
  - `southern airport seasonality peaks in January`.
- [ ] Run them and watch them fail. Implement the build script and run it (`node packages/data/scripts/build-holidays.ts`). Implement the sim.
- [ ] `pnpm test` is green. Commit `feat: real holidays and festivals drive demand`.

### Task 4: Holiday player tools

**Files:**
- Modify: `packages/shared/src/types.ts` (`Route.seasonalFares?: { startDay: number; endDay: number; pct: number }[]`), `packages/shared/src/commands.ts` (`updateRoute.seasonalFares`, max 4, pct −50..+100, `endDay ≥ startDay ≥ today`), `packages/sim/src/commands/routes.ts`, `packages/sim/src/daySim.ts` (effective fare = fare × (1 + pct / 100) on matching days)
- Modify: `packages/sim/src/view.ts` (`ClientView.upcomingPeaks: { name: string; countries: string[]; startDay: number; endDay: number; peak: number }[]`: the next 60 days, festivals only, limited to countries of airports the player serves or has bases at, sorted by start)
- Create: `apps/desktop/src/renderer/screens/Overview/PeaksCard.tsx`
- Modify: the route editor: a "Seasonal fares" section (date range + %)
- Test: `packages/sim/src/commands/commands.test.ts`, `packages/sim/src/view.test.ts`, `apps/desktop/src/renderer/screens/Overview/PeaksCard.test.tsx`

- [ ] Write tests:
  - `seasonal fare +20% raises revenue per pax on that day only`;
  - `seasonal fare with startDay in the past is rejected`;
  - `upcomingPeaks for a PEK-based player includes Lunar New Year when within 60 days`;
  - `PeaksCard renders an empty state "No big travel peaks in the next 60 days"`.
- [ ] Implement it. `pnpm test` is green. Commit `feat: upcoming peaks and seasonal fares`.

Ruling 2: "Add seasonal flights" (a temporary frequency increase) is deferred. Players can raise frequency by hand.

### Task 5: Simulated weather and disruptions

**Files:**
- Create: `packages/sim/src/weather.ts`, `packages/sim/src/hash.ts` (`hash01(seed: number, day: number, key: string): number` in [0,1), using FNV-1a mixed with the seed)
- Modify: `packages/sim/src/daySim.ts`, `packages/sim/src/economics.ts`, `packages/sim/src/events.ts` (the old random `storm` event is removed; weather replaces it), `packages/shared/src/commands.ts` + `packages/sim/src/commands/routes.ts` (`preCancel { routeId, day }`, with day in today+1..today+3), `packages/sim/src/config/balance.ts` (`WEATHER` block)
- Test: `packages/sim/src/weather.test.ts`

**Interfaces (produces):**
- `type WeatherCondition = 'clear' | 'wind' | 'rain' | 'thunderstorm' | 'snow' | 'fog' | 'cyclone'`.
- `simulatedWeather(seed, airport: Airport, day, startYear): WeatherCondition` uses climatology by |lat| band, hemisphere and month:
  - snow when |lat| > 40 in local winter: p = min(0.12, 0.04 + 0.002 × (|lat| − 40));
  - thunderstorm: 0.10 in the tropical wet season (|lat| < 25; N Jun–Sep, S Dec–Mar), 0.04 in temperate summer, else 0.01;
  - fog: 0.06 in temperate autumn and winter, else 0.03;
  - rain 0.15, wind 0.08;
  - cyclone: 8° ≤ |lat| ≤ 30° in season (N Jul–Oct, S Jan–Mar), with a start p of 0.004 and a length of 1–3 days. A start on day d covers d..d+len−1.
  - One `hash01(seed, day, id)` draw is mapped through the cumulative probabilities. Cyclones are checked first, using separate keys `id+':cy'`.
- `weatherAt(state, catalog, airportId, day): WeatherCondition`: `state.world.liveWeather[day]?.[id]` if present, else simulated.
- `weatherEffect(cond, airport, aircraftClass) → { capacityCut, onTimePenalty, cancelShare, deicePerDeparture, closed }`, per the spec table:
  - wind and rain: 0.10 / 5 / 0;
  - thunderstorm: 0.30 / 15 / 0.05, ×1.5 cancellations for turboprops;
  - snow: 0.40 / 20 / 0.10, $300 per departure;
  - fog: 0.35 / 15 / 0.05, ×3 cancellations if `runwayM < 2500`;
  - cyclone: closed.

**Applied in `routeOps`:**
- For each end airport, effective cancel = `max(cancelShare, 1 − (1 − capacityCut) × capacity / max(1, slotsUsed))`, clamped to [0,1]. The route uses the worse of its two ends.
- Flown round trips are multiplied by (1 − cancel).
- The on-time penalty is subtracted. It is halved for aircraft under 85% utilisation (the spare buffer).
- Cancelled seats on the day cost $20 each (passenger care) in `fees`. Pre-cancelled days fly 0 at $5 per seat.
- The 3-day forecast simply calls `weatherAt` for day+1..day+3.

Ruling 3: rebooking cancelled passengers onto the next day is not modelled. The loss is limited to that day's revenue.

- [ ] Write tests:
  - `simulatedWeather is deterministic for same inputs`;
  - `Helsinki gets snow on ~4–12% of January days over 10 years, ~0 in July`;
  - `Singapore never gets snow`;
  - `Manila has cyclone days in Aug–Oct over 10 years, none in Feb`;
  - `live weather overrides simulated`;
  - `snow at origin cancels ~10% of flights and adds de-icing cost`;
  - `cyclone closes the airport`;
  - `preCancel 2 days ahead: route flies 0 that day at $5/seat`;
  - `preCancel for today is rejected`.
- [ ] Implement it. `pnpm test` is green (update tick and storm tests). Commit `feat: simulated weather and disruptions`.

### Task 6: Weather UI

**Files:**
- Modify: `packages/sim/src/view.ts` (`ClientView.weather: { today: Record<string, WeatherCondition>; forecast: Record<string, WeatherCondition[]> }`. `today` covers non-clear airports with any active route; `forecast` covers the player's airports for the next 3 days.)
- Create: `apps/desktop/src/renderer/screens/Overview/WeatherCard.tsx` (player airports with non-clear weather in the next 3 days, each with a "Cancel ahead" action → `preCancel` on its routes)
- Modify: `apps/desktop/src/renderer/map/layers.ts` + `WorldMap.tsx` (a `ScatterplotLayer` "weather": soft radius 40 km, colour per condition, from the validated palette tokens; toggled in the map controls, persisted in settings `mapWeather: boolean`, default true), the airport inspector (shows the 3-day forecast)
- Test: `apps/desktop/src/renderer/map/layers.test.ts`, `apps/desktop/src/renderer/screens/Overview/WeatherCard.test.tsx`

- [ ] Write tests:
  - `weather layer omitted when toggle off`;
  - `weather layer has one point per non-clear airport`;
  - `WeatherCard lists a snow day at LHR with Cancel ahead`;
  - `WeatherCard empty state "Clear skies across your network"`.
- [ ] Implement it, using icons from lucide (`CloudSnow`, `CloudLightning`, `CloudFog`, `Wind`, `CloudRain`, `Tornado`). `pnpm test` is green. Commit `feat: weather forecast card and map layer`.

### Task 7: Live weather (Open-Meteo)

**Files:**
- Create: `apps/desktop/src/main/weather.ts`
- Modify: `apps/desktop/src/main/settings.ts` (`liveWeather: boolean`, default true), `apps/desktop/src/main/ipc.ts` + `gameLoop.ts` (after each tick, request a refresh), `apps/desktop/src/worker/simHandler.ts` (message `setLiveWeather` merges into `state.world.liveWeather` and prunes days < today), the Settings screen toggle, `CREDITS.md`
- Test: `apps/desktop/src/main/weather.test.ts`

**Interfaces (produces):**
- `conditionFromWmo(code: number, gustKmh: number): WeatherCondition`:
  - 95–99 thunderstorm;
  - 71–77 and 85–86 snow;
  - 45 and 48 fog;
  - 51–67 and 80–82 rain;
  - else gust ≥ 60 gives wind, and gust ≥ 118 with code ≥ 80 gives cyclone;
  - otherwise clear.
- `class LiveWeather { constructor(fetchFn, nowFn, sleepFn); refresh(points: { id: string; lat: number; lon: number }[], gameDay: number): Promise<Record<number, Record<string, WeatherCondition>> | null> }`:
  - It runs at most once per 60 s of real time; otherwise it returns null.
  - It sends batches of 50 points to `https://api.open-meteo.com/v1/forecast?latitude=..&longitude=..&daily=weather_code,wind_gusts_10m_max&forecast_days=3&timezone=UTC`.
  - Forecast day i maps to game day `gameDay + 1 + i`.
  - The timeout is 10 s. Any error or malformed batch is skipped (those airports stay simulated). The User-Agent is `SkyEmpire/<version> (+https://github.com/saurabhwebdev/skyempire)`.
- Points are the airports used by any active route plus the player's bases.

- [ ] Write tests with an injected fetch:
  - `maps WMO codes`;
  - `throttles to once per minute`;
  - `network error returns null and does not throw`;
  - `malformed batch is skipped, others kept`;
  - `day mapping starts at gameDay+1`;
  - `disabled setting never fetches`.
- [ ] Implement it. `pnpm test` is green. Commit `feat: live weather from Open-Meteo`.

### Task 8: Airspace regions data

**Files:**
- Create: `packages/data/scripts/build-airspace.ts` → `packages/data/src/airspace.json`; `packages/data/src/index.ts` exports `loadAirspace(): AirspaceRegion[]`
- Modify: `packages/shared/src/types.ts` (`AirspaceRegion { id: string; name: string; countries: string[]; rings: [number, number][][]; nodes: [number, number][] }`)
- Test: `packages/data/src/airspace.test.ts`

The script defines about 40 geographic regions, each a list of ISO-2 codes, for example:
- `eastern-mediterranean` (CY, LB, SY, IL, JO, PS)
- `caucasus` (GE, AM, AZ)
- `central-asia` (KZ, UZ, TM, KG, TJ)
- `horn-of-africa` (ER, DJ, SO, ET)
- `persian-gulf` (IR, IQ, KW)
- `sahel` (ML, NE, TD, BF)
- `eastern-europe` (UA, BY, MD)
- `western-russia` (RU rings with lon < 60)
- `siberia` (RU rings 60 ≤ lon < 180)
- …covering Africa, the Middle East, Asia, Europe and South America sparsely.

Rings come from the basemap features (`iso`). Rings crossing the antimeridian are dropped. Each ring is simplified with Douglas–Peucker at a 0.5° tolerance. `nodes` are the ring vertices pushed 0.75° outward from the region's centroid, minus any node that falls inside any ring.

- [ ] Write tests:
  - `35–45 regions, each with ≥1 ring and ≥4 nodes`;
  - `no ring spans > 180° longitude`;
  - `no node lies inside its region`;
  - `airspace.json < 400 KB`.
- [ ] Implement it and run the script. `pnpm test` is green. Commit `feat: airspace regions from Natural Earth`.

### Task 9: Tensions engine and detours

**Files:**
- Create: `packages/sim/src/tensions.ts`, `packages/sim/src/routing.ts`
- Modify: `packages/sim/src/tick.ts` (order: events → weather (pure, nothing to step) → tensions → market), `packages/sim/src/daySim.ts` + `economics.ts` + `ops.ts` + `ai/decide.ts` + `preview.ts` + `commands/routes.ts` (flight distance for block time, fuel, crew and range; great circle stays for `refFare`), `packages/sim/src/demand.ts` (advisory), `packages/shared/src/view.ts` + `packages/sim/src/view.ts`
- Test: `packages/sim/src/routing.test.ts`, `packages/sim/src/tensions.test.ts`

**Interfaces (produces):**
- `ActiveTension`:
  ```ts
  {
    id;
    kind: 'airspaceClosure' | 'routeBan' | 'advisory' | 'thawBonus';
    regionId?;
    countries?: [string, string];
    country?;
    magnitude;
    warnDay;
    startDay;
    endDay;
  }
  ```
- `flightDistanceKm(state, catalog, from, to): { km: number; detourKm: number; blocked: null | string }`:
  - It returns the great circle when no closure is active or the path doesn't cross one. A closure is ignored for this pair when either endpoint lies inside it.
  - Otherwise Dijkstra runs over the endpoints plus the closed regions' nodes. An edge is valid when great-circle samples every 50 km avoid all closed rings (point-in-polygon in lon/lat, with longitudes unwrapped relative to the segment start).
  - No path gives `blocked: 'No path around closed airspace'`.
  - Results are cached in a module-level `Map` keyed by the sorted active-closure ids plus the pair (derived, not saved).
- `routeBlock(state, catalog, route): null | string` returns, in order:
  - `"Flights banned between X and Y"` for a route between two banned countries;
  - the no-path message;
  - `"Detour exceeds <type> range"` per aircraft that can't make it (that aircraft flies 0).
  - A blocked route flies 0 with no cancellation fees and keeps its slots while blocked (Ruling 4: the spec says 90 days, but slots are kept for the whole ban; cost: rivals can't take those slots meanwhile).
- `rollTensions(state, catalog, rng): Notification[]` handles these events:

  | Event | Daily chance | Duration | Details |
  |---|---|---|---|
  | Airspace closure | 1.5/360 | 30–360 days | 70% picked from regions crossed by active routes |
  | Route ban | 1/360 | 60–720 days | Country pair taken from a random active international route |
  | Advisory | 2/360 | 30–120 days | Magnitude 0.2–0.5 |
  | Thaw | 1/180 per active ban | — | Ends the ban now and adds `thawBonus` +20% demand between the pair for 90 days |

  - Each new event other than a thaw sets `warnDay = today` and `startDay = today + rng.int(7, 30)`. It sends a warning note ("Rising tensions: airspace over Eastern Mediterranean may close in ~N days"), a major note at start if the player is affected (else info), and an info note at the end.
- `openRoute` / `updateRoute` reject banned pairs and assignments whose detour distance exceeds range.
- The preview returns `detourKm` and `blocked`.
- View additions:
  - `ClientView.tensions: { id; kind; regionId?; countries?; country?; startDay; endDay; active: boolean }[]`;
  - `ClientView.routeStatus: Record<routeId, { detourKm: number; blocked: string | null }>`.

- [ ] Write tests:
  - `LHR–DEL with central-asia + persian-gulf closed is longer than great circle and < 1.5×`;
  - `SYD–LAX with siberia closed equals great circle (no crossing)`;
  - `NRT–SFO with a closure active is sane ≤ 1.5×`;
  - `endpoint inside closed region ignores that region`;
  - `enclosed path returns blocked, terminates`;
  - `ban suspends flying and openRoute is rejected`;
  - `advisory lowers demand to that country`;
  - `warning precedes start by 7–30 days`;
  - `thaw ends ban and adds bonus`;
  - `cache returns same object on repeat`;
  - `tick perf: worst tick with 2 closures < 250 ms`, measured in the slow suite.
- [ ] Implement it. `pnpm test` is green. Commit `feat: airspace closures, route bans, advisories and detours`.

### Task 10: Tensions UI

**Files:**
- Modify: `apps/desktop/src/renderer/map/layers.ts` + `WorldMap.tsx` (a `GeoJsonLayer` "airspace": active closures in the danger token at 18% fill with a 1.5 px outline; warned-but-not-started ones dashed at 8%), the route list and inspector (a "Detour +480 km" chip and a "Blocked: …" chip from `routeStatus`), the route editor (shows the preview `detourKm` / `blocked` warning before opening), News (tension notes under the "World" category)
- The renderer loads the airspace geometry via the existing `loadBasemap`-style import (`loadAirspace`).
- Test: `layers.test.ts`, the route inspector test, the route editor test

- [ ] Write tests:
  - `airspace layer shows only active and warned regions`;
  - `route row shows Detour +480 km chip`;
  - `route editor shows blocked warning and disables Open route`.
- [ ] Implement it. `pnpm test` and e2e are green. Commit `feat: tension map layer, detour chips and warnings`.

### Task 11: Balance pass

**Files:** `packages/sim/src/config/balance.ts`, `packages/sim/src/balance/balance.slow.test.ts`, `packages/sim/scripts/balance-report.ts`

Acceptance, over 3 years for seeds 1–3, matching v0.1's bands:
- the median AI margin lies between 2% and 10%;
- AI bankruptcies ≤ 3 per seed;
- the balanced bot reaches Regional before day 200, keeps a margin ≥ 5% and doesn't go bankrupt;
- the cheap bot still goes bankrupt;
- the worst tick is under 250 ms.

Tune only the weather cancellation shares, tension rates and festival peaks (spec §9).

- [ ] Run `pnpm --filter @skyempire/sim test:balance` and `tsx packages/sim/scripts/balance-report.ts 3 3 1`, tune, and re-run until the acceptance holds. Commit `balance: tune living-world systems`.

### Task 12: Docs and release v0.2.0

**Files:** `apps/desktop/package.json` (0.2.0), `CHANGELOG.md`, `README.md` (features: 38 aircraft, weather, holidays, tensions), `CREDITS.md` (Open-Meteo CC BY 4.0, date-holidays ISC), `docs/simulation-spec.md` (weather, holidays, tensions sections), `docs/roadmap.md` (v0.2 done)

- [ ] Run the full suite: unit, slow balance, e2e (`xvfb-run -a`) and lint.
- [ ] Do the final whole-branch review, then fix it.
- [ ] Merge to main, tag `v0.2.0`, push, watch the release workflow and set the release notes.

## Rulings carried into execution

1. `ageDays / 360` and interest `/360` stay. The calendar is real, but aging and banking keep their 360-day conventions. Cost: about 1.4% slower aging.
2. Seasonal flights are deferred. Seasonal fares ship.
3. Rebooking cancelled passengers is not modelled.
4. Slots are kept for the whole duration of a ban, not 90 days.
5. Holiday tables cover 2026–2045 and later years wrap. Countries where date-holidays fails rely on the festival table only.
