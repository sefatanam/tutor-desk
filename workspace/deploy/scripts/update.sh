#!/usr/bin/env bash
# ─── update.sh ────────────────────────────────────────────────────────────────
# Rolling update for one or all customer instances.
# Pulls new Docker images, runs DB migrations (via Go API startup), and
# performs a zero-downtime container restart.
#
# Usage:
#   ./update.sh <version> [customer_id | all]
#
# Examples:
#   ./update.sh v1.2.0              # update all customers
#   ./update.sh v1.2.0 school-abc  # update one customer
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

VERSION="${1:?Usage: update.sh <version> [customer_id | all]}"
TARGET="${2:-all}"
BASE_DIR="/opt/tutordesk/customers"
FAILED=()

update_customer() {
  local CUSTOMER_ID="$1"
  local DIR="$BASE_DIR/$CUSTOMER_ID"

  if [[ ! -f "$DIR/.env" ]]; then
    echo "WARN: No .env found for '$CUSTOMER_ID', skipping."
    return
  fi

  echo "──────────────────────────────────────────────"
  echo "  Updating $CUSTOMER_ID → $VERSION"
  echo "──────────────────────────────────────────────"

  # Load current env
  set -a; source "$DIR/.env"; set +a

  # Update version in .env
  sed -i "s/^APP_VERSION=.*/APP_VERSION=$VERSION/" "$DIR/.env"

  # Pull new images
  docker compose -f "$DIR/docker-compose.yml" --env-file "$DIR/.env" pull api web

  # Restart API first (runs migrations on startup via database.RunMigrations)
  echo "  Restarting API (migrations will run automatically)..."
  docker compose -f "$DIR/docker-compose.yml" --env-file "$DIR/.env" \
    up -d --no-deps --force-recreate api

  # Wait for API to become healthy
  local MAX_WAIT=60
  local WAITED=0
  until docker compose -f "$DIR/docker-compose.yml" exec -T api \
      wget -qO- http://localhost:8080/api/v1/health > /dev/null 2>&1; do
    if [[ $WAITED -ge $MAX_WAIT ]]; then
      echo "  ERROR: API did not become healthy within ${MAX_WAIT}s for $CUSTOMER_ID"
      FAILED+=("$CUSTOMER_ID")
      return 1
    fi
    sleep 2
    WAITED=$((WAITED + 2))
  done

  echo "  API healthy. Restarting web..."
  docker compose -f "$DIR/docker-compose.yml" --env-file "$DIR/.env" \
    up -d --no-deps --force-recreate web

  echo "  ✓ $CUSTOMER_ID updated to $VERSION"
}

if [[ "$TARGET" == "all" ]]; then
  for dir in "$BASE_DIR"/*/; do
    [[ -d "$dir" ]] || continue
    update_customer "$(basename "$dir")" || true
  done
else
  update_customer "$TARGET"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
if [[ ${#FAILED[@]} -gt 0 ]]; then
  echo "Update complete with errors. Failed customers:"
  for c in "${FAILED[@]}"; do
    echo "  - $c"
  done
  exit 1
else
  echo "All instances updated to $VERSION successfully."
fi
