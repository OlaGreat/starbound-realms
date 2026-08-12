# Contributing Guide

Welcome to Starbound Realms. This guide covers everything you need to start contributing.

---

## Project Structure at a Glance

```
contracts/    — Soroban smart contracts (Rust). The on-chain game logic.
sdk/          — TypeScript SDK. Wraps contract calls for frontend & backend use.
frontend/     — React + Vite. The game UI.
backend/      — Node.js + Express. Indexer + REST API.
scripts/      — Bash scripts for deploy and testnet setup.
docs/         — Documentation.
```

---

## Setting Up Locally

### Requirements

- Rust (stable) + `wasm32-unknown-unknown` target
- Stellar CLI v26+
- Node.js v20+
- pnpm v9+
- Docker + Docker Compose
- Freighter browser extension (for frontend testing)

### Steps

```bash
# 1. Fork and clone
git clone https://github.com/YOUR_USERNAME/starbound-realms.git
cd starbound-realms

# 2. Install Node dependencies
pnpm install

# 3. Add Rust WASM target
rustup target add wasm32-unknown-unknown

# 4. Start local Postgres
docker-compose up -d postgres

# 5. Set up backend env
cd backend && cp .env.example .env

# 6. Run backend
pnpm dev

# 7. Run frontend (separate terminal)
cd frontend && pnpm dev
```

---

## Branch Naming

| Type | Pattern | Example |
|---|---|---|
| Feature | `feat/<short-description>` | `feat/fleet-contract` |
| Bug fix | `fix/<short-description>` | `fix/claim-system-panic` |
| Docs | `docs/<short-description>` | `docs/battle-mechanics` |
| Refactor | `refactor/<short-description>` | `refactor/indexer-polling` |

Always branch off `main`.

---

## Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>
```

**Types:** `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

**Scopes:** `contracts`, `sdk`, `frontend`, `backend`, `docs`, `ci`

**Examples:**
```
feat(contracts): implement fleet contract unit building
fix(backend): handle missing system_id in galaxy route
docs(readme): add testnet deploy instructions
```

---

## Pull Request Guidelines

- One feature or fix per PR — keep it focused
- Reference the issue: `Closes #42`
- Write a clear PR description — what changed and why
- Ensure CI passes before requesting review
- Add tests for contract changes where possible

---

## Contract Development Notes

- All contracts live in `contracts/<name>/src/lib.rs`
- Build a single contract: `stellar contract build --package <name>`
- Build all: `cargo build --target wasm32-unknown-unknown --release`
- Test: `cargo test`

---

## Engineering Standards

All contributions follow these non-negotiable rules:

- **TDD** — write the failing test first, then write the code that makes it pass
- **SOLID principles** — Single Responsibility above all else
- **One function, one job** — every function does exactly one thing and its name must describe that thing precisely

Full details: [`engineering-guidelines.md`](engineering-guidelines.md)

---

## Running Tests

```bash
# Rust contracts
cargo test

# TypeScript (SDK / backend / frontend)
pnpm test
```

No PR is merged without passing tests. No new function is accepted without a corresponding test.

---

## Good First Issues

Look for issues labelled [`good first issue`](https://github.com/OlaGreat/starbound-realms/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22). These are scoped, well-defined tasks that don't require deep knowledge of the full codebase.

---

## Questions?

Open a [GitHub Discussion](https://github.com/OlaGreat/starbound-realms/discussions) or comment directly on the issue you're working on.
