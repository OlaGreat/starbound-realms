# Contract Event Catalog

## Overview

Starbound Realms contracts emit events that the backend indexer listens to and writes to PostgreSQL. This document is the single source of truth for every event: its shape, what emits it, what handles it, and how to build against it.

All events are keyed by their topic (first element of `event.topic[]`). The event value payload is decoded based on the topic.

---

## Galaxy Map Contract

### Event: `claimed`

**Emitted by:** `claim_system(player: Address, system_id: u32)`

**Topic shape:**
```
[0] = "claimed" (Symbol)
[1] = player (Address)
```

**Value shape:**
```
system_id (u32)
```

**When:** A player claims an unclaimed system.

**Handler:** `processSystemClaimed` in `backend/src/indexer/processor.ts`

**Database impact:** Inserts/updates `star_systems` table, increments `players.systems_owned`.

**Example:**
```json
{
  "topic": ["claimed", "GA..."],
  "value": 42
}
```

---

### Event: `transfer`

**Emitted by:**
- `transfer_ownership(caller: Address, system_id: u32, new_owner: Address)` (player-initiated)
- `transfer_ownership_after_battle(caller: Address, system_id: u32, new_owner: Address)` (battle-initiated)

**Topic shape:**
```
[0] = "transfer" (Symbol)
[1] = system_id (u32)
```

**Value shape:**
```
(old_owner: Option<Address>, new_owner: Address)
```

**When:** A system changes hands (via player transfer or battle victory).

**Handler:** `processOwnershipTransferred` in `backend/src/indexer/processor.ts`

**Database impact:** Updates `star_systems.owner`, adjusts `players.systems_owned` for both old and new owner.

**Example:**
```json
{
  "topic": ["transfer", 42],
  "value": ["GB...", "GC..."]
}
```

---

## Resources Contract

### Event: `minted`

**Emitted by:** `mint(to: Address, resource: ResourceType, amount: i128)` (admin-only)

**Topic shape:**
```
[0] = "minted" (Symbol)
[1] = to (Address)
```

**Value shape:**
```
(resource: ResourceType, amount: i128)
```

**Where ResourceType:**
```
0 = Iron
1 = Energy
2 = Plasma
```

**When:** The admin mints tokens (usually during initialization or for special events).

**Handler:** `processResourceMinted` in `backend/src/indexer/processor.ts`

**Database impact:** Inserts into `resource_events` table with event_type='mint'.

**Example:**
```json
{
  "topic": ["minted", "GA..."],
  "value": [0, 1000000]
}
```

---

### Event: `mined`

**Emitted by:** `mine(player: Address, system_id: u32) -> i128`

**Topic shape:**
```
[0] = "mined" (Symbol)
[1] = player (Address)
```

**Value shape:**
```
(system_id: u32, resource: ResourceType, amount: i128)
```

**When:** A player successfully mines resources from a system they own.

**Handler:** `processResourceMined` in `backend/src/indexer/processor.ts`

**Database impact:** Inserts into `resource_events` table with event_type='mine'.

**Example:**
```json
{
  "topic": ["mined", "GA..."],
  "value": [42, 1, 500]
}
```

---

### Event: `burned`

**Emitted by:** `burn(from: Address, resource: ResourceType, amount: i128)` (player-initiated via SAC)

**Topic shape:**
```
[0] = "burned" (Symbol)
[1] = from (Address)
```

**Value shape:**
```
(resource: ResourceType, amount: i128)
```

**When:** A player spends resources (building units, etc.).

**Handler:** `processResourceBurned` in `backend/src/indexer/processor.ts`

**Database impact:** Inserts into `resource_events` table with event_type='burn'.

**Example:**
```json
{
  "topic": ["burned", "GA..."],
  "value": [0, 250]
}
```

---

## Fleet Contract

### Event: `built`

**Emitted by:** `build_unit(player: Address, unit_type: UnitType, count: u32)`

**Topic shape:**
```
[0] = "built" (Symbol)
[1] = player (Address)
```

**Value shape:**
```
(unit_type: UnitType, count: u32)
```

**Where UnitType:**
```
0 = Scout
1 = Fighter
2 = Cruiser
3 = Dreadnought
```

**When:** A player builds units.

**Handler:** Currently not handled in `processor.ts`

**Database impact:** Could be recorded in a hypothetical `unit_builds` table (not yet implemented).

**Example:**
```json
{
  "topic": ["built", "GA..."],
  "value": [1, 5]
}
```

---

### Event: `deployed`

**Emitted by:** `deploy_fleet(player: Address, system_id: u32)`

**Topic shape:**
```
[0] = "deployed" (Symbol)
[1] = player (Address)
```

**Value shape:**
```
system_id (u32)
```

**When:** A player deploys their fleet to a system for the first time.

**Handler:** Currently not handled in `processor.ts`

**Database impact:** Could be recorded in a hypothetical `deployments` table (not yet implemented).

**Example:**
```json
{
  "topic": ["deployed", "GA..."],
  "value": 42
}
```

---

### Event: `moved`

**Emitted by:** `move_fleet(player: Address, target_system_id: u32)`

**Topic shape:**
```
[0] = "moved" (Symbol)
[1] = player (Address)
```

**Value shape:**
```
(from_system_id: u32, to_system_id: u32)
```

**When:** A player moves their fleet to an adjacent system.

**Handler:** Currently not handled in `processor.ts`

**Database impact:** Could be recorded in a hypothetical `fleet_movements` table (not yet implemented).

**Example:**
```json
{
  "topic": ["moved", "GA..."],
  "value": [42, 43]
}
```

---

### Event: `losses` (or `applied_losses`)

**Emitted by:** `apply_battle_losses(caller: Address, player: Address, losses: Fleet)` (called by Battle contract)

**Topic shape:**
```
[0] = "losses" (Symbol)
[1] = player (Address)
```

**Value shape:**
```
(scouts_lost: u32, fighters_lost: u32, cruisers_lost: u32, dreadnoughts_lost: u32)
```

**When:** A player's fleet is damaged in a battle.

**Handler:** `processFleetLosses` in `backend/src/indexer/processor.ts`

**Database impact:** Updates `fleet_snapshots` table, applies losses to the player's fleet.

**Example:**
```json
{
  "topic": ["losses", "GA..."],
  "value": [3, 1, 0, 0]
}
```

---

## Battle Contract

### Event: `battle_resolved`

**Emitted by:** `resolve_battle(attacker: Address, defender: Address, system_id: u32) -> u64`

**Topic shape:**
```
[0] = "battle_resolved" (Symbol)
[1] = attacker (Address)
```

**Value shape:**
```
{
  "battle_id": u64,
  "attacker": Address,
  "defender": Address,
  "system_id": u32,
  "winner": Address,
  "rounds": u32
}
```

**Note:** Field names match the Rust struct (snake_case), not JavaScript naming.

**When:** A battle is resolved (attacker and defender fleets clash).

**Handler:** `processBattleResolved` in `backend/src/indexer/processor.ts`

**Database impact:** Inserts into `battles` table, updates player win/loss counts.

**Example:**
```json
{
  "topic": ["battle_resolved", "GA..."],
  "value": {
    "battle_id": 1,
    "attacker": "GA...",
    "defender": "GB...",
    "system_id": 42,
    "winner": "GA...",
    "rounds": 7
  }
}
```

---

## Unhandled Events

The following events are emitted by contracts but not currently handled by the indexer:

| Event | Contract | Reason | Status |
|---|---|---|---|
| `built` | Fleet | Tracking individual unit builds is optional for the MVP | Not yet handled |
| `deployed` | Fleet | Tracking deployments is optional | Not yet handled |
| `moved` | Fleet | Tracking fleet movements is optional | Not yet handled |

**To implement:** Add handlers in `backend/src/indexer/processor.ts` and corresponding database tables.

---

## Decoding Events in JavaScript

### Example: Parsing a `mined` event

```typescript
// Raw event from Soroban RPC
const rawEvent = {
  contractId: "CBATTLE789ABC...",
  topic: ["mined", "GA..."],
  value: [42, 1, 500],  // system_id, ResourceType, amount
  ledgerSequence: 12345
};

// Decode
const topic = rawEvent.topic[0];  // "mined"
const player = rawEvent.topic[1]; // "GA..."
const [systemId, resourceType, amount] = rawEvent.value;

console.log(`${player} mined ${amount} units of resource ${resourceType} from system ${systemId}`);
```

### Example: Parsing a `battle_resolved` event

```typescript
const rawEvent = {
  contractId: "CBATTLE789ABC...",
  topic: ["battle_resolved", "GA..."],
  value: {
    battle_id: 1,
    attacker: "GA...",
    defender: "GB...",
    system_id: 42,
    winner: "GA...",
    rounds: 7
  },
  ledgerSequence: 12346
};

const { battle_id, attacker, defender, system_id, winner, rounds } = rawEvent.value;
console.log(`Battle ${battle_id}: ${attacker} defeated ${defender} in ${rounds} rounds. ${winner} now owns system ${system_id}.`);
```

---

## Event Ordering Guarantees

- **Within a single ledger:** Events are emitted in the order contracts were called.
- **Across ledgers:** No ordering guarantee. Event A from ledger 1000 may be processed before Event B from ledger 999.
- **Implications:** The indexer must be idempotent; re-processing the same event twice should not corrupt state.

---

## Backfill and Reprocessing

If the indexer crashes or is redeployed, it re-processes events from the last saved ledger. This may replay some events:

1. The indexer reads `IndexerCursor.ledger_sequence`.
2. It fetches events starting from that ledger.
3. It re-processes them and updates the cursor.

**Important:** All event handlers must be idempotent. Processing the same event twice should not duplicate database rows or corrupt counts.

**Current mitigation:** Use `ON CONFLICT ... DO UPDATE` in database inserts, or upsert by (player, system_id, timestamp).

---

## Adding a New Event

If you add a new event to a contract:

1. **Define the event in Rust:**
   ```rust
   env.events().publish((symbol_short!("my_event"), player), data);
   ```

2. **Add a handler in `processor.ts`:**
   ```typescript
   case 'my_event':
     await processMyEvent(db, event);
     break;
   ```

3. **Implement the handler:**
   ```typescript
   async function processMyEvent(db: Pool, event: ContractEvent): Promise<void> {
     const player = event.topic[1];
     const data = event.value;
     // Write to database
   }
   ```

4. **Document it here** (this file).

---

## Schema Reference

### Tables Updated by Events

| Event | Table | Operation |
|---|---|---|
| `claimed`, `transfer` | `star_systems` | INSERT/UPDATE |
| `claimed`, `transfer` | `players` | UPDATE (systems_owned) |
| `minted`, `burned`, `mined` | `resource_events` | INSERT |
| `battle_resolved` | `battles` | INSERT |
| `battle_resolved` | `players` | UPDATE (wins/losses) |
| `losses` | `fleet_snapshots` | UPDATE |

For exact column names and types, see `backend/src/db/schema.sql`.

---

## Testing Events

To generate test events locally:

```bash
cd contracts/galaxy-map
cargo test --test integration_tests
```

This runs the contract's test suite and emits events into the Soroban test environment. You can inspect them via `env.events().all()`.
