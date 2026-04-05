#!/usr/bin/env bash
# ─── add-vhost.sh ─────────────────────────────────────────────────────────────
# Creates an Nginx vhost config for a customer and reloads Nginx.
# Called automatically by provision.sh.
#
# Usage:
#   ./add-vhost.sh <customer_id> <domain> <api_port> <web_port>
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

CUSTOMER_ID="${1:?Missing customer_id}"
DOMAIN="${2:?Missing domain}"
API_PORT="${3:?Missing api_port}"
WEB_PORT="${4:?Missing web_port}"

TEMPLATE="/opt/tutordesk/nginx/vhost.template"
SITES_AVAILABLE="/etc/nginx/sites-available/$CUSTOMER_ID"
SITES_ENABLED="/etc/nginx/sites-enabled/$CUSTOMER_ID"

# Generate vhost from template (simple string substitution)
sed \
  -e "s/CUSTOMER_DOMAIN/$DOMAIN/g" \
  -e "s/API_PORT/$API_PORT/g"      \
  -e "s/WEB_PORT/$WEB_PORT/g"      \
  "$TEMPLATE" > "$SITES_AVAILABLE"

# Enable the site
ln -sf "$SITES_AVAILABLE" "$SITES_ENABLED"

# Test config and reload
nginx -t
nginx -s reload

echo "Nginx vhost created for $DOMAIN (api:$API_PORT, web:$WEB_PORT)"
