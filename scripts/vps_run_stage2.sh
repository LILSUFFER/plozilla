#!/usr/bin/env bash
set -euo pipefail

BOARDS="${BOARDS:-20000}"
VILLAIN_SAMPLES="${VILLAIN_SAMPLES:-20}"
SEED="${SEED:-12345}"
CRN="${CRN:-on}"
THREADS="${THREADS:-auto}"
OUTPUT="public/plo5_rankings_stage2.bin"

echo "╔══════════════════════════════════════════════╗"
echo "║   PLO5 Ranker — Stage-2 Production Run       ║"
echo "║   Deterministic CRN Mode                     ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "  BOARDS:           $BOARDS"
echo "  VILLAIN_SAMPLES:  $VILLAIN_SAMPLES"
echo "  SEED:             $SEED"
echo "  CRN:              $CRN"
echo "  THREADS:          $THREADS"
echo "  OUTPUT:           $OUTPUT"
echo ""

source "$HOME/.cargo/env" 2>/dev/null || true

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "[1/4] Building Rust release binary..."
cd "$PROJECT_DIR/engine-rust"
cargo build --release 2>&1
BINARY="$PROJECT_DIR/engine-rust/target/release/plo5_ranker"
echo "       Built: $BINARY"
echo ""

cd "$PROJECT_DIR"
mkdir -p public

echo "[2/4] Running Stage-2 precompute (CRN=$CRN, seed=$SEED)..."
echo "       Started at: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

$BINARY precompute \
    --boards "$BOARDS" \
    --villain-samples "$VILLAIN_SAMPLES" \
    --seed "$SEED" \
    --crn "$CRN" \
    --threads "$THREADS" \
    --out "$OUTPUT"

echo ""
echo "       Finished at: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

echo "[3/4] Verifying output..."
if [ ! -f "$OUTPUT" ]; then
    echo "  ERROR: Output file not found: $OUTPUT"
    exit 1
fi
FILE_SIZE=$(stat -c%s "$OUTPUT" 2>/dev/null || stat -f%z "$OUTPUT")
if [ "$FILE_SIZE" -eq 0 ]; then
    echo "  ERROR: Output file is empty"
    exit 1
fi
echo "  File: $OUTPUT"
echo "  Size: $FILE_SIZE bytes"
echo "  OK: file exists and is non-empty."
echo ""

echo "[4/4] Accuracy sanity check (2 benchmark hands × 2M MC trials)..."
echo ""

$BINARY accuracy \
    --bin "$OUTPUT" \
    --trials 2000000 \
    --test-hands "JsTh5dTc4c,AcAhTh8d7c"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   Stage-2 Complete                            ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "  Output: $OUTPUT"
echo "  Size:   $FILE_SIZE bytes"
echo "  Seed:   $SEED"
echo "  CRN:    $CRN"
echo ""
echo "  Next steps:"
echo "    1. Copy $OUTPUT to Replit public/"
echo "    2. Rename to plo5_rankings_prod.bin"
echo "    3. Restart server"
