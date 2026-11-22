# Threat Model for Starbound Realms Contracts

## Overview

This document outlines the security properties and threats for each of the four smart contracts in Starbound Realms. It is intended for contributors, auditors, and operators to understand what an attacker could do, what mitigates those risks, and what remains unmitigated.

---

## Galaxy Map Contract

### Design

The Galaxy Map contract owns all star systems in the game. It is authoritative for system ownership and resource yields. Only the Galaxy Map can emit `claimed` and `transfer` events, and only the Battle contract can force ownership transfers (after a battle).

### Threat Model

| Threat | Attacker Profile | Attack | Impact | Mitigation | Status |
|---|---|---|---|---|---|
| Claim infinite systems | Player with XLM | Exhaust grid by calling `claim_system` on all 10,000 systems | None; anyone can claim any unclaimed system | None — this is intentional game design. The first player to claim gets it. | Accepted |
| Transfer system without ownership | Player A | Call `transfer_ownership` for a system owned by Player B | Player A does not own it; `verify_system_is_owned_by` panics | Caller authorization check + ownership verification | Mitigated |
| Unregistered contract forces ownership transfer | Attacker | Call `transfer_ownership_after_battle` without being registered as the battle contract | Only the battle contract can call it; `verify_caller_is_battle_contract` panics | Caller must be pre-registered via `set_battle_contract` (admin-only) | Mitigated |
| Admin account compromised | Attacker with admin key | Call `set_battle_contract` with attacker's contract address | Attacker can then force arbitrary transfers via fake battles | Admin key is in cold storage on mainnet; dev keys rotate frequently | Mitigated (key management) |
| System data corruption via DoS | Network partition | Indexer falls behind, database loses ledger sequence | Frontend shows stale data for hours | Manual recovery via indexer runbook; alerts on lag | Partially mitigated |
| Replay attack on `claim_system` | Network observer | Capture and re-broadcast a signed claim transaction | Soroban's replay prevention (nonce, sequence number) prevents it | Soroban SDK enforces replay prevention built-in | Mitigated |

### Key Invariants

1. **Only the owner (or the battle contract as owner) can transfer a system.**
   - Enforced by `verify_system_is_owned_by` and `verify_caller_is_battle_contract`.
2. **Only unclaimed systems can be claimed.**
   - Enforced by check: `if system.owner.is_some() { panic!("system already owned") }`.
3. **The battle contract is immutable after initialization.**
   - Enforced by lack of a function to change it. If wrong contract is set, admin must redeploy.

---

## Resources Contract

### Design

The Resources contract mints three Stellar Asset Contract (SAC) tokens: Iron, Energy, and Plasma. It allows:
- Admins to mint tokens directly (for initialization).
- Players to mine tokens from systems they own (via the `mine` function).
- Anyone to burn tokens (delegated to the SAC).

### Threat Model

| Threat | Attacker Profile | Attack | Impact | Mitigation | Status |
|---|---|---|---|---|---|
| Unlimited token minting | Attacker or compromised admin | Call `mint` with arbitrary amounts | Hyperinflation; tokens become worthless | Only admin can call `mint`; restricted to initialization | Mitigated (access control) |
| Mine from system not owned | Player A | Call `mine` for a system owned by Player B | `verify_player_owns_system` panics; minting fails | Ownership check in `mine` before minting | Mitigated |
| Mine twice in one period | Player | Call `mine` twice within MINING_PERIOD_SECONDS (300s) | Returns error: "nothing to mine yet"; no tokens minted | The contract tracks `LastMined` and enforces the period | Mitigated |
| Token transfer to wrong player | Backend indexer bug | Processor writes mined resources to wrong account | Player gets tokens they didn't earn | Backend is not part of the contract; this is an indexer/backend bug | Unmitigated (out of scope) |
| Infinite mining by calling mine on each block | Player | Call `mine` once per block indefinitely | Tokens accumulate until system degradation | The `mine` function requires 300s between calls per system; rate-limited | Mitigated |
| Burn more tokens than owned | Player | The SAC checks balance; insufficient funds panic | Mitigated (delegated to SAC) | The underlying Stellar Asset Contract | Mitigated |

### Key Invariants

1. **Only the admin can mint tokens.**
   - Enforced by check: `admin.require_auth()`.
2. **Only the system owner can mine.**
   - Enforced by `verify_player_owns_system`.
3. **Tokens can only be mined every 300 seconds per system.**
   - Enforced by tracking `LastMined(system_id)` and checking `periods > 0`.

---

## Fleet Contract

### Design

The Fleet contract manages unit inventories for each player. It allows players to:
- Build units (at a resource cost).
- Deploy their fleet to a system they own.
- Move their fleet to adjacent systems (with a cooldown).

The Battle contract is the only entity that can reduce a player's fleet (via `apply_battle_losses`).

### Threat Model

| Threat | Attacker Profile | Attack | Impact | Mitigation | Status |
|---|---|---|---|---|---|
| Build infinite units for free | Player | Call `build_unit` without spending resources | Contract calls `burn_build_cost`, which calls the Resources contract; burn fails if balance is insufficient | Resources contract enforces balance checks | Mitigated |
| Deploy fleet to system not owned | Player A | Call `deploy_fleet` for a system owned by Player B | `verify_player_owns_system` panics; deployment fails | Ownership check before state mutation | Mitigated |
| Move fleet to non-adjacent system | Player | Call `move_fleet` to system 50 squares away | `verify_systems_are_adjacent` checks Manhattan distance; panic if not adjacent | Adjacency check enforced | Mitigated |
| Move fleet twice in one cooldown | Player | Call `move_fleet`, wait 30 seconds, call again | Cooldown is 60 seconds; second call panics: "cooldown not elapsed" | Timestamp check: `verify_cooldown_has_elapsed` | Mitigated |
| Unregistered contract applies losses | Attacker | Call `apply_battle_losses` without being the battle contract | Only the registered battle contract can call it; `verify_caller_is_battle_contract` panics | Caller must be pre-registered via `set_battle_contract` (admin-only) | Mitigated |
| Deploy fleet twice | Player | Call `deploy_fleet` twice | Second call panics: "fleet already deployed" | Check: `verify_fleet_is_not_deployed` | Mitigated |
| Reduce fleet below zero | Battle contract (or attacker pretending to be it) | Call `apply_battle_losses` with losses > current fleet | Uses `saturating_sub`, so units cannot go below 0 | Saturating subtraction ensures non-negative fleet size | Mitigated |

### Key Invariants

1. **Only the owner of a system can deploy a fleet there.**
   - Enforced by `verify_player_owns_system`.
2. **Fleets can only move to adjacent systems.**
   - Enforced by `verify_systems_are_adjacent`.
3. **Fleets can move at most once per 60 seconds.**
   - Enforced by `verify_cooldown_has_elapsed`.
4. **Only the battle contract can reduce a fleet.**
   - Enforced by `verify_caller_is_battle_contract`.

---

## Battle Contract

### Design

The Battle contract is the game logic engine. It:
1. Accepts a battle request from an attacker (attacker's fleet vs. defender's fleet + system defense bonus).
2. Runs combat rounds using Soroban's PRNG.
3. Determines a winner and applies losses to both fleets.
4. Transfers system ownership to the winner (via Galaxy Map).
5. Emits a `battle_resolved` event.

The contract does not hold any tokens or systems; it only orchestrates calls to other contracts.

### Threat Model

| Threat | Attacker Profile | Attack | Impact | Mitigation | Status |
|---|---|---|---|---|---|
| Attacker with empty fleet fights | Player | Call `resolve_battle` with an empty fleet | `verify_fleet_is_not_empty` panics; no battle occurs | Fleet must have at least one unit | Mitigated |
| Defender doesn't own the system | Attacker | Call `resolve_battle` for a system owned by Player C, claiming to fight Player B | `verify_defender_owns_system` panics; defender is checked | Defender-system ownership verified | Mitigated |
| Influencing combat rolls (PRNG) | On-chain observer | Analyze contract code to predict the PRNG sequence | Soroban's PRNG is seeded per-ledger from the network; externally unpredictable within a single ledger | Soroban PRNG design; unpredictable per-ledger | Mitigated (design) |
| Timing attack (waiting for favorable PRNG) | Attacker | Delay transaction submission to target a "good" PRNG seed | Each new ledger has a new seed; delaying shifts the battle to a future ledger with a different seed. Attacker has no control over the seed. | Soroban re-seeds on each ledger | Mitigated |
| Battle ID collision | Attacker or accidental | Two battles assigned the same battle_id | Each `resolve_battle` call increments `NextBattleId`; collision impossible | Monotonic ID assignment | Mitigated |
| Calling battle from a contract | Attacker contract | Submit a battle on behalf of another player without their signature | `attacker.require_auth()` forces the attacker to sign; contract cannot bypass this | Caller authorization required | Mitigated |
| A defeated player calls `resolve_battle` again on the same system | Player | Fight the same system twice in one transaction sequence | Each call increments NextBattleId and stores the result. The player could fight twice, but ownership is determined by the latest battle_id. The battle contract prevents the same player from fielding a fleet at two different locations simultaneously (fleet has one location). | Fleet has one location; a player can only be involved in one battle at a time | Partially mitigated (enforced by fleet state) |

### Key Invariants

1. **Both fleets must be non-empty to battle.**
   - Enforced by `verify_fleet_is_not_empty` for both attacker and defender.
2. **The defender must own the system being attacked.**
   - Enforced by `verify_defender_owns_system`.
3. **Battle results are deterministic given the PRNG seed.**
   - Enforced by the combat algorithm; multiple runs with the same seed produce identical results.
4. **Battle IDs are unique and monotonically increasing.**
   - Enforced by `NextBattleId` counter.
5. **Only the winner gains the system.**
   - Enforced by conditional transfer: `if attacker_wins { galaxy_map.transfer_ownership_after_battle(...) }`.

---

## Cross-Contract Assumptions

### Chain of Trust

1. **Galaxy Map** is authoritative for system ownership.
2. **Resources** contract trusts Galaxy Map's `get_system` for ownership.
3. **Fleet** contract trusts Galaxy Map for system ownership (via `deploy_fleet`).
4. **Battle** contract trusts Galaxy Map for system ownership (via `resolve_battle`) and trusts Fleet for fleet state.

### Admin Role

All four contracts share the same `admin` address. If the admin key is compromised:
- An attacker can call all admin-only functions across all contracts.
- An attacker could mint infinite tokens, change the battle contract, or reassign systems.

**Mitigation:** Admin key is in cold storage on mainnet; dev keys rotate frequently.

### Backend Indexer

The backend indexer listens to contract events and writes to PostgreSQL. If the indexer is compromised:
- It can corrupt the cache (but not the authoritative on-chain state).
- Players see stale or false data until the indexer is corrected.

**Mitigation:** Indexer writes are auditable; a re-index from the ledger corrects any corruption.

---

## Attack Scenarios

### Scenario 1: Player A floods the network with claim transactions

**Attack:** Player A writes a script to claim all systems as fast as the network allows.

**Outcome:** Player A claims most systems before anyone else. The game becomes unbalanced.

**Verdict:** This is not a security issue; it's a game design issue. If desired, add a cooldown between claims or a limit on systems per player in the game logic.

---

### Scenario 2: Player B discovers they were defeated in an unfair battle

**Attack:** Player B claims the PRNG was biased or a contract bug caused them to lose unfairly.

**Investigation:**
1. Retrieve the `BattleResult` from `get_battle`.
2. Re-run the combat algorithm with the same inputs and PRNG seed (available from the ledger).
3. If the recorded result differs, the contract has a bug.

**Mitigation:** All battles are deterministic and auditable; run the combat algorithm off-chain to verify.

---

### Scenario 3: Backend indexer crashes; frontend is offline

**Attack:** Network partition; indexer cannot reach Soroban RPC or PostgreSQL crashes.

**Outcome:** Players see a blank screen. Frontend is unreachable.

**Mitigation:** Restart the indexer and backend. The indexer catches up from the last saved cursor. See the [indexer lag runbook](./runbook-indexer-lag.md).

---

### Scenario 4: Admin key is stolen

**Attack:** Attacker gains the private key for the admin account.

**Outcome:** Attacker can mint infinite tokens, redirect the battle contract to a malicious address, or reassign all systems.

**Mitigation:** This is a key management issue, not a contract issue. On mainnet, the admin key is in cold storage and not used except for emergencies. If compromised, redeploy all contracts with a new admin key.

---

## Summary Table

| Component | Criticality | Risk Level | Mitigation Status |
|---|---|---|---|
| Galaxy Map | Critical | Low | Fully mitigated (authorization + verification) |
| Resources | Critical | Low | Fully mitigated (authorization + balance checks) |
| Fleet | High | Low | Fully mitigated (authorization + state checks) |
| Battle | High | Low | Fully mitigated (deterministic, auditable) |
| Admin Key | Critical | Medium | Key management (cold storage on mainnet) |
| Backend Indexer | Medium | Medium | Auditable; can be re-indexed |
| PRNG Fairness | High | Low | Soroban design (per-ledger seed) |

---

## Recommendations for Auditors

1. **Code Review:** Verify all authorization checks (require_auth) are enforced.
2. **State Verification:** Ensure invariants hold (ownership, cooldowns, fleet state).
3. **Cross-Contract Calls:** Verify callers are correct and results are validated.
4. **PRNG Usage:** Confirm the combat algorithm is deterministic and fair.
5. **Backend Testing:** Simulate the indexer with event loss and verify recovery.

---

## Future Hardening

- Add a time-lock delay to admin-only functions (e.g., 48-hour delay before `set_battle_contract` takes effect).
- Implement multi-sig for the admin role.
- Add emergency pause functions to all contracts.
- Implement a permit system to prevent replay of old transactions.
