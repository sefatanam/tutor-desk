#!/usr/bin/env bash
# ─── setup.sh — TutorDesk Self-Hosted Setup ───────────────────────────────────
# Guides you through configuring and starting your TutorDesk instance.
# Requirements: Docker, Docker Compose v2, openssl
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "══════════════════════════════════════════════"
echo "    TutorDesk Self-Hosted Setup"
echo "══════════════════════════════════════════════"
echo ""

# Check Docker
if ! command -v docker &>/dev/null; then
  echo "ERROR: Docker is not installed. Please install Docker first."
  echo "  https://docs.docker.com/get-docker/"
  exit 1
fi

if ! docker compose version &>/dev/null; then
  echo "ERROR: Docker Compose v2 is required."
  exit 1
fi

# Copy .env.example if .env doesn't exist
ENV_FILE="$SCRIPT_DIR/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  cp "$SCRIPT_DIR/.env.example" "$ENV_FILE"
  echo "Created .env from .env.example"
fi

# Generate secrets if placeholders remain
if grep -q "CHANGE_ME" "$ENV_FILE"; then
  echo "Generating secure secrets..."
  DB_PASS=$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 32)
  JWT_SEC=$(openssl rand -base64 64)
  sed -i "s/^DB_PASSWORD=CHANGE_ME/DB_PASSWORD=$DB_PASS/" "$ENV_FILE"
  sed -i "s/^JWT_SECRET=CHANGE_ME/JWT_SECRET=$JWT_SEC/" "$ENV_FILE"
  echo "  Secrets generated and saved to .env"
fi

# Prompt for domain
source "$ENV_FILE"
if [[ "$CORS_ORIGINS" == "https://yourdomain.com" ]]; then
  echo ""
  read -rp "Enter your domain (e.g. tutordesk.yourinstitution.com): " DOMAIN
  sed -i "s|^CORS_ORIGINS=.*|CORS_ORIGINS=https://$DOMAIN|" "$ENV_FILE"
  sed -i "s|^BKASH_CALLBACK_URL=.*|BKASH_CALLBACK_URL=https://$DOMAIN/payment/callback|" "$ENV_FILE"
fi

echo ""
echo "Pulling Docker images (this may take a few minutes)..."
docker compose -f "$SCRIPT_DIR/docker-compose.yml" --env-file "$ENV_FILE" pull

echo ""
echo "Starting TutorDesk..."
docker compose -f "$SCRIPT_DIR/docker-compose.yml" --env-file "$ENV_FILE" up -d

echo ""
echo "══════════════════════════════════════════════"
echo "  TutorDesk is starting up!"
echo ""
echo "  Web:  http://localhost:${WEB_PORT:-3000}"
echo "  API:  http://localhost:${API_PORT:-8080}/api/v1/health"
echo ""
echo "  To view logs:  docker compose logs -f"
echo "  To stop:       docker compose down"
echo "  To update:     ./update.sh <version>"
echo "══════════════════════════════════════════════"
