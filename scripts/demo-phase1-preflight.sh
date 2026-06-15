#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_BASE_URL="https://privy-stellar-api.namvu3121.workers.dev"
TX_HASHES=(
  "800852ee4278b12c16ebd0ec80f7946d0be3b645e370b79feb30423099fd740b"
  "b1c2c763b3cfb7cd01a271abf4e5d0ccc8e05ab98e6f0138d09792240bb8cd3a"
)

echo "== Public Worker =="
curl --fail --silent --show-error "${API_BASE_URL}/api/health" | jq
curl --fail --silent --show-error "${API_BASE_URL}/api/networks" | jq
curl --fail --silent --show-error "${API_BASE_URL}/api/assets?network=testnet" | jq

echo
echo "== Stellar Testnet transactions =="
for hash in "${TX_HASHES[@]}"; do
  curl --fail --silent --show-error \
    "https://horizon-testnet.stellar.org/transactions/${hash}" |
    jq '{hash, successful, ledger, created_at, operation_count}'
done

echo
echo "== Worker API checks =="
(
  cd "${ROOT_DIR}/worker-api"
  npm run typecheck
  npm test
)

echo
echo "== Mobile TypeScript check =="
(
  cd "${ROOT_DIR}/mobile"
  npx tsc --noEmit
)

echo
echo "Phase 1 preflight passed."
