#!/usr/bin/env bash
# ─── remove-customer.sh ───────────────────────────────────────────────────────
# Safely removes a customer's instance.
# Takes a final backup before destroying anything.
#
# Usage:
#   ./remove-customer.sh <customer_id> [--confirm]
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

CUSTOMER_ID="${1:?Usage: remove-customer.sh <customer_id> [--confirm]}"
CONFIRM="${2:-}"
BASE_DIR="/opt/tutordesk/customers"
DEPLOY_DIR="$BASE_DIR/$CUSTOMER_ID"

if [[ ! -d "$DEPLOY_DIR" ]]; then
  echo "ERROR: No deployment found for '$CUSTOMER_ID' at $DEPLOY_DIR"
  exit 1
fi

if [[ "$CONFIRM" != "--confirm" ]]; then
  echo "WARNING: This will permanently remove the instance for '$CUSTOMER_ID'."
  echo "  A final backup will be taken first."
  echo ""
  echo "  To proceed, run:"
  echo "    $0 $CUSTOMER_ID --confirm"
  exit 0
fi

echo "Taking final backup before removal..."
/opt/tutordesk/scripts/backup.sh

echo "Stopping and removing containers for $CUSTOMER_ID..."
docker compose -f "$DEPLOY_DIR/docker-compose.yml" --env-file "$DEPLOY_DIR/.env" \
  down -v --remove-orphans || true

echo "Removing Nginx vhost..."
NGINX_CONF="/etc/nginx/sites-enabled/${CUSTOMER_ID}"
if [[ -f "$NGINX_CONF" ]]; then
  rm -f "$NGINX_CONF"
  nginx -s reload
fi
NGINX_AVAIL="/etc/nginx/sites-available/${CUSTOMER_ID}"
[[ -f "$NGINX_AVAIL" ]] && rm -f "$NGINX_AVAIL"

echo "Removing deployment directory..."
rm -rf "$DEPLOY_DIR"

echo "✓ Customer '$CUSTOMER_ID' removed."
echo "  Backups retained at: /opt/tutordesk/backups/$CUSTOMER_ID"
