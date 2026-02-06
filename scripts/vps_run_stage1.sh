#!/usr/bin/env bash
set -euo pipefail

BOARDS="${BOARDS:-10000}"
VILLAIN_SAMPLES="${VILLAIN_SAMPLES:-10}"
THREADS="${THREADS:-$(nproc)}"
OUTPUT="public/plo5_rankings_stage1.bin"
EXPECTED_HEROES=134459
MAX_ALLOWED_DELTA="0.5"   # %  (sanity threshold for Stage-1)

echo "╔══════════════════════════════════════════════╗"
echo "║   PLO5 Ranker — Stage-1 Production Run       ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "  BOARDS:           $BOARDS"
echo "  VILLAIN_SAMPLES:  $VILLAIN_SAMPLES"
echo "  THREADS:          $THREADS"
echo "  OUTPUT:           $OUTPUT"
echo ""

# Load Rust env if exists
source "$HOME/.cargo/env" 2>/dev/null || true

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "[1/5] Building Rust release binary..."
cd "$PROJECT_DIR/engine-rust"
cargo build --release
BINARY="$PROJECT_DIR/engine-rust/target/release/plo5_ranker"

if [ ! -x "$BINARY" ]; then
  echo "ERROR: Binary not found or not executable: $BINARY"
  exit 1
fi

echo "       Built: $BINARY"
echo ""

cd "$PROJECT_DIR"
mkdir -p public

echo "[2/5] Running Stage-1 precompute..."
echo "       Started at: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

PRECOMPUTE_LOG=$(mktemp)

set +e
"$BINARY" precompute \
  --boards "$BOARDS" \
  --villain-samples "$VILLAIN_SAMPLES" \
  --threads "$THREADS" \
  --out "$OUTPUT" | tee "$PRECOMPUTE_LOG"
STATUS=${PIPESTATUS[0]}
set -e

if [ "$STATUS" -ne 0 ]; then
  echo "ERROR: precompute command failed."
  exit 1
fi

echo ""
echo "       Finished at: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

echo "[3/5] Verifying output file..."

if [ ! -f "$OUTPUT" ]; then
  echo "ERROR: Output file not found: $OUTPUT"
  exit 1
fi

FILE_SIZE=$(stat -c%s "$OUTPUT" 2>/dev/null || stat -f%z "$OUTPUT")
if [ "$FILE_SIZE" -eq 0 ]; then
  echo "ERROR: Output file is empty"
  exit 1
fi

echo "  File: $OUTPUT"
echo "  Size: $FILE_SIZE bytes"
echo "  OK: file exists and is non-empty."
echo ""

echo "[4/5] Verifying hero count from precompute log..."

HEROES_FOUND=$(grep -Eo 'heroes_processed[:=][[:space:]]*[0-9]+' "$PRECOMPUTE_LOG" | grep -Eo '[0-9]+' | tail -n1 || echo "0")

if [ "$HEROES_FOUND" != "$EXPECTED_HEROES" ]; then
  echo "ERROR: heroes_processed mismatch."
  echo "  Expected: $EXPECTED_HEROES"
  echo "  Found:    $HEROES_FOUND"
  exit 1
fi

echo "  OK: heroes_processed = $HEROES_FOUND"
echo ""

echo "[5/5] Accuracy sanity check (2 benchmark hands × 2M MC trials)..."
echo ""

ACCURACY_LOG=$(mktemp)

set +e
"$BINARY" accuracy \
  --bin "$OUTPUT" \
  --trials 2000000 \
  --test-hands "JsTh5dTc4c,AcAhTh8d7c" | tee "$ACCURACY_LOG"
STATUS=${PIPESTATUS[0]}
set -e

if [ "$STATUS" -ne 0 ]; then
  echo "ERROR: accuracy command failed."
  exit 1
fi

echo ""
echo "Checking max absolute delta..."

MAX_DELTA_FOUND=$(grep -Eo 'absolute_delta[:=][[:space:]]*[0-9.]+%' "$ACCURACY_LOG" | grep -Eo '[0-9.]+' | sort -nr | head -n1 || echo "999")

if awk "BEGIN {exit !($MAX_DELTA_FOUND > $MAX_ALLOWED_DELTA)}"; then
  echo "ERROR: Accuracy delta too high."
  echo "  Found max delta: $MAX_DELTA_FOUND%"
  echo "  Allowed max:     $MAX_ALLOWED_DELTA%"
  exit 1
fi

echo "  OK: max delta = $MAX_DELTA_FOUND% (≤ $MAX_ALLOWED_DELTA%)"
echo ""

echo "╔══════════════════════════════════════════════╗"
echo "║   Stage-1 SUCCESS                             ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "  Output: $OUTPUT"
echo "  Size:   $FILE_SIZE bytes"
echo ""
echo "Next steps:"
echo "  1. Copy $OUTPUT to Replit public/"
echo "  2. Rename to plo5_rankings_prod.bin"
echo "  3. Restart server"
