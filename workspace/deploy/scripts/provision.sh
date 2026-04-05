#!/usr/bin/env bash
# ─── provision.sh ─────────────────────────────────────────────────────────────
# One-click script to deploy a fresh TutorDesk instance for a new customer.
#
# Usage:
#   ./provision.sh <customer_id> <domain> <email> [version]
#
# Example:
#   ./provision.sh school-abc school-abc.tutordesk.com admin@school-abc.com v1.0.0
#
# Requirements (run once on the VPS — see HOSTINGER_DEPLOYMENT.md):
#   - Docker + Docker Compose v2
#   - Nginx + Certbot
#   - SUPER_ADMIN_KEY set as an environment variable on the VPS
#   - DOCKER_IMAGE_API and DOCKER_IMAGE_WEB set (or edit defaults below)
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
CUSTOMER_ID="${1:?Usage: provision.sh <customer_id> <domain> <email> [version]}"
CUSTOMER_DOMAIN="${2:?Missing domain}"
EMAIL="${3:?Missing email}"
APP_VERSION="${4:-latest}"

DOCKER_IMAGE_API="${DOCKER_IMAGE_API:-yourdockerhub/tutordesk-api}"
DOCKER_IMAGE_WEB="${DOCKER_IMAGE_WEB:-yourdockerhub/tutordesk-web}"
SUPER_ADMIN_KEY="${SUPER_ADMIN_KEY:?SUPER_ADMIN_KEY env var must be set on the VPS}"

BASE_DIR="/opt/tutordesk/customers"
DEPLOY_DIR="$BASE_DIR/$CUSTOMER_ID"
TEMPLATE_DIR="/opt/tutordesk/templates"

# ── Validation ────────────────────────────────────────────────────────────────
if [[ ! "$CUSTOMER_ID" =~ ^[a-z0-9-]+$ ]]; then
  echo "ERROR: customer_id must contain only lowercase letters, numbers, and hyphens."
  exit 1
fi

if [[ -d "$DEPLOY_DIR" ]]; then
  echo "ERROR: Customer '$CUSTOMER_ID' already exists at $DEPLOY_DIR"
  echo "  To update, run: /opt/tutordesk/scripts/update.sh <version> $CUSTOMER_ID"
  exit 1
fi

echo "──────────────────────────────────────────────────────────"
echo "  Provisioning TutorDesk for: $CUSTOMER_ID"
echo "  Domain: $CUSTOMER_DOMAIN"
echo "  Version: $APP_VERSION"
echo "──────────────────────────────────────────────────────────"

# ── Find available ports ───────────────────────────────────────────────────────
find_free_port() {
  local start=$1
  local end=$2
  for port in $(shuf -i "$start-$end" -n 100); do
    if ! ss -tlnp | grep -q ":$port "; then
      echo "$port"
      return
    fi
  done
  echo "ERROR: No free port found in range $start-$end" >&2
  exit 1
}

API_PORT=$(find_free_port 8100 8999)
WEB_PORT=$(find_free_port 3100 3999)

# ── Generate secrets ──────────────────────────────────────────────────────────
DB_NAME="tutordesk_$(echo "$CUSTOMER_ID" | tr '-' '_')"
DB_USER="td_$(echo "$CUSTOMER_ID" | tr '-' '_')"
DB_PASSWORD=$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 32)
JWT_SECRET=$(openssl rand -base64 64)

# ── Create deployment directory ───────────────────────────────────────────────
mkdir -p "$DEPLOY_DIR"

# ── Write .env file ───────────────────────────────────────────────────────────
cat > "$DEPLOY_DIR/.env" << EOF
CUSTOMER_ID=$CUSTOMER_ID
CUSTOMER_DOMAIN=$CUSTOMER_DOMAIN
DOCKER_IMAGE_API=$DOCKER_IMAGE_API
DOCKER_IMAGE_WEB=$DOCKER_IMAGE_WEB
APP_VERSION=$APP_VERSION
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
JWT_SECRET=$JWT_SECRET
SUPER_ADMIN_KEY=$SUPER_ADMIN_KEY
API_PORT=$API_PORT
WEB_PORT=$WEB_PORT
BKASH_APP_KEY=
BKASH_APP_SECRET=
BKASH_USERNAME=
BKASH_PASSWORD=
EOF

chmod 600 "$DEPLOY_DIR/.env"

# ── Copy docker-compose template ──────────────────────────────────────────────
cp "$TEMPLATE_DIR/docker-compose.template.yml" "$DEPLOY_DIR/docker-compose.yml"

# ── Pull images and start the stack ──────────────────────────────────────────
echo "Pulling Docker images..."
docker compose -f "$DEPLOY_DIR/docker-compose.yml" --env-file "$DEPLOY_DIR/.env" pull

echo "Starting containers..."
docker compose -f "$DEPLOY_DIR/docker-compose.yml" --env-file "$DEPLOY_DIR/.env" up -d

# ── Configure Nginx ───────────────────────────────────────────────────────────
echo "Configuring Nginx vhost..."
/opt/tutordesk/scripts/add-vhost.sh "$CUSTOMER_ID" "$CUSTOMER_DOMAIN" "$API_PORT" "$WEB_PORT"

# ── Issue SSL certificate ─────────────────────────────────────────────────────
echo "Issuing SSL certificate for $CUSTOMER_DOMAIN..."
certbot --nginx -d "$CUSTOMER_DOMAIN" \
  --non-interactive \
  --agree-tos \
  -m "$EMAIL" \
  --redirect

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "✓ Customer '$CUSTOMER_ID' deployed successfully!"
echo "  URL:      https://$CUSTOMER_DOMAIN"
echo "  API port: $API_PORT"
echo "  Web port: $WEB_PORT"
echo "  Env file: $DEPLOY_DIR/.env"
echo ""
echo "  To view logs:   docker compose -f $DEPLOY_DIR/docker-compose.yml logs -f"
echo "  To stop:        docker compose -f $DEPLOY_DIR/docker-compose.yml stop"
echo "  To update:      /opt/tutordesk/scripts/update.sh <version> $CUSTOMER_ID"
