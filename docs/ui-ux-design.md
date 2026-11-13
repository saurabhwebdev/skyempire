# SkyEmpire — UI / UX & Design System

**Direction:** *modern, minimal, highly functional.* Think "a calm air-traffic control room built by Linear." The **map is the hero**; panels are quiet, precise, and fast. Every screen answers: *what's happening, what needs me, what do I do next?*

---

## 1. UX principles

1. **Map first.** The world map is always present; everything else is a panel over or beside it.
2. **One primary action per screen.** E.g. Routes screen → "New route". Never three equal buttons.
3. **Show consequences before commit.** Every decision shows a live preview: expected load factor, daily profit, risk. (Uses `sim.preview()`.)
4. **Progressive disclosure.** Simple fields first ("Fare"), advanced on demand ("Per-class fares, service level, cabin").
5. **Forgiving.** Confirmation for destructive/irreversible actions (sell aircraft, close route, close base) in v0.1; same-day **undo** arrives in v0.2. Pause is always one key away.
6. **Recognition over recall.** Searchable airports with city/IATA, recent items, suggested next goals.
7. **Feedback ≤100 ms.** Every click shows a press state; every tick shows what changed (money delta, notifications).
8. **Speak airline, not database.** "Load factor", "Fare", "Flights per week" — with plain-language tooltips for newcomers.

---

## 2. Information architecture

Left **nav rail** (icons + labels on hover/expanded), max 7 items:

| # | Section | Purpose | Shortcut |
|---|---|---|---|
| 1 | **Overview** | Dashboard: cash, profit trend, alerts, goals | `1` |
| 2 | **Network** | Map + route list, create/edit routes | `2` |
| 3 | **Fleet** | Aircraft owned/leased, market, cabin config | `3` |
| 4 | **Finance** | P&L, balance sheet, loans, cash flow | `4` |
| 5 | **Market** | Competitors, airports, demand explorer | `5` |
| 6 | **Airline** | Brand, reputation, service, marketing, bases | `6` |
| 7 | **News** | Events, rival moves, notifications log | `7` |

Settings, save/load, and help live in the **top-bar menu** (Esc opens it).

Everything reachable in ≤ 3 clicks. Selection persists when switching sections (selected route stays selected).

---

## 3. Layout

### Main shell (1280×800 and up)
```
┌────────────────────────────────────────────────────────────────────────────┐
│ ◆ SkyEmpire   Nordwind Air (NW)      $48.2M ▲+312k   Day 47 · Mar 17 Y1   │
│                                       ⏸  ▶ 1×  2×  4×  8×        🔔3   ≡   │
├──┬─────────────────────────────────────────────────────┬───────────────────┤
│▣ │                                                     │ Inspector         │
│⌖ │                 WORLD MAP (hero)                    │ ───────────────── │
│✈ │       arcs = routes, dots = airports                │ LHR → FRA         │
│$ │       your color vs rivals' muted colors            │ A320neo · 21/wk     │
│◎ │                                                     │ Load  86% ███████░│
│★ │                                                     │ Profit +$18.4k/d  │
│✉ │                                                     │ [Edit route]      │
│  │  ┌ Bottom tray (collapsible): Routes list ───────┐  │                   │
│  │  │ Route      Freq  Load  Fare   Profit/day       │  │                   │
│  │  └────────────────────────────────────────────────┘  │                   │
└──┴─────────────────────────────────────────────────────┴───────────────────┘
```
- **Top bar (48px):** airline identity · cash with delta since last tick · date · time controls · notifications · menu.
- **Nav rail (56px collapsed / 200px expanded).**
- **Center:** map (always mounted; dimmed behind full-screen sections like Finance).
- **Inspector (360px, right):** details of whatever is selected (airport, route, aircraft, rival). Closes with `Esc`.
- **Bottom tray:** contextual table (routes, fleet). Drag to resize; `T` toggles.
- Small windows (1024–1279px): inspector overlays the map as a drawer.

### Full-page sections
Finance, Fleet market, and Market explorer use the full content area (map hidden/dimmed) with a page header + one primary action.

---

## 4. Key screens & flows

### 4.1 Title / main menu
Minimal: logo, animated slow-moving route arcs on a dark globe in the background, buttons: **Continue** (primary, if a save exists) · New career · Load · Multiplayer (v0.3) · Settings · Quit.

### 4.2 New airline (3 steps, single column, progress dots)
1. **Identity** — Airline name, code (auto-suggested, validated unique), logo builder (shape + 2 colors) or **upload your own logo image**, live preview of the tail.
2. **Home hub** — map + searchable list; each airport card shows size, demand potential, competition, difficulty tag ("Busy hub — harder").
3. **Difficulty** — Easy / Normal (default) / Hard cards with plain-language consequences.
→ Button: **"Found airline"**.

### 4.3 First-run onboarding (skippable, never blocking)
Guided checklist in the Overview "Goals" card + coach-marks:
1. Lease your first aircraft → 2. Create your first route → 3. Set a fare (use suggested) → 4. Press Play → 5. Check your first day's profit.
Empty states teach the same steps if the tutorial is skipped.

### 4.4 Create route (core flow — must feel great)
Trigger: "New route" button, or click origin then destination on the map.
```
┌ New route ───────────────────────────────────────────┐
│ From  [ LHR London Heathrow   ▾]                     │
│ To    [ type city or code…    ]  → suggestions       │
│                                                      │
│ Distance 655 km · Demand ~2,400/day · 3 competitors   │
│                                                      │
│ Aircraft  [ A320neo #3 (free 14h/day) ▾]               │
│ Flights per week   [ 14 ]  ━━━━━━●━━━  max 21        │
│ Fare (economy)     [ $112 ]  suggested $108          │
│   ▸ Premium & business fares, service level          │
│ ─────────────────────────────────────────────────── │
│ Expected load 78% · Profit +$9.2k/day · Payback 21d  │
│                                   [Cancel] [Open route]│
└──────────────────────────────────────────────────────┘
```
- Preview line updates live (debounced 150 ms) with a subtle number tick animation.
- Validation inline: "Range too short — A320neo flies max 6,300 km", with a fix ("Show aircraft that can fly this").
- On success: arc draws on the map from origin to destination (450 ms), toast "Route LHR–FRA opened" (an "Undo" action is added in v0.2).
- The "Aircraft" field can take more than one aircraft (an "+ Add aircraft" row); each row shows the aircraft's free hours.

### 4.5 Overview dashboard
Cards (grid, auto-fit, min 280px): **Cash & 30-day profit** (sparkline) · **Alerts** (needs attention: unprofitable routes, aircraft due for maintenance, low cash) · **Goals** (next 3 objectives) · **Top routes** · **Reputation** · **Rival watch** (biggest moves this week).
Alerts are actionable: each has a single button ("Review route").

### 4.6 Fleet
Table: aircraft, type, age, condition bar, route assignment, utilisation, status (flying / maintenance / idle). Idle aircraft highlighted as a warning.
**Aircraft market**: filterable cards (range, seats, price, lease/mo, fuel/seat) with a compare tray (up to 3).

### 4.7 Finance
P&L by month (stacked bar: revenue vs cost categories), line chart of cash, KPIs row (Revenue, Op. margin, RASK, CASK, Load factor). Loans card with "Take loan" / "Repay" and clear interest preview.

### 4.8 Market
Airport explorer (demand heat on map), competitor list (fleet size, reputation, routes overlapping yours), route demand lookup for any pair.

### 4.9 News & notifications
Event cards: icon, headline, effect, duration, affected routes link. Toasts for minor info; **auto-pause modal** only for major events (configurable).

### 4.10 Game over / season end
Clear summary: key stats, chart of company value, "what went wrong/right" hints, buttons: New career / Load save.

---

## 5. Visual design system

### 5.1 Theme
**Dark by default** (long sessions, map contrast). A **light theme** comes in v0.2; tokens are set up for it from day one.

### 5.2 Color tokens (OKLCH)
```css
:root[data-theme="dark"] {
  --bg:          oklch(0.16 0.012 250);  /* app background, tinted navy-gray */
  --surface-1:   oklch(0.20 0.012 250);  /* panels */
  --surface-2:   oklch(0.24 0.014 250);  /* raised cards, menus */
  --surface-3:   oklch(0.28 0.016 250);  /* modals, hover rows */
  --border:      color-mix(in oklch, var(--text) 10%, transparent);
  --text:        oklch(0.93 0.008 250);
  --text-muted:  oklch(0.72 0.012 250);  /* still ≥4.5:1 on surface-1 */
  --text-faint:  oklch(0.58 0.012 250);  /* labels only, large/UPPERCASE */
  --accent:      oklch(0.72 0.14 230);   /* "sky" blue — actions, focus, YOUR airline */
  --accent-hover:color-mix(in oklch, var(--accent), white 10%);
  --success:     oklch(0.74 0.15 155);   /* profit */
  --warning:     oklch(0.80 0.14 80);
  --danger:      oklch(0.66 0.19 25);    /* loss */
  --map-water:   oklch(0.14 0.015 250);
  --map-land:    oklch(0.21 0.010 250);
}
:root[data-theme="light"] {
  --bg:          oklch(0.98 0.004 250);
  --surface-1:   oklch(1 0 0 / 0.9);
  --surface-2:   oklch(0.97 0.005 250);
  --surface-3:   oklch(0.94 0.006 250);
  --text:        oklch(0.22 0.02 250);
  --text-muted:  oklch(0.45 0.02 250);
  --accent:      oklch(0.55 0.16 240);
  /* …success/warning/danger darkened for contrast */
}
```
Rules:
- ~90% neutrals; **accent = action + your airline only.**
- **Rival airlines** use their real (approximate) brand color, muted on the map (35% opacity). A "Color-blind friendly rivals" setting swaps to a fixed palette of 8 validated hues. The player's airline uses its chosen color *plus* the accent outline on the map.
- **Profit/loss** always shown with sign and arrow (▲/▼), never color alone.

### 5.3 Typography
- **Inter** (UI) with `font-variant-numeric: tabular-nums` for all numbers; **JetBrains Mono** only for codes (IATA, flight numbers). Both free (Google Fonts / OFL), bundled offline.
- Scale (px): 12 · 14 (default UI) · 16 · 20 · 24 · 32 (page titles) · 48 (big KPI numbers).
- Weights: 400 and 600 only. Headings `letter-spacing: -0.02em`. Small uppercase labels `12px / 600 / 0.08em`.
- Dense UI: base size 14px for tables/panels (management game); 16px for prose (help, events).

### 5.4 Spacing, radius, elevation
- Spacing scale: **2, 4, 8, 12, 16, 24, 32, 48, 64**. Panel padding 16; card padding 16–24; table row height 36 (compact) / 44 (comfortable, setting).
- Radius: **4** (chips, inputs inner), **8** (buttons, inputs), **12** (cards, panels), **16** (modals), full (pills). Nested radius = outer − padding.
- Elevation (dark mode = lighter surface, not bigger shadow): flat (border) → surface-2 → surface-3 + `0 8px 24px rgb(0 0 0 / .35)` for modals/menus. Panels over the map use `backdrop-filter: blur(12px)` with 85% opaque surface (disabled in "performance mode").

### 5.5 Iconography
**Lucide** icons only, 1.5px stroke, 16/20px. **Real aircraft silhouettes** per type (side view in Fleet/market cards, top view as map plane dots), tinted with `currentColor`.

### 5.5a Airline logos
- Shown at 16/24/40 px in tables, inspectors, rival list and route tooltips, always inside a rounded-square tile (radius 8) on `--surface-2` so logos with different shapes line up.
- Source order: player-supplied file in `logos/` → downloaded logo pack → **placeholder badge** (IATA code, 600 weight, on the airline's brand color).
- Settings → **"Download real logos"**: shows progress ("42 of 150"), can be cancelled, retries failures, and states "Logos are downloaded from Wikimedia Commons for personal use."

### 5.6 Components (all states designed)
Every interactive component has **default, hover, pressed, focus-visible, disabled**, and where relevant **loading, selected, error**.

| Component | Notes |
|---|---|
| Button | Primary (accent fill), Secondary (surface-2 + border), Ghost, Danger. Height 32 (dense) / 40. Press `scale(.97)`. Loading = inline spinner replacing label width-stable. |
| Input / NumberInput | Label always visible above; suffix units ($, /wk); stepper + scroll-wheel + arrow keys (Shift = ×10). |
| Slider | For frequency, cabin split; shows value bubble; keyboard accessible. |
| Combobox | Airport/aircraft search with IATA, city, country; recent items first. |
| Table | Sticky header, sortable columns, tabular numbers right-aligned, row hover, virtualized (TanStack Virtual) for 1000+ rows. |
| Card / KPI tile | Label (uppercase small), big number, delta with arrow, optional sparkline. |
| Inspector panel | Header (entity + type chip), key stats, sections (collapsible), one primary action at bottom. |
| Toast | Bottom-right, max 3 stacked, auto-dismiss 4 s, "Undo" action where possible. |
| Modal | Only for destructive confirms and major events. Focus-trapped, Esc closes. |
| Tooltip | 300 ms delay, plain-language explanation of game terms. |
| Progress / bar | Load factor, condition, reputation (with numeric label). |
| Empty state | Icon, one sentence, one action button. |
| Skeleton | For tables/charts while queries load. |

### 5.7 Map styling
- Minimal basemap: water, land, country borders (hairline), no roads/labels except major city labels at zoom ≥ 4.
- **Airports:** dots sized by size class; your bases = ring + accent.
- **Routes:** great-circle arcs (deck.gl ArcLayer). Your routes = livery color, 2px, full opacity; rivals = muted palette, 1px, 35% opacity; filter toggle "Show rivals".
- Hover airport → tooltip (name, IATA, demand). Click → inspector.
- Optional animated "planes" (small dots moving along arcs) — **ambient, low-cost**, auto-disabled under reduced motion / performance mode.

---

## 6. Motion system

Motion has a job: **feedback, orientation, focus**. Fast and subtle.

```css
:root {
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);   /* entrances, most UI */
  --ease-in:  cubic-bezier(0.4, 0, 1, 1);      /* exits */
  --ease-io:  cubic-bezier(0.65, 0, 0.35, 1);  /* moves on screen, map camera */
  --dur-1: 120ms;  /* hover, press, focus */
  --dur-2: 200ms;  /* menus, tooltips, toasts in */
  --dur-3: 320ms;  /* panels, drawers, modals */
  --dur-4: 450ms;  /* page/section change, route arc draw */
}
```

| Moment | Animation |
|---|---|
| Hover / press | bg shift 120ms; press `scale(.97)` |
| Inspector open | slide from right 16px + fade, 320ms ease-out; close 200ms ease-in |
| Section switch | content fade + 8px rise, 200ms; map camera eases (600ms ease-io) to relevant area |
| New route | arc draws origin→destination 450ms, then gentle pulse at destination |
| Tick (new day) | cash number "ticks" to new value (300ms), delta chip fades in ▲+$312k |
| Notification | toast slides up 12px + fade 200ms; bell badge pops (spring, low bounce) |
| Lists/cards appear | stagger 30ms per item, cap 8 items |
| Major event | modal scale .98→1 + fade 250ms; map flashes affected airports once (no repeated flashing) |
| Loading | skeleton shimmer (subtle, 1.5s loop) |

Rules:
- Animate **only transform & opacity**. Never width/height/top/left.
- Exits faster than enters. No linear easing on UI.
- **`prefers-reduced-motion`** + in-game "Reduce motion" setting: remove travel/arc drawing/plane dots; keep instant cross-fades.
- Tools: CSS transitions by default; **Motion (Framer Motion)** for presence/exit and layout animations; deck.gl transitions for map.

---

## 7. Accessibility
- Fully **keyboard playable**: nav (1–7), Space = play/pause, `+`/`-` speed, `N` new route, `Esc` close, `/` search, `Ctrl+S` save, `Ctrl+Z` undo. Shortcut list via `?`.
- Visible focus ring: `2px solid var(--accent)`, offset 2px, on every control.
- Contrast: body text ≥ 4.5:1, UI elements ≥ 3:1 in both themes.
- Never color-only meaning (profit/loss arrows, status icons + text).
- Color-blind safe rival palette; optional patterns/dashes on rival routes.
- UI scale setting: 90% / 100% / 115% / 130%. Respect OS text scaling.
- Screen-reader labels on icon-only buttons; tables use semantic markup.

## 8. Microcopy guidelines
- Buttons = verb + object: "Open route", "Lease aircraft", "Take $10M loan". Never "OK"/"Submit".
- Errors: name the problem + fix: "Not enough cash — you need $2.1M more. Take a loan?"
- Numbers: `$48.2M`, `$312k`, `86%`, `2,400 pax/day`. Always units.
- Tone: calm, confident, a bit of airline flavor in news ("BudgetJet slashes fares on AMS–BCN").
- One word per concept (always "route", never "line"/"connection" interchangeably).

## 9. Performance (UI)
- 60 fps map pan/zoom on integrated GPUs; deck.gl layers update incrementally per tick.
- Tables virtualized; charts render only visible.
- "Performance mode" setting: disables blur, plane dots, and reduces map detail.

## 10. Settings
Theme (dark/light/system) · UI scale · Reduce motion · Performance mode · Auto-pause on events · Auto-save interval · Units (km/mi) · Currency display · Language (EN first; i18n-ready strings) · Sound volume.

## 11. Review checklist (apply to every screen)
- [ ] One obvious focal point and one primary action.
- [ ] Preview shown before committing a decision.
- [ ] Empty, loading, error, and huge-data states designed.
- [ ] All spacing on scale; consistent radius; ≤ 3 type sizes per panel.
- [ ] Keyboard operable with visible focus; contrast passes in both themes.
- [ ] Motion has a job, is fast, and respects reduced motion.
