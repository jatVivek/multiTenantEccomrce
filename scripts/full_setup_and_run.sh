#!/usr/bin/env bash
# --------------------------------------------------------------------------
# full_setup_and_run.sh
# A single‑command, end‑to‑end bootstrap for the ClothingSetup project.
# It:
#   1️⃣ Ensures a modern npm (>=9) is installed (apt‑install if needed).
#   2️⃣ Generates a package‑lock.json.
#   3️⃣ Installs all dependencies.
#   4️⃣ Initializes PostgreSQL (creates dev_user, DB, grants rights).
#   5️⃣ Creates a .env file from the provided template.
#   6️⃣ Runs the seed script, load‑test generator, and Vitest suite.
# --------------------------------------------------------------------------
set -euo pipefail

log()   { echo -e "\e[32m[+] $*\e[0m"; }
error(){ echo -e "\e[31m[!] $*\e[0m" >&2; }

# -------------------------------------------------
# Helper: ensure command exists
# -------------------------------------------------
command_exists(){ command -v "$1" >/dev/null 2>&1; }

# -------------------------------------------------
# 1️⃣ Verify Node version (>=20) – we rely on the system Node
# -------------------------------------------------
if ! command_exists node; then
  error "Node is not installed. Please install Node >=20 (via nvm, apt, etc.)"
  exit 1
fi
NODE_VER=$(node -v | cut -c2-)
log "Node version detected: $NODE_VER"
# simple version compare (>=20)
if [[ $(printf "%s\n" "$NODE_VER" "20" | sort -V | head -n1) != "20" ]]; then
  error "Node version must be >=20. Current: $NODE_VER"
  exit 1
fi

# -------------------------------------------------
# 2️⃣ Verify npm version (>=9). If too old, install via apt.
# -------------------------------------------------
if ! command_exists npm; then
  error "npm not found – attempting to install via apt..."
  sudo apt-get update && sudo apt-get install -y npm
fi
NPM_VER=$(npm -v)
log "npm version detected: $NPM_VER"
# Compare with 9
if [[ $(printf "%s\n" "$NPM_VER" "9" | sort -V | head -n1) != "9" ]]; then
  log "npm version <9 – installing newer npm via apt..."
  sudo apt-get install -y npm   # on Ubuntu 24.04 this yields npm 9.x
  NPM_VER=$(npm -v)
  log "npm version after install: $NPM_VER"
fi

# -------------------------------------------------
# 3️⃣ Generate a package-lock.json (npm i --package-lock-only)
# -------------------------------------------------
log "Generating package-lock.json..."
npm i --package-lock-only

# -------------------------------------------------
# 4️⃣ Install all dependencies (npm ci)
# -------------------------------------------------
log "Installing dependencies (npm ci)..."
npm ci

# -------------------------------------------------
# 5️⃣ Initialise PostgreSQL (create dev_user, DB, privileges)
# -------------------------------------------------
log "Running PostgreSQL init script..."
if [ -f "scripts/init_db.sh" ]; then
  chmod +x scripts/init_db.sh
  ./scripts/init_db.sh
else
  error "scripts/init_db.sh not found – aborting."
  exit 1
fi

# -------------------------------------------------
# 6️⃣ Prepare .env file
# -------------------------------------------------
if [ -f ".env.example" ]; then
  cp -n .env.example .env || true
  log ".env file ready (copy of .env.example)."
else
  error ".env.example missing – cannot create .env"
  exit 1
fi

# -------------------------------------------------
# 7️⃣ Run seed, load‑test, and test sequentially
# -------------------------------------------------
log "Running seed script..."
npm run seed
log "Running load‑test generator..."
npm run load-test
log "Running Vitest suite..."
npm test

log "✅ All steps completed successfully."
