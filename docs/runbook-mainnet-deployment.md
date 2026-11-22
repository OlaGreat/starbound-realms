# Mainnet Deployment Runbook

## Overview

This runbook covers deploying Starbound Realms to Stellar mainnet. It assumes:
- You have deployer keys on mainnet with sufficient XLM for fees.
- PostgreSQL is set up and reachable.
- All contract WASM binaries are built and ready.

The deployment order matters: contracts must be initialized in a specific sequence because later contracts depend on earlier ones.

---

## Pre-Deployment Checklist

### 1. Environment Validation

```bash
# Verify Stellar network access
stellar network ls

# Set active network to mainnet
stellar network use public

# Verify deployer account exists and has XLM
stellar account balance --source-account deployer

# Should output: Account balance: X.XX XLM
# Minimum recommended: 10 XLM (covers ~200 deployments)
```

### 2. Build All Contracts

```bash
cd contracts
cargo build --release --target wasm32-unknown-unknown
cd ..

# Verify all WASMs exist
ls -lh target/wasm32-unknown-unknown/release/*.wasm
```

You should see four files:
- `galaxy_map.wasm`
- `resources.wasm`
- `fleet.wasm`
- `battle.wasm`

### 3. Backup Current Mainnet State (If Upgrading)

If you are deploying on top of existing contracts, back up the current contract IDs and admin keys:

```bash
# Record current contract addresses and admin key
cat << EOF > mainnet-contracts-backup-$(date +%Y%m%d-%H%M%S).txt
GALAXY_MAP_CONTRACT=
RESOURCES_CONTRACT=
FLEET_CONTRACT=
BATTLE_CONTRACT=
ADMIN_ADDRESS=

# Backup Postgres
ADMIN_ADDRESS=<YOUR_MAINNET_ADMIN>
psql $DATABASE_URL -c "SELECT version();" || exit 1
echo "Database verified."
EOF

pg_dump $DATABASE_URL > mainnet-backup-$(date +%Y%m%d-%H%M%S).sql
```

### 4. Prepare Environment Variables

Create `.env.mainnet`:

```bash
export SOROBAN_RPC_URL="https://soroban-mainnet.stellar.org"
export STELLAR_NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"
export IDENTITY="deployer"
export ADMIN_ADDRESS="GXXX..." # Your admin Stellar account
```

Load it:
```bash
source .env.mainnet
```

---

## Deployment Sequence

### Phase 1: Deploy Galaxy Map

```bash
./scripts/deploy.sh galaxy-map mainnet
```

Capture the contract address from the output:
```
✅ Deployed to: CAB3CDEF123456...
```

Save it:
```bash
export CONTRACT_GALAXY_MAP="CAB3CDEF123456..."
```

### Phase 2: Deploy Resources

```bash
./scripts/deploy.sh resources mainnet
```

Capture the address:
```bash
export CONTRACT_RESOURCES="CXYZ9876543210..."
```

### Phase 3: Deploy Fleet

```bash
./scripts/deploy.sh fleet mainnet
```

Capture the address:
```bash
export CONTRACT_FLEET="CFLEET1234567..."
```

### Phase 4: Deploy Battle

```bash
./scripts/deploy.sh battle mainnet
```

Capture the address:
```bash
export CONTRACT_BATTLE="CBATTLE789ABC..."
```

### Phase 5: Initialize Contracts (In Order)

Galaxy Map (admin-only):
```bash
stellar contract invoke \
  --id $CONTRACT_GALAXY_MAP \
  --source-account $IDENTITY \
  --network public \
  -- initialize \
  --admin $ADMIN_ADDRESS \
  --grid_size 100
```

Resources (requires token addresses; Stellar Asset Contracts for mainnet):
```bash
# Get the Stellar Asset Contract addresses for IRON, ENERGY, PLASMA
# These must be pre-deployed classic assets on mainnet
export SAC_IRON="C..."
export SAC_ENERGY="C..."
export SAC_PLASMA="C..."

stellar contract invoke \
  --id $CONTRACT_RESOURCES \
  --source-account $IDENTITY \
  --network public \
  -- initialize \
  --admin $ADMIN_ADDRESS \
  --iron_token $SAC_IRON \
  --energy_token $SAC_ENERGY \
  --plasma_token $SAC_PLASMA
```

Fleet (admin-only):
```bash
stellar contract invoke \
  --id $CONTRACT_FLEET \
  --source-account $IDENTITY \
  --network public \
  -- initialize \
  --admin $ADMIN_ADDRESS \
  --resources_contract $CONTRACT_RESOURCES \
  --galaxy_map_contract $CONTRACT_GALAXY_MAP
```

Battle (admin-only):
```bash
stellar contract invoke \
  --id $CONTRACT_BATTLE \
  --source-account $IDENTITY \
  --network public \
  -- initialize \
  --admin $ADMIN_ADDRESS \
  --galaxy_map_contract $CONTRACT_GALAXY_MAP \
  --fleet_contract $CONTRACT_FLEET
```

### Phase 6: Wire Up Cross-Contract Calls

Galaxy Map needs to know the Battle contract:
```bash
stellar contract invoke \
  --id $CONTRACT_GALAXY_MAP \
  --source-account $IDENTITY \
  --network public \
  -- set_battle_contract \
  --caller $ADMIN_ADDRESS \
  --battle_contract $CONTRACT_BATTLE
```

Resources needs to know the Galaxy Map:
```bash
stellar contract invoke \
  --id $CONTRACT_RESOURCES \
  --source-account $IDENTITY \
  --network public \
  -- set_galaxy_map \
  --caller $ADMIN_ADDRESS \
  --galaxy_map $CONTRACT_GALAXY_MAP
```

Fleet needs to know the Battle contract:
```bash
stellar contract invoke \
  --id $CONTRACT_FLEET \
  --source-account $IDENTITY \
  --network public \
  -- set_battle_contract \
  --caller $ADMIN_ADDRESS \
  --battle_contract $CONTRACT_BATTLE
```

---

## Post-Deployment Verification

### 1. Check All Contracts Are Initialized

Galaxy Map (read grid size):
```bash
stellar contract invoke \
  --id $CONTRACT_GALAXY_MAP \
  --network public \
  -- get_grid_size
```

Should return a number > 0, e.g., `100`.

### 2. Check a System Exists

```bash
stellar contract invoke \
  --id $CONTRACT_GALAXY_MAP \
  --network public \
  -- get_system \
  --system_id 0
```

Should return a system object with owner, coordinates, and resources.

### 3. Test a Player Action (Optional)

Mint some resources to a test account:
```bash
stellar contract invoke \
  --id $CONTRACT_RESOURCES \
  --source-account $IDENTITY \
  --network public \
  -- mint \
  --to $ADMIN_ADDRESS \
  --resource Iron \
  --amount 1000
```

### 4. Configure Backend

Update `.env` in the backend to point to mainnet contracts:

```bash
DATABASE_URL=postgres://...
SOROBAN_RPC_URL=https://soroban-mainnet.stellar.org
STELLAR_NETWORK_PASSPHRASE=Public Global Stellar Network ; September 2015
CONTRACT_GALAXY_MAP=$CONTRACT_GALAXY_MAP
CONTRACT_RESOURCES=$CONTRACT_RESOURCES
CONTRACT_FLEET=$CONTRACT_FLEET
CONTRACT_BATTLE=$CONTRACT_BATTLE
INDEXER_POLL_INTERVAL_MS=5000
PORT=3000
```

Restart the backend:
```bash
systemctl restart starbound-backend
```

### 5. Configure Frontend

Update `.env` in the frontend:

```bash
VITE_BACKEND_URL=https://api.starbound-realms.com
VITE_SOROBAN_RPC_URL=https://soroban-mainnet.stellar.org
VITE_NETWORK_PASSPHRASE=Public Global Stellar Network ; September 2015
VITE_CONTRACT_GALAXY_MAP=$CONTRACT_GALAXY_MAP
VITE_CONTRACT_RESOURCES=$CONTRACT_RESOURCES
VITE_CONTRACT_FLEET=$CONTRACT_FLEET
VITE_CONTRACT_BATTLE=$CONTRACT_BATTLE
```

Redeploy the frontend.

---

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `Account does not exist` | Deployer account has no XLM on mainnet | Fund the account via exchange or Stellar account creator |
| `InsufficientFee` | Network fees spiked | Wait and retry, or increase fee |
| `contract not found` | Contract address is wrong or not yet confirmed | Verify address from deploy output, check block explorer |
| `initialize: already initialized` | You already ran initialize once | Do not initialize again; it's idempotent |
| `set_battle_contract: caller is not the admin` | Caller is not the admin address | Use the correct admin account from ADMIN_ADDRESS |
| `no data returned` | Contract call succeeded but returned nothing | This is normal for void functions |

---

## If Deployment Fails

### Partial Deployment (Some Contracts Deployed)

Do not re-deploy contracts that succeeded. Skip to the next contract and initialize it.

### Database Mismatch

If the backend indexer crashes during deployment, it may have a stale cursor:

```bash
psql $DATABASE_URL <<SQL
DELETE FROM indexer_cursor;
SQL
systemctl restart starbound-backend
```

### Rollback to Previous Deployment

If mainnet deployment is broken beyond repair:

1. Revert the frontend to the previous contract IDs (from the backup).
2. Update the backend `.env` to the previous contract IDs.
3. Restart both services.
4. Contact the maintainers to audit what went wrong.

---

## Monitoring Post-Deployment

- **Backend health:** `curl https://api.starbound-realms.com/leaderboard | head -20`
- **Indexer lag:** Check the indexer cursor using the [indexer lag runbook](./runbook-indexer-lag.md)
- **Player feedback:** Monitor Slack/Discord for game issues

---

## Success Criteria

- [ ] All four contracts deployed and initialized
- [ ] Contract calls succeed and return data
- [ ] Backend indexer catches up to current ledger
- [ ] Frontend loads and connects to backend
- [ ] A test player can claim a system
- [ ] A test player can build units
- [ ] A test player can move their fleet
- [ ] Battle resolution works (if two players clash)
- [ ] Leaderboard shows updated player stats
