#!/bin/bash
set -e

# ── Deploy a single contract to any network ───────────────────────────────────
# Usage: ./scripts/deploy.sh <contract-name> <network>
# Example: ./scripts/deploy.sh galaxy-map testnet
#          ./scripts/deploy.sh resources mainnet

CONTRACT=$1
NETWORK=${2:-testnet}
IDENTITY="deployer"
WASM_DIR="target/wasm32-unknown-unknown/release"

validate_args() {
  if [[ -z "$CONTRACT" ]]; then
    echo "❌ Usage: ./scripts/deploy.sh <contract-name> [network]"
    echo "   Contracts: galaxy-map | resources | fleet | battle"
    exit 1
  fi
}

resolve_wasm_path() {
  local contract=$1
  local wasm_name="${contract//-/_}.wasm"
  echo "$WASM_DIR/$wasm_name"
}

build_single_contract() {
  local contract=$1
  echo "🔨 Building $contract..."
  cargo build \
    --package "$contract" \
    --target wasm32-unknown-unknown \
    --release \
    --quiet
  echo "✅ Built $contract"
}

deploy_wasm() {
  local contract=$1
  local wasm_path
  wasm_path=$(resolve_wasm_path "$contract")

  if [[ ! -f "$wasm_path" ]]; then
    echo "❌ WASM not found: $wasm_path — run build first"
    exit 1
  fi

  echo "🚀 Deploying $contract to $NETWORK..."
  stellar contract deploy \
    --wasm "$wasm_path" \
    --source "$IDENTITY" \
    --network "$NETWORK"
}

# ── Main ──────────────────────────────────────────────────────────────────────
validate_args
build_single_contract "$CONTRACT"
deploy_wasm "$CONTRACT"
