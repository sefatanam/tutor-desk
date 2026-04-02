#!/usr/bin/env bash
# ─── update.sh — TutorDesk Self-Hosted Update ─────────────────────────────────
# Updates your TutorDesk instance to a new version.
# Database migrations run automatically when the API container restarts.
#
# Usage:  ./update.sh <version>
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

VERSION="${1:?Usage: ./update.sh <version>  (e.g. v1.2.0)}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

echo "Updating TutorDesk to $VERSION..."

# Update version in .env
sed -i "s/^APP_VERSION=.*/APP_VERSION=$VERSION/" "$ENV_FILE"

# Pull new images
docker compose -f "$SCRIPT_DIR/docker-compose.yml" --env-file "$ENV_FILE" pull api web

# Restart with new images (migrations run on API startup automatically)
docker compose -f "$SCRIPT_DIR/docker-compose.yml" --env-file "$ENV_FILE" \
  up -d --no-deps --force-recreate api web

echo "✓ Updated to $VERSION. Database migrations ran automatically on API startup."
echo "  Check logs: docker compose logs -f api"
