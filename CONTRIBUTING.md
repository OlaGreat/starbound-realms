# Contributing to Starbound Realms

Thanks for your interest in contributing. Starbound Realms is open to contributors of all skill levels — whether you write Rust, TypeScript, or just want to improve docs.

Please note that this project is released with a [Code of Conduct](CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms.

---

## Where to Start

- [`good first issue`](https://github.com/OlaGreat/starbound-realms/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) — Scoped, beginner-friendly tasks
- [`help wanted`](https://github.com/OlaGreat/starbound-realms/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22) — Larger features open for contributors
- [`contracts`](https://github.com/OlaGreat/starbound-realms/issues?q=is%3Aissue+is%3Aopen+label%3Acontracts) — Soroban / Rust
- [`frontend`](https://github.com/OlaGreat/starbound-realms/issues?q=is%3Aissue+is%3Aopen+label%3Afrontend) — React / TypeScript
- [`backend`](https://github.com/OlaGreat/starbound-realms/issues?q=is%3Aissue+is%3Aopen+label%3Abackend) — Node.js / indexer

---

## Areas to Contribute

| Area | Language | Location |
|---|---|---|
| Smart Contracts | Rust | `contracts/` |
| TypeScript SDK | TypeScript | `sdk/` |
| Frontend | React / TypeScript | `frontend/` |
| Backend / Indexer | Node.js / TypeScript | `backend/` |
| Documentation | Markdown | `docs/` |
| Scripts | Bash | `scripts/` |

---

## Local Setup

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/starbound-realms.git
cd starbound-realms

# Install Node dependencies
pnpm install

# Add Rust WASM target
rustup target add wasm32-unknown-unknown

# Start Postgres
docker-compose up -d postgres

# Backend
cd backend && cp .env.example .env && pnpm dev

# Frontend (separate terminal)
cd frontend && pnpm dev
```

Full setup instructions: [`docs/contributing.md`](docs/contributing.md)

---

## End-to-End Tests

The Playwright suite in `frontend/e2e/` runs the real app in headless Chromium. It needs no backend, wallet, or network: the backend API and the Freighter extension are mocked inside the test.

```bash
# The frontend imports the built SDK, so build it first
cd sdk && pnpm run build

cd ../frontend
pnpm exec playwright install chromium   # one-time browser download
pnpm test:e2e
```

Playwright starts the Vite dev server on port 5173 itself, and reuses one that is already running locally. CI runs the same suite in the `E2E (Playwright)` job.

---

## Branch Naming

| Type | Pattern |
|---|---|
| Feature | `feat/<short-description>` |
| Bug fix | `fix/<short-description>` |
| Docs | `docs/<short-description>` |
| Refactor | `refactor/<short-description>` |

---

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>
```

**Types:** `feat` `fix` `docs` `refactor` `test` `chore`  
**Scopes:** `contracts` `sdk` `frontend` `backend` `docs` `ci`

```bash
# Examples
feat(contracts): implement fleet contract unit building
fix(backend): handle missing systemId in galaxy route
docs(readme): update getting started steps
```

---

## Engineering Standards

All contributions must follow our engineering guidelines:

- **TDD** — write the test first, then the implementation
- **SOLID principles** — especially Single Responsibility
- **One function, one job** — every function does exactly one thing and is named after what it does

Read the full guide: [`docs/engineering-guidelines.md`](docs/engineering-guidelines.md)

---

## Mutation Testing

Writing a test that passes is not enough — you must confirm your test actually *catches* a bug.

After your test goes green, deliberately break the implementation to verify the test turns red. This is called mutation testing, and it is required for every PR that adds new logic.

### How to do it

1. Write your test and make it pass (TDD green).
2. Introduce a small mutation in the implementation — change a `<` to `<=`, flip a boolean, remove a condition, or alter a return value.
3. Run the tests and confirm your test **fails** on the mutant.
4. Revert the mutation and submit.

### Example (TypeScript)

```ts
// Implementation
function isFleetEmpty(fleet: Fleet): boolean {
  return fleet.units.length === 0; // original
  // return fleet.units.length <= 0; // ← mutant: change === to <=
}

// Test
it('returns false when fleet has units', () => {
  expect(isFleetEmpty({ units: [{ type: 'fighter', count: 3 }] })).toBe(false);
});
```

Temporarily changing `=== 0` to `<= 0` does not change behaviour here — a better mutation is changing it to `> 0`, which would flip the result. If the test doesn't catch that flip, the test is not strong enough.

### Example (Rust)

```rust
// Implementation
fn is_system_unclaimed(system: &StarSystem) -> bool {
    system.owner.is_none() // original
    // !system.owner.is_none() // ← mutant: flip the condition
}
```

If you add a boundary check like `hp > 0`, try changing it to `hp >= 0` and confirm your test catches the difference.

> A test that only passes against correct code is not a safety net — it is a false sense of security.

## GitHub labels

Issues use a small, consistent label vocabulary. Apply one area label and,
when useful, one type or priority label:

| Category | Labels |
|---|---|
| Area | `contracts`, `backend`, `frontend`, `sdk`, `docs`, `devops` |
| Type | `bug`, `feature`, `documentation`, `testing` |
| Priority | `priority:high`, `priority:medium`, `priority:low` |
| Contributor guidance | `good first issue`, `help wanted` |

Area labels identify the code owner; type labels describe the change. Keep
labels lowercase and do not add duplicates or synonyms. Closed issues should
be explained in a comment instead of receiving administrative labels such as
`invalid`, `duplicate`, or `wontfix`; those labels are intentionally not part
of the project vocabulary.

---

## Pull Request Guidelines

- One feature or fix per PR
- Reference the issue your PR closes: `Closes #42`
- Write a clear description — what changed and why
- Ensure CI passes before requesting review (`cargo test` + `pnpm test`)
- Every new function must have a corresponding test — no exceptions

---

## Questions?

Open a [GitHub Discussion](https://github.com/OlaGreat/starbound-realms/discussions) or comment on the issue you're working on.
