# SkyEmpire v0.6 "Cargo" — design

Agreed with the user on 2026-11-14 (the cargo plan, extended twice): every freighter in service, conversions, special cargo, configurable belly cargo, and cargo-only airlines that can never fly passengers.

## 1. Airline types
- `Airline.kind`: `'passenger' | 'combination' | 'cargo'`, shown as **Passenger**, **Passenger + Cargo** and **Cargo only**. It's chosen on the New Airline screen and is **permanent**.
  - **Passenger:** passenger aircraft only. They carry belly cargo.
  - **Passenger + Cargo:** passenger aircraft plus freighters, passenger and cargo routes.
  - **Cargo only:** freighters only, cargo routes only. Passenger aircraft can't be leased or bought new.
    - A used passenger aircraft can be bought only together with a conversion. That's the `buyUsedAircraft` command with `convertTo`.
- **Rivals:**
  - The real combination carriers in the catalogue become `combination`: LH, EK, QR, CX, KE, CI, TK, SQ, ET, AF, KL, CA, CZ, MU, NH, JL, UA, AA, DL, BA.
  - New real cargo airlines join as `cargo`, with two new personalities:
    - `integrator`: express hub-and-spoke (FedEx MEM, UPS SDF, DHL/EAT LEJ, SF Airlines SZX);
    - `freightCarrier`: long-haul general cargo (Cargolux LUX, Atlas CVG, Kalitta YIP, AeroLogic LEJ, Nippon Cargo NRT, China Cargo PVG, Silk Way West GYD).
  - Each game picks about 3 cargo rivals: the nearest ones, then the biggest.
- **Old saves:** every airline becomes `passenger`, except the combination carriers listed above, which become `combination`.

## 2. Freighters (about 33 real types)
`AircraftType` gains:
- `kind?: 'freighter'`
- `payloadT` (freighters; `maxSeats` = 0)
- `bellyT` (passenger types: total hold tonnes)
- `entryYear?`
- `conversion?: { from: string[]; costUsd; days }`
- `special?: true` (main-deck freighters can take live animals and outsize cargo)

| Kind | Types |
|---|---|
| New build | 747-8F, 777F, 767-300F, A330-200F, ATR 72-600F, Cessna 408 SkyCourier, Cessna 208B Cargomaster |
| Coming (orderable, delivered from the real entry year) | A350F (2027), 777-8F (2028) |
| Conversions (from game types) | 777-300ERSF ← B77W · 767-300BCF ← B763 · A330-200P2F ← A332 · A330-300P2F ← A333 · 737-800BCF ← B738 · A321P2F ← A321 · A320P2F ← A320 · 757-200PCF ← B752 · ATR 72-600 conversion ← AT76 · E190F/E195F (used) · Dash 8-400 conversion ← DH8D |
| Used only | 747-400F, 747-400BCF, MD-11F, An-124, A300-600F, Il-76TD, 737-300SF, 737-400SF, Tu-204C, ATR 42 freighter, CRJ200 PCF, Saab 340F, BAe 146 QT |

- Each type gets a real photo (Wikimedia Commons, credited) and real specs: payload, range, engines, first flight.
- Every type is checked against its Wikipedia page.

## 3. Cargo types
| Type | Share of flows | Rate × general | Needs |
|---|---|---|---|
| General | 55% | 1.0 | — |
| Express / e-commerce | 20% | 1.6 | Values frequency and on-time strongly |
| Mail | 5% | 0.8 | Steady all year (no seasonal peak) |
| Perishables | 8% | 1.8 | Strong from KE, CO, EC, CL, NO, NL, ZA, IN, VN, PE. Late or cancelled flights spoil shipments: revenue lost = (1 − onTime) × 0.5 |
| Dangerous goods | 8% | 1.4 | A one-time **dangerous-goods licence** ($250k, command `buyDgLicence`) |
| Special (live animals, outsize) | 4% | 2.5 | Main-deck freighters only |

## 4. Demand
- **Airport cargo weight `cargoT`:**
  - The real annual tonnes for about 60 major cargo airports, from the Wikipedia "busiest airports by cargo traffic" list and ACI figures (approximate, credited).
  - Every other airport: 1,500 t × population^0.8 × wealth × size class.
- **Country export strength `exportIndex`:** about 35 countries (e.g. CN 1.6, HK 1.5, KR/TW 1.3, DE 1.2, US 0.85…). Every other country is 1.
- **Flow A→B (tonnes/day):**
  K × √(cargoT_A × cargoT_B) / dist^0.3 × exportIndex(A) / √(exportIndex(B)) × domestic factor × season × economyIndex.
  - Flows are **one-sided**: China → USA is heavy, the return is light.
  - **Season:** Oct–Dec +25% (Black Friday and Christmas), Lunar New Year −20% for 2 weeks from CN/HK/TW, a quieter January. Mail is flat all year.
- **Shippers choose by:**
  - rate versus the reference rate;
  - weekly frequency;
  - reliability (on-time);
  - stops.
  - Express weights frequency and on-time ×2; perishables weight on-time ×2.
  - "Other carriers" take a background share, as with passengers.
- **Reference rate (general, $/kg):** 0.8 + 0.00028 × km.

## 5. Capacity, pricing and routes
- **Route kinds:** `Route.kind?: 'passenger' | 'cargo'` (default `passenger`).
- **Cargo routes:**
  - Freighters only, and stops are allowed.
  - `cargoRate` is the general rate in $/kg. The other types use the multipliers above.
  - `cargoAccept: CargoType[]` lists what the route takes.
  - Capacity = payloadT per flight per direction.
- **Belly cargo on passenger routes:**
  - Capacity = bellyT × hold share.
  - `Route.belly?: { mode: 'default' } | { mode: 'custom'; rate; accept; holdShare }`.
  - **Default:** the market rate (0.95 × reference), every type except special, 60% of the hold.
  - **Custom:** the hold share can be set from 40% to 90%. Above 75%, passengers' bags get left behind: passenger quality falls by (share − 0.75) × 40.
  - **Off:** a global switch `Airline.bellyCargo` (Settings / Airline screen). With it off, there's no belly cargo at all.
- **Revenue** = tonnes × 1,000 × rate × type multiplier, minus perishable spoilage.
- **Costs:**
  - handling $90 per tonne at each end;
  - fuel, crew, maintenance and fees as for passenger aircraft (freighter types carry their own figures);
  - no service costs on freighters.
- **Leg capacity** is enforced per direction in tonnes, as for passengers.

## 6. Conversions and deliveries
- **`convertAircraft { aircraftId, toTypeId }`:**
  - Allowed for an **owned** passenger aircraft whose type is in the target's `conversion.from`.
  - The aircraft must not be assigned to any route, and must not be in a refit.
  - The cost (≈ $4–15M by size) is paid up front. The aircraft becomes the freighter type straight away (cabin cleared) with `refitDaysLeft = conversion.days` (60–120), keeping its age and condition.
- **Ordering a type with `entryYear` after today's year:**
  - The aircraft gets `deliveryDay` (Jan 1 of the entry year) and can't fly until then.
  - Lease payments only start after delivery.
  - The market shows "Delivered from 2027".

## 7. Progress, goals and AI
- **Cargo-only tiers** use tonnes a year instead of passengers: Regional 20k t, National 150k t, Global 600k t (plus aircraft and revenue as today).
- **Cargo-only goals:**
  - Lease your first freighter;
  - Open your first cargo route;
  - Move 1,000 t;
  - Reach 95% on-time on 3 routes;
  - Open a second base;
  - Move 10,000 t;
  - Earn the dangerous-goods licence.
- **AI:**
  - `integrator` and `freightCarrier` rivals lease freighters and open cargo routes from their hubs, using a cargo route estimate.
  - Combination rivals add cargo routes for any freighters in their fleet.
  - Passenger AI is unchanged, and gets belly cargo on the default settings.

## 8. UI
- **New Airline:** an airline-type step with 3 cards. Cargo only notes "permanent: you can never fly passengers".
- **Market:**
  - a "Passenger / Freighter" type filter;
  - freighter cards show payload (t) instead of seats;
  - "Coming 2027" badges;
  - no cabin designer for freighters (a simple confirm);
  - cargo-only airlines see only freighters, plus used passenger aircraft with "Buy & convert".
- **Fleet inspector:** a "Convert to freighter" button for convertible owned aircraft (cost, days, payload).
- **Route editor:**
  - a route type switch: Passenger or Cargo, offered according to the airline type;
  - **cargo:** freighters, rate per kg, accepted types, expected tonnes, load and profit;
  - **passenger:** a "Belly cargo" section with Default or Custom (rate, types, hold share).
- **Map, lists and screens:**
  - Cargo routes are drawn in amber (dashed arcs aren't practical with deck.gl arcs).
  - Lists show a text badge "Cargo".
  - Finance splits revenue into passenger and cargo.
  - The Overview shows tonnes moved.
- **Airline screen:** the dangerous-goods licence, and the belly cargo switch.

## 9. Save format
- **Schema 5:**
  - airlines get `kind` and `bellyCargo: true`;
  - routes default to `kind: 'passenger'` and `belly: { mode: 'default' }`;
  - aircraft gain an optional `deliveryDay`.

## Out of scope
- Cargo connections across routes (transshipment).
- ULD/volume limits (weight only).
- Charter flights.

## Notes from building it (2026-11-14)
- **Missing hubs:**
  - MEM, SDF, CVG and ANC were added to the airports, the same way as the others (`build-airports.ts --add`).
  - Kalitta's Willow Run (YIP) has no scheduled service in OurAirports, so Kalitta isn't in the game.
- **Belly holds:** `bellyT` is the total hold. The default cargo share is 60% on widebodies and 35% on narrowbodies (mostly bags). Low-cost rivals don't sell belly cargo.
- **Photos:** 6 freighters have no freely licensed photo (A320P2F, A350F, 777-8F, Dash 8-400 conversion, E190F, E195F) and show their silhouette.
- **Unlisted airports:** cargo estimates are capped at 300,000 t a year.

## Changes after the final review (2026-11-14)
- **Types not delivered yet** (A350F, 777-8F) are ordered by lease only:
  - nothing is paid, nothing ages and no overhead is charged until delivery;
  - they can't be assigned to routes before then;
  - they never appear on the used market.
- **Conversions** check the target freighter's tier.
- **Bag room** is the default share + 15%: 50% on narrowbodies, 75% on widebodies.
- **Road freight:**
  - Under 1,000 km, part of the cargo goes by truck (most of it under 500 km).
  - Long-haul flights (2,500 km or more) draw on cargo trucked in from airports within 600 km. Each airport sends 40% of its cargo to its nearby hubs, weighted towards the biggest.
  - Without this, freighters earned most on 150 km hops.
- **Reputation:** cargo routes no longer count towards passenger fare fairness or quality.
- **Deferred:**
  - special cargo is decided per route, not per aircraft;
  - cargo lost to leg caps or closures isn't handed to other carriers;
  - the AI can't grow fleets of used-only freighter types;
  - arrow-key navigation in radio groups.
