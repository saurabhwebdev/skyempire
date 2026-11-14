# SkyEmpire v0.4 "Cabin" — design

Agreed with the user on 2026-11-14. v0.5 "Cargo" follows as a separate release.

## Goals
1. A **cabin designer**: up to three classes (Economy, Premium Economy, Business) with seat type and legroom, seats across where the real aircraft allows a denser row, in-flight entertainment (IFE), meals and extras per class.
2. Products matter: they change offer quality (and therefore fares, share and reputation) and cost money: install cost, per-flight running cost, a little extra fuel, and refit downtime.
3. **Saved layouts** per aircraft type, applied in one click.
4. The airline-wide "service level" is replaced by per-class products. Old saves convert automatically.
5. Rivals fly products that suit their personality.
6. **Search, filters and sorting** on every list where they help: aircraft market (new and used), fleet, routes, news, rivals, saves, notifications, airport pickers.

## Products (per class)

| Class | Seat options (seat units per seat, comfort score) |
|---|---|
| Economy | slimline (0.92, 35) · standard (1.0, 55) · extra legroom (1.15, 75) |
| Premium | recliner (1.5, 70) · leg-rest recliner (1.75, 82) |
| Business | recliner (2.0, 60) · angled lie-flat (2.5, 75) · full-flat (3.2, 90) · private suite (3.8, 100) |

The unit values for standard economy, recliner premium and angled business equal today's 1 / 1.5 / 2.5, so migrated cabins stay valid.

- **Dense economy:** types with a real denser layout (e.g. 777 3-4-3 instead of 3-3-3) have `denseAbreast` in `aircraft-details.json`. Dense multiplies economy units by `abreast / denseAbreast` and takes 12 off the economy seat score.
- **IFE** (any class): none (0) · Wi-Fi streaming (55) · seatback screens (75) · premium screens + free Wi-Fi (100).
- **Meals:**
  - Economy: none (0), buy on board (25), snack (50), hot (75).
  - Premium: snack, hot, dining (90).
  - Business: hot, dining, chef-designed (100).
- **Extras:** amenity kit (premium and business), lounge access (business only).

**Product score** of a class (0–100), with w = clamp((blockHours − 1) / 7, 0, 1):
seat × (0.6 − 0.15w) + IFE × (0.1 + 0.1w) + meal × (0.2 + 0.05w) + extras × 0.1. Economy has no extras, so its weights are renormalised. Extras = 50 per extra held (premium amenity alone = 100).

**Offer quality per class** = 0.4 × type.comfort × (1 − agePenalty) + 0.35 × productScore + 0.25 × onTime. This replaces the service-level term and the old density penalty. Routes now carry quality per class; passengers in each class compare offers in that class. Reputation uses the passenger-weighted mean.

## Costs
- **Install (per seat):**
  - Economy: slimline $2k, standard $3k, extra legroom $4.5k.
  - Premium: recliner $12k, leg-rest $18k.
  - Business: recliner $30k, angled $90k, flat $200k, suite $400k.
  - IFE: Wi-Fi $400k per aircraft (once, if any class has Wi-Fi or premium IFE); seatback $8k per seat; premium $18k per seat.
- **New aircraft** (lease, buy, used): you pay only for upgrades above the standard fit. Standard fit is standard / recliner / angled seats with no IFE, for the same seat counts: max(0, install(config) − install(standard fit)).
- **Refit** of an owned or leased aircraft: if a class's seat type, seat count, dense setting or IFE changes, pay that class's full install cost. The aircraft is out of service for 3 days (turboprop/regional), 5 days (narrowbody/long narrowbody) or 10 days (widebody). Changes to meals and extras only are instant and free.
- **Running cost per passenger:**
  - Meals: buy on board −$3 (net income), snack $3, hot $9, dining $35, chef $70.
  - Amenity kit: $8 premium, $15 business. Lounge: $30.
  - Seatback IFE: $0.5 per passenger.
  - Wi-Fi or premium IFE: $60 per block hour per aircraft.
- **Weight:** fuel × (1 + (cabinMass − standardMass) / (MTOW kg)), from per-seat masses:
  - Economy: slimline 9 kg, standard 11, extra legroom 12.
  - Premium: 25 / 30.
  - Business: 40 / 80 / 110 / 150.
  - IFE adds 6 kg per seat (seatback) or 10 kg per seat (premium).

## Saved layouts
- `Airline.cabinTemplates` holds up to 30 entries of `{ id, name, typeId, config }`.
- Commands: `saveCabinTemplate`, `deleteCabinTemplate`.
- Applying a layout fills the designer; confirming still uses `setCabin`.

## State and commands
- `CabinConfig = { seats: Cabin; product: CabinProduct; dense: boolean }`.
- `Aircraft` gains `product`, `dense` and `refitDaysLeft`. An aircraft flies only when `status === 'active'` and `refitDaysLeft === 0`.
- `leaseAircraft`, `buyAircraft` and `buyUsedAircraft` take `config: CabinConfig` instead of `cabin`. `setCabin` takes `{ aircraftId, config }`.
- `setServiceLevel` and `Airline.serviceLevel` are removed.
- **Schema 3 migration:**
  - Aircraft keep their seats, get standard / recliner / angled seats, and get IFE and meals from the owner's old service level. Mapping by level: 1 none/none, 2 none/buy on board, 3 Wi-Fi/snack, 4 seatback/hot, 5 premium IFE/hot (business dining; at 4 and above, business adds amenity kit and lounge).
  - Each aircraft gets dense false and refitDaysLeft 0.
  - Each airline gets `cabinTemplates: []`.
- **AI products by personality:**
  - budget: slimline, no IFE, buy on board.
  - expander: slimline, Wi-Fi, buy on board.
  - regional: standard, none, snack.
  - legacy: standard / leg-rest / flat, seatback, hot / dining.
  - gulf: extra legroom / leg-rest / suite, premium IFE, hot / dining / chef, with all extras.

## UI
- **The cabin designer** (large modal) replaces the cabin editor.
  - Per class: seat count, seat-type cards, IFE, meals and extras. Economy gets a dense toggle where the aircraft allows it.
  - A live seat map: business row shape follows the seat type; dense economy uses `denseAbreast`.
  - A summary: seats, units used out of max, a comfort score per class, running cost per passenger, install or refit cost, and downtime.
  - "Start from" presets, saved layouts, and "Save as layout".
- **The Airline screen:** the service-level picker is replaced by a short explanation of cabin products.
- **The fleet inspector** shows the product, and "Refit · N d" while a refit is running.
- **Search, filter and sort**, through a shared `ListToolbar` (search box, filter chips or selects, sort select) and pure, tested filter and sort helpers:
  - Aircraft market:
    - search by name or manufacturer;
    - filter by class, manufacturer, "available to me", min range and min seats;
    - sort by price, lease, seats, range, fuel per seat or name;
    - on the Used tab, also sort by age, condition and price.
  - Fleet: search, filter by status (flying, idle, maintenance, refit) and by ownership.
  - Routes: search airports, filter by profitable, losing, suspended or grounded.
  - News: search and category filter.
  - Rivals: search and sort.
  - Saves: search and sort.
  - Notifications: tone filter.
  - Airport pickers: search, where one doesn't already exist.

## Out of scope
- Seat maps for specific real airlines.
- First class as a fourth cabin (the maximum is three classes).

## Notes after the final review (2026-11-14)
- **Notifications:** News already filters by tone ("Warnings") and now has search. The toast/modal notifier isn't a list, so it has no filter.
- **Airport pickers:** the route editor, the demand lookup and the new-airline screen already search airports by code or city.
- **Upgrade cost:** taken per class (a cheaper seat in one class doesn't pay for upgrades in another).
- **Deferred:**
  - arrow-key (roving tabindex) navigation for the designer's choice groups and for the `Segmented` filter;
  - a toast when a malformed command is rejected by the IPC schema (already the case on v0.3; the UI only sends valid commands).
