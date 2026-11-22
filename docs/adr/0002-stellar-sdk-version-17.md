# ADR-0002: Upgrade to Stellar SDK v17

## Status

Accepted

## Context

The project initially used Stellar SDK v13 for backend and frontend components. When implementing classic transaction
write confirmations (a feature requiring parsing classic transaction envelopes from Soroban event logs), the SDK v13
did not reliably parse these transaction types. Upgrading to a newer SDK version became necessary.

## Decision

Upgrade `@stellar/stellar-sdk` from v13 to v17 across the backend and SDK packages.

**Changes:**
- Updated backend `@stellar/stellar-sdk` dependency from 13 to 17
- Updated SDK package `@stellar/stellar-sdk` from 13 to 17
- Removed unused direct `@stellar/stellar-sdk` dependency from frontend (relied on transitive dependency)
- Updated code to use SDK v17 APIs for transaction parsing

## Consequences

### Positive
- Classic transaction envelope parsing now works reliably
- Access to bug fixes and performance improvements in v17
- Better compatibility with current Stellar ecosystem tooling
- Cleaner SDK interfaces for transaction handling

### Negative
- Potential breaking changes in SDK v17 API (required code updates)
- Increased bundle size for backend
- Dependency on a newer version tied to continued Stellar maintenance

## Related Issues/PRs

- #15: "Upgrade @stellar/stellar-sdk 13 → 17"
- Enables write confirmation parsing for Soroban-based transaction tracking
