# SkyEmpire — Simulation Spec

How the world works, mathematically. All numbers are **starting values for balancing**, kept in a single config file (`packages/sim/src/config/balance.ts`) so they can be tuned without touching logic.

---

## 1. Principles
- **Deterministic:** same save + same commands + same seed → same result. Use a seeded RNG (e.g. `mulberry32` / `pure-rand`). Never `Math.random()` inside the sim.
- **Pure core:** `nextState = tick(state, commands, rng)`. No I/O inside the sim; persistence and networking live outside.
- **Daily tick**, with weekly/monthly roll-ups.
- **Integer money** (cents as integers, or whole dollars) to avoid floating-point drift.

## 2. Tick order (one game day)
1. Apply queued player/AI **commands** (validated, incl. slot availability and aircraft hour budgets).
2. Advance **world state**: date, season, fuel price, economy index, events start/end.
3. **AI decisions** (each AI airline evaluates on its own cadence, e.g. every 7 days, staggered).
4. Compute **demand** for every airport pair with at least one active route.
5. **Allocate passengers** among competing offers (per class).
6. Compute **revenue and costs** per flight / route / airline.
7. Update **aircraft** (hours, condition, maintenance checks), **reputation**, **cash**, loans/interest.
8. Check **bankruptcy**, tier progress, objectives (achievements from v0.2).
9. Emit **events/notifications** and a compact **tick summary** for the UI.

Performance target: a 20-airline, ~2,000-route world ticks in **< 200 ms** on a mid laptop (v0.1 worlds have 20 airlines and ~1,000 airports).

## 3. Demand (gravity model)

Daily base demand (one direction) between airports A and B:

```
D_AB = K × (P_A × P_B)^α × (W_A × W_B)^ω × Dom × T_AB × S(t) × E(t) / f(dist)
```
- `P` = catchment population (millions, cities within 80 km).
- `α = 0.3`, `ω = 0.125` (wealth index 0.3–2.0 from GDP per capita), `Dom = 3.5` when both airports are in the same country.
- `T_AB` = destination pull = `1 + 0.5 × (tourism_B + business_B)` (indices 0–1)
- `S(t)` = seasonality `1 + (0.05 + 0.25 × tourism) × cos(2π (dayOfYear − 195) / 360)` (0.7–1.3)
- `E(t)` = economy index (0.7–1.2)
- `f(dist)` = 1, except dist < 150 km → ÷ 0.2 (rail/road competition). Longer trips are discouraged through fares (price elasticity), not through f.
- `K = 206`. α, ω, Dom and K were fitted by log least squares to ~24 real city pairs' annual traffic (each within ~2×); e.g. LHR–CDG ≈ 2,700/day, DEL–BOM ≈ 7,300/day.

**Class split** of demand: business share = `0.05 + 0.10 × business_index_avg`; premium = `0.06`; economy = rest.

**Price elasticity:** total demand also reacts to the **average offered fare** vs a reference fare:
```
ref_fare(dist) = 25 + 0.065 × min(dist, 1500) + 0.04 × max(0, dist − 1500)   (economy, USD; real-world average yields)
premium ×1.8, business ×3.5
D_effective = D × (avg_fare / ref_fare)^(-ε)   ε = 1.2 econ, 0.8 premium, 0.5 business
```
Cap at 1.5× base demand (very cheap fares can't create infinite passengers).

## 4. Passenger allocation (competition)

Each **offer** (an airline's service on A→B in a class) gets an attractiveness score:

```
U = −β_p × (fare / ref_fare)
    + β_f × ln(weekly_frequency)
    + β_q × (quality / 100)
    + β_r × (reputation / 100)
    − β_s × stops
β_p = 4.0 economy, 3.0 premium, 1.5 business (flights are close substitutes), β_f = 0.6, β_q = 1.2, β_r = 1.0, β_s = 1.5
```
Share uses a logit model: `share_i = e^U_i / (Σ e^U_j + e^U_none)` where `U_none` is the "don't fly" option (≈ −1.0) so poor offers lose passengers to nobody.

**Background competition ("other airlines").** Each pair, direction and class also gets an offer from the real airlines that aren't in this game world: fare = ref, quality 65, reputation 60, seats = max(0.2 × D, 0.9 × D − in-game seats), frequency = those seats ÷ 150 per flight. Without it most pairs would be monopolies (only 20 airlines per world).

Passengers assigned to an offer = `min(D_effective × share_i, seats_available_i)`. **Spill:** passengers who don't fit are re-offered to remaining offers once (simple 1-pass reallocation).

**Quality** (0–100) per offer = weighted aircraft comfort (age, cabin density), service level, on-time performance.

## 5. Flights & operations
- Block time = `dist / cruise_speed + 0.5 h` (taxi/climb/descent).
- Aircraft daily availability = 18 h. Each flight uses block time + turnaround (30–90 min by size).
- Each aircraft has a weekly budget of `7 × 18 = 126 h`. A round trip on a route costs `2 × (block + turnaround)` hours. The sum over all of an aircraft's assignments must be ≤ 126 h. A single-route maximum is therefore `floor(126 / (2 × (block + turnaround)))` round trips per week.
- **Slots:** each departure and arrival uses 1 slot per day at that airport (weekly frequency ÷ 7, rounded up). Commands that exceed free slots are rejected with a clear reason.
- **On-time performance:** base 85%; reduced by low aircraft condition, congested airports, weather events, overloaded schedules (utilisation > 90%).

## 6. Costs (per flight unless stated)
| Cost | Formula (starting values) |
|---|---|
| Fuel | `fuel_burn_kg_per_h × block_h × fuel_price_per_kg` (fuel price $0.60–1.20/kg, starts $0.80, random walk + shocks) |
| Crew | `crew_cost_per_h(aircraft_class) × block_h` ($400–2,500/h) |
| Maintenance | `maint_per_h × block_h × (1 + age_years × 0.03)` |
| Landing fee | `airport.landing_fee × MTOW_tonnes` |
| Navigation (ATC) fee | `0.4 $/km × distance × sqrt(MTOW / 50 t)` per leg |
| Passenger fee | `airport.pax_fee × passengers × 0.3` (most of it is a tax passed to travelers) |
| Distribution | `6% × ticket revenue` (sales, GDS, card fees) |
| Service | `service_cost_per_pax(level, class) × passengers` |
| Lease | monthly, charged on day 1 of month |
| Interest | `loan_balance × annual_rate / 360` daily |
| Overheads | `base_overhead + per_aircraft_overhead × fleet_size` monthly |
| Base upkeep | monthly per hub/focus city |

## 7. Aircraft condition & maintenance
- Condition 100 → falls `0.02 × block_h` per flight.
- **A-check** every 500 flight hours (1 day out of service, cost small). **C-check** every 6,000 h (7 days, larger cost).
- Condition < 60 → on-time and quality penalties; < 40 → safety-incident risk (rare event, big reputation hit).

## 8. Reputation
Daily smoothed (EMA, ~30-day window) towards a target:
```
target = 0.30 × on_time + 0.25 × avg_quality + 0.15 × price_fairness
       + 0.15 × fleet_youth + 0.15 × marketing_score − incident_penalties
```
All inputs normalized to 0–100.

## 9. Finance
- Company value = cash + aircraft market value + base value − debt.
- Credit limit = 40% of company value (min $5M); interest rate 4–12% by credit rating (A–D) from debt ratio and profitability.
- Used aircraft market value = `new_price × 0.92^age_years × (condition/100)^0.5`.
- Bankruptcy: cash < 0 and no credit available for 30 consecutive days.

## 10. AI airlines (utility AI)
Each AI has a **personality profile**:

| Param | Budget | Legacy | Gulf | Regional | Expander |
|---|---|---|---|---|---|
| price_aggressiveness | 0.9 | 0.3 | 0.4 | 0.5 | 0.7 |
| expansion_rate | 0.6 | 0.4 | 0.5 | 0.4 | 0.9 |
| risk_tolerance | 0.5 | 0.3 | 0.6 | 0.3 | 0.9 |
| premium_focus | 0.0 | 0.7 | 0.9 | 0.2 | 0.3 |
| preferred_aircraft | narrowbody | mixed | widebody | turboprop/RJ | narrowbody |

Every N days (budget 7, others 7–14, staggered), an AI:
1. **Scores candidate routes** from its bases: `score = expected_profit × (1 + personality bonuses) − competition_penalty`. Expected profit uses the same demand + allocation model with a guessed fare.
2. **Opens** the best route if cash/fleet allows (respecting expansion_rate and risk).
3. **Adjusts fares** on existing routes: lower if load factor < 60% (more so with high price_aggressiveness), raise if > 90%; react to a rival undercutting by partial matching.
4. **Closes** routes losing money for 60+ days.
5. **Acquires aircraft** when utilisation > 85% and cash allows (lease if cash-poor).
6. **Takes loans** within risk tolerance.

Difficulty scales AI starting cash, decision quality (noise added to scores), and reaction speed.

## 11. Events
| Event | Frequency | Effect |
|---|---|---|
| Fuel spike | ~1/yr | fuel ×1.3–1.8 for 30–120 days |
| Recession / boom | ~1/3 yrs | economy index ±0.2 over 180 days |
| Airport strike | ~4/yr | airport closed 1–5 days |
| Storm | seasonal | airport closed 1–3 days, on-time −10% regionally |
| New aircraft launch | by entry year | new type available |
| Airport expansion | ~2/yr | +20–50% slots |
| Pandemic | very rare, off on Easy | demand ×0.2–0.5, recovers over 1–2 yrs |

**Airline style cost profiles:** low-cost carriers run crew ×0.7 and maintenance ×0.9 with basic service; network carriers service level 4; super-connectors level 5.

**Aircraft prices** are ~50% of last published list prices (typical market value); leases ≈ 0.75% of that per month.

## 12. Tiers (v0.1: first three)
| Tier | Unlock condition (any 2 of 3) | Unlocks |
|---|---|---|
| Startup | start | turboprop, regional jet, narrowbodies |
| Regional | 5 aircraft · 1M pax total · $100M yearly revenue | A321XLR, A330-900, 787-9, 50% base-setup discount |
| National | 15 aircraft · 5M pax · $500M yearly revenue | A350-900 (v0.2: more widebodies, more regions) |

## 13. Balance targets (tested in `packages/sim/src/balance/`)
- A well-run first route (e.g. LHR–MAD, A320neo) covers its flying costs within 30 game days.
- A typical healthy airline earns **5–12% operating margin**.
- Pure "cheapest fare" strategy loses money long-term vs balanced fare + quality.
- On Normal, the player can reach the *National* tier in ~3–5 game years.
