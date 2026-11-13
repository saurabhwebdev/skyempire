# SkyEmpire — Game Design Document

> Working title: **SkyEmpire** (to be checked for name conflicts before public release).
> Status: Draft v1 · 2026-11-13

---

## 1. Intent & the why

SkyEmpire is a **downloadable desktop airline-management game**. The player founds an airline with a small budget and one aircraft, then grows it into a global carrier by planning routes, managing a fleet, pricing tickets and out-competing rival airlines — the way a real airline makes its name in the market.

**Why it should exist:** existing airline games are either *deep but dated and hard to learn* (AirlineSim), *easy but shallow and pay-to-win* (Airline Manager 4, Airlines Manager), or *single-player only* (Airline Tycoon). Multiplayer games in this genre also feel **empty** when few players are online. SkyEmpire aims to be:

1. **Easy to learn, deep to master.**
2. **Always alive** — AI airlines fill every empty seat in a world, so there's competition with 0 or 50 humans.
3. **Fair** — no pay-to-win. Free and open source.
4. **Modern** — a minimal, map-first interface that's fast and pleasant to use.

### Success looks like
- A Windows player can download from GitHub/itch.io, install, and be flying their first route within **5 minutes**.
- A session of 30–60 minutes feels meaningful (visible growth, decisions with consequences).
- Players come back: seasons, rivals, and goals give reasons to return.

---

## 2. Goals, non-goals, anti-goals

### Goals
- Offline single-player vs AI airlines (first release).
- Online multiplayer where real players and AI airlines share one world (second release).
- Windows first; Android and others later.
- **$0 cost** to build, ship and run (see `docs/roadmap.md` → Free platform stack).
- Open source on GitHub.

### Non-goals (for now)
- Flight-sim / cockpit / 3D aircraft. This is a management game.
- Real-time minute-by-minute flight tracking. The game runs in **daily ticks**.
- iOS (needs a $99/yr Apple account) — revisit only if the game earns money.
- Steam (needs $100) — revisit later.

### Anti-goals (it fails if…)
- It needs a wiki to start playing.
- Paying money gives a gameplay advantage.
- A multiplayer world feels empty or dead.
- Screens are cluttered spreadsheets with no clear next action.
- One dominant strategy wins every time (e.g., "just undercut price").

---

## 3. Constraints

- **Zero budget.** Only free tools, free data, free hosting.
- **Solo/small-team friendly.** One language (TypeScript) across UI, simulation and server.
- **Runs on an ordinary laptop** (8 GB RAM, integrated graphics, Windows 10/11).
- **Works fully offline** in single-player (including the map).
- **Real-world content (owner's decision):** real airports worldwide, **real aircraft models** (A320neo, 737-8, ATR 72…) with **real silhouettes**, and **real airlines from around the world** as AI rivals (name, IATA/ICAO code, approximate brand color). **Real logos via a logo pack:** the official download and repo contain **no logos** (placeholder badge = IATA code on brand color); a Settings button **"Download real logos"** fetches each airline's logo from Wikimedia Commons (via its Wikidata entry) onto the player's own PC, and players can drop logo files into a `logos/` folder (fan packs). Silhouettes are free-licensed (Wikimedia Commons CC0/CC-BY/CC-BY-SA, credited) or drawn by us from public 3-view drawings. README and an in-game About screen state: "SkyEmpire is not affiliated with any airline or aircraft manufacturer. Names are used for identification only." Known risk: stores may reject the game or receive takedown requests; if that happens, a fictional-names data file can be swapped in.
- **Data is facts, cited:** aircraft specs come from public manufacturer spec sheets and Wikidata (CC0); airline names/codes from OpenFlights (ODbL) and Wikidata; every source listed in `CREDITS.md`. Fuel burn and lease rates are our estimates from published figures.

---

## 4. Approaches considered

| Approach | Trade-offs | Decision |
|---|---|---|
| **A. Web tech in a desktop shell (Electron + React + TypeScript)** | Reuses web skills; UI-heavy management games suit HTML/CSS; proven on Steam; later Android via Capacitor. Larger download (~100 MB). | **Chosen** |
| B. Tauri (Rust shell + webview) | Tiny download (~10 MB), mobile support; but weaker Steam overlay/integration and adds Rust. | Rejected for now |
| C. Game engine (Godot / Unity) | Great for graphics, but management UIs (tables, forms, charts) are slower to build; less reuse for a server. | Rejected |

| Multiplayer approach | Trade-offs | Decision |
|---|---|---|
| **Player-hosted worlds** (one player hosts, friends join, AI fills seats) | $0 forever; host must be online; free tunnels (playit.gg / Tailscale / ZeroTier) avoid port forwarding. | **Chosen first** |
| Official server on Oracle Cloud Always Free | Always-on public world, $0, but needs ops work. | **Later** |
| Paid hosting | Easiest, costs money. | Rejected |

| Release order | Decision |
|---|---|
| Offline single-player first, multiplayer second, mobile third | **Chosen** — same simulation engine powers all modes, so multiplayer = "run the engine on a host and sync clients." |

---

## 5. Core game loop

```
Plan routes → Assign aircraft → Set prices & cabins → Advance time
     ↑                                                     ↓
 Reinvest  ←  Earn revenue / pay costs  ←  Passengers choose airlines
```

### Time
- The world advances in **ticks; 1 tick = 1 game day**.
- **Single-player:** player controls speed — Pause / 1× (1 day ≈ 6 s) / 2× / 4× / 8×. Auto-pause on important events (configurable).
- **Multiplayer:** host sets the pace; default **1 game day per real hour**; options 15 min / 30 min / 1 h / 2 h.
- Reports are weekly (7 days), monthly (30 days) and quarterly (90 days). A game year = 360 days (12 × 30) for clean maths.

### Start of game
1. Name your airline, pick a 2–3 letter code, logo (from a simple builder: shape + colors), and livery colors.
2. Choose a **home hub** (any eligible airport in the starting region).
3. Choose difficulty: **Easy** ($80M, gentle AI) / **Normal** ($50M) / **Hard** ($25M, aggressive AI).
4. Start with **cash only, no aircraft** — the tutorial's first step is leasing your first aircraft, then opening a guided first route (skippable).

---

## 6. Game systems

### 6.1 World & airports
- Real airports (OurAirports data) filtered to commercially relevant ones (~2,000 worldwide; MVP region ~300).
- Each airport has: city population, wealth index, tourism index, business index, runway length (limits aircraft), **size class** (1–6), **slot capacity** per day, landing fee and passenger fee.
- **Slots:** each airport has a daily slot capacity (1 slot = 1 departure or arrival). **v0.1:** enforced, first-come-first-served; a route needs a free slot at both ends per flight; closing a route releases its slots. Airport-expansion events add slots. **v0.4:** slot bidding/trading between airlines.
- **Bases:** the home hub is the first base. Players and AI can open extra bases (setup cost + monthly upkeep) from v0.1. **Every route must touch at least one of the airline's bases.** Bases reduce crew/maintenance costs on routes from that airport; from v0.2 they also enable connecting passengers.

### 6.2 Demand
- Each airport pair has daily **base demand** per class (economy / premium / business) computed from a gravity model (see `docs/simulation-spec.md`).
- Modified by: season (summer/winter, holidays), economy state, events, and travel purpose (business vs leisure mix).
- Demand is **shared**: all airlines on a route compete for the same passengers.

### 6.3 Routes & scheduling
- A **route** = origin, destination, fares per class, and one or more **assignments**. An assignment = (aircraft, round trips per week).
- **Aircraft are shared by hours:** each aircraft has a weekly hour budget (7 × 18 h). One aircraft can fly several routes, and one route can use several aircraft (even of different types), as long as each aircraft's assigned hours (block time + turnaround) fit its budget and the route is within its range/runway limits.
- Route frequency = sum of its assignments. The UI shows each aircraft's free hours ("free 14h/day").
- Connecting traffic (MVP+1): passengers can connect through the player's hubs (A→Hub→B), with a penalty vs direct flights.

### 6.4 Fleet
- **Real aircraft models**: ~19 in v0.1, ~40 at full release, across classes: turboprop, regional jet, narrowbody, long-range narrowbody, widebody.
- Stats: seats (max), range (km), cruise speed, fuel burn per hour, price, lease cost per month, maintenance cost per hour, minimum runway, turnaround time, entry year (unlocks over time).
- Acquire by **buying new**, **buying used** (cheaper, older, higher maintenance), or **leasing** (low upfront, monthly cost).
- Aircraft **age** → rising maintenance, falling comfort; **condition** drops with use and is restored by maintenance checks (A/C checks take the plane out of service briefly).
- **Cabin configuration:** split seats between Economy / Premium / Business (business seats take more space).

### 6.5 Pricing & revenue
- Player sets fare per class per route; the game shows a **suggested fare** and expected load factor.
- Revenue: tickets, cargo (simple, MVP+1), ancillary fees (bag/seat — toggles that raise revenue but lower satisfaction).
- **Loyalty program** (later): raises repeat-customer share on your network.

### 6.6 Costs
Fuel (global price changes daily, with shocks) · crew (per flight hour) · maintenance (per hour + checks) · landing & passenger fees · leases · loan interest · base upkeep · marketing · overheads (scales with airline size).

### 6.7 Finance
- Cash, loans (credit limit based on company value and credit rating), depreciation, profit & loss, balance sheet, cash-flow.
- **Bankruptcy:** cash below zero for 30 days with no credit → game over (single-player) / airline liquidated (multiplayer).
- **IPO** (later): go public to raise money; share price reacts to results.

### 6.8 Reputation & service
- **Reputation (0–100)** per airline, driven by: on-time performance, service quality (catering, seat comfort, crew), fleet age, safety incidents, price fairness, marketing.
- **Service level** per class (budget → premium) costs money per passenger but improves satisfaction.
- Reputation affects passenger choice and how much you can charge.

### 6.9 Competition & AI airlines
- Every world has a target number of airlines: **20 in single-player (you + 19 AI)**, 30 in multiplayer. Empty seats are filled by **AI airlines**.
- **AI airlines are real airlines** from a curated data file (name, IATA/ICAO code, home hub, personality, the real aircraft types they fly). The database holds ~150 real airlines worldwide (e.g. Ryanair, IndiGo, Southwest — Budget; Lufthansa, Air India, Delta — Legacy; Emirates, Qatar Airways — Gulf; Widerøe, Alliance Air — Regional; Wizz Air, VietJet — Expander). Each new world picks **19**: the 10 nearest to the player's hub plus 9 global majors not already chosen.
- **They start as established incumbents**, scaled for gameplay: starting fleet Easy 4 / Normal 6 / Hard 10 aircraft of their real types, first routes preferring their real routes (OpenFlights `routes.dat`) from their hub. You're the startup taking them on.
- The player cannot pick a name or code already used by a real airline in the data.
- **AI personalities:**
  - **Budget** — low fares, high density, point-to-point, young narrowbody fleet.
  - **Legacy** — hubs, premium cabins, wide network, higher fares.
  - **Gulf-style giant** — one mega-hub, long-haul, premium service, deep pockets.
  - **Regional specialist** — turboprops, thin routes, feeds bigger airlines.
  - **Aggressive expander** — opens routes fast, takes risks, may go bankrupt.
- AI uses rule-based "utility" decisions (no paid AI services). AI reacts to the player: price matching, adding frequency on contested routes, buying slots.
- **AI makes room for humans** (multiplayer): when a human joins a full world, the weakest AI airline is retired (bankrupt or acquired), releasing its slots.
- **Inactive humans** (multiplayer): after a host-set number of days offline, an AI "caretaker" runs the airline conservatively; after a longer period it's liquidated.

### 6.10 Events
Random and seasonal events affect everyone: fuel spikes, recessions/booms, strikes at an airport, storms closing airports, pandemics (rare, severe), new aircraft model launches, airport expansions (more slots), regulatory changes. Each event shows a clear card: what happened, who's affected, how long.

### 6.11 Progression & goals
- **Airline tiers:** Startup → Regional → National → Continental → Global, unlocked by fleet size/passengers/revenue. Each tier unlocks features (e.g., widebodies, alliances, IPO).
- **Objectives:** a short list of suggested goals at all times ("Reach 70% load factor on 3 routes", "Open a second base").
- **Achievements** (local; Steam achievements later).
- **Alliances & codeshares** (later, multiplayer-first): join with other airlines to share connecting traffic.

### 6.12 Multiplayer specifics
- **Worlds** have settings: region(s), tick speed, starting cash, AI count/difficulty, season length.
- **Seasons:** a world runs a set length (e.g., 3–6 months real time, or N game years), then ends with a leaderboard (company value, passengers, reputation). New season → fresh start.
- Chat (simple world chat), news feed of rival moves.
- Fair play: the host is authoritative; clients send *commands*, never results.

---

## 7. Modes

| Mode | Release | Description |
|---|---|---|
| Career (single-player) | v0.1 | You vs AI airlines in one region, speed control, save/load. |
| Sandbox | v0.2 | Custom cash, all aircraft, all regions. |
| Host World (multiplayer) | v0.3 | Host from your app; friends join by code/address; AI fills seats. |
| Official World | v0.5+ | Always-on server (Oracle Cloud Free). |

---

## 8. MVP scope (v0.1 — "First Flight")

**In:**
- **Whole world:** ~1,000 airports on all continents; start anywhere.
- ~19 real aircraft types with real silhouettes.
- Real airline database of ~150 airlines worldwide; each world uses **19 AI rivals** from it (10 based near your hub + 9 global majors).
- Logo pack download + `logos/` folder.
- Airline creation, home hub + extra bases, lease/buy/sell aircraft, create/edit/close routes, shared aircraft assignments, fares (3 classes), cabin config, service level.
- Slot limits (first-come-first-served).
- Demand + passenger-split simulation; fuel price; costs; P&L; loans.
- AI across all 5 personalities (Budget, Legacy, Gulf-style, Regional, Aggressive expander) + reputation.
- 5 event types: fuel spike, recession/boom, airport strike, storm, airport expansion.
- **Tiers** (Startup → Regional → National; the widebody unlocks at Regional) and **objectives** (used by the tutorial and Goals card).
- Time controls, auto-save, manual save/load slots.
- Onboarding tutorial (skippable).
- UI: all 7 nav sections. Overview, Network, Fleet, Finance are full; Market (competitor list + airport info), Airline (brand, reputation, service, bases) and News (event/notification log) are basic. Dark theme only, English only (strings i18n-ready), full keyboard shortcuts.
- Windows installer via GitHub Releases + auto-update.

**Out (later):** connections via hubs, cargo, IPO, alliances, slot trading, achievements, light theme, UI scale, undo (v0.1 uses confirm dialogs for destructive actions), Continental/Global tiers, multiplayer, mobile, Microsoft Store/itch.io (v0.2), Steam.

---

## 9. Decided "how"
- Desktop: **Electron + Vite + React + TypeScript**.
- Simulation: shared TypeScript package, deterministic (seeded RNG), runs in a background worker.
- Local saves: **SQLite**.
- Map: **MapLibre GL + deck.gl** with bundled offline **Protomaps PMTiles** basemap.
- Multiplayer (v0.3): host's app runs an embedded **Fastify + WebSocket** server; same sim engine.
- Distribution: **GitHub Releases** in v0.1; **itch.io and Microsoft Store** added in v0.2 (all free). Open source.

Details: `docs/technical-architecture.md`, `docs/simulation-spec.md`, `docs/ui-ux-design.md`, `docs/roadmap.md`.

## 10. Airport attribute data
OurAirports gives location, type and runways only. Other attributes are **generated by heuristics** in the data pipeline and hand-tuned for the ~50 biggest airports:
- Population: GeoNames/Natural Earth city population within ~80 km.
- Wealth index: country GDP per capita (World Bank open data, CC-BY), normalized 0.3–2.0.
- Tourism / business indices: start from country + city size, with a hand-authored override file for major destinations.
- Size class, slot capacity, fees: derived from airport type, runway count/length and catchment population.

## 11. Left to the builder
- Exact balancing numbers (start with values in `simulation-spec.md`, tune by playtesting).
- Exact airport filter thresholds for "commercially relevant."
- Aircraft silhouettes (own art, one per class).
- Logo-builder specifics.
- Open-source license choice — **recommended: MIT** for code; art assets under their own (CC0/CC-BY) licenses.
