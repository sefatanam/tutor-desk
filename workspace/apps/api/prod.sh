#!/usr/bin/env bash
# ─── Tutor Desk API — Production / Full Docker Stack ──────────────────────────
# Regenerates Swagger docs, builds the API image, then starts all services.
# Run from workspace root:  bash apps/api/prod.sh
# Or from apps/api/:        bash prod.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[prod]${NC} $*"; }
warn()  { echo -e "${YELLOW}[prod]${NC} $*"; }
error() { echo -e "${RED}[prod]${NC} $*" >&2; }

# ── 1. Warn if JWT_SECRET is still the default ────────────────────────────────
DEFAULT_SECRET="tutor-desk-super-secret-key-change-in-production-2024"
JWT_SECRET="${JWT_SECRET:-$DEFAULT_SECRET}"
if [[ "$JWT_SECRET" == "$DEFAULT_SECRET" ]]; then
  warn "JWT_SECRET is set to the default dev value — set a strong secret in production!"
fi

# ── 2. Regenerate Swagger docs ────────────────────────────────────────────────
if command -v /Users/sefat/go/bin/swag &>/dev/null; then
  info "Regenerating Swagger docs..."
  /Users/sefat/go/bin/swag init -g main.go -o ./docs --parseDependency --parseInternal -q
  info "Swagger docs updated"
else
  warn "swag CLI not found — skipping docs regeneration (existing docs will be used)"
fi

# ── 3. Build API Docker image + start all services ────────────────────────────
info "Building API image and starting all services..."
docker compose --profile full up -d --build

# ── 4. Wait for postgres to be healthy ────────────────────────────────────────
info "Waiting for postgres to be ready..."
RETRIES=40
until docker compose exec -T postgres pg_isready -U postgres -d tutordesk -q 2>/dev/null; do
  RETRIES=$((RETRIES - 1))
  if [[ $RETRIES -eq 0 ]]; then
    error "Postgres did not become ready in time"
    docker compose logs postgres
    exit 1
  fi
  sleep 2
done
info "Postgres is ready"

# ── 5. Print status ───────────────────────────────────────────────────────────
echo ""
info "All services running:"
docker compose --profile full ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
echo ""
info "API        → http://localhost:8080"
info "Swagger UI → http://localhost:8080/swagger/"
info "pgAdmin    → http://localhost:5050  (admin@tutordesk.app / admin)"
echo ""
info "To tail logs:  docker compose --profile full logs -f"
info "To stop:       docker compose --profile full down"
