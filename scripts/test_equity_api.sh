#!/usr/bin/env bash
# Regression tests for POST /api/equity
# Usage: bash scripts/test_equity_api.sh [BASE_URL]
#   BASE_URL defaults to http://localhost:5000

set -euo pipefail

BASE="${1:-http://localhost:5000}"
URL="${BASE}/api/equity"
PASS=0
FAIL=0

echo "=== Equity API Regression Tests ==="
echo "URL: $URL"
echo

# ── Test 1: Preflop hero vs 100% ──────────────────────────
echo "Test 1: JsTh5dTc4c vs 100% @ 600k trials (preflop)"
RESP=$(curl -sf -X POST "$URL" \
  -H 'Content-Type: application/json' \
  -d '{"hero":"JsTh5dTc4c","villain":"100%","trials":600000,"seed":12345}')

OK=$(echo "$RESP" | jq -r '.ok')
EQ=$(echo "$RESP" | jq -r '.equityPct')
ELAPSED=$(echo "$RESP" | jq -r '.elapsedMs')

if [ "$OK" = "true" ]; then
  IN_RANGE=$(echo "$EQ" | awk '{if ($1 >= 50.0 && $1 <= 57.0) print "yes"; else print "no"}')
  if [ "$IN_RANGE" = "yes" ]; then
    echo "  PASS  equity=${EQ}% elapsed=${ELAPSED}ms (expected 53.6-54.1)"
    PASS=$((PASS+1))
  else
    echo "  FAIL  equity=${EQ}% out of expected range 50-57"
    FAIL=$((FAIL+1))
  fi
else
  echo "  FAIL  ok=false error=$(echo "$RESP" | jq -r '.error')"
  FAIL=$((FAIL+1))
fi
echo

# ── Test 2: Hero vs 100% with flop board ──────────────────
echo "Test 2: AcAdKhQh5s vs 100% on board AsKd3c @ 300k trials"
RESP=$(curl -sf -X POST "$URL" \
  -H 'Content-Type: application/json' \
  -d '{"hero":"AcAdKhQh5s","villain":"100%","board":"AsKd3c","trials":300000,"seed":12345}')

OK=$(echo "$RESP" | jq -r '.ok')
EQ=$(echo "$RESP" | jq -r '.equityPct')
ELAPSED=$(echo "$RESP" | jq -r '.elapsedMs')

if [ "$OK" = "true" ]; then
  IN_RANGE=$(echo "$EQ" | awk '{if ($1 >= 80.0 && $1 <= 92.0) print "yes"; else print "no"}')
  if [ "$IN_RANGE" = "yes" ]; then
    echo "  PASS  equity=${EQ}% elapsed=${ELAPSED}ms (expected ~85-86)"
    PASS=$((PASS+1))
  else
    echo "  FAIL  equity=${EQ}% out of expected range 80-92"
    FAIL=$((FAIL+1))
  fi
else
  echo "  FAIL  ok=false error=$(echo "$RESP" | jq -r '.error')"
  FAIL=$((FAIL+1))
fi
echo

# ── Test 3: Duplicate card validation (hero overlaps board) ─
echo "Test 3: Duplicate card validation (hero=AcAdKhQh5s board=AcKd3c)"
RESP=$(curl -sf -X POST "$URL" \
  -H 'Content-Type: application/json' \
  -d '{"hero":"AcAdKhQh5s","villain":"100%","board":"AcKd3c","trials":100000,"seed":12345}')

OK=$(echo "$RESP" | jq -r '.ok')
ERR=$(echo "$RESP" | jq -r '.error // empty')

if [ "$OK" = "false" ] && echo "$ERR" | grep -qi "duplicate"; then
  echo "  PASS  correctly rejected: $ERR"
  PASS=$((PASS+1))
else
  echo "  FAIL  expected ok=false with duplicate error, got ok=$OK error=$ERR"
  FAIL=$((FAIL+1))
fi
echo

# ── Summary ───────────────────────────────────────────────
echo "=== Results: ${PASS} passed, ${FAIL} failed ==="
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
