#!/bin/bash
set -e

# ── Setup Stellar testnet and deploy all contracts ────────────────────────────
# Usage: ./scripts/setup-testnet.sh
# Requires: stellar CLI v26+, cargo, rustup wasm32 target

IDENTITY="deployer"
NETWORK="testnet"
WASM_DIR="target/wasm32-unknown-unknown/release"

echo "🌌 Starbound Realms — Testnet Setup"
echo "────────────────────────────────────"

# ── Step 1: Create identity if it doesn't exist ───────────────────────────────
create_identity_if_missing() {
  if stellar keys address "$IDENTITY" &>/dev/null; then
    echo "✅ Identity '$IDENTITY' already exists"
  else
    echo "🔑 Generating new identity: $IDENTITY"
    stellar keys generate "$IDENTITY" --network "$NETWORK"
  fi
}

# ── Step 2: Fund the account via Friendbot ────────────────────────────────────
fund_account() {
  echo "💸 Funding $IDENTITY via Friendbot..."
  stellar keys fund "$IDENTITY" --network "$NETWORK"
}

# ── Step 3: Build all contracts ───────────────────────────────────────────────
build_contracts() {
  echo "🔨 Building contracts..."
  cargo build --target wasm32-unknown-unknown --release --quiet
  echo "✅ Contracts built"
}

# ── Step 4: Deploy a single contract and return its ID ───────────────────────
deploy_contract() {
  local name=$1
  local wasm_file=$2
  echo "🚀 Deploying $name..."
  local contract_id
  contract_id=$(stellar contract deploy \
    --wasm "$wasm_file" \
    --source "$IDENTITY" \
    --network "$NETWORK" 2>&1 | tail -1)
  echo "✅ $name deployed: $contract_id"
  echo "$contract_id"
}

# ── Step 5: Write contract IDs to .env files ──────────────────────────────────
write_env_files() {
  local galaxy_map=$1
  local resources=$2
  local fleet=$3
  local battle=$4

  cat > backend/.env <<EOF
DATABASE_URL=postgres://postgres:postgres@localhost:5432/starbound
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
CONTRACT_GALAXY_MAP=$galaxy_map
CONTRACT_RESOURCES=$resources
CONTRACT_FLEET=$fleet
CONTRACT_BATTLE=$battle
INDEXER_POLL_INTERVAL_MS=5000
PORT=3000
EOF

  cat > frontend/.env <<EOF
VITE_BACKEND_URL=http://localhost:3000
VITE_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
VITE_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
VITE_CONTRACT_GALAXY_MAP=$galaxy_map
VITE_CONTRACT_RESOURCES=$resources
VITE_CONTRACT_FLEET=$fleet
VITE_CONTRACT_BATTLE=$battle
EOF

  echo "✅ .env files written"
}

# ── Main ──────────────────────────────────────────────────────────────────────
create_identity_if_missing
fund_account
build_contracts

GALAXY_MAP=$(deploy_contract "galaxy-map" "$WASM_DIR/galaxy_map.wasm")
RESOURCES=$(deploy_contract "resources"   "$WASM_DIR/resources.wasm")
FLEET=$(deploy_contract     "fleet"       "$WASM_DIR/fleet.wasm")
BATTLE=$(deploy_contract    "battle"      "$WASM_DIR/battle.wasm")

write_env_files "$GALAXY_MAP" "$RESOURCES" "$FLEET" "$BATTLE"

echo ""
echo "────────────────────────────────────"
echo "🎉 Deployment complete!"
echo "   galaxy-map : $GALAXY_MAP"
echo "   resources  : $RESOURCES"
echo "   fleet      : $FLEET"
echo "   battle     : $BATTLE"
echo ""
echo "Next: pnpm dev (backend) && pnpm dev (frontend)"
