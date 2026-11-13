# SkyEmpire v0.2 "Living World" — Design

> Status: Draft v1 · 2026-11-13 · Builds on v0.1 "First Flight"

## 1. Intent

Make the world feel alive and **real**: weather that grounds flights, airspace that closes and forces detours, holidays that fill planes, and a much bigger fleet to choose from. Each system creates **decisions** for the player (reroute, add capacity, raise fares, hedge, wait it out), not just random punishment.

### Goals
- **Weather** — real-time (when online) or realistic simulated weather that delays, diverts and cancels flights and reduces airport capacity.
- **Geopolitical tensions** — airspace closures, route bans and diplomatic thaws that change which routes are possible and how long they take.
- **Holidays and seasons** — real public holidays and festivals per country drive demand peaks.
- **More aircraft** — from 19 to ~40 real types, including used classics and new-generation jets.

### Non-goals
- Live flight tracking or real airline schedules.
- Commentary on real conflicts. Tensions are modeled as **generic, region-level events** ("Airspace closed over region X"), never naming parties or causes.

### Anti-goals
- Events that feel unfair (no warning, no counterplay).
- Online-only features: everything must work offline with a simulated fallback.

## 2. Weather

### Sources
| Mode | Source | Notes |
|---|---|---|
| **Live weather** (setting, default on when online) | [Open-Meteo](https://open-meteo.com/) forecast API — free, no key, CC BY 4.0 | One batched request per game day for the ~150 airports the player and rivals actually use; cached; mapped onto the game calendar |
| **Simulated** (offline / setting off) | Climatology by latitude band + month (storm, snow, fog, cyclone seasons) | Deterministic from the save seed |

Open-Meteo is called from the main process only, at most once per real minute, with attribution in Credits.

### Model
Each airport gets a daily **condition**: Clear · Wind · Rain · Thunderstorm · Snow · Fog · Tropical cyclone (from WMO weather codes + wind gusts + visibility).

| Condition | Capacity | On-time | Cancellations | Other |
|---|---|---|---|---|
| Wind / Rain | −10% slots | −5 | — | — |
| Thunderstorm | −30% | −15 | 5% of flights | Turboprops more affected |
| Snow | −40% | −20 | 10% | De-icing cost +$300/departure |
| Fog | −35% | −15 | 5% | Diverts if runway < 2,500 m |
| Tropical cyclone | Airport closed 1–3 days | — | 100% | Warned 2 days ahead |

- **Disruption cascade (light):** cancelled flights lose that day's revenue and cost reputation; passengers rebook onto the next day if seats exist.
- **Counterplay:** weather forecast panel (3 days), "Pre-emptive cancel" (cheaper than a cancellation on the day), spare-aircraft buffer (aircraft under 85% use recover delays faster).
- **Map:** weather layer (icons + soft radar-style overlay), toggle in map controls.

## 3. Geopolitical tensions

### Model
- **Airspace regions:** ~40 coarse polygons (FIR-group level) in `packages/data/src/airspace.json`, drawn from public FIR boundaries (simplified).
- **Tension events** (generic, randomized, no real-world attribution):
  - **Airspace closure** over a region for 30–360 days → routes whose great circle crosses it **detour** around the polygon (+distance → +block time, fuel, crew; may exceed range → route suspended with a clear message).
  - **Route ban** between two countries for 60–720 days → affected routes suspended, slots kept for 90 days.
  - **Thaw** → a ban lifts early, or a new market opens (one-off demand bonus).
  - **Travel advisory** → demand to a country −20–50% for its duration.
- **Warnings:** most events have a 7–30 day "rising tensions" notice so players can react.
- **Scenario mode (later):** optional preset historical-style closures for players who want them, off by default.

### Routing
- `routeDistance(a, b, closures)` = great-circle unless it crosses a closed polygon; then shortest detour via polygon edge points (precomputed visibility graph per closure). Cached per pair.
- UI: affected routes show a "Detour +480 km" chip; route editor warns before opening.

## 4. Holidays and seasons

- **Data:** [`date-holidays`](https://github.com/commenthol/date-holidays) (ISC licence, offline) for public holidays in ~200 countries, plus a hand-authored **festival table** for multi-day travel peaks: Christmas–New Year, Easter, Lunar New Year / Spring Festival travel (Chunyun), Diwali, Eid al-Fitr, Eid al-Adha, Golden Week (JP, CN), Thanksgiving (US), summer school holidays (by hemisphere/country), Ramadan (lower leisure demand).
- **Demand multiplier per airport-country per day:** `1 + peak × shape(day)`, where peak ranges 0.1 (long weekend) to 0.8 (Chunyun / Christmas) with ramp-up and return-trip spikes. Leisure-heavy pairs get more; business demand drops on holidays.
- **Player tools:** holiday calendar (next 60 days, by your markets), "Add seasonal flights" (temporary frequency increase), seasonal fares (+/− % for a date range).
- The game calendar becomes real-calendar-aligned (Year 1 = the real current year), so holidays fall on real dates.

## 5. More aircraft (19 → ~40)

| Class | Additions |
|---|---|
| Regional jets | Bombardier CRJ900, Embraer E190-E2, COMAC ARJ21 |
| Narrowbody | A319ceo, A321ceo, Boeing 737-700, 737-9, 737-10, COMAC C919 |
| Long-range narrowbody | Boeing 757-200 (used only) |
| Widebody | A330-200, A350-1000, Boeing 767-300ER (used), 787-8, 787-10, 777-200ER, 777-9 |
| Very large | Airbus A380-800, Boeing 747-8I |
| Tier | A380 / 747-8 / 777-9 / A350-1000 unlock at a new **Global** tier |

Each needs specs + sources, silhouettes (side + top) from real dimensions, and AI fleet lists updated (e.g. Emirates gets A380s).

## 6. Engine changes (summary)

- `GameState.world`: `weather: Record<airportId, DailyWeather>`, `tensions: ActiveTension[]`, `detourCache` (derived, not saved).
- Tick order gains: (2a) weather update, (2b) tension events, (2c) holiday multipliers.
- Save schema **v2** with a migration from v1 (no weather → simulated; no tensions).
- Live-weather fetch lives in the main process and is fed to the worker as a command-like input, so the sim stays deterministic **given its inputs** (replays store fetched weather).

## 7. Release plan

**v0.2 "Living World"** — next release after v0.1 ships and has had a week of player feedback.

| Order | Work | Why this order |
|---|---|---|
| 1 | More aircraft | Pure data + silhouettes; low risk, immediate value |
| 2 | Holidays & real calendar | Demand-only change; easy to balance |
| 3 | Simulated weather + forecast UI | Disruption mechanics without network dependency |
| 4 | Live weather (Open-Meteo) | Swap-in data source for 3 |
| 5 | Geopolitical tensions + detours | Needs routing changes; most balancing work |
| 6 | Balance pass + save migration + release | — |

## 8. Free data sources (all $0)
Open-Meteo (CC BY 4.0) · date-holidays (ISC) · public FIR boundary data (simplified) · manufacturer spec sheets / Wikidata for new aircraft.

## 9. Left to the builder
Exact disruption probabilities, polygon simplification tolerance, festival peak sizes — tune in the balance pass.
