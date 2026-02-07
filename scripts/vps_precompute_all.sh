#!/usr/bin/env bash
set -euo pipefail

BOARDS="${1:-5000}"
VILLAIN="${2:-5}"
SEED="${3:-12345}"
THREADS="${4:-auto}"
OUT_EQ="${5:-equity_all_2598960.f32}"
OUT_RK="${6:-rank_index_all_2598960.u32}"

echo "╔══════════════════════════════════════════════╗"
echo "║   PLO5 — Precompute All 2,598,960 Hands     ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "  Boards:          $BOARDS"
echo "  Villain samples: $VILLAIN"
echo "  Seed:            $SEED"
echo "  Threads:         $THREADS"
echo "  Output equity:   $OUT_EQ"
echo "  Output rank:     $OUT_RK"
echo ""

if [ ! -f engine-rust/target/release/plo5_ranker ]; then
    echo "[1/2] Building Rust engine (release)..."
    cd engine-rust
    cargo build --release
    cd ..
    echo "       Done."
else
    echo "[1/2] Rust engine already built."
fi

echo ""
echo "[2/2] Running precompute_all..."
echo "       Start time: $(date)"
echo ""

time engine-rust/target/release/plo5_ranker precompute_all \
    --boards "$BOARDS" \
    --villain-samples "$VILLAIN" \
    --seed "$SEED" \
    --threads "$THREADS" \
    --out-equity "$OUT_EQ" \
    --out-rank "$OUT_RK"

echo ""
echo "  End time: $(date)"
echo ""
echo "  Output files:"
ls -lh "$OUT_EQ" "$OUT_RK" 2>/dev/null || echo "  (files not found — check errors above)"
echo ""
echo "Done. Copy the .u32 rank file to public/rank_index_all_2598960.u32 on the server."
