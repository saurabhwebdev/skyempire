# SkyEmpire v0.5 "Connections" — design

Requested by the user on 2026-11-14, before cargo (cargo moves to v0.6). The decisions below were confirmed with the user.

## 1. Multi-city routes (one flight with stops)
- A route can have **up to 2 intermediate stops**: `Route.stops?: string[]`. The chain is `[from, ...stops, to]`.
- The aircraft flies the whole chain out and back, e.g. LHR→DXB→SIN→DXB→LHR. One round trip = every leg once in each direction.
- **Markets:** every ordered pair along the chain is sold. One stop gives 3 markets (A–B, B–C, A–C); two stops give 6.
  - **Fares:** `Route.fares` is the end-to-end (from–to) fare. `Route.legFares?: Record<pairKey, Fares>` holds the other markets.
  - **Seasonal fares** apply to every market.
- **Demand:** each market is allocated with the airport-pair model, alongside every other airline's offer in that pair.
  - A through market (A–C via B) is an offer with `stops = 1` (or 2), so it takes the existing stop penalty in the allocation utility.
  - Each market offer gets the route's per-class seats.
  - After allocation, **leg capacity** is enforced: if a leg's passengers (all markets using that leg, both directions) exceed 2 × seats, those markets are scaled down proportionally. Passengers who don't fit are lost.
- **Operations:**
  - Every leg must be within range and runway limits. Distance and block time are summed over the legs.
  - `roundTripHours` = Σ over legs of 2 × (block + turnaround).
  - Costs are per leg (fuel, crew, maintenance, landing fees at each arrival).
  - Closures, bans and closed airspace on any leg affect the whole route.
- **Slots:** the end airports use slots as today; each stop uses twice as many (an arrival and a departure in each direction).
- **Rules:**
  - The route must start or end at a base.
  - No airport may appear twice.
  - The same chain can't be opened twice. Different chains between the same end airports are allowed.
  - The AI keeps flying nonstop routes only.
- **UI:**
  - The route editor gets "Add a stop", up to 2, each picked with an airport combobox.
  - When there are stops, a fare table lists each market × class, pre-filled with the suggested fares.
  - The route label everywhere reads `LHR → DXB → SIN`.
  - The map draws the route through its stops.
  - The route inspector shows the passengers per market.
- **Results:** `RouteDayStats` gains `legLoad?: number[]` (load factor per leg). The route's load factor is the seat-weighted mean over its legs.

## 2. Fleet: fill free hours
- New sim function `suggestRoutes(state, airlineId, aircraftId, catalog)` returns up to 3 suggestions.
  - Each suggestion: `{ from, to, roundTripsPerWeek, fares, expectedLoadFactor, expectedProfitPerDay, distanceKm }`.
  - Destinations are from the player's bases: within range and runway limits, with free slots, not already flown by the player.
  - Ranking: candidates are pre-ranked by base demand (top 40), scored with the AI route estimate, and the top 3 are confirmed with `preview` (which gives suggested fares).
  - Frequency is the most round trips that fit the aircraft's free hours (at most 21 a week).
  - Only profitable suggestions are returned.
- **IPC:** `game.suggestRoutes(aircraftId)`.
- **Fleet tray:** a "Use free hours" button opens a panel.
  - It lists every aircraft using less than 70% of its weekly hours, with its suggestions (route, flights per week, expected load and profit per day) and an **Open** button each.
  - **Open best for all** opens the best suggestion for each aircraft in turn, refreshing suggestions between them.
  - When every aircraft is busy, it says so.

## 3. Travel peaks: seasonal fares from the Overview
- Each peak in "Travel peaks ahead" gets a **Raise fares** action.
  - It shows the player's routes touching the peak's countries (any airport in the chain).
  - The percentage defaults to round(10 + 15 × peak), editable from −50 to +100.
  - Applying it adds a seasonal fare for the peak dates to every listed route with `updateRoute`. It skips routes that already have a seasonal fare overlapping those dates, or already have 4.
- The panel reports "Added to N routes · skipped M (already set)".

## 4. Side menu
- The tooltip shows the section name plus a key badge (`<kbd>1</kbd>`) instead of "Overview · 1".

## Save format
- Schema 4: no field is required. `stops`, `legFares` and `legLoad` are optional, so the migration only bumps the version.

## Out of scope
- AI multi-stop routes, connecting itineraries across different routes, and cargo (v0.6).

## Notes after the final review (2026-11-14)
- **Leg capacity** is enforced per direction (outbound and return separately), not on the two-way total.
- **Tension warnings** count every leg of a stop route.
- **"Use free hours"** refreshes can't overwrite newer ones. If the best route can't open, it tries the next. A failed lookup can't leave it stuck.
- **Deferred:** rival AI still groups routes by their end airports, so it doesn't count the player's stop routes as competitors on intermediate pairs.
