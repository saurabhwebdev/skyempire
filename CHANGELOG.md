# Changelog

## 0.6.0 — "Cargo"

- **Three kinds of airline.** When you start a career, choose **Passenger**, **Passenger + Cargo**, or **Cargo only**. Cargo only is for good: a cargo airline can never fly passengers.
- **34 real freighters**, each with real specs, an aircraft page, and a real photo where a free one exists:
  - new: 747-8F, 777F, 767-300F, A330-200F, ATR 72-600F, Cessna 408 SkyCourier, Cessna 208B;
  - coming: A350F from 2027 and 777-8F from 2028. You can order them now; they're delivered on their real entry dates, and lease payments start then;
  - conversions of the airliners you fly, e.g. 777-300ERSF, A321P2F, 737-800BCF, 767-300BCF, 757-200PCF;
  - used only: 747-400F, MD-11F, An-124, A300-600F, Il-76 and more.
- **Convert to freighter.** Send an airliner you own to the conversion shop. It keeps its age and condition and comes back as a freighter after 2–5 months. A cargo airline can also buy a used airliner and convert it in one go.
- **Cargo demand in tonnes.**
  - It runs between real cargo hubs (Hong Kong, Memphis, Shanghai, Anchorage, Louisville, Leipzig…), using real annual tonnages for 70 airports.
  - It's one-sided: China → USA is busy, the way back is half empty.
  - It peaks before Christmas and dips at Lunar New Year.
- **Six kinds of cargo:**
  - general;
  - express (frequency and punctuality matter);
  - mail (steady all year);
  - perishables (late flights spoil them);
  - dangerous goods (they need a licence: $250k on the Airline screen);
  - live animals and outsize (main-deck freighters only).
- **Belly cargo.** Your passenger aircraft sell cargo in their holds automatically. On any route you can switch to Custom to set the rate, the cargo types and how much of the hold to give cargo. Too much, and bags get left behind. You can switch belly cargo off on the Airline screen.
- **Cargo rivals.**
  - Real cargo airlines join every game: FedEx, UPS, DHL, Cargolux, AeroLogic, SF Airlines, China Cargo, Nippon Cargo, Silk Way West, Atlas Air and Polar.
  - Lufthansa, Emirates, Qatar, Cathay and other big carriers fly freighters too.
- **Cargo on every screen.** The route editor gets a Passengers / Cargo switch, a rate per kg and the cargo types. Cargo routes are amber on the map. The Overview shows tonnes moved, and Finance shows cargo revenue.
- **Cargo-only careers** grow by tonnes moved and have their own goals and tutorial.
- **Four big cargo hubs added:** Memphis, Louisville, Cincinnati and Anchorage.
- **Trucks matter.**
  - Short cargo hops lose most of their freight to road transport.
  - Long-haul hubs collect cargo trucked in from nearby airports, the way Luxembourg and Leipzig really work.

## 0.5.0 — "Connections"

- **Routes with stops.** A route can now have up to 2 stops, e.g. London → Dubai → Singapore.
  - One aircraft flies the whole way and back.
  - You sell every pair along the route: London–Dubai, Dubai–Singapore and London–Singapore through.
  - Each pair has its own fares, with suggestions.
  - Short-range aircraft can now reach far-away cities, and thin routes fill better.
  - Every leg must be within range. Stops use twice the airport slots, and a strike, a ban or closed airspace on any leg grounds the whole route.
  - The route panel shows passengers for each pair and how full each leg is.
- **Use free hours.** On the Fleet page, **Use free hours** lists every aircraft flying less than 70% of its week, with the best new routes from your bases (expected load and profit).
  - Open one in a click, or press **Open best for all**.
- **Raise fares for a travel peak.** In **Travel peaks ahead** on the Overview, **Raise fares** adds a seasonal fare over the peak dates to every route that flies there, in one go. Routes that already have one for those dates are skipped.
- **Side menu:** the tooltip shows the section name with its keyboard shortcut as a key, e.g. "Fleet [3]".
- **Fix:** a new route could ask for more flights than the aircraft had hours for. On long routes this made "Open route" fail with "Not enough free hours".

## 0.4.0 — "Cabin"

- **Cabin designer.** Design every aircraft's cabin, with up to three classes: Economy, Premium Economy and Business. For each class you choose:
  - **Seats:** how many, and the seat type. Economy can be slimline, standard or extra legroom. Business can be a recliner, angled lie-flat, full-flat bed or private suite. Bigger seats take more room, so you fit fewer.
  - **A denser economy row** on aircraft where airlines really fly one (e.g. 3-4-3 on the 777-200).
  - **Entertainment:** none, Wi-Fi streaming, seatback screens, or big screens with free Wi-Fi.
  - **Meals:** from none or buy-on-board up to chef-designed dining, plus amenity kits and lounge access.
- **Cabins matter.**
  - Better products raise each class's quality, so you win more passengers and can charge more.
  - They also cost money:
    - seats and screens cost money to fit;
    - meals, kits, lounges and Wi-Fi cost money on every flight;
    - heavier cabins burn a little more fuel.
  - Changing seats or screens on an aircraft you already have means a paid **refit**: 3 to 10 days out of service. Changing meals and extras is free and instant.
- **Saved layouts.** Save a cabin as a layout (for example "787 long-haul") and start from it in one click.
- **The live seat map** follows your seat choices, for example 1-2-1 lie-flat beds or 2-2 recliners.
- **Rivals have products too.**
  - Low-cost airlines fly slimline seats with buy-on-board.
  - Full-service airlines fly lie-flat beds.
  - Super-connectors fly suites on their widebodies.
- **Search, filters and sorting** everywhere:
  - **Aircraft market:**
    - search by name or maker;
    - filter by class, maker, "only what I can fly now", range and seats;
    - sort by price, lease, seats, range or fuel per seat;
    - used aircraft also sort by age and condition.
  - **Fleet:** search, and filter by flying, idle, maintenance or refit, and by owned or leased.
  - **Routes:** search by airport or city, and filter by profitable, losing, suspended or grounded.
  - **News, rivals and saved careers:** search, filter and sort.
- **Changes:**
  - The airline-wide "service level" is replaced by per-class cabin products. Old saves convert automatically.
  - Only one fuel price spike can happen at a time. Before, two could stack and push fuel to three times its normal price.

## 0.3.1

- **Faster, more reliable start.**
  - The window opens straight away with a "Loading…" screen, instead of staying hidden until the game has loaded.
  - The game files are about a third of the size, and the map and charts load after the title screen appears.
  - Only one copy of the game runs at a time. Double-clicking again just brings the open game to the front. Two copies used to fight over the same files and could hang.
  - If the game screen crashes, it reloads by itself. If it can't load, you get a message with a **Try again** button instead of nothing.
- **A log file** for start-up problems, at `%APPDATA%\SkyEmpire\logs\main.log`.

## 0.3.0 — "Hangar"

- **Real aircraft photos.** Every one of the 38 aircraft now has a real photo, from Wikimedia Commons. Each photo credits its photographer and licence.
- **A new aircraft page.** Click any aircraft in the market or your fleet to open it:
  - real-world specs: length, wingspan, height, engines, first flight and typical seating
  - the in-game numbers side by side
  - a cabin map showing one-, two- and three-class layouts
- **Cabin editor with a seat map.** It draws your seats row by row as you change them, and has one-click typical layouts to start from.
- **Updates inside the game.** When a new version comes out, a banner tells you.
  - Click **Update now**: it downloads while you play, then **Restart now** saves your game and installs it.
  - A "What's new" note appears after the update.
  - Settings has a **Check for updates** button.
  - This works with the Setup .exe install. The .zip version gets a download link instead.

## 0.2.0 — "Living World"

- **Weather.** Every airport gets a daily condition: clear, wind, rain, thunderstorms, snow, fog or a tropical cyclone. Realistic weather is simulated from climate, by latitude, hemisphere and month. When you're online, real forecasts from Open-Meteo are used instead (Settings → Live weather).
  - Bad weather delays and cancels flights, and snow adds de-icing costs.
  - A "Weather watch" card warns you 3 days ahead and lets you cancel ahead for less.
  - Weather shows on the map, and the airport panel has a 3-day forecast.
- **Geopolitical tensions.** Generic, region-level events with 7–30 days' warning: airspace closures (with detours, or routes out of range), route bans between two countries, travel advisories, and thaws that bring travel back. Closed airspace is shaded on the map, and routes show "Detour +N km" or "Grounded".
- **Holidays and festivals.** The calendar now uses real dates: your career starts on Jan 1 of the current year. Real public holidays in about 180 countries lift demand, and so do the big travel peaks: Christmas and New Year, Lunar New Year (Chunyun), Diwali, the two Eids, Easter, the Golden Weeks, Thanksgiving and the southern summer. Ramadan lowers leisure travel.
  - A new "Travel peaks ahead" card lists what's coming in your markets.
  - Seasonal fares let you raise or cut fares for a date range.
- **19 more aircraft**, making 38: CRJ900, E190-E2, ARJ21, A319ceo, 737-700, A321ceo, 737 MAX 9 and 10, C919, 757-200, 767-300ER, A330-200, 787-8, 787-10, 777-200ER, A350-1000, 777-9, A380 and 747-8.
  - Out-of-production types are sold used only.
  - The new **Global** tier unlocks the A380, 747-8, 777-9 and A350-1000.
- Map layer toggles (Rivals, Weather).
- Saves from 0.1 load and keep playing (save format v2).

## 0.1.0 — "First Flight"

First playable version: single-player, offline, Windows.

- Career mode: found an airline at any of ~1,000 real airports, Easy / Normal / Hard.
- 19 real aircraft types with silhouettes; lease, buy new, buy used; cabin layouts.
- Routes with shared aircraft, live profit preview and suggested fares; slots and bases.
- 19 real AI rival airlines per game (from 145), five airline styles, real home hubs and real-route preferences.
- Economy calibrated to real traffic and airline costs; background competition from airlines outside the game world.
- Events: fuel spikes, recessions and booms, strikes, storms, airport expansions.
- Reputation, maintenance checks, loans and credit ratings, bankruptcy.
- Tiers (Startup → Regional → National) and goals; skippable tutorial.
- Screens: Overview, Network, Fleet & market, Finance (charts), Market, Airline, News.
- Saves with autosave; settings (reduce motion, performance mode, colour-blind rivals, auto-pause).
- Optional real-logo pack downloaded from Wikimedia Commons; custom player logo.
- Auto-update from GitHub Releases.
