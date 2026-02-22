#!/usr/bin/env bash
# ─── Tutor Desk API — Development ─────────────────────────────────────────────
# Starts postgres + pgAdmin in Docker, then runs the Go API natively.
# Run from workspace root:  bash apps/api/dev.sh
# Or from apps/api/:        bash dev.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[dev]${NC} $*"; }
warn()  { echo -e "${YELLOW}[dev]${NC} $*"; }
error() { echo -e "${RED}[dev]${NC} $*" >&2; }

# ── 1. Copy .env if missing ────────────────────────────────────────────────────
if [[ ! -f .env ]]; then
  warn ".env not found — copying from .env.example"
  cp .env.example .env
  info "Created .env — review and edit if needed"
fi

# ── 2. Start postgres + pgAdmin ───────────────────────────────────────────────
info "Starting postgres + pgAdmin..."
docker compose up -d postgres pgadmin

# ── 3. Wait for postgres to be healthy ────────────────────────────────────────
info "Waiting for postgres to be ready..."
RETRIES=30
until docker compose exec -T postgres pg_isready -U postgres -d tutordesk -q 2>/dev/null; do
  RETRIES=$((RETRIES - 1))
  if [[ $RETRIES -eq 0 ]]; then
    error "Postgres did not become ready in time"
    docker compose logs postgres
    exit 1
  fi
  sleep 1
done
info "Postgres is ready"

# ── 4. Start Go API natively ──────────────────────────────────────────────────
info "Starting Go API on http://localhost:8080"
info "Swagger UI → http://localhost:8080/swagger/"
info "pgAdmin    → http://localhost:5050  (admin@tutordesk.app / admin)"
echo ""

# Load .env into the current shell so go run picks them up
set -a; source .env; set +a

exec /opt/homebrew/opt/go/libexec/bin/go run .
