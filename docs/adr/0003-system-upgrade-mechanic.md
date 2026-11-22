# ADR-0003: System Upgrade Mechanic for Defense Scaling

## Status

Accepted

## Context

As the game evolved, players needed ways to invest in systems beyond initial claim. The existing combat system relied
solely on base `defense_rating` (5–20, determined at system generation) and fleet composition. Without player-driven
investment, all systems felt static and there was limited strategic depth around system ownership.

The question arose: should systems have an upgrade path, and if so, what should it improve?

## Decision

Introduce a system upgrade mechanic where owners can spend Plasma resources to increase a system's defensive capability.

**Key Design Points:**
- **Cost structure:** 100 Plasma × (current_level + 1), so level 0→1 costs 100, level 1→2 costs 200, etc.
- **Effect:** Each upgrade level adds 5 defense points directly to system defense in battle calculations
- **Scaling:** Defense grows quadratically in cost but linearly in effect, creating decision points
- **Availability:** Any owner can upgrade their system at any time (no cooldown)

**Implementation:**
- Added `upgrade_level` field to `StarSystem` struct across all contracts
- Battle resolution updated to calculate: `defense = defense_rating + (upgrade_level × 5)`
- `galaxy-map.upgrade_system()` function validates ownership and deducts cost

## Consequences

### Positive
- Gives players agency and strategic options for defending valuable systems
- Creates a Plasma sink (balances resource economy)
- Scales naturally: wealthy players invest more, but costs grow—preventing runaway dominance
- Encourages long-term system ownership as an investment
- Opens future expansion: yield upgrades, unit bonuses, etc.

### Negative
- Wealthy players have inherent advantage in defense (more resources → more upgrades)
- Could lead to "snowball" scenarios if not balanced carefully
- Adds complexity to on-chain state (more data per system)
- Must carefully tune cost curve to avoid making upgrades trivial or prohibitive

## Related Issues/PRs

- #83: "Design proposal for system upgrade mechanic"
- #84: "Add upgrade_level stat boosts and upgrade handling to StarSystem"
