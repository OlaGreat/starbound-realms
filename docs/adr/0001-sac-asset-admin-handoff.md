# ADR-0001: Hand Resource Asset Admin to Resources Contract

## Status

Accepted

## Context

Resources (Iron, Energy, Plasma) are issued as native Stellar classic assets. Initially, an external admin
controlled minting for all three assets. As the game matured, the need arose to give the `resources` contract
itself the ability to mint resources (e.g., for future passive mining features or governance-controlled mints),
rather than relying on external admin intervention.

## Decision

Transfer asset admin rights from an external address to the `resources` smart contract itself. This is achieved
via Stellar's `SetOptions` operation (admin-only operation on classic assets) that changes the asset's admin
signer to point to the contract's Soroban address.

**Changes:**
- `resources` contract redeployed with admin capabilities
- Asset admin changed to the new `resources` contract address
- Admin minting now callable only by the contract itself via `resources.mint`

## Consequences

### Positive
- Contract has trustless control over resource minting
- Enables future automation (passive mining, governance-triggered resource distribution)
- Removes dependency on external key management for asset control
- More transparent: all mint operations flow through on-chain contract code

### Negative
- If a bug exists in the `resources` contract, it could affect all three assets
- Minting authority is now tied to contract deployment; redeployment requires careful migration
- Requires careful coordination between Stellar classic asset operations and Soroban contract deployment

## Related Issues/PRs

- #16: "Hand asset admin to resources contract"
- #137: "Confirm admin mint works after SAC admin handoff"
