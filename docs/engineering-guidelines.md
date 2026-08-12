# Engineering Guidelines

All contributors are expected to follow these guidelines. PRs that violate them will be asked to revise before merge.

---

## 1. Test-Driven Development (TDD)

We follow TDD on this project. That means:

**Write the test first. Then write the code that makes it pass.**

### The TDD cycle

```
1. RED   — Write a failing test that describes the behaviour you want
2. GREEN — Write the minimum code to make the test pass
3. REFACTOR — Clean up without breaking the test
```

### For Soroban contracts (Rust)

Every public contract function must have at least one test in the same file under `#[cfg(test)]`.

```rust
// ✅ Write this first
#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::Env;

    #[test]
    fn claim_system_sets_owner() {
        let env = Env::default();
        env.mock_all_auths();
        // arrange → act → assert
    }
}

// Then write the implementation to make it pass
```

Run contract tests with:
```bash
cargo test
```

### For TypeScript (SDK / backend / frontend)

Use [Vitest](https://vitest.dev/) for unit tests.

```ts
// ✅ Write this first
describe('claimSystem', () => {
  it('should return a transaction envelope when called with valid args', async () => {
    // arrange → act → assert
  });
});
```

Run tests with:
```bash
pnpm test
```

### Rules

- No PR that adds a new function is accepted without a corresponding test
- Tests live alongside the code — `*.test.ts` next to the source file, `#[cfg(test)]` in the same `.rs` file
- Test names must describe the behaviour, not the implementation: `claim_system_sets_owner` ✅ not `test1` ❌

---

## 2. SOLID Principles

### S — Single Responsibility
Every module, class, and function does **one thing only**. If you find yourself writing "and" in a function's description, split it.

```ts
// ❌ Does too much
async function fetchAndProcessAndSaveGalaxy() { ... }

// ✅ Each function does one thing
async function fetchGalaxyFromChain() { ... }
async function processGalaxyEvents(events: Event[]) { ... }
async function saveGalaxyToDatabase(systems: StarSystem[]) { ... }
```

### O — Open/Closed
Code should be open for extension but closed for modification. Add new behaviour by extending, not by editing existing logic.

### L — Liskov Substitution
Subtypes must be substitutable for their base types without breaking behaviour.

### I — Interface Segregation
Don't force a module to depend on interfaces it doesn't use. Keep interfaces small and focused.

```ts
// ❌ Fat interface
interface GameClient {
  claimSystem(): Promise<void>;
  buildUnit(): Promise<void>;
  getLeaderboard(): Promise<Player[]>;
}

// ✅ Segregated
interface GalaxyClient { claimSystem(): Promise<void>; }
interface FleetClient { buildUnit(): Promise<void>; }
interface LeaderboardClient { getLeaderboard(): Promise<Player[]>; }
```

### D — Dependency Inversion
Depend on abstractions, not concrete implementations. Inject dependencies rather than hardcoding them.

```ts
// ❌ Hardcoded dependency
class GalaxyService {
  private db = new PostgresDatabase();
}

// ✅ Injected dependency
class GalaxyService {
  constructor(private readonly db: DatabaseClient) {}
}
```

---

## 3. Single Responsibility for Functions

Every function must do **one thing and one thing only**.

### Rules

- **Name the function after exactly what it does.** The name should be so clear that a comment is unnecessary.
- Functions that do multiple things must be split.
- Functions should be short — if a function doesn't fit on one screen, it's doing too much.

```rust
// ❌ Does two things — verifies AND updates
fn verify_and_update_owner(env: Env, player: Address, system_id: u32) { ... }

// ✅ Each function does one thing
fn verify_system_is_unclaimed(system: &StarSystem) { ... }
fn set_system_owner(system: &mut StarSystem, owner: Address) { ... }
```

```ts
// ❌ Ambiguous name, mixed concerns
async function handleGalaxy(req, res) { ... }

// ✅ Clear name, single concern
async function getGalaxyGridFromDatabase(db: DatabaseClient): Promise<StarSystem[]> { ... }
async function formatGalaxyResponse(systems: StarSystem[]): GalaxyResponse { ... }
```

### Naming conventions

| Language | Style | Example |
|---|---|---|
| Rust | `snake_case` verbs | `claim_system`, `get_system_owner`, `verify_system_is_unclaimed` |
| TypeScript | `camelCase` verbs | `claimSystem`, `getSystemOwner`, `verifySystemIsUnclaimed` |

Use precise, descriptive verbs:
- `get` — read and return data
- `set` — write data
- `verify` / `assert` — check a condition, panic/throw if false
- `calculate` — compute and return a value
- `build` — construct an object
- `save` / `persist` — write to storage
- `fetch` — retrieve from external source (chain, API)
- `emit` — publish an event

---

## 4. Code Review Checklist

Before submitting a PR, confirm:

- [ ] Tests were written before the implementation (TDD)
- [ ] All new public functions have at least one test
- [ ] Every function does one thing only
- [ ] Every function is named after what it does
- [ ] No function has side effects outside its stated purpose
- [ ] SOLID principles are followed
- [ ] CI passes (`cargo test` + `pnpm test`)
