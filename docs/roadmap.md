# SkyEmpire — Roadmap & Release Plan

## Milestones

| Version | Name | Contents | Platform |
|---|---|---|---|
| **v0.1** | First Flight | Offline career: whole world, ~1,000 airports, ~19 real aircraft with silhouettes, 19 real AI airlines per world from a ~150-airline database, logo-pack download, routes with shared aircraft, fares, cabins, slots, bases, demand & competition, all 5 AI personalities, reputation, 5 events, tiers 1–3, objectives, finance & loans, save/load, tutorial, installer + auto-update | Windows (GitHub Releases) |
| v0.2 | Open Skies | Hub connections, ~40 aircraft, sandbox mode, achievements, cargo (simple), light theme, undo, UI scale | + itch.io, Microsoft Store |
| v0.3 | Shared Skies | **Player-hosted multiplayer**: host/join, AI fill & retire, caretaker AI, world chat, seasons & leaderboard | Windows |
| v0.4 | Alliances | Slots trading, alliances & codeshares, loyalty program, IPO & share price | Windows |
| v0.5 | Always On | Official dedicated world on Oracle Cloud Always Free, optional lobby/relay | Windows |
| v0.6 | Pocket Skies | Android build (Capacitor), touch-optimized layout | Android APK (GitHub/itch.io), F-Droid |
| later | — | Steam ($100), Google Play ($25), macOS/Linux builds, iOS ($99/yr) — only if the game earns money | — |

## v0.1 work breakdown (high level)
1. Monorepo + Electron shell + CI building a Windows installer (empty app).
2. Design tokens + core components (`packages/ui`).
3. Data pipeline: world airports, real aircraft + silhouettes, real airlines DB, offline basemap.
4. Sim core: state model, commands, tick, demand, allocation, costs, finance (with tests).
5. Map view: airports, routes, selection, inspector.
6. Screens: New airline, Overview, Network/Create route, Fleet, Finance (full); Market, Airline, News (basic).
7. AI airlines (5 personalities) + events + reputation + tiers & objectives.
8. Saves, auto-save, settings.
9. Onboarding, notifications, polish (motion, empty/loading states).
10. Balancing pass + playtest + release v0.1.

## Free platform stack ($0)
| Need | Free option |
|---|---|
| Code & issues | GitHub (public repo) |
| CI/builds | GitHub Actions (unlimited minutes for public repos) |
| Downloads & updates | GitHub Releases + electron-updater |
| Store fronts | itch.io (choose 0% revenue share), Microsoft Store (free for individuals), Game Jolt |
| Code signing | SignPath Foundation (free for OSS) — or unsigned at first |
| Website | GitHub Pages / Cloudflare Pages |
| Community | Discord, GitHub Discussions |
| Crash reports | Sentry free tier (opt-in) |
| Multiplayer | Player-hosted + playit.gg / Tailscale / ZeroTier (free); later Oracle Cloud Always Free |
| Data | OurAirports (public domain), Natural Earth (public domain), GeoNames (CC-BY), Protomaps/OSM (ODbL) |
| Art & audio | Kenney.nl (CC0), game-icons.net (CC-BY), OpenGameArt, Freesound, Lucide icons (ISC) |
| Fonts | Inter, JetBrains Mono (OFL) |

## Licensing
- Code: **MIT** (recommended).
- Data/art: keep each source's license; credit list in `CREDITS.md` (OSM/ODbL and CC-BY require attribution).
