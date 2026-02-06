#!/usr/bin/env bash
set -euo pipefail

echo "╔══════════════════════════════════════════════╗"
echo "║   PLO5 Ranker — VPS Setup                    ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

echo "[1/3] Installing system dependencies..."
sudo apt-get update -qq
sudo apt-get install -y -qq build-essential git curl pkg-config libssl-dev
echo "       Done."

echo ""
echo "[2/3] Installing Rust (non-interactive)..."
if command -v rustc &>/dev/null; then
    echo "       Rust already installed, skipping."
else
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
fi
echo ""

echo "[3/3] Versions:"
echo "  rustc:  $(rustc --version)"
echo "  cargo:  $(cargo --version)"
echo ""
echo "Setup complete."
