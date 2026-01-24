#!/bin/bash
# Test script for contract verification on Stellar

set -e

RPC_URL="${TVA_RPC_URL:-http://localhost:8545}"
CONTRACT_ADDR="${1:-0x0000000000000000000000000000000000000000}"

echo "=== Testing TVA Contract Verification ==="
echo "RPC URL: $RPC_URL"
echo "Contract Address: $CONTRACT_ADDR"
echo ""

# Test 1: Get verified source (should fail if not verified)
echo "Test 1: Querying verified source..."
RESPONSE=$(curl -s -X POST "$RPC_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"method\": \"tva_getVerifiedSource\",
    \"params\": [\"$CONTRACT_ADDR\"],
    \"id\": 1
  }")

echo "Response: $RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Test 2: Verify a contract (example with Counter.sol)
if [ -f "contracts/Counter.sol" ]; then
  echo "Test 2: Verifying contract with Counter.sol source..."
  SOURCE=$(cat contracts/Counter.sol)
  
  RESPONSE=$(curl -s -X POST "$RPC_URL" \
    -H "Content-Type: application/json" \
    -d "{
      \"jsonrpc\": \"2.0\",
      \"method\": \"tva_verifyContract\",
      \"params\": [
        \"$CONTRACT_ADDR\",
        $(echo "$SOURCE" | jq -Rs .),
        \"0.3.0\",
        \"--target soroban\",
        \"{}\"
      ],
      \"id\": 2
    }")
  
  echo "Response: $RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
  echo ""
  
  # Wait a bit for transaction to settle
  echo "Waiting 3 seconds for transaction to settle..."
  sleep 3
  
  # Test 3: Query again (should now return verified source)
  echo "Test 3: Querying verified source again..."
  RESPONSE=$(curl -s -X POST "$RPC_URL" \
    -H "Content-Type: application/json" \
    -d "{
      \"jsonrpc\": \"2.0\",
      \"method\": \"tva_getVerifiedSource\",
      \"params\": [\"$CONTRACT_ADDR\"],
      \"id\": 3
    }")
  
  echo "Response: $RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
else
  echo "Test 2: Skipped (Counter.sol not found)"
fi

echo ""
echo "=== Verification Test Complete ==="

