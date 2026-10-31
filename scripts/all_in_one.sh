#!/usr/bin/env bash
# =============================================================================
# all_in_one.sh
# Fully‑automated bootstrap for the ClothingSetup project.
# =============================================================================
set -euo pipefail

log()   { echo -e "\e[32m[+] $*\e[0m"; }
error() { echo -e "\e[31m[!] $*\e[0m" >&2; }

command_exists() { command -v "$1" >/dev/null 2>&1; }

# -------------------------------------------------------------------------
# 1️⃣ Verify Node (>=20)
# -------------------------------------------------------------------------
if ! command_exists node; then
  error "Node.js not found. Install Node >=20 (e.g. via nvm or apt)."
  exit 1
fi
NODE_VER=$(node -v | cut -c2-)
log "Node version detected: $NODE_VER"
if [[ $(printf "%s\n20\n" "$NODE_VER" | sort -V | head -n1) != "20" ]]; then
  error "Node version must be >=20. Current: $NODE_VER"
  exit 1
fi

# -------------------------------------------------------------------------
# 2️⃣ Verify npm (>=9)
# -------------------------------------------------------------------------
if ! command_exists npm; then
  error "npm not found. Install a recent npm (>=9) and re‑run."
  exit 1
fi
NPM_VER=$(npm -v)
log "npm version detected: $NPM_VER"
if [[ $(printf "%s\n9\n" "$NPM_VER" | sort -V | head -n1) != "9" ]]; then
  error "npm version is too old (need >=9). Update npm (e.g. sudo apt install npm) and re‑run."
  exit 1
fi

# -------------------------------------------------------------------------
# 3️⃣ Generate package-lock.json
# -------------------------------------------------------------------------
log "Generating package-lock.json..."
npm i --package-lock-only

# -------------------------------------------------------------------------
# 4️⃣ Install all dependencies (npm ci)
# -------------------------------------------------------------------------
log "Installing dependencies (npm ci)…"
npm ci

# -------------------------------------------------------------------------
# 5️⃣ Initialise PostgreSQL
# -------------------------------------------------------------------------
log "Running PostgreSQL initialisation…"
read -s -p "PostgreSQL super‑user (postgres) password: " SUPER_PASS
echo

HBA_FILE=$(PGPASSWORD=$SUPER_PASS psql -U postgres -t -c "SHOW hba_file;" 2>/dev/null | tr -d '[:space:]')
if [[ -z "$HBA_FILE" ]]; then
  error "Could not locate pg_hba.conf. Aborting."
  exit 1
fi
log "pg_hba.conf located at: $HBA_FILE"

# Ensure md5 auth
log "Ensuring md5 authentication for all local users…"
sudo sed -i '/^#.*md5/d' "$HBA_FILE"
grep -q '^host[[:space:]]\+all[[:space:]]\+all[[:space:]]\+127\.0\.0\.1/32[[:space:]]\+md5' "$HBA_FILE" || \
  echo "host    all    all    127.0.0.1/32    md5" | sudo tee -a "$HBA_FILE"
grep -q '^local[[:space:]]\+all[[:space:]]\+all[[:space:]]\+md5' "$HBA_FILE" || \
  echo "local   all    all                 md5" | sudo tee -a "$HBA_FILE"

log "Restarting PostgreSQL…"
sudo systemctl restart postgresql
log "PostgreSQL restarted."

# Create DB, role, privileges
PGPASSWORD=$SUPER_PASS psql -U postgres <<'SQL'
CREATE DATABASE IF NOT EXISTS clothing_setup;
DO $$ BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname='dev_user') THEN
      CREATE USER dev_user WITH PASSWORD 'dev_pass';
   ELSE
      ALTER USER dev_user WITH PASSWORD 'dev_pass';
   END IF;
END $$;

GRANT ALL PRIVILEGES ON DATABASE clothing_setup TO dev_user;
\c clothing_setup
GRANT ALL ON SCHEMA public TO dev_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO dev_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO dev_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO dev_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO dev_user;
SQL
log "dev_user and DB created, privileges granted."

# -------------------------------------------------------------------------
# 6️⃣ Prepare .env
# -------------------------------------------------------------------------
if [[ -f ".env.example" ]]; then
  if [[ ! -f ".env" ]]; then
    cp .env.example .env
    log ".env created from .env.example"
  else
    log ".env already exists – leaving untouched."
  fi
else
  error ".env.example missing – cannot create .env"
  exit 1
fi

# -------------------------------------------------------------------------
# 7️⃣ Run the pipeline
# -------------------------------------------------------------------------
log "Running seed script…"
npm run seed

log "Running load‑test generator…"
npm run load-test

log "Running Vitest suite…"
npm test

log "✅ All steps completed successfully!"
# =============================================================================
