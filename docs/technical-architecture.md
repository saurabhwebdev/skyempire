# SkyEmpire — Technical Architecture

## 1. Overview

```
┌──────────────────────── Electron app (Windows .exe) ───────────────────────┐
│                                                                             │
│  Renderer (UI)                     Main process            Sim worker       │
│  React + Vite + TS          IPC    - window, menus   msgs  (utilityProcess) │
│  MapLibre + deck.gl   ◄──────────► - saves (SQLite) ◄────► packages/sim     │
│  Zustand, TanStack Query           - auto-update           tick(), AI       │
│                                    - (v0.3) host server                     │
│                                      Fastify + WebSocket ◄──── friends' apps│
└─────────────────────────────────────────────────────────────────────────────┘
```
- **One simulation engine** (`packages/sim`) used everywhere: offline worker, multiplayer host, future headless server.
- UI never computes game results; it sends **commands** and renders **state snapshots/diffs**.

## 2. Stack (all free / open source)
| Layer | Choice |
|---|---|
| Language | TypeScript (strict) |
| Monorepo | pnpm workspaces + Turborepo |
| Desktop shell | Electron (latest stable) + electron-vite |
| UI | React 19, Vite, Tailwind CSS v4, Radix primitives (via shadcn/ui), lucide-react icons |
| State | Zustand (UI state), TanStack Query (snapshot/queries over IPC) |
| Map | MapLibre GL JS + deck.gl (ArcLayer, ScatterplotLayer), Protomaps PMTiles basemap bundled offline |
| Charts | Recharts (or visx if needed) |
| Motion | CSS transitions + Motion (`motion` / Framer Motion) for presence/layout |
| Sim | Plain TS, seeded RNG (`pure-rand`), no DOM/Node APIs |
| Storage | SQLite via `better-sqlite3` (main process), Drizzle ORM schema |
| Validation | Zod (commands, save files, network messages) |
| Multiplayer (v0.3) | Fastify + `ws` WebSockets inside the host's main process |
| Packaging | electron-builder (NSIS installer + portable .zip), electron-updater (GitHub Releases) |
| CI | GitHub Actions (Windows runner) |
| Tests | Vitest (sim + logic), Playwright (Electron e2e) |
| Lint/format | ESLint + Prettier (or Biome) |
| Crash reports | Sentry free tier (opt-in) |

## 3. Repository layout
```
skyempire/
├─ apps/
│  ├─ desktop/            # Electron: main, preload, renderer
│  │  ├─ src/main/        # window, IPC, saves, updater, host server
│  │  ├─ src/preload/     # typed, minimal contextBridge API
│  │  └─ src/renderer/    # React app (screens, components)
│  └─ server/             # (v0.5) headless dedicated server using packages/sim
├─ packages/
│  ├─ sim/                # pure game engine: state, tick, AI, events, balance config
│  ├─ shared/             # types, Zod schemas, command & message definitions
│  ├─ data/               # airports, aircraft, regions (JSON) + build scripts
│  └─ ui/                 # design tokens + shared React components
├─ docs/
├─ .github/workflows/     # build, test, release
└─ README.md
```

## 4. Simulation engine (`packages/sim`)
- **State** is a plain serializable object (normalized maps by id): `world`, `airports`, `airlines`, `aircraft`, `routes`, `events`, `market` (fuel, economy), `rngState`, `day`.
- **Commands** (Zod-validated): `CreateRoute`, `UpdateRoute`, `CloseRoute`, `LeaseAircraft`, `BuyAircraft`, `SellAircraft`, `SetCabin`, `TakeLoan`, `RepayLoan`, `OpenBase`, `SetServiceLevel`, `SetMarketingBudget`, …
- `tick(state, commands[], config) → { state, summary, notifications }`.
- `preview(state, command)` → projected effects (used for "expected load factor / profit" UI hints) without mutating state.
- Runs in an Electron **utilityProcess** so the UI stays at 60 fps.
- Pure functions + immutable updates (Immer allowed) for testability and determinism.

## 5. Persistence
- One **SQLite file per save** in `%APPDATA%/SkyEmpire/saves/`.
- Store full state as compressed JSON blob per snapshot + tables for history (daily airline financials, route stats) for charts.
- Auto-save every 30 game days and on quit; keep last 3 auto-saves.
- Save file includes `schemaVersion`; migrations run on load.

## 6. IPC contract (renderer ↔ main ↔ worker)
- Preload exposes a **typed API**: `game.newGame(opts)`, `game.load(id)`, `game.save()`, `game.command(cmd)`, `game.setSpeed(n)`, `game.onTick(cb)`, `game.query(name, params)`.
- `contextIsolation: true`, `nodeIntegration: false`, sandboxed renderer; no remote content loaded.
- Tick updates are pushed as **diffs/summary**; heavy views (route list, financial history) are fetched via `query`.

## 7. Multiplayer (v0.3) — player-hosted
- Host clicks **Host World** → main process starts Fastify + WebSocket on a port; sim worker becomes authoritative for that world.
- Clients connect via **address + world code** (works with LAN, Tailscale/ZeroTier, or playit.gg tunnel). Optional later: free relay/lobby on Oracle Free / Cloudflare.
- Protocol: JSON messages (Zod schemas), versioned.
  - Client → host: `hello{version, playerToken}`, `command{cmd}`, `query{...}`, `chat`.
  - Host → clients: `welcome{airlineId, snapshot}`, `tick{day, diff}`, `notification`, `chat`.
- **Authority:** host validates every command; clients only see their own private data (others' finances are partly hidden, like real competitors).
- **Identity:** each player has a locally generated keypair/token; host maps token → airline. No accounts needed.
- **AI fill/retire** and **caretaker** logic per the design doc.

## 8. Dedicated server (v0.5)
- `apps/server`: Node process running `packages/sim` + Fastify/WebSocket + SQLite (or Postgres if needed), hosted on **Oracle Cloud Always Free** (ARM VM), behind Caddy (free TLS).

## 9. Build, release & updates
- GitHub Actions on tag `v*`: install → test → build → electron-builder → upload to **GitHub Releases** (`latest.yml` for auto-update).
- Artifacts: NSIS installer `.exe`, portable `.zip`.
- **itch.io** via `butler` in CI (free). **Microsoft Store** via MSIX package (free individual developer account).
- Code signing: apply to **SignPath Foundation** (free for OSS); until then, unsigned (SmartScreen "Run anyway").

## 10. Data pipeline (`packages/data`)
- Script downloads OurAirports CSV (public domain) → filters (scheduled service = yes, type large/medium) → joins population from GeoNames/Natural Earth (CC-BY / public domain) → outputs `airports.<region>.json`.
- `aircraft.json`: hand-curated **real aircraft** (ICAO type code as id, e.g. `A20N`), specs from manufacturer spec sheets + Wikidata (CC0), with a `sources` field per entry; fuel burn/lease are cited estimates.
- `airlines.world.json`: ~150 curated **real airlines** worldwide (name, IATA, ICAO, Wikidata QID, hub, personality, fleet types, approximate brand color), cross-checked against OpenFlights `airlines.dat` (ODbL) / Wikidata (CC0). **No logo files in the repo.**
- `silhouettes/<ICAO>.svg`: real aircraft silhouettes, free-licensed from Wikimedia Commons (credited) or traced by us from public 3-views.
- **Logo pack:** at runtime, Settings → "Download real logos" queries Wikidata (P154 logo image) for each airline QID and downloads the file from Wikimedia Commons into `%APPDATA%/SkyEmpire/logos/<IATA>.(svg|png)`. Players can also drop files there. Missing logo → placeholder badge (IATA code on brand color).
- `routes.world.json`: real routes for the roster airlines filtered from OpenFlights `routes.dat` (ODbL, 2014 snapshot) — used only as AI preferences.
- Basemap: Protomaps world PMTiles extract at low zoom (0–6), bundled (~30–60 MB).

## 11. Quality gates
- Unit tests for every formula in `simulation-spec.md`.
- **Golden tests:** run 365 days with fixed seed, compare summary snapshot.
- Perf test: tick time budget (< 200 ms for target world size).
- e2e smoke: launch app → new game → create route → advance 7 days → profit visible.

## 12. Security
- Renderer isolated, strict CSP, no `eval`, no remote code.
- Multiplayer: validate all inputs with Zod, rate-limit commands, cap message size, host never executes client-provided code.
