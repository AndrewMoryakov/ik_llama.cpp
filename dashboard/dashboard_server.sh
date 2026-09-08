#!/bin/bash
# ik_llama.cpp Dashboard Server — Linux launcher
# Usage: ./dashboard_server.sh [port]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "  Starting ik_llama.cpp Dashboard Server..."
echo ""

# Prefer python3, fall back to python
if command -v python3 &>/dev/null; then
    PYTHON=python3
elif command -v python &>/dev/null; then
    PYTHON=python
else
    echo "  Error: Python not found. Install python3:"
    echo "    sudo apt install python3    # Debian/Ubuntu"
    echo "    sudo dnf install python3    # Fedora/RHEL"
    echo "    sudo pacman -S python       # Arch"
    exit 1
fi

exec "$PYTHON" "$SCRIPT_DIR/dashboard_server.py" "$@"
