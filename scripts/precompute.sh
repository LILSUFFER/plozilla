#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ENGINE_DIR="$ROOT_DIR/engine-rust"
OUTPUT="$ROOT_DIR/public/plo5_rankings_prod.bin"

BOARDS="${BOARDS:-full}"
VILLAIN_SAMPLES="${VILLAIN_SAMPLES:-50}"
THREADS="${THREADS:-auto}"

echo "============================================"
echo "  PLO5 Ranker — Full Precompute Pipeline"
echo "============================================"
echo ""
echo "  Root:             $ROOT_DIR"
echo "  Engine:           $ENGINE_DIR"
echo "  Output:           $OUTPUT"
echo "  Boards:           $BOARDS"
echo "  Villain samples:  $VILLAIN_SAMPLES"
echo "  Threads:          $THREADS"
echo ""

echo "[1/3] Building Rust engine (release mode)..."
cd "$ENGINE_DIR"
cargo build --release
BINARY="$ENGINE_DIR/target/release/plo5_ranker"
echo "  Binary: $BINARY"
echo "  Size: $(du -h "$BINARY" | cut -f1)"
echo ""

echo "[2/3] Running precompute..."
"$BINARY" precompute \
  --boards "$BOARDS" \
  --villain-samples "$VILLAIN_SAMPLES" \
  --threads "$THREADS" \
  --out "$OUTPUT"
echo ""

echo "[3/3] Verifying output..."
if [ -f "$OUTPUT" ]; then
  SIZE=$(stat -c%s "$OUTPUT" 2>/dev/null || stat -f%z "$OUTPUT" 2>/dev/null)
  echo "  File: $OUTPUT"
  echo "  Size: $SIZE bytes ($(echo "scale=2; $SIZE / 1048576" | bc) MB)"
  echo ""
  "$BINARY" info
  echo ""
  echo "============================================"
  echo "  PRECOMPUTE COMPLETE"
  echo "============================================"
else
  echo "  ERROR: Output file not created!"
  exit 1
fi
