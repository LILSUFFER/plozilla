#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
BIN_FILE="$ROOT_DIR/public/plo5_rankings_prod.bin"

echo "============================================"
echo "  PLO5 Ranker — Deploy Rankings"
echo "============================================"
echo ""

if [ ! -f "$BIN_FILE" ]; then
  echo "ERROR: Rankings file not found: $BIN_FILE"
  echo "Run ./scripts/precompute.sh first."
  exit 1
fi

SIZE=$(stat -c%s "$BIN_FILE" 2>/dev/null || stat -f%z "$BIN_FILE" 2>/dev/null)
echo "  File: $BIN_FILE"
echo "  Size: $SIZE bytes ($(echo "scale=2; $SIZE / 1048576" | bc) MB)"
echo ""

EXPECTED_SIZE=2689244
if [ "$SIZE" -lt "$EXPECTED_SIZE" ]; then
  echo "WARNING: File is smaller than expected ($SIZE < $EXPECTED_SIZE bytes)."
  echo "  This may indicate an incomplete precompute."
  echo ""
fi

echo "[1/2] Checking binary integrity..."
MAGIC=$(head -c 4 "$BIN_FILE")
if [ "$MAGIC" != "PLO5" ]; then
  echo "ERROR: Invalid file magic. Expected 'PLO5', got '$MAGIC'"
  exit 1
fi
echo "  Magic: OK (PLO5)"

HANDS=$(od -An -tu4 -j8 -N4 "$BIN_FILE" | tr -d ' ')
echo "  Hands: $HANDS"

if [ "$HANDS" -ne 134459 ]; then
  echo "WARNING: Expected 134459 canonical hands, got $HANDS"
fi

echo ""
echo "[2/2] Restarting server..."

if command -v npm &> /dev/null && [ -f "$ROOT_DIR/package.json" ]; then
  cd "$ROOT_DIR"
  echo "  Restarting Node.js server..."
  npm run dev &
  sleep 3

  echo ""
  echo "  Testing /api/rankings/status..."
  if command -v curl &> /dev/null; then
    STATUS=$(curl -s http://localhost:5000/api/rankings/status 2>/dev/null || echo "FAILED")
    echo "  $STATUS"
  else
    echo "  (curl not available, skip endpoint test)"
  fi
else
  echo "  (No package.json found, skip server restart)"
  echo "  Copy $BIN_FILE to your server's public/ directory and restart."
fi

echo ""
echo "============================================"
echo "  DEPLOY COMPLETE"
echo "============================================"
echo ""
echo "The rankings are now live. Check /api/rankings/status"
