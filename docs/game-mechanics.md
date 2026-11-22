# Game Mechanics

This document describes the full game mechanics of Starbound Realms.

---

## The Galaxy

The galaxy is a procedurally generated grid of star systems, initialized once when the `galaxy-map` contract is deployed. The grid size is configurable at deploy time (e.g. 20×20 = 400 systems).

Each star system has:

| Property | Description |
|---|---|
| `coord_x`, `coord_y` | Grid coordinates — determines adjacency for fleet movement |
| `owner` | Stellar address of the current owner, or unclaimed |
| `resource_type` | One of: Iron, Energy, Plasma |
| `resource_yield` | Amount of resources produced per mining cycle (10–50 units) |
| `defense_rating` | Base defense value (5–20), adds to defender fleet stats in battle |
| `upgrade_level` | Defensive upgrade level (0+), each level adds 5 to system defense in battle |
| `last_claimed` | Ledger timestamp of the last mining action |

---

## Claiming a System

Any player can claim an unclaimed star system by calling `galaxy-map.claim_system`. Requirements:
- The system must have no current owner
- The player must sign the transaction (Soroban auth enforced)

Once claimed, the system appears in the player's owned systems list and begins producing resources.

---

## Resources

Three resource types exist, each issued as a native Stellar asset:

| Resource | Symbol | Primary use |
|---|---|---|
| Iron | `IRON` | Build Scout, Fighter, Cruiser units |
| Energy | `NRGY` | Build Dreadnoughts, power fleet movement |
| Plasma | `PLSM` | Advanced units and future upgrades |

Since they are real Stellar assets, players can:
- Hold them in their Freighter wallet
- Trade them freely on the Stellar DEX
- Send them to other players

**Trustlines (one-time setup):** because these are classic Stellar assets, a player's account must trust each
one before it can receive any. Without that, a mint to the player fails with "trustline entry is missing". The
SDK's `ResourcesClient.establishTrustlines` creates all missing trustlines in a single transaction the player
signs, and does nothing if none are missing. In the app, a banner offers this once a wallet is connected; it
never prompts for a signature on its own.

**How resources are created today:** only through `resources.mint`, which is admin-only. There is no
player-callable mining function yet, so each system's `resource_yield` and `last_claimed` are stored but not
used. Passive mining (a player claiming their systems' yield) is planned, not implemented.

### Player trading

Players can create escrowed offers through the `resources` contract. The maker locks a positive amount
of one resource and specifies a positive amount of a different resource plus a future ledger timestamp
for expiry. Another player may accept before expiry; both token transfers occur in the same transaction.
The maker may cancel at any time, including after expiry, to recover the escrow. Offers cannot be
self-accepted, and expired offers are omitted from open-offer queries.

Offers and their lifecycle are stored on-chain. The contract exposes paginated open offers and emits
trade offered, accepted, and cancelled events. The SDK's `TradeClient` submits signed contract calls and
reads open offers from Soroban. The resources contract must be upgraded before trading is available.

---

## Fleets

Each player has one fleet, tracked by the `fleet` contract. Fleets are composed of units:

| Unit | Attack | Defense | Iron cost | Energy cost |
|---|---|---|---|---|
| Scout | 2 | 1 | 10 | 5 |
| Fighter | 5 | 3 | 25 | 15 |
| Cruiser | 12 | 8 | 60 | 40 |
| Dreadnought | 30 | 20 | 150 | 100 |

**Building units:** Players call `fleet.build_unit`, spending resources from their balance. Units are added to their fleet immediately.

**Moving fleets:** Players call `fleet.move_fleet` to move to an adjacent system. Movement has a 60-second cooldown between moves.

- If the target system is **unclaimed** — the fleet moves and the player can claim it
- If the target system is **owned by another player** — the fleet moves there; moving doesn't fight
  automatically, see Battle below

---

## Battle

Battle is a separate, explicit action: a player calls `battle.resolve_battle(attacker, defender, system_id)`
directly, naming the system's current owner as the defender. It has no location requirement — an attacker's
fleet can be anywhere and still attack any system owned by someone else. (`fleet.move_fleet` only ever moves
a fleet; it never calls into the battle contract.)

**Resolution algorithm:**

1. Load attacker's total attack power (sum of all unit attack values). Each unit type counters one other type
   (Scout → Dreadnought → Cruiser → Fighter → Scout): a unit's attack is boosted 50% while the defender fleet
   contains its counter type. This matchup rule is proposed, see [seasonal-reset-design.md](seasonal-reset-design.md)
2. Load defender's total defense power (sum of unit defense values + system `defense_rating` + system `upgrade_level` × 5)
3. Run combat rounds using Soroban `Prng` (seeded per ledger — verifiable, not manipulable):
   - Each round both sides roll
   - Losing side of the round loses units proportional to damage dealt
4. Repeat until one side has no units remaining, or max rounds (20) reached
5. Winner is determined:
   - **Attacker wins** → `galaxy-map.transfer_ownership` is called, attacker takes the system
   - **Defender wins** → system stays, attacker fleet is reduced
6. Battle record is written to contract storage and emitted as a `battle_resolved` event

**Why on-chain randomness?** Soroban's `Prng` is seeded by the ledger sequence + contract address. Outcomes are deterministic given the same inputs and independently verifiable. Players cannot game the randomness by timing their transactions.

---

## System Upgrades

System owners can spend Plasma resources to increase a system's defensive capability. Each upgrade level raises the system's defense value by 5 points, stacking additively with the system's base `defense_rating`.

**How to upgrade:**
- Call `galaxy-map.upgrade_system(system_id)` with Plasma in your wallet
- Cost increases per level: `100 × (current_level + 1)` Plasma
- For example: level 0→1 costs 100 Plasma, level 1→2 costs 200 Plasma, etc.

**Effect on combat:**
- Each upgrade adds 5 defense points to the system
- Defenders attacking a system with upgrade_level 3 gain +15 defense in battle (3 × 5)
- Higher-level systems are significantly harder to conquer, creating strategic value in defending and upgrading

**On-chain events:** When a system is upgraded, a `upgraded` event is emitted with `(system_id, new_upgrade_level, cost_paid)`.

---

## Winning

There is no hard win condition — the galaxy is persistent. Players compete for:

- **Most systems owned** — tracked on the leaderboard
- **Most battles won** — tracked per player
- **Resource dominance** — players with high-yield systems accumulate resources faster

---

## Future Mechanics (open for contributors)

- **Alliance system** — players form alliances, share system defense
- **Resource yield upgrades** — spend Plasma to increase a system's resource production rate
- **Fleet specializations** — unit type bonuses against specific enemies
- **Seasonal resets** — optional governance-triggered galaxy resets (proposal: [seasonal-reset-design.md](seasonal-reset-design.md))

---

## Random Galaxy Events (#205)

The galaxy supports a periodic random-event system that creates emergent threats and
opportunities without player input. Any account may call `galaxy-map.trigger_random_event`
to attempt to fire an event; a per-contract cooldown (720 ledgers ≈ 1 hour) prevents
spam.

### Event list

| Event | Effect on the targeted system | On-chain emission |
|---|---|---|
| **Pirate raid** | Reduces `defense_rating` by 3 (floored at 1) until the next event cycle | `pirate_raid(system_id, magnitude)` |
| **Resource surge** | Increases `resource_yield` by 10 until the next event cycle | `resource_surge(system_id, bonus)` |

### Trigger mechanism

- **Who calls it**: anyone (the function is permissionless). In practice a cron job
  or a motivated player calls it once an hour.
- **Cooldown**: stored as `LastEventLedger` in contract instance storage. If fewer
  than 720 ledgers have elapsed since the last trigger, the call is a no-op and
  returns `false`.
- **Randomness**: Soroban `Prng`, seeded by the current ledger sequence and contract
  address (the same pattern used in `contracts/battle/src/lib.rs`). The target system
  id is `prng.u64_in_range(0..total_systems)` and the event type rolls `prng.u64_in_range(0..2)`.
  Outcomes are deterministic given the same ledger inputs and independently verifiable.
- **Where it lives**: `contracts/galaxy-map/src/lib.rs` — the event modifies `StarSystem`
  fields that already exist on that struct, so no new contract is needed.

### Backend indexing (#207)

A `galaxy_events` table records every on-chain occurrence. The processor handles
`pirate_raid` and `resource_surge` topics and writes `(event_type, system_id, magnitude,
ledger_sequence)` rows. `GET /events` returns recent occurrences paginated like `GET /battles`.

