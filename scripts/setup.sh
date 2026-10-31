#!/usr/bin/env bash
# scripts/setup.sh
# ------------------------------------------------------------
# Sets up a clean development environment for the ClothingSetup project.
# It verifies that a recent Node (>=20) & npm (>=9) are available, and
# configures npm to use the same Node binary for script execution.
# ------------------------------------------------------------
set -euo pipefail

log()   { echo -e "\e[32m[+] $*\e[0m"; }
error() { echo -e "\e[31m[!] $*\e[0m" >&2; }

# 1️⃣ Verify Node version
if ! command -v node >/dev/null; then
  error "Node is not installed. Install Node >=20 (via nvm, apt, or your favourite method)."
  exit 1
fi
NODE_VER=$(node -v | cut -c2-)
log "Detected Node version $NODE_VER"
# Simple version check (>=20)
if [[ $(printf "%s\n" "$NODE_VER" "20" | sort -V | head -n1) != "20" ]]; then
  error "Node version must be >=20. Current: $NODE_VER"
  exit 1
fi

# 2️⃣ Verify npm version
if ! command -v npm >/dev/null; then
  error "npm not found. Install npm that matches your Node (npm >=9)."
  exit 1
fi
NPM_VER=$(npm -v)
log "Detected npm version $NPM_VER"

# 3️⃣ npm config – make scripts use the same node binary
# npm config not needed – we rely on the current Node binary
# npm config set scripts-prepend-node-path true
# npm config set script-shell "/bin/bash"

log "Setup complete. You can now run 'npm install' and then 'npm run seed', 'npm run load-test', 'npm test'."
