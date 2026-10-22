# Changelog

All notable changes to Starbound Realms are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

---

## October 2026

### Added
- **AllianceClient** — new SDK client for managing in-game alliances; alliance event indexing wired into the backend indexer (#82, #140)
- **System upgrades** — plasma cost and defense bonus applied when upgrading a star system (#176)
- **Paginated galaxy API** — `/galaxy` endpoint supports `page` and `pageSize` query params; frontend renders a scalable virtual map (#181)
- **Rate limiter config** — `standardLimiter` and `strictLimiter` middleware added to all routes (#180)
- **Network indicator** — live network badge in the frontend showing testnet/mainnet status (#180)
- **Onboarding modal** — first-visit walkthrough for new players (#139)
- **Galaxy empty state** — dedicated empty-state component when no systems are claimed (#138)
- **Shared notification toasts** — all frontend error and success states routed through a unified toast system (#160)
- **Full-loop integration test** — Soroban integration test spanning all four contracts: galaxy-map, fleet, resources, battle (#186)
- **Playwright E2E test** — connect-wallet → view-galaxy flow tested in headless Chromium (#185)
- **Route parameter validation** — middleware validates all route params before handlers run (#185)
- **localStorage persistence** — last-selected star system survives page refresh (#185)
- **Backend observability** — health endpoint hardened; testnet safety checks added (#186)
- **CODEOWNERS** — ownership file mapping directories to GitHub teams (#180)

### Changed
- Season reset for `galaxy-map`, `fleet`, and `resources` contracts now guards against reopening already-mined periods (#178)
- Unit type matchups applied to attack power calculations in the battle contract (#182)

---

## September 2026

### Added
- **Stellar SDK v17 upgrade** — SDK and frontend updated to `@stellar/stellar-sdk` v17; breaking XDR changes resolved
- **Trustline support** — `useTrustlines` hook and `ResourceSetupBanner` component guide players through establishing trustlines before mining (#134, #135)
- **Mining goes live on testnet** — resources contract mint/burn wired end-to-end; tested against live testnet deployment
- **Live testnet addresses** — contract IDs documented in `docs/` for all four deployed contracts (#187)
- **Testnet CI workflow** — GitHub Actions job runs contract tests against testnet on push to `main`
- **Dependabot config** — automated dependency updates for npm and cargo (#158)
- **Prettier CI** — formatting enforced in CI with `--check`; `.prettierignore` and `.prettierrc` added (#158)
- **Dark / light mode toggle** — shared CSS design tokens and `ThemeToggle` component (#123, #124)
- **Copy wallet address** — one-click clipboard button on the player profile (#125)
- **Open Graph meta tags** — social sharing previews for the app (#126)
- **Seasonal reset design doc** — `docs/seasonal-reset-design.md` outlining the planned wipe cycle (#183)
- **CODE_OF_CONDUCT** — contributor code of conduct added at repo root (#180)
- **Dev script** — `scripts/dev.sh` starts all services in one command (#180)
- **OpenAPI spec** — `docs/openapi.yaml` documents all backend REST endpoints (#181)

### Fixed
- `resources` contract: `reset_season` no longer re-opens already-mined periods (#178)
- Backend: missing `systemId` in galaxy route now returns a 400 instead of a 500 (#185)
- ESLint config added; Clippy CI job lint-checks all Rust contracts on every PR (#178)

---

## August 2026

### Added
- **Four Soroban contracts reach feature-complete state**: `galaxy-map`, `fleet`, `resources`, `battle` — all core game logic implemented and unit-tested
- **BattleClient** — SDK client with pure helpers: `didAttackerWin`, `getBattleLoser`, `wasBattleDecisive`
- **FleetClient** — SDK client with `getFleet`, `getUnitCost`, `calculateFleetAttack`, `calculateFleetDefense`, `isFleetEmpty`
- **ResourcesClient** — SDK client with `getBalance`, `getAllBalances`
- **GalaxyClient** — SDK client with `getSystem`, `getPlayerSystems`, `getGridSize`
- **StarboundClient** — top-level RPC client with testnet helper; exported from `sdk/src/index.ts`
- **Backend indexer** — `processEvent`, `processSystemClaimed`, `processBattleResolved` event processors
- **Backend routes** — galaxy, player, battle, and leaderboard REST endpoints fully implemented
- **PostgreSQL schema** — `star_systems`, `players`, `battles`, `resource_events` tables
- **DB queries** — `fetchAllStarSystems`, `fetchPlayerByAddress`, `saveBattle`, leaderboard query
- **Rate limiters** — `standardLimiter` and `strictLimiter` middleware scaffolded
- **Error handler middleware** — centralised Express error handler
- **Engineering guidelines** — TDD, SOLID, single-responsibility, and naming conventions documented in `docs/engineering-guidelines.md`
- **Game mechanics doc** — galaxy, resources, fleets, battle, and future mechanics described in `docs/game-mechanics.md`

### Changed
- `galaxy-map` and `resources` contracts deployed to testnet; contract IDs committed to `.env.testnet`

---

## July 2026

### Added
- **Project scaffold** — monorepo structure: `contracts/`, `sdk/`, `frontend/`, `backend/`, `docs/`, `scripts/`
- **Frontend landing page** — hero section, feature highlights, game-loop explainer, connect-wallet stub
- **React entry point** — Vite + React app bootstrapped with global CSS variables
- Initial `README.md`, `docs/architecture.md`, and CI configuration
